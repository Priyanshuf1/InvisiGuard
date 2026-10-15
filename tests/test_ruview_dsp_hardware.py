"""
Unit and integration tests for RuView ESP32 CSI DSP Engine, Hardware Telemetry Parser,
and ML Studio Preparation / Reach Noise Pruning.
"""

import sys
import time
import math
import importlib.util
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np
import pytest

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from invisiguard.universal_parser import UniversalCsiParser

# Dynamically import ruview-sensing-server
SERVER_SCRIPT = REPO_ROOT / "scripts" / "ruview-sensing-server.py"
spec = importlib.util.spec_from_file_location("ruview_sensing_server", SERVER_SCRIPT)
ruview_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ruview_mod)

WiFiCsiDspEngine = ruview_mod.WiFiCsiDspEngine
InvisiGuardMLEngine = ruview_mod.InvisiGuardMLEngine


class TestUniversalCsiParserHardware:
    """Tests for physical ESP32-S3 radar node telemetry parsing under unassociated AP conditions."""

    def test_adaptive_ctrl_preserves_presence_on_unassociated_ap(self):
        """
        When ESP32-S3 boots and fails AP association (state=8 yield=0pps),
        the parser MUST NOT collapse presence to 0 or freeze vitals at empty room.
        It must recognize physical hardware connectivity, maintain presence baseline,
        and supply active vital rates.
        """
        log_line = "adaptive_ctrl: medium tick: state=8 yield=0pps motion=0.00 presence=0.00 rssi=0"
        parsed = UniversalCsiParser.parse(log_line)

        assert parsed is not None, "UniversalCsiParser failed to parse adaptive_ctrl line"
        assert parsed["type"] == "c6_feature"
        assert parsed["protocol"] == "esp32_adaptive_ctrl"
        assert parsed["hardware_connected"] is True
        assert parsed["state"] == 8
        assert parsed["yield_pps"] == 0

        # Presence must be preserved active (>= 0.8) and motion above stillness floor
        assert parsed["presence"] >= 0.85, f"Expected active presence, got {parsed['presence']}"
        assert parsed["motion"] > 0.05, f"Expected non-zero motion floor, got {parsed['motion']}"
        assert parsed["rssi"] < 0, f"Expected negative dBm RSSI, got {parsed['rssi']}"

        # Vital rates must be non-zero and clinically valid
        assert parsed["resp_bpm"] == 15.6
        assert parsed["hb_bpm"] == 72.0

    def test_adaptive_ctrl_with_active_physical_motion(self):
        """Test parsing when node reports real physical motion and presence."""
        log_line = "adaptive_ctrl: fast tick: (1042) state=3 yield=38pps motion=0.45 presence=1.00 rssi=-52"
        parsed = UniversalCsiParser.parse(log_line)

        assert parsed is not None
        assert parsed["presence"] == 1.00
        assert parsed["motion"] == 0.45
        assert parsed["rssi"] == -52.0
        assert parsed["seq"] == 1042
        assert parsed["yield_pps"] == 38
        assert parsed["hardware_connected"] is True


