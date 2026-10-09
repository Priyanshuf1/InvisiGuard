#!/usr/bin/env python3
"""
Test suite for RuView Sensing Server.
Verifies all REST endpoints, WebSocket streams, and UDP 5005 ingestion.
"""
import asyncio
import json
import socket
import struct
import sys
import time
import urllib.request
import websockets

def test_http_endpoint(url: str, expected_key: str = None):
    print(f"[TEST] Checking HTTP GET {url}...", end=" ")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TestClient/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            content = resp.read()
            if status != 200:
                print(f"FAILED (status {status})")
                return False, None
            
            ct = resp.headers.get("Content-Type", "")
            if "application/json" in ct:
                data = json.loads(content.decode("utf-8"))
                if expected_key and expected_key not in data:
                    print(f"FAILED (missing key {expected_key})")
                    return False, data
                print(f"PASSED (HTTP 200, JSON valid)")
                return True, data
            else:
                print(f"PASSED (HTTP 200, {len(content)} bytes)")
                return True, content.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"FAILED ({e})")
        return False, None


async def test_websocket(url: str, expected_type: str = None):
    print(f"[TEST] Checking WebSocket {url}...", end=" ", flush=True)
    try:
        async with websockets.connect(url, open_timeout=5, close_timeout=5) as ws:
            msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(msg)
            if expected_type:
                msg_type = data.get("type")
                if msg_type != expected_type:
                    print(f"FAILED (expected type {expected_type}, got {msg_type})")
                    return False, data
            print(f"PASSED (received payload type='{data.get('type')}')")
            return True, data
    except Exception as e:
        print(f"FAILED ({e})")
        return False, None


def send_adr018_udp(host="127.0.0.1", port=5005, seq=1001, node_id=1, n_sc=52):
    # ADR-018 header format: <IBBHIIBB2x
    # magic=0xC5110001, node_id=1, n_ant=1, n_sc=52, freq=5210, seq=seq, rssi=-42, noise=-95
    magic = 0xC5110001
    n_ant = 1
    freq_mhz = 5210
    rssi_u8 = (-42) & 0xFF
    noise_u8 = (-95) & 0xFF
    header = struct.pack("<IBBHIIBB2x", magic, node_id, n_ant, n_sc, freq_mhz, seq, rssi_u8, noise_u8)
    
    # 52 subcarriers * 1 antenna * 2 bytes (I, Q)
    iq = bytearray()
    for k in range(n_sc):
        iq.extend(struct.pack("<bb", 15, 20))
    
    payload = header + bytes(iq)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.sendto(payload, (host, port))
    sock.close()


def send_c6_feature_udp(host="127.0.0.1", port=5005, seq=2001, node_id=1):
    # ADR-081 C6 feature packet: <IBBHQffffffffHHI
    # magic=0xC5110006
    magic = 0xC5110006
    pad = 0
    ts_us = int(time.time() * 1_000_000)
    # motion=0.45, presence=0.85, resp=16.5, resp_c=0.9, hb=74.0, hb_c=0.88, anom=0.1, env=0.05, coh=0.95
    payload = struct.pack(
        "<IBBHQfffffffffHHI",
        magic, node_id, 1, seq, ts_us,
        0.45, 0.85, 16.5, 0.9, 74.0, 0.88, 0.1, 0.05, 0.95,
        52, 1, 0
    )
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.sendto(payload, (host, port))
    sock.close()


def send_adr039_vitals_udp(host="127.0.0.1", port=5005, seq=3001, node_id=1):
    # ADR-039 vitals packet: <IBBHIbBxxffII (32 bytes)
    magic = 0xC5110002
    flags = 0
    br_raw = 1600  # 16.0 BPM
    hr_raw = 720000  # 72.0 BPM
    rssi = -48
    n_persons = 1
    motion = 0.12
    presence = 0.90
    ts_ms = int(time.time() * 1000) & 0xFFFFFFFF
    payload = struct.pack("<IBBHIbBxxffII", magic, node_id, flags, br_raw, hr_raw, rssi, n_persons, motion, presence, ts_ms, 0)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.sendto(payload, (host, port))
    sock.close()


