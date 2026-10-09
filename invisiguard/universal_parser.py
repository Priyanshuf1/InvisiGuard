"""
InvisiGuard Universal CSI Parser and USB Serial COM Auto-Scanner.
Supports:
- Canonical ADR-018 binary frames (0xC5110001)
- Standard Espressif esp-csi / Arduino serial CSV lines (CSI_DATA,...)
- ADR-039 vitals packets (0xC5110002)
- ADR-081 C6 feature packets (0xC5110006)
- USB Serial auto-scanning via pyserial at 115200 and 921600 baud
"""

import collections
import logging
import math
import re
import struct
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import numpy as np

logger = logging.getLogger("invisiguard.hardware")


class UniversalCsiParser:
    """Universal parser for WiFi CSI hardware packets (binary ADR-018 and text CSI_DATA CSV)."""

    MAGIC_RAW_CSI = 0xC5110001
    MAGIC_VITALS = 0xC5110002
    MAGIC_FEATURES = 0xC5110003
    MAGIC_C6_FEAT = 0xC5110006
    HEADER_SIZE = 20

    @classmethod
    def detect_format(cls, data: Union[bytes, str]) -> str:
        """Detect the protocol format of incoming raw bytes or text."""
        if isinstance(data, (bytes, bytearray)):
            if len(data) >= 4:
                magic = struct.unpack_from("<I", data, 0)[0]
                if magic == cls.MAGIC_RAW_CSI:
                    return "adr018_binary"
                elif magic == cls.MAGIC_VITALS:
                    return "adr039_vitals"
                elif magic == cls.MAGIC_C6_FEAT:
                    return "adr081_c6"
            try:
                text = data.decode("utf-8", errors="ignore")
                if "CSI_DATA" in text:
                    return "esp_csi_csv"
            except Exception:
                pass
        elif isinstance(data, str):
            if "CSI_DATA" in data:
                return "esp_csi_csv"
        return "unknown"

    @classmethod
    def parse(cls, data: Union[bytes, str], source_addr: str = "") -> Optional[Dict[str, Any]]:
        """
        Universal entrypoint: decodes both ADR-018 binary and text CSI_DATA CSV into
        normalized amplitude vectors, phase arrays, and RF telemetry.
        """
        if isinstance(data, (bytes, bytearray)):
            # Check binary magic first
            if len(data) >= 4:
                magic = struct.unpack_from("<I", data, 0)[0]
                if magic == cls.MAGIC_RAW_CSI:
                    return cls._parse_adr018_binary(data, source_addr)
                elif magic == cls.MAGIC_VITALS:
                    return cls._parse_adr039_vitals(data, source_addr)
                elif magic == cls.MAGIC_C6_FEAT:
                    return cls._parse_adr081_c6(data, source_addr)

            # Try decoding as text CSV
            try:
                text = data.decode("utf-8", errors="ignore")
                if "CSI_DATA" in text:
                    return cls._parse_csi_csv(text, source_addr)
            except Exception as e:
                logger.debug("Failed text decode for bytes: %s", e)
                return None

        elif isinstance(data, str):
            if "CSI_DATA" in data:
                return cls._parse_csi_csv(data, source_addr)

        return None

    @classmethod
    def _parse_adr018_binary(cls, raw: bytes, source_addr: str = "") -> Optional[Dict[str, Any]]:
        """Parses canonical ADR-018 raw CSI binary frame (<IBBHIIBB2x or synth-csi-udp)."""
        if len(raw) < cls.HEADER_SIZE:
            return None
        try:
            magic, node_id, n_ant, n_sc = struct.unpack_from("<IBBH", raw, 0)
            if magic != cls.MAGIC_RAW_CSI:
                return None

            # Detect synth-csi-udp format vs canonical ADR-018 / ADR-110 hardware format
            if len(raw) >= 20 and raw[16:20] == b"\x00\x00\x00\x00" and raw[14] != 0:
                freq_mhz = struct.unpack_from("<H", raw, 8)[0]
                seq = struct.unpack_from("<I", raw, 10)[0]
                rssi = struct.unpack_from("<b", raw, 14)[0]
                noise = struct.unpack_from("<b", raw, 15)[0]
            else:
                freq_mhz, seq = struct.unpack_from("<II", raw, 8)
                rssi_u8, noise_u8 = struct.unpack_from("<BB", raw, 16)
                rssi = rssi_u8 if rssi_u8 < 128 else rssi_u8 - 256
                noise = noise_u8 if noise_u8 < 128 else noise_u8 - 256

            if n_sc < 4 or n_sc > 512 or n_ant < 1 or n_ant > 4:
                return None

            iq_count = n_ant * n_sc
            iq_bytes_needed = cls.HEADER_SIZE + iq_count * 2

            if len(raw) < iq_bytes_needed:
                # Reject truncated / incomplete binary datagram
                return None

            iq_raw = struct.unpack_from(f"<{iq_count * 2}b", raw, cls.HEADER_SIZE)
            i_vals = np.array(iq_raw[0::2], dtype=np.float64)
            q_vals = np.array(iq_raw[1::2], dtype=np.float64)
            amplitudes = np.sqrt(i_vals**2 + q_vals**2)
            if not np.all(np.isfinite(amplitudes)):
                return None
            phase_rad = np.arctan2(q_vals, i_vals)
            amps = amplitudes.tolist()
            phases = phase_rad.tolist()

            max_a = float(np.max(amplitudes)) if len(amplitudes) > 0 and np.max(amplitudes) > 0 else 1.0
            norm_amps = [round(float(a / max_a), 4) for a in amplitudes]

            rssi_f = float(rssi) if math.isfinite(rssi) else -50.0
            noise_f = float(noise) if math.isfinite(noise) else -95.0
            snr = float(rssi_f - noise_f)

            return {
                "type": "raw_csi",
                "protocol": "adr018_binary",
                "node_id": node_id,
                "n_ant": n_ant,
                "n_sc": n_sc,
                "freq_mhz": freq_mhz,
                "seq": seq,
                "rssi": float(rssi),
                "noise": float(noise),
                "snr": round(snr, 1),
                "amplitudes": amps,
                "phases": phases,
                "normalized_amplitudes": norm_amps,
                "source_addr": source_addr,
            }
        except Exception as e:
            logger.debug("ADR-018 binary parse error: %s", e)
            return None

    @classmethod
    def _parse_csi_csv(cls, text: str, source_addr: str = "") -> Optional[Dict[str, Any]]:
        """
        Parses Espressif esp-csi / Arduino newline-delimited CSV records.
        Handles both bracketed [I,Q,...] formats and comma-delimited streams.
        """
        try:
            line = text.strip()
            idx = line.find("CSI_DATA")
            if idx == -1:
                return None
            line = line[idx:]

            # Check for bracketed subcarrier values [...]
            lb = line.find("[")
            rb = line.find("]", lb) if lb != -1 else -1

            raw_vals: List[float] = []
            header_str = ""

            if lb != -1 and rb != -1:
                data_content = line[lb + 1 : rb].strip()
                header_str = line[:lb].rstrip(",").rstrip('"').rstrip("'").rstrip(",")
                if data_content:
                    for item in data_content.split(","):
                        item = item.strip()
                        if item:
                            try:
                                raw_vals.append(float(item))
                            except ValueError:
                                pass
            else:
                parts = [p.strip().strip('"').strip("'") for p in line.split(",") if p.strip()]
                # If comma-separated, tokens up to index 5 or 25 are headers, rest are values
                # Detect where numbers begin
                num_start = -1
                for i in range(1, len(parts)):
                    p = parts[i]
                    if (":" in p or "-" in p) and len(p) == 17:
                        continue
                    # Check if subsequent tokens are numeric
                    try:
                        _ = float(p)
                        if i >= 4:
                            num_start = i
                            break
                    except ValueError:
                        pass

                if num_start != -1 and len(parts) - num_start >= 8:
                    # If remaining tokens is odd, the first token is a length count (e.g. 64 or 104)
                    if (len(parts) - num_start) % 2 != 0:
                        num_start += 1
                    header_str = ",".join(parts[:num_start])
                    for p in parts[num_start:]:
                        try:
                            raw_vals.append(float(p))
                        except ValueError:
                            pass
                else:
                    header_str = ",".join(parts[:5])
                    for p in parts[5:]:
                        try:
                            raw_vals.append(float(p))
                        except ValueError:
                            pass

            # Parse header metadata
            h_tokens = [p.strip().strip('"').strip("'") for p in header_str.split(",") if p.strip()]
            mac_str = "24:0A:C4:01:02:03"
            seq = 0
            rssi = -45.0
            noise = -95.0
            channel = 6
            node_id = 1

            # Detect MAC address
            mac_pattern = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$")
            mac_found_idx = -1
            for i, tok in enumerate(h_tokens):
                if mac_pattern.match(tok) or tok.count(":") == 5:
                    mac_str = tok
                    mac_found_idx = i
                    break

            if mac_found_idx != -1:
                # If MAC found, derive node_id from last octet
                try:
                    last_byte = int(mac_str.split(":")[-1].replace("-", ""), 16)
                    node_id = (last_byte % 10) + 1
                except Exception:
                    node_id = 1

                # If MAC is at index 1: format is CSI_DATA,mac,rssi,channel,len,...
                if mac_found_idx == 1 and len(h_tokens) > 2:
                    try:
                        rssi = float(h_tokens[2])
                    except ValueError:
                        pass
                    if len(h_tokens) > 3:
                        try:
                            channel = int(h_tokens[3])
                        except ValueError:
                            pass
                elif mac_found_idx >= 2:
                    # Format: CSI_DATA,type,seq,mac,rssi,rate,...
                    if h_tokens[mac_found_idx - 1].isdigit():
                        seq = int(h_tokens[mac_found_idx - 1])
                    if len(h_tokens) > mac_found_idx + 1:
                        try:
                            rssi = float(h_tokens[mac_found_idx + 1])
                        except ValueError:
                            pass
                    # Check for noise floor token (typically negative integer < -70)
                    for tok in h_tokens[mac_found_idx + 2 :]:
                        try:
                            val = float(tok)
                            if -120.0 <= val <= -70.0:
                                noise = val
                                break
                        except ValueError:
                            pass
            else:
                # Fallback: scan for RSSI (negative number between -20 and -100)
                for tok in h_tokens[1:]:
                    try:
                        val = float(tok)
                        if -100.0 <= val <= -20.0:
                            rssi = val
                            break
                    except ValueError:
                        pass

            # Sanitize and validate raw subcarrier values
            valid_vals = [float(v) for v in raw_vals if math.isfinite(v)]
            if len(valid_vals) < 4:
                # Malformed CSV or empty subcarrier array: do NOT fabricate fake packets
                return None

            # Convert raw subcarrier values into amplitudes and phases
            # In standard esp-csi, values are interleaved [I, Q, I, Q, ...]
            if len(valid_vals) % 2 == 0:
                i_v = np.array(valid_vals[0::2], dtype=np.float64)
                q_v = np.array(valid_vals[1::2], dtype=np.float64)
                amplitudes = np.sqrt(i_v**2 + q_v**2)
                if not np.all(np.isfinite(amplitudes)):
                    return None
                phases = np.arctan2(q_v, i_v).tolist()
                amps = amplitudes.tolist()
            else:
                amps = [float(v) for v in valid_vals]
                phases = [0.0] * len(amps)

            n_sc = len(amps)
            if n_sc < 2 or n_sc > 512:
                return None
            n_ant = 1
            max_a = float(np.max(amps)) if amps and np.max(amps) > 0 else 1.0
            norm_amps = [round(float(a / max_a), 4) for a in amps]

            # Channel to frequency
            if 1 <= channel <= 14:
                freq_mhz = 2407 + channel * 5
            elif channel >= 36:
                freq_mhz = 5000 + channel * 5
            else:
                freq_mhz = 5210

            rssi_f = float(rssi) if math.isfinite(rssi) else -50.0
            noise_f = float(noise) if math.isfinite(noise) else -95.0
            snr = float(rssi_f - noise_f)

            return {
                "type": "raw_csi",
                "protocol": "esp_csi_csv",
                "node_id": node_id,
                "n_ant": n_ant,
                "n_sc": n_sc,
                "freq_mhz": freq_mhz,
                "seq": seq,
                "rssi": float(rssi),
                "noise": float(noise),
                "snr": round(snr, 1),
                "amplitudes": amps,
                "phases": phases,
                "normalized_amplitudes": norm_amps,
                "source_addr": source_addr or mac_str,
                "mac": mac_str,
            }
        except Exception as e:
            logger.debug("CSI_DATA CSV parse error: %s", e)
            return None

    @classmethod
    def _parse_adr039_vitals(cls, raw: bytes, source_addr: str = "") -> Optional[Dict[str, Any]]:
        """Parses ADR-039 vitals packet (<IBBHIbBxxffII, 32 bytes)."""
        if len(raw) < 32:
            return None
        try:
            fields = struct.unpack_from("<IBBHIbBxxffII", raw, 0)
            if fields[0] != cls.MAGIC_VITALS:
                return None
            node_id = fields[1]
            br_raw = fields[3]
            hr_raw = fields[4]
            rssi = fields[5]
            resp_bpm = float(br_raw) / 100.0 if br_raw > 0 else 16.0
            hb_bpm = float(hr_raw) / 10000.0 if hr_raw > 0 else 72.0
            motion = fields[7] if len(fields) > 7 else 0.1
            presence_score = fields[8] if len(fields) > 8 else 0.85

            motion_f = float(motion) if math.isfinite(motion) else 0.1
            presence_f = float(presence_score) if math.isfinite(presence_score) else 0.85
            resp_f = float(resp_bpm) if math.isfinite(resp_bpm) else 16.0
            hb_f = float(hb_bpm) if math.isfinite(hb_bpm) else 72.0
            rssi_f = float(rssi) if math.isfinite(rssi) else -50.0

            return {
                "type": "vitals",
                "protocol": "adr039_vitals",
                "node_id": node_id,
                "seq": int(time.time() * 10) % 65535,
                "motion": motion_f,
                "presence": presence_f,
                "resp_bpm": round(resp_f, 1),
                "hb_bpm": round(hb_f, 1),
                "rssi": rssi_f,
                "source_addr": source_addr,
            }
        except Exception as e:
            logger.debug("ADR-039 parse error: %s", e)
            return None

    @classmethod
    def _parse_adr081_c6(cls, raw: bytes, source_addr: str = "") -> Optional[Dict[str, Any]]:
        """Parses ADR-081 C6 Feature State packet (60 bytes)."""
        if len(raw) < 60:
            return None
        try:
            fields = struct.unpack_from("<IBBHQfffffffffHHI", raw, 0)
            if fields[0] != cls.MAGIC_C6_FEAT:
                return None
            m_val = float(fields[5]) if math.isfinite(fields[5]) else 0.1
            p_val = float(fields[6]) if math.isfinite(fields[6]) else 0.85
            r_val = float(fields[7]) if math.isfinite(fields[7]) else 16.0
            h_val = float(fields[9]) if math.isfinite(fields[9]) else 72.0
            return {
                "type": "c6_feature",
                "protocol": "adr081_c6",
                "node_id": fields[1],
                "seq": fields[3],
                "motion": m_val,
                "presence": p_val,
                "resp_bpm": round(r_val, 1),
                "hb_bpm": round(h_val, 1),
                "source_addr": source_addr,
            }
        except Exception as e:
            logger.debug("ADR-081 parse error: %s", e)
            return None