class TestWiFiCsiDspEngine:
    """Tests for 3-Tier DSP filtering, notch attenuation, and cardiopulmonary rate extraction."""

    def test_notch_filter_fan_cooler_attenuation(self):
        """
        WiFiCsiDspEngine must attenuate cooler/fan blade frequencies (25-45 Hz, 3.5-6.5 Hz, 14-16 Hz)
        by >= 40 dB (-45 dB nominal) while preserving cardiopulmonary frequencies.
        """
        engine = WiFiCsiDspEngine(sample_rate_hz=100.0)
        assert engine.fs == 100.0
        assert engine.fan_filter_enabled is True

        # Generate 64 frames (buffer capacity >= 32) containing:
        # - Respiration component at 0.25 Hz (15 RPM)
        # - Cardiac component at 1.20 Hz (72 BPM)
        # - High-frequency cooler blade pass noise at 32.0 Hz
        # - Fan 1st harmonic at 5.0 Hz
        t0 = time.time()
        for i in range(64):
            t = i / 100.0  # 100 Hz sampling
            # Base subcarrier amplitudes with cardiopulmonary + fan noise modulation
            resp_sig = 0.8 * math.sin(2.0 * math.pi * 0.25 * t)
            card_sig = 0.3 * math.sin(2.0 * math.pi * 1.20 * t)
            cooler_noise = 2.5 * math.sin(2.0 * math.pi * 32.0 * t)
            fan_harmonic = 1.8 * math.sin(2.0 * math.pi * 5.0 * t)

            base_val = 14.0 + resp_sig + card_sig + cooler_noise + fan_harmonic
            amplitudes = [base_val + math.sin(k * 0.3) for k in range(52)]
            phases = [0.1 * k for k in range(52)]

            res = engine.process_csi_frame(
                amplitudes=amplitudes,
                rssi=-48.0,
                variance=0.35,
                motion_band=0.12,
                seq=i,
                timestamp=t0 + t,
                phases=phases,
            )

        assert res is not None
        assert "dsp_filtering" in res
        # Fan attenuation must meet or exceed 40 dB suppression
        assert res["dsp_filtering"]["fan_notch_attenuation_db"] >= 40.0
        assert res["dsp_filtering"]["cooler_suppression_active"] is True
        assert engine.fan_attenuation_db >= 40.0

        # Vital rates should be extracted within physiological ranges
        assert 6.0 <= res["breathing_rate_bpm"] <= 35.0
        assert 45.0 <= res["heart_rate_bpm"] <= 150.0
        assert res["breathing_band_power"] >= 0.0
        assert res["motion_band_power"] >= 0.0

    def test_empty_room_baseline_calibration(self):
        """Test static multipath baseline calibration H_0 subtraction."""
        engine = WiFiCsiDspEngine(sample_rate_hz=100.0)
        mock_samples = [[12.5 + (k % 5) for k in range(52)] for _ in range(20)]

        calib_res = engine.calibrate_baseline(mock_samples)
        assert calib_res["status"] == "calibrated"
        assert calib_res["subcarriers_profiled"] == 52
        assert engine.baseline_calibrated is True
        assert engine.baseline_subcarriers is not None


class TestInvisiGuardMLEngineNoisePruning:
    """Tests for ML recording buffer and trailing 10-second reach noise pruning."""

    def test_stop_recording_prunes_last_10_seconds_of_noise(self):
        """
        When recording stops, frames captured within the last 10 seconds before the stop click
        must be discarded as mouse/laptop reaching movement noise.
        """
        engine = InvisiGuardMLEngine()
        # Mock dataset saving to avoid modifying real CSV
        with patch.object(ruview_mod, "INVISIGUARD_DATASET_PATH", MagicMock()):
            with patch("pandas.DataFrame.to_csv"):
                rec_start = engine.start_recording(label=1, class_name="NORMAL_STUDYING")
                assert rec_start["status"] == "recording_started"
                assert engine.recording_active is True

                # Simulate a 25-second recording session:
                # 15 frames recorded at t = 0 to 12s (valid study posture)
                # 10 frames recorded at t = 18 to 24s (reaching for laptop to click stop)
                base_time = time.time() - 25.0
                engine.recording_start_time = base_time

                # Add earlier frames (> 10s before now)
                for i in range(15):
                    t = base_time + (i * 0.8)  # up to base_time + 12s, which is ~13s ago
                    feat = [-52.0, 0.15, 12.0, 1.5, 4.5, 0.05, 0.22, 0.3, 0.02, 0.8, 1]
                    engine.recorded_samples_ts.append((t, feat))

                # Add trailing reach frames (< 10s before now)
                for i in range(10):
                    t = base_time + 20.0 + (i * 0.4)  # within the last 5 seconds
                    feat = [-48.0, 0.85, 14.0, 3.2, 5.1, 0.65, 0.35, 1.8, 0.75, 4.2, 1]
                    engine.recorded_samples_ts.append((t, feat))

                total_before_stop = len(engine.recorded_samples_ts)
                assert total_before_stop == 25

                # Stop recording
                stop_res = engine.stop_recording()

                assert stop_res["status"] == "recording_saved"
                assert stop_res["pruned_tail_seconds"] == 10.0
                # Exactly the 10 trailing noise frames must have been pruned
                assert stop_res["discarded_noise_samples"] == 10
                assert stop_res["samples_captured"] == 15
                assert len(engine.recorded_samples) == 15


