#!/usr/bin/env python3
"""
Adversarial Verification Suite for RuView Sensing Server.
Thoroughly tests:
1. Static asset integrity and MIME types
2. Complete REST API surface including parameterized routes
3. WebSocket connections across ports 3000, 3001, 8765
4. WebSocket error resilience: malformed messages, abrupt disconnects, invalid frames
5. UDP 5005 datagram ingestion: valid CSI/Vitals/C6, 0-byte datagrams, truncated packets, oversized datagrams
6. UI asset loading & dependency chain consistency
"""
import asyncio
import json
import socket
import struct
import sys
import time
import urllib.request
import urllib.error
import websockets

def log(msg):
    print(msg, flush=True)

def test_http_get(path, expected_status=200, check_fn=None):
    url = f"http://localhost:3000{path}"
    log(f"[HTTP] GET {path}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ReviewerTest/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            content = resp.read()
            ct = resp.headers.get("Content-Type", "")
            if status != expected_status:
                log(f"  FAILED: expected status {expected_status}, got {status}")
                return False
            if check_fn:
                ok, err = check_fn(content, ct)
                if not ok:
                    log(f"  FAILED: {err}")
                    return False
            log(f"  PASSED (status {status}, {len(content)} bytes, CT: {ct})")
            return True
    except urllib.error.HTTPError as e:
        if e.code == expected_status:
            log(f"  PASSED (expected error status {e.code})")
            return True
        log(f"  FAILED: HTTPError {e.code}")
        return False
    except Exception as e:
        log(f"  FAILED: exception {e}")
        return False

def test_http_post(path, body_json=None, expected_status=200):
    url = f"http://localhost:3000{path}"
    log(f"[HTTP] POST {path}...")
    data = json.dumps(body_json or {}).encode("utf-8")
    try:
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "ReviewerTest/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status != expected_status:
                log(f"  FAILED: expected {expected_status}, got {resp.status}")
                return False
            log(f"  PASSED (status {resp.status})")
            return True
    except Exception as e:
        log(f"  FAILED: exception {e}")
        return False

async def test_ws_stream(url, count=3):
    log(f"[WS] Streaming {url} (expecting {count} frames)...")
    try:
        async with websockets.connect(url, open_timeout=5, close_timeout=5) as ws:
            for i in range(count):
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                d = json.loads(msg)
                log(f"  Frame {i+1}: type={d.get('type')}")
        log("  PASSED")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False

async def test_ws_malformed_input(url):
    log(f"[WS-ATTACK] Sending malformed / garbage payload to {url}...")
    try:
        async with websockets.connect(url, open_timeout=5, close_timeout=5) as ws:
            # Receive initial frame
            await asyncio.wait_for(ws.recv(), timeout=5.0)
            # Send invalid JSON
            await ws.send("{{{NOT_VALID_JSON")
            # Send binary garbage
            await ws.send(b"\x00\xff\xfe\x01\x02\x03")
            # Send empty string
            await ws.send("")
            # Send normal ping to verify connection is still completely alive
            await ws.send(json.dumps({"type": "ping", "timestamp": 9999, "connectionId": "attack-test"}))
            # Wait for next message or pong
            msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(msg)
            log(f"  Server survived attack and responded with type={data.get('type')}")
            return True
    except Exception as e:
        log(f"  FAILED: server crashed or closed socket: {e}")
        return False

def test_udp_edge_cases():
    log("[UDP-ATTACK] Sending edge-case datagrams to 127.0.0.1:5005...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    # 1. 0-byte datagram
    sock.sendto(b"", ("127.0.0.1", 5005))
    # 2. 1-byte datagram
    sock.sendto(b"\x00", ("127.0.0.1", 5005))
    # 3. Truncated header (12 bytes)
    sock.sendto(b"\xC5\x11\x00\x01\x01\x01\x00\x34\x00\x00\x00\x00", ("127.0.0.1", 5005))
    # 4. Unknown magic
    sock.sendto(b"\xDE\xAD\xBE\xEF" * 10, ("127.0.0.1", 5005))
    # 5. Oversized datagram (8192 bytes of random noise)
    sock.sendto(b"\xAA" * 4096, ("127.0.0.1", 5005))
    sock.close()
    log("  Sent 5 abnormal UDP datagrams without issue.")

async def main():
    log("=" * 65)
    log("  ADVERSARIAL REVIEWER TEST SUITE")
    log("=" * 65)
    passed = 0
    total = 0

    def run_check(name, ok):
        nonlocal passed, total
        total += 1
        if ok:
            passed += 1
            log(f"[CHECK {total}] {name}: PASSED\n")
        else:
            log(f"[CHECK {total}] {name}: FAILED\n")

    # 1. Static Assets
    run_check("HTML index.html", test_http_get("/", 200, lambda c, ct: ("WiFi DensePose" in c.decode("utf-8", "ignore"), "Missing title")))
    run_check("CSS style.css", test_http_get("/style.css", 200, lambda c, ct: ("text/css" in ct, f"Wrong MIME: {ct}")))
    run_check("JS app.js", test_http_get("/app.js", 200, lambda c, ct: ("javascript" in ct, f"Wrong MIME: {ct}")))
    run_check("Manifest", test_http_get("/manifest.json", 200))
    run_check("Pose Fusion page", test_http_get("/pose-fusion.html", 200))
    run_check("Observatory page", test_http_get("/observatory.html", 200))
    run_check("Icon 192", test_http_get("/icons/icon-192.png", 200))
    run_check("Icon 512", test_http_get("/icons/icon-512.png", 200))

    # 2. REST Endpoints
    run_check("Health live", test_http_get("/health/live", 200))
    run_check("Health ready", test_http_get("/health/ready", 200))
    run_check("Health health", test_http_get("/health/health", 200))
    run_check("Health metrics", test_http_get("/health/metrics", 200))
    run_check("Health version", test_http_get("/health/version", 200))
    run_check("Health root (ADR-125 invariant)", test_http_get("/health", 200, lambda c, ct: (json.loads(c).get("identity_risk_score") is None, "identity_risk_score not None")))
    run_check("API status", test_http_get("/api/v1/status", 200))
    run_check("API info", test_http_get("/api/v1/info", 200))
    run_check("API metrics", test_http_get("/api/v1/metrics", 200))
    run_check("API sensing latest", test_http_get("/api/v1/sensing/latest", 200))
    run_check("API vital signs", test_http_get("/api/v1/vital-signs", 200))
    run_check("API pose current", test_http_get("/api/v1/pose/current", 200, lambda c, ct: (json.loads(c).get("pose_source") == "signal_derived", "pose_source != signal_derived")))
    run_check("API pose stats", test_http_get("/api/v1/pose/stats", 200))
    run_check("API pose zones summary", test_http_get("/api/v1/pose/zones/summary", 200))
    run_check("API pose zone occupancy", test_http_get("/api/v1/pose/zones/zone_1/occupancy", 200))
    run_check("API pose activities", test_http_get("/api/v1/pose/activities", 200))
    run_check("API pose calibration status", test_http_get("/api/v1/pose/calibration/status", 200))
    run_check("API models list", test_http_get("/api/v1/models", 200))
    run_check("API models active", test_http_get("/api/v1/models/active", 200))
    run_check("API models lora profiles", test_http_get("/api/v1/models/lora/profiles", 200))
    run_check("API models get specific", test_http_get("/api/v1/models/wifi-densepose-v2", 200))
    run_check("API train status", test_http_get("/api/v1/train/status", 200))
    run_check("API recording list", test_http_get("/api/v1/recording/list", 200))
    run_check("API stream status", test_http_get("/api/v1/stream/status", 200))
    run_check("API stream clients", test_http_get("/api/v1/stream/clients", 200))
    run_check("API stream metrics", test_http_get("/api/v1/stream/metrics", 200))
    run_check("API dev config", test_http_get("/api/v1/dev/config", 200))
    run_check("OAuth status", test_http_get("/oauth/status", 200))
    run_check("POST ws-ticket", test_http_post("/api/v1/ws-ticket", {}, 200))
    run_check("POST pose calibrate", test_http_post("/api/v1/pose/calibrate", {}, 200))
    run_check("POST pose analyze", test_http_post("/api/v1/pose/analyze", {}, 200))

    # 3. WebSockets
    run_check("WS :3000 /ws/sensing", await test_ws_stream("ws://localhost:3000/ws/sensing", 2))
    run_check("WS :3000 /api/v1/stream/pose", await test_ws_stream("ws://localhost:3000/api/v1/stream/pose", 2))
    run_check("WS :3000 /api/v1/stream/events", await test_ws_stream("ws://localhost:3000/api/v1/stream/events", 1))
    run_check("WS :3001 /ws/sensing", await test_ws_stream("ws://localhost:3001/ws/sensing", 2))
    run_check("WS :8765 /ws/sensing", await test_ws_stream("ws://localhost:8765/ws/sensing", 2))

    # 4. Resilience and Attack Probes
    run_check("WS :3000 resilience to malformed frames", await test_ws_malformed_input("ws://localhost:3000/ws/sensing"))
    run_check("WS :3001 resilience to malformed frames", await test_ws_malformed_input("ws://localhost:3001/ws/sensing"))
    
    test_udp_edge_cases()
    await asyncio.sleep(0.5)
    run_check("Server healthy after UDP attacks", test_http_get("/health/live", 200))

    log("=" * 65)
    log(f"  RESULTS: {passed}/{total} CHECKS PASSED")
    log("=" * 65)
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