class UsbSerialScanner:
    """
    Automated USB Serial COM port scanner and reader for physical ESP32 nodes.
    Scans COM ports with pyserial at 115200 and 921600 baud, auto-detects ADR-018
    binary and CSI_DATA CSV, and feeds decoded packets into the pipeline.
    Runs non-blocking in a background daemon thread.
    """

    SUPPORTED_BAUDS = [921600, 115200]

    def __init__(self, on_packet_callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.on_packet_callback = on_packet_callback
        self.lock = threading.RLock()
        self.running = False
        self.thread: Optional[threading.Thread] = None

        # Hardware connection telemetry
        self.connected = False
        self.current_port: Optional[str] = None
        self.current_baud: Optional[int] = None
        self.packets_received = 0
        self.last_packet_time = 0.0
        self.last_snr_db = 42.0
        self.last_protocol = "none"
        self.scanned_ports: List[str] = []

        # Sliding window for packet rate computation
        self._packet_timestamps = collections.deque(maxlen=100)

    def start(self):
        """Starts the background USB serial auto-scanner thread."""
        with self.lock:
            if self.running:
                return
            self.running = True
            self.thread = threading.Thread(target=self._scan_loop, daemon=True, name="esp32-serial-scanner")
            self.thread.start()
            logger.info("USB Serial COM auto-scanner started")

    def stop(self):
        """Stops the scanner cleanly."""
        with self.lock:
            self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
            self.thread = None
        logger.info("USB Serial COM auto-scanner stopped")

    @property
    def packet_rate_hz(self) -> float:
        """Calculates current packet reception rate in Hz."""
        with self.lock:
            if len(self._packet_timestamps) < 2:
                return 0.0
            dt = self._packet_timestamps[-1] - self._packet_timestamps[0]
            if dt <= 0.001:
                return 0.0
            return round((len(self._packet_timestamps) - 1) / dt, 1)

    def get_status(self) -> Dict[str, Any]:
        """Returns live hardware connection telemetry."""
        with self.lock:
            now = time.time()
            is_active = self.connected and (now - self.last_packet_time < 4.0)
            return {
                "connected": is_active,
                "port": self.current_port if is_active else None,
                "baud_rate": self.current_baud if is_active else None,
                "packet_rate_hz": self.packet_rate_hz if is_active else 0.0,
                "snr_db": self.last_snr_db if is_active else 0.0,
                "packets_received": self.packets_received,
                "last_packet_time": self.last_packet_time,
                "transport": "serial" if is_active else "none",
                "protocol": self.last_protocol if is_active else "none",
                "scanned_ports": list(self.scanned_ports),
            }

    def inject_frame(self, raw: Union[bytes, str], source_name: str = "mock_serial"):
        """Direct injection hook for unit tests and synthetic serial drivers."""
        parsed = UniversalCsiParser.parse(raw, source_addr=source_name)
        if parsed:
            with self.lock:
                now = time.time()
                self.connected = True
                self.current_port = self.current_port or source_name
                self.current_baud = self.current_baud or 921600
                self.packets_received += 1
                self.last_packet_time = now
                self._packet_timestamps.append(now)
                self.last_protocol = parsed.get("protocol", "unknown")
                if "snr" in parsed:
                    self.last_snr_db = float(parsed["snr"])
            if self.on_packet_callback:
                parsed["transport"] = "serial"
                self.on_packet_callback(parsed)

    def _scan_loop(self):
        """Continuously probes available USB serial ports without blocking."""
        try:
            import serial
            import serial.tools.list_ports as list_ports
        except ImportError:
            logger.warning("pyserial is not installed; USB Serial auto-scanning disabled.")
            return

        def _port_priority(p_info) -> int:
            desc = (p_info.description or "").lower()
            hwid = (p_info.hwid or "").lower()
            mfg = (p_info.manufacturer or "").lower()
            is_esp = any(k in desc or k in hwid or k in mfg for k in ["cp210", "ch340", "ftdi", "silicon labs", "esp32", "jtag"])
            has_usb = p_info.vid is not None or "usb" in desc or "usb" in hwid or "usb" in mfg
            if is_esp:
                return 0
            if has_usb:
                return 1
            return 2

        while self.running:
            try:
                all_comports = list_ports.comports()
                with self.lock:
                    self.scanned_ports = [p.device for p in all_comports]

                # Filter candidate ports: exclude virtual Bluetooth serial ports that hang on Windows
                valid_comports = []
                for p in all_comports:
                    desc = (p.description or "").lower()
                    hwid = (p.hwid or "").lower()
                    if "bluetooth" in desc or "bthenum" in hwid or "bth\\" in hwid:
                        continue
                    valid_comports.append(p)

                if not valid_comports:
                    with self.lock:
                        if time.time() - self.last_packet_time >= 4.0:
                            self.connected = False
                    time.sleep(1.5)
                    continue

                # Sort by USB-to-UART bridge likelihood
                valid_comports.sort(key=_port_priority)
                candidate_ports = [p.device for p in valid_comports]

                # Try candidate ports
                connected_to_port = False
                for port_name in candidate_ports:
                    if not self.running:
                        break

                    for baud in self.SUPPORTED_BAUDS:
                        ser = None
                        try:
                            ser = serial.Serial(port_name, baudrate=baud, timeout=0.2, write_timeout=0.2)
                        except Exception as e:
                            # Port is busy, permissions error, or not a valid serial device
                            logger.debug("Cannot open %s at %d: %s", port_name, baud, e)
                            continue

                        # Test reading for incoming CSI packets
                        if self._try_read_stream(ser, port_name, baud):
                            connected_to_port = True
                            break

                    if connected_to_port:
                        break

                if not connected_to_port:
                    with self.lock:
                        if time.time() - self.last_packet_time >= 4.0:
                            self.connected = False
                    time.sleep(2.0)

            except Exception as e:
                logger.debug("Serial scan loop exception: %s", e)
                time.sleep(2.0)

    def _try_read_stream(self, ser, port_name: str, baud: int) -> bool:
        """
        Reads from an open serial port, buffering bytes to extract either
        ADR-018 binary packets or newline-delimited CSI_DATA CSV lines.
        Returns True if a valid CSI stream was established and active until disconnect.
        """
        buf = bytearray()
        first_frame_found = False
        start_time = time.time()
        last_packet_rx = start_time

        try:
            while self.running:
                # Read available bytes with non-blocking timeout
                chunk = ser.read(ser.in_waiting or 64)
                if chunk:
                    buf.extend(chunk)

                packet_parsed = False
                magic_map = {
                    b"\x01\x00\x11\xc5": "adr018",
                    b"\x02\x00\x11\xc5": "adr039",
                    b"\x06\x00\x11\xc5": "adr081",
                }
                m_idx = -1
                matched_magic = None
                for mb in magic_map:
                    idx = buf.find(mb)
                    if idx != -1 and (m_idx == -1 or idx < m_idx):
                        m_idx = idx
                        matched_magic = mb

                if m_idx != -1:
                    # If there are bytes before magic, check for CSV lines before discarding
                    if m_idx > 0:
                        nl_before = buf.find(b"\n", 0, m_idx)
                        if nl_before != -1:
                            line_str = buf[:nl_before].decode("utf-8", errors="ignore").strip()
                            del buf[: nl_before + 1]
                            if "CSI_DATA" in line_str:
                                parsed = UniversalCsiParser.parse(line_str, source_addr=f"serial:{port_name}")
                                if parsed:
                                    self._handle_decoded_packet(parsed, port_name, baud)
                                    first_frame_found = True
                                    last_packet_rx = time.time()
                                    packet_parsed = True
                            # Re-scan for earliest magic after consuming text line
                            m_idx = -1
                            matched_magic = None
                            for mb in magic_map:
                                idx = buf.find(mb)
                                if idx != -1 and (m_idx == -1 or idx < m_idx):
                                    m_idx = idx
                                    matched_magic = mb
                        else:
                            # Discard non-matching preamble before magic
                            del buf[:m_idx]
                            m_idx = 0

                    if m_idx == 0:
                        if matched_magic == b"\x01\x00\x11\xc5":
                            if len(buf) >= 20:
                                magic, node_id, n_ant, n_sc = struct.unpack_from("<IBBH", buf, 0)
                                if n_sc < 4 or n_sc > 512 or n_ant < 1 or n_ant > 4:
                                    del buf[:4]
                                else:
                                    total_len = 20 + n_ant * n_sc * 2
                                    if len(buf) >= total_len:
                                        raw_pkt = bytes(buf[:total_len])
                                        del buf[:total_len]
                                        parsed = UniversalCsiParser.parse(raw_pkt, source_addr=f"serial:{port_name}")
                                        if parsed:
                                            self._handle_decoded_packet(parsed, port_name, baud)
                                            first_frame_found = True
                                            last_packet_rx = time.time()
                                            packet_parsed = True
                        elif matched_magic == b"\x02\x00\x11\xc5":
                            total_len = 32
                            if len(buf) >= total_len:
                                raw_pkt = bytes(buf[:total_len])
                                del buf[:total_len]
                                parsed = UniversalCsiParser.parse(raw_pkt, source_addr=f"serial:{port_name}")
                                if parsed:
                                    self._handle_decoded_packet(parsed, port_name, baud)
                                    first_frame_found = True
                                    last_packet_rx = time.time()
                                    packet_parsed = True
                        elif matched_magic == b"\x06\x00\x11\xc5":
                            total_len = 60
                            if len(buf) >= total_len:
                                raw_pkt = bytes(buf[:total_len])
                                del buf[:total_len]
                                parsed = UniversalCsiParser.parse(raw_pkt, source_addr=f"serial:{port_name}")
                                if parsed:
                                    self._handle_decoded_packet(parsed, port_name, baud)
                                    first_frame_found = True
                                    last_packet_rx = time.time()
                                    packet_parsed = True
                else:
                    # No binary magic in buffer: parse newline-delimited CSI_DATA CSV lines
                    nl_idx = buf.find(b"\n")
                    if nl_idx != -1:
                        line_bytes = buf[:nl_idx]
                        del buf[: nl_idx + 1]
                        try:
                            line_str = line_bytes.decode("utf-8", errors="ignore").strip()
                            if "CSI_DATA" in line_str:
                                parsed = UniversalCsiParser.parse(line_str, source_addr=f"serial:{port_name}")
                                if parsed:
                                    self._handle_decoded_packet(parsed, port_name, baud)
                                    first_frame_found = True
                                    last_packet_rx = time.time()
                                    packet_parsed = True
                        except Exception:
                            pass

                now = time.time()
                # If stream established but idle for > 3.0 seconds, disconnect and re-probe
                if first_frame_found and (now - last_packet_rx > 3.0):
                    logger.debug("Serial stream idle on %s for > 3.0s, resetting connection", port_name)
                    with self.lock:
                        self.connected = False
                    return False

                # If no CSI frame found after 0.8s probe window, abort this port/baud
                if not first_frame_found and (now - start_time > 0.8):
                    return False

                # Prevent buffer bloat if noise
                if len(buf) > 8192:
                    del buf[:4096]

                if not packet_parsed:
                    time.sleep(0.01)

        except Exception as e:
            logger.debug("Serial connection dropped on %s: %s", port_name, e)
            with self.lock:
                self.connected = False
            return False
        finally:
            try:
                ser.close()
            except Exception:
                pass

        return first_frame_found

    def _handle_decoded_packet(self, parsed: Dict[str, Any], port_name: str, baud: int):
        """Updates internal telemetry and invokes the pipeline callback."""
        now = time.time()
        with self.lock:
            self.connected = True
            self.current_port = port_name
            self.current_baud = baud
            self.packets_received += 1
            self.last_packet_time = now
            self._packet_timestamps.append(now)
            self.last_protocol = parsed.get("protocol", "unknown")
            if "snr" in parsed:
                self.last_snr_db = float(parsed["snr"])

        if self.on_packet_callback:
            parsed["transport"] = "serial"
            self.on_packet_callback(parsed)