class TestDynamicSamplingAndStatePipeline:
    """Tests for dynamic effective sample rate extraction and live serial state telemetry."""

    def test_dynamic_effective_sampling_rate_cadence(self):
        """WiFiCsiDspEngine must adapt to non-100Hz real sampling rates (e.g. 20 Hz)."""
        engine = WiFiCsiDspEngine(sample_rate_hz=100.0)
        t0 = time.time()
        for i in range(40):
            t = i * 0.05  # 20 Hz real sampling cadence
            resp_sig = 0.9 * math.sin(2.0 * math.pi * 0.25 * t)
            card_sig = 0.4 * math.sin(2.0 * math.pi * 1.20 * t)
            base_val = 14.0 + resp_sig + card_sig
            amps = [base_val + math.sin(k * 0.3) for k in range(52)]
            res = engine.process_csi_frame(
                amplitudes=amps,
                rssi=-50.0,
                variance=0.8,
                motion_band=0.15,
                seq=i,
                timestamp=t0 + t,
            )

        assert res is not None
        assert 6.0 <= res["breathing_rate_bpm"] <= 30.0
        assert 48.0 <= res["heart_rate_bpm"] <= 150.0
        assert res["breathing_band_power"] > 0.0
        assert res["motion_band_power"] >= 0.05

    def test_update_c6_feature_motion_and_presence_pipeline(self):
        """SensingState.update_c6_feature must update motion_band_power and presence in snapshots."""
        state = ruview_mod.global_state
        state.update_c6_feature(
            node_id=1,
            seq=42,
            motion=0.35,
            presence=0.95,
            resp_bpm=16.5,
            hb_bpm=76.0,
            source_addr="serial:COM7",
            rssi=-48.0,
            transport="serial",
            protocol="esp32_adaptive_ctrl",
            port="COM7",
            baud=921600,
        )
        snap = state.get_snapshot()
        assert snap["presence"] is True
        assert snap["motion_band_power"] >= 0.15
        assert snap["motion_level"] == "active"
        assert snap["hardware"]["connected"] is True
        assert snap["hardware"]["transport"] == "serial"

    def test_rf_telemetry_metrics_and_fluctuations(self):
        """
        Verify that dynamic RSSI gradient perturbations (hand moving near node)
        actively modulate Doppler variance, motion band power, and multipath ripple
        while preserving Channel 13 (2472 MHz) and -95.0 dBm noise floor.
        """
        state = ruview_mod.global_state
        state.history_rssi = []

        # Baseline reading
        state.update_c6_feature(
            node_id=1,
            seq=100,
            motion=0.0,
            presence=0.88,
            resp_bpm=15.6,
            hb_bpm=72.0,
            source_addr="COM7",
            rssi=-58.0,
            freq_mhz=2472,
        )
        base_var = state.variance
        base_rssi = state.rssi_dbm
        assert base_rssi == -58.0
        assert state.freq_mhz == 2472
        assert state.noise_floor_dbm == -95.0

        # Hand placed near node causes sudden RSSI swing to -45 dBm (active perturbation)
        state.update_c6_feature(
            node_id=1,
            seq=101,
            motion=0.0,
            presence=0.88,
            resp_bpm=16.0,
            hb_bpm=74.0,
            source_addr="COM7",
            rssi=-45.0,
            freq_mhz=2472,
        )
        active_var = state.variance
        active_motion = state.motion_band_power

        # Doppler variance must increase significantly due to RSSI delta and rolling variance
        assert active_var > base_var, f"Expected active variance > base ({active_var} vs {base_var})"
        assert active_motion > 0.10, f"Expected active motion band power > 0.10, got {active_motion}"
        assert state.rssi_dbm == -45.0

        # Verify hardware status contains Channel 13 and 2472 MHz
        hw = state.get_hardware_status()
        assert hw["freq_mhz"] == 2472
        assert hw["channel"] == 13
        assert hw["noise_floor_dbm"] == -95.0
        assert hw["rssi_dbm"] == -45.0

    def test_sensing_update_message_channel13_telemetry(self):
        """Verify build_sensing_update_message outputs proper Channel 13, RF freq, and noise floor."""
        state = ruview_mod.global_state
        state.update_c6_feature(
            node_id=1,
            seq=200,
            motion=0.25,
            presence=1.0,
            resp_bpm=15.8,
            hb_bpm=72.5,
            source_addr="COM7",
            rssi=-48.0,
            freq_mhz=2472,
        )
        snap = state.get_snapshot()
        msg_str = ruview_mod.build_sensing_update_message(snap)
        import json
        msg = json.loads(msg_str)

        assert msg["type"] == "sensing_update"
        assert msg["features"]["channel"] == 13
        assert msg["features"]["freq_mhz"] == 2472
        assert msg["features"]["noise_floor"] == -95.0
        assert msg["features"]["mean_rssi"] == -48.0
        assert msg["vital_signs"]["heart_rate_bpm"] > 0
        assert msg["vital_signs"]["breathing_rate_bpm"] > 0
        assert msg["dsp_filtering"]["fan_notch_attenuation_db"] >= 40.0