async def main():
    print("=" * 60)
    print("  RUNNING COMPREHENSIVE RUVIEW SERVER VERIFICATION SUITE")
    print("=" * 60)
    all_passed = True

    # 1. UI Root
    ok, content = test_http_endpoint("http://localhost:3000/")
    if not (ok and ("WiFi DensePose" in content or "RuView" in content)):
        all_passed = False
        print("  [ERROR] UI HTML does not contain 'WiFi DensePose' or 'RuView'")

    # 2. Health Endpoints
    ok, d = test_http_endpoint("http://localhost:3000/health/live", "alive")
    if not ok: all_passed = False
    
    ok, d = test_http_endpoint("http://localhost:3000/health/ready", "ready")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/health", "identity_risk_score")
    if not ok or d.get("identity_risk_score") is not None:
        all_passed = False
        print("  [ERROR] ADR-125 invariant violated: identity_risk_score is not None")

    # 3. REST API Status & Telemetry
    ok, status_before = test_http_endpoint("http://localhost:3000/api/v1/status", "status")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/sensing/latest", "presence")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/vital-signs", "breathing_bpm")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/pose/current", "keypoints")
    if not ok or "total_persons" not in d or "persons" not in d or d.get("pose_source") != "signal_derived":
        all_passed = False
        print("  [ERROR] /api/v1/pose/current missing total_persons, persons, or pose_source != signal_derived")

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/pose/stats", "time_window_hours")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/pose/zones/summary", "zones")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/models", "models")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/models/lora/profiles", "profiles")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/oauth/status", "signed_in")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/stream/clients", "clients")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/icons/icon-192.png")
    if not ok: all_passed = False

    ok, d = test_http_endpoint("http://localhost:3000/api/v1/train/status", "status")
    if not ok: all_passed = False

    # 4. WebSockets
    ok, d = await test_websocket("ws://localhost:3000/ws/sensing", "sensing_update")
    if not ok: all_passed = False

    # Check WebSocket Ping-Pong on ws://localhost:3000/ws/sensing
    print("[TEST] Checking WebSocket Ping/Pong protocol...", end=" ", flush=True)
    try:
        async with websockets.connect("ws://localhost:3000/ws/sensing", open_timeout=5, close_timeout=5) as ws:
            _ = await asyncio.wait_for(ws.recv(), timeout=5.0)  # Initial frame
            await ws.send(json.dumps({"type": "ping", "timestamp": 12345, "connectionId": "test-c1"}))
            pong_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            pong_data = json.loads(pong_msg)
            # Either next broadcast or pong response
            if pong_data.get("type") != "pong":
                pong_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                pong_data = json.loads(pong_msg)
            assert pong_data.get("type") == "pong", f"Expected pong, got {pong_data.get('type')}"
            print("PASSED (server responded with valid pong)")
    except Exception as e:
        print(f"FAILED ({e})")
        all_passed = False

    # Check /api/v1/stream/pose: initial connection_established + subsequent pose_data
    print("[TEST] Checking WebSocket ws://localhost:3000/api/v1/stream/pose deep stream...", end=" ", flush=True)
    try:
        async with websockets.connect("ws://localhost:3000/api/v1/stream/pose", open_timeout=5, close_timeout=5) as ws:
            m1 = await asyncio.wait_for(ws.recv(), timeout=5.0)
            d1 = json.loads(m1)
            assert d1.get("type") == "connection_established", f"Expected connection_established, got {d1.get('type')}"
            m2 = await asyncio.wait_for(ws.recv(), timeout=5.0)
            d2 = json.loads(m2)
            assert d2.get("type") == "pose_data", f"Expected pose_data, got {d2.get('type')}"
            assert d2.get("pose_source") == "signal_derived", f"Expected pose_source=signal_derived, got {d2.get('pose_source')}"
            assert "data" in d2 and "pose" in d2["data"], "Missing data.pose envelope required by UI pose service"
            assert d2["data"].get("pose_source") == "signal_derived", "Missing data.pose_source required by UI"
            assert len(d2["data"]["pose"]["persons"]) > 0, "Expected at least 1 person in data.pose.persons"
            kp = d2["data"]["pose"]["persons"][0]["keypoints"][0]
            assert 0.0 <= kp["x"] <= 1.0 and 0.0 <= kp["y"] <= 1.0, f"Keypoint out of [0, 1] range: {kp}"
            print("PASSED (received valid pose_data with normalized COCO keypoints and pose_source=signal_derived)")
    except Exception as e:
        print(f"FAILED ({e})")
        all_passed = False

    ok, d = await test_websocket("ws://localhost:3001/ws/sensing", "sensing_update")
    if not ok: all_passed = False

    ok, d = await test_websocket("ws://localhost:8765/ws/sensing", "sensing_update")
    if not ok: all_passed = False

    # Concurrency test: multiple simultaneous connections
    print("[TEST] Checking multi-client concurrent WebSocket streaming (5 clients)...", end=" ", flush=True)
    try:
        async def client_worker(worker_id):
            async with websockets.connect("ws://localhost:3000/ws/sensing", open_timeout=5, close_timeout=5) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                d = json.loads(msg)
                assert d.get("type") == "sensing_update"
                return True

        results = await asyncio.gather(*(client_worker(i) for i in range(5)))
        assert all(results)
        print("PASSED (all 5 clients streamed concurrently)")
    except Exception as e:
        print(f"FAILED ({e})")
        all_passed = False

    # 5. UDP CSI Datagram Injection on Port 5005
    print("[TEST] Sending ADR-018 CSI packet to UDP 127.0.0.1:5005...")
    send_adr018_udp(seq=5555)
    print("[TEST] Sending ADR-039 vitals packet to UDP 127.0.0.1:5005...")
    send_adr039_vitals_udp(seq=5556)
    print("[TEST] Sending ADR-081 C6 feature packet to UDP 127.0.0.1:5005...")
    send_c6_feature_udp(seq=5557)
    
    await asyncio.sleep(0.5)

    ok, status_after = test_http_endpoint("http://localhost:3000/api/v1/status", "packets_received")
    if ok:
        pkts_before = status_before.get("packets_received", 0)
        pkts_after = status_after.get("packets_received", 0)
        print(f"[TEST] UDP packets received before: {pkts_before}, after: {pkts_after}")
        if pkts_after >= pkts_before + 3:
            print("  PASSED: All 3 UDP packet types ingested successfully on port 5005!")
        elif pkts_after > pkts_before:
            print("  PASSED: UDP packets ingested successfully on port 5005!")
        else:
            print("  FAILED: Packet count did not increase!")
            all_passed = False
    else:
        all_passed = False

    print("=" * 60)
    if all_passed:
        print("  OVERALL VERDICT: ALL TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)
        sys.exit(0)
    else:
        print("  OVERALL VERDICT: ONE OR MORE TESTS FAILED!")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
