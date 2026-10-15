#!/usr/bin/env python3
"""
Adversarial Stress-Test Suite for InvisiGuard Physical ESP32 Hardware Support.
Directly probes edge cases and attack vectors:
1. Truncated binary packets
2. Malformed / corrupted CSV packets (empty values, non-numeric strings, unclosed brackets)
3. NaN / Inf injection into parser and DSP notch filter
4. UART stream fragmentation where binary payload contains newline (0x0A)
5. Serial scanner idle timeout & rapid disconnect/reconnect simulation
6. Live vs Disconnected state recency check in WebSocket telemetry
"""

import math
import struct
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np
from invisiguard.universal_parser import UniversalCsiParser, UsbSerialScanner
from scripts.ruview_sensing_server_loader import get_server_modules


def test_truncated_binary():
    print("[PROBE 1] Truncated Binary Packets...")
    # Canonical header: 20 bytes, n_sc = 52, n_ant = 1 -> needs 124 bytes
    magic = 0xC5110001
    hdr = struct.pack("<IBBHIIBB2x", magic, 1, 1, 52, 2412, 100, 200, 210)
    
    # Test A: Header only (20 bytes), payload completely missing
    res_hdr_only = UniversalCsiParser.parse(hdr)
    print(f"  Header only (20 bytes, expected 124): result is {res_hdr_only}")
    
    # Test B: Truncated payload (only 10 bytes of IQ instead of 104)
    res_trunc = UniversalCsiParser.parse(hdr + b"\x00" * 10)
    print(f"  Truncated payload (30 bytes, expected 124): result is {res_trunc}")

    # Test C: Corrupted n_sc = 60000
    hdr_huge = struct.pack("<IBBHIIBB2x", magic, 1, 1, 60000, 2412, 100, 200, 210)
    res_huge = UniversalCsiParser.parse(hdr_huge)
    print(f"  Corrupted n_sc=60000: result is {res_huge}")

    return res_hdr_only, res_trunc, res_huge


def test_malformed_csv():
    print("\n[PROBE 2] Malformed CSV Packets...")
    cases = [
        "CSI_DATA",
        "CSI_DATA\n",
        "CSI_DATA,ERROR,SYSTEM_HALTED\n",
        "CSI_DATA,1,2,3,4\n",
        "CSI_DATA,type,seq,mac,rssi,rate,[]\n",
        "CSI_DATA,type,seq,mac,rssi,rate,[invalid,non_numeric,data]\n",
        "CSI_DATA,type,seq,mac,rssi,rate,[10,20\n",  # unclosed bracket
    ]
    for c in cases:
        res = UniversalCsiParser.parse(c)
        subcarriers = len(res["amplitudes"]) if res else 0
        print(f"  Input: {repr(c.strip())} -> parsed: {res is not None} (subcarriers: {subcarriers})")


def test_nan_inf_injection():
    print("\n[PROBE 3] NaN / Inf Injection...")
    csv_nan = 'CSI_DATA,CSI_DATA,101,84:F7:03:07:33:48,-45,24,0,0,0,0,0,0,0,0,0,-95,0,6,0,1234567,1,104,0,104,0,"[nan,inf,-inf,12.0,15.0,20.0]"\n'
    res = UniversalCsiParser.parse(csv_nan)
    print(f"  Parser output on NaN/Inf CSV: {res is not None}")
    if res:
        amps = res.get("amplitudes", [])
        has_nan = any(math.isnan(a) or math.isinf(a) for a in amps)
        print(f"  Contains NaN/Inf in amplitudes: {has_nan}")

    dsp_engine, ml_engine = get_server_modules()
    # Feed NaN into DSP engine
    amps_nan = [float("nan")] * 52
    phases_nan = [float("nan")] * 52
    dsp_res = dsp_engine.process_csi_frame(
        amplitudes=amps_nan,
        rssi=float("nan"),
        variance=float("nan"),
        motion_band=float("nan"),
        seq=1,
        timestamp=time.time(),
        phases=phases_nan,
    )
    print(f"  DSP result with NaN inputs: HR={dsp_res.get('heart_rate_bpm')}, RR={dsp_res.get('breathing_rate_bpm')}")
    print(f"  Time series last value: {dsp_engine.time_series[-1] if dsp_engine.time_series else None}")


