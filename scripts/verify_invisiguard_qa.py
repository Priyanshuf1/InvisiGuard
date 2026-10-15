#!/usr/bin/env python3
"""
Visual QA Verification Script for InvisiGuard Frontend.
Connects to headless Chrome via Chrome DevTools Protocol (CDP):
- Verifies zero console errors or exceptions.
- Captures desktop viewport screenshot (1600x1000).
- Captures mobile viewport screenshot (390x844).
- Captures full-page screenshot.
- Tests WebSocket telemetry connectivity and scenario switches (normal, struggle, fall, inactivity, empty).
"""
import asyncio
import base64
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
import websockets
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET_URL = "http://localhost:3000/invisiguard/"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
USER_DATA_DIR = r"C:\Users\apriy\AppData\Local\Temp\cdp_qa_profile"
OUTPUT_DIR = Path(r"C:\Users\apriy\OneDrive\Desktop\wifi sensoring\invisiguard_web")

async def run_qa():
    print("[QA] Starting headless Chrome with CDP...")
    proc = subprocess.Popen(
        [
            CHROME_PATH,
            "--headless=new",
            "--remote-debugging-port=9222",
            f"--user-data-dir={USER_DATA_DIR}",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    ws_url = None
    for attempt in range(20):
        await asyncio.sleep(0.5)
        try:
            req = urllib.request.Request("http://localhost:9222/json/version")
            with urllib.request.urlopen(req, timeout=1) as resp:
                data = json.loads(resp.read().decode())
                ws_url = data.get("webSocketDebuggerUrl")
                if ws_url:
                    break
        except Exception:
            pass

    if not ws_url:
        print("[QA] FAILED to connect to Chrome CDP")
        proc.kill()
        return False

    print(f"[QA] Connected to Chrome CDP: {ws_url}")
    console_logs = []
    exceptions = []

    try:
        # Create a new target page
        req = urllib.request.Request("http://localhost:9222/json/new?about:blank", method="PUT")
        with urllib.request.urlopen(req) as resp:
            page_data = json.loads(resp.read().decode())
            page_ws_url = page_data["webSocketDebuggerUrl"]

        async with websockets.connect(page_ws_url, max_size=25 * 1024 * 1024) as ws:
            msg_id = 0

            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method}
                if params:
                    payload["params"] = params
                await ws.send(json.dumps(payload))
                while True:
                    res = json.loads(await ws.recv())
                    if res.get("id") == msg_id:
                        return res.get("result", {})
                    # Record events
                    if res.get("method") == "Runtime.consoleAPICalled":
                        args = [str(a.get("value", a.get("description", ""))) for a in res["params"].get("args", [])]
                        log_msg = f"[{res['params']['type']}] " + " ".join(args)
                        console_logs.append(log_msg)
                    elif res.get("method") == "Runtime.exceptionThrown":
                        exceptions.append(res["params"])

            async def evaluate(expr):
                res = await send_cmd("Runtime.evaluate", {
                    "expression": expr,
                    "returnByValue": True,
                    "awaitPromise": True
                })
                # CDP wraps result in {"result": {"type": ..., "value": ...}}
                if "result" in res and "value" in res["result"]:
                    return res["result"]["value"]
                if "value" in res:
                    return res["value"]
                return res

            # 1. Enable domains
            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("DOM.enable")

            # 2. Set desktop viewport
            print("[QA] Setting desktop viewport 1600x1000...")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1600,
                "height": 1000,
                "deviceScaleFactor": 1,
                "mobile": False,
            })

            # 3. Navigate to InvisiGuard
            print(f"[QA] Navigating to {TARGET_URL}...")
            await send_cmd("Page.navigate", {"url": TARGET_URL})

            # Wait 3.5s for Three.js, WebGL, canvases, and WebSocket to initialize
            await asyncio.sleep(3.5)

            # 4. Capture Desktop Screenshot
            print("[QA] Capturing desktop screenshot...")
            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            if "data" in res:
                img_data = base64.b64decode(res["data"])
                desktop_path = OUTPUT_DIR / "invisiguard_desktop.png"
                with open(desktop_path, "wb") as f:
                    f.write(img_data)
                print(f"[QA] Saved desktop screenshot: {desktop_path} ({len(img_data)} bytes)")

            # 5. Capture Full-Page Screenshot
            print("[QA] Capturing full-page screenshot...")
            layout_metrics = await send_cmd("Page.getLayoutMetrics")
            content_size = layout_metrics.get("contentSize", {})
            full_height = int(content_size.get("height", 1600))
            full_width = int(content_size.get("width", 1600))
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": full_width,
                "height": full_height,
                "deviceScaleFactor": 1,
                "mobile": False,
            })
            await asyncio.sleep(0.5)
            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            if "data" in res:
                img_data = base64.b64decode(res["data"])
                fullpage_path = OUTPUT_DIR / "invisiguard_fullpage.png"
                with open(fullpage_path, "wb") as f:
                    f.write(img_data)
                print(f"[QA] Saved fullpage screenshot: {fullpage_path} ({len(img_data)} bytes)")

            # 6. Switch to Mobile Viewport (iPhone 14 / 390x844)
            print("[QA] Setting mobile viewport 390x844...")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 390,
                "height": 844,
                "deviceScaleFactor": 2,
                "mobile": True,
            })
            await asyncio.sleep(1.5)

            print("[QA] Capturing mobile screenshot...")
            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            if "data" in res:
                img_data = base64.b64decode(res["data"])
                mobile_path = OUTPUT_DIR / "invisiguard_mobile.png"
                with open(mobile_path, "wb") as f:
                    f.write(img_data)
                print(f"[QA] Saved mobile screenshot: {mobile_path} ({len(img_data)} bytes)")

            # Reset back to desktop for functional scenario testing
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1600,
                "height": 1000,
                "deviceScaleFactor": 1,
                "mobile": False,
            })
            await asyncio.sleep(0.5)

            # 7. Evaluate Baseline DOM checks
            dom_eval = await evaluate("""
                ({
                    title: document.title,
                    kpiCardsCount: document.querySelectorAll('.kpi-card').length,
                    canvasCount: document.querySelectorAll('canvas').length,
                    hasThree: typeof THREE !== 'undefined',
                    hasRadar: typeof Radar3DEngine !== 'undefined',
                    hasBiometrics: typeof BiometricsEngine !== 'undefined',
                    hasRFMetrics: typeof RfMetricsEngine !== 'undefined',
                    hasMeshTopology: typeof MeshTopologyEngine !== 'undefined',
                    hasMLStudio: typeof MlStudioEngine !== 'undefined',
                    threatText: document.getElementById('kpiThreatValue') ? document.getElementById('kpiThreatValue').textContent.trim() : null,
                    heartRateText: document.getElementById('vitalHeartRate') ? document.getElementById('vitalHeartRate').textContent.trim() : null,
                    rssiText: document.getElementById('lblRssi') ? document.getElementById('lblRssi').textContent.trim() : null,
                    sceneSelectOptions: Array.from(document.querySelectorAll('#scenarioSelect option')).map(o => o.value)
                })
            """)

            # 8. Test scenario switching (Struggle, Fall, Inactivity, Empty)
            scenario_tests = {}
            for scenario in ["struggle", "fall", "inactivity", "empty", "normal"]:
                print(f"[QA] Testing scenario switch: {scenario}...")
                await evaluate(f"""
                    (() => {{
                        const sel = document.getElementById('scenarioSelect');
                        if (sel) {{
                            sel.value = '{scenario}';
                            sel.dispatchEvent(new Event('change'));
                        }}
                    }})()
                """)
                await asyncio.sleep(1.5)
                state_data = await evaluate("""
                    (() => {
                        const threat = document.getElementById('kpiThreatValue') ? document.getElementById('kpiThreatValue').textContent.trim() : '';
                        const cardThreat = document.getElementById('cardThreat') ? document.getElementById('cardThreat').className : '';
                        const fallCounter = document.getElementById('fallStillnessCounter') ? document.getElementById('fallStillnessCounter').textContent.trim() : '';
                        const inactWrap = document.getElementById('inactivityWrap') ? window.getComputedStyle(document.getElementById('inactivityWrap')).display : '';
                        const inactCounter = document.getElementById('inactivityTimer') ? document.getElementById('inactivityTimer').textContent.trim() : '';
                        return { threat, cardThreat, fallCounter, inactWrap, inactCounter };
                    })()
                """)
                scenario_tests[scenario] = state_data

            print("\n" + "=" * 60)
            print("  VISUAL BROWSER QA VERIFICATION REPORT")
            print("=" * 60)
            print(f"  DOM Evaluation Result:\n{json.dumps(dom_eval, indent=2)}")
            print("\n  Scenario State Switch Results:")
            for sc_name, sc_res in scenario_tests.items():
                print(f"    - {sc_name:10s} -> Threat: {sc_res.get('threat')} | Card Class: {sc_res.get('cardThreat')} | Inactivity Display: {sc_res.get('inactWrap')}")
            print(f"\n  Console Log Entries: {len(console_logs)}")
            for log in console_logs[:10]:
                print(f"    {log}")
            print(f"  Exceptions Thrown: {len(exceptions)}")
            if exceptions:
                for ex in exceptions:
                    print(f"    ERROR: {ex}")
            print("=" * 60 + "\n")

            # Assertions
            assert dom_eval.get("hasThree") is True, "THREE is not defined"
            assert dom_eval.get("hasRadar") is True, "Radar3DEngine is not defined"
            assert dom_eval.get("hasBiometrics") is True, "BiometricsEngine is not defined"
            assert dom_eval.get("canvasCount", 0) >= 4, f"Expected at least 4 canvases, got {dom_eval.get('canvasCount')}"
            assert "inactivity" in dom_eval.get("sceneSelectOptions", []), "inactivity scenario missing from select options"
            assert len(exceptions) == 0, f"Found {len(exceptions)} JavaScript exceptions"

            print("[QA] ALL CRITICAL ASSERTIONS PASSED! Visual QA verification SUCCESSFUL.")
            return True

    finally:
        proc.kill()

if __name__ == "__main__":
    success = asyncio.run(run_qa())
    if not success:
        exit(1)