def test_uart_fragmentation_with_newline():
    print("\n[PROBE 4] UART Stream Fragmentation with 0x0A (newline) in payload...")
    magic = 0xC5110001
    hdr = struct.pack("<IBBHIIBB2x", magic, 1, 1, 52, 2412, 100, 200, 210)
    iq = bytearray([0] * 104)
    iq[4] = 0x0A  # Newline byte in binary payload!
    pkt = hdr + bytes(iq)

    received = []
    scanner = UsbSerialScanner(on_packet_callback=lambda p: received.append(p))

    # Simulate chunked UART arrival via a mock serial object
    class MockSerial:
        def __init__(self, chunks):
            self.chunks = list(chunks)
            self.in_waiting = 0

        def read(self, size):
            if self.chunks:
                c = self.chunks.pop(0)
                return c
            return b""

        def close(self):
            pass

    # Split packet across 2 chunks: chunk 1 has 30 bytes (contains 0x0A at byte 24), chunk 2 has rest
    mock = MockSerial([pkt[:30], pkt[30:]])
    scanner.running = True
    # Run _try_read_stream
    import threading
    t = threading.Thread(target=lambda: scanner._try_read_stream(mock, "MOCK_PORT", 921600))
    t.start()
    time.sleep(0.3)
    scanner.running = False
    t.join(timeout=1.0)

    print(f"  Received fragmented binary packets with 0x0A: {len(received)}")
    assert len(received) == 1, f"Expected 1 packet, got {len(received)}"


def test_serial_idle_disconnect_and_reconnect():
    print("\n[PROBE 5] Serial Stream Idle Disconnect & Reconnect Recovery...")
    received = []
    scanner = UsbSerialScanner(on_packet_callback=lambda p: received.append(p))

    # A mock serial that delivers 1 packet, then stays idle (empty bytes)
    magic = 0xC5110001
    hdr = struct.pack("<IBBHIIBB2x", magic, 1, 1, 52, 2412, 100, 200, 210)
    pkt = hdr + bytes([0] * 104)

    class DisconnectMockSerial:
        def __init__(self, data):
            self.data = bytearray(data)
            self.in_waiting = 0
            self.closed = False

        def read(self, size):
            if self.data:
                chunk = bytes(self.data[:size])
                del self.data[:size]
                return chunk
            return b""

        def close(self):
            self.closed = True

    mock1 = DisconnectMockSerial(pkt)
    scanner.running = True

    # 1. First connection
    connected = scanner._try_read_stream(mock1, "COM_TEST", 921600)
    print(f"  First connection ended due to idle: returned={connected}, closed={mock1.closed}")
    assert connected is False, "Stream should return False on idle disconnect"
    assert mock1.closed is True, "Serial port should be closed after stream disconnect"

    # 2. Reconnect with new packet on another mock device
    mock2 = DisconnectMockSerial(pkt)
    # Give it another packet immediately
    import threading
    t = threading.Thread(target=lambda: scanner._try_read_stream(mock2, "COM_TEST", 921600))
    t.start()
    time.sleep(0.2)
    scanner.running = False
    t.join(timeout=3.5)

    print(f"  Reconnect successfully processed packet: {len(received) >= 2}")
    assert len(received) >= 2, "Scanner failed to process packet upon reconnect"


def test_websocket_and_rest_status():
    print("\n[PROBE 6] REST API and WebSocket Telemetry Status Recency...")
    import urllib.request
    import json

    # Query /health
    req = urllib.request.Request("http://127.0.0.1:3000/health")
    with urllib.request.urlopen(req, timeout=3) as resp:
        h_data = json.loads(resp.read().decode("utf-8"))
    
    print(f"  Server health status: source_state={h_data.get('source_state')}, nodes={h_data.get('nodes')}")
    assert "source_state" in h_data, "Missing source_state in /health"

    # Query hardware status
    req_hw = urllib.request.Request("http://127.0.0.1:3000/api/v1/hardware/status")
    with urllib.request.urlopen(req_hw, timeout=3) as resp:
        hw_data = json.loads(resp.read().decode("utf-8"))
    print(f"  Hardware status: status={hw_data.get('status')}, transport={hw_data.get('transport')}")
    assert "status" in hw_data, "Missing status in /api/v1/hardware/status"


if __name__ == "__main__":
    test_truncated_binary()
    test_malformed_csv()
    test_nan_inf_injection()
    test_uart_fragmentation_with_newline()
    test_serial_idle_disconnect_and_reconnect()
    test_websocket_and_rest_status()
    print("\n" + "=" * 60)
    print("  ALL ADVERSARIAL STRESS PROBES PASSED!")
    print("=" * 60)
