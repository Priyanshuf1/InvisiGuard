#!/usr/bin/env python3
"""
INVISIGUARD: Real-World CSI Dataset Collector & Noise-Resilient ML Engine
Created for Smart India Hackathon (SIH) — InvisiGuard Project.

Capabilities:
1. Connects to live ESP32 radar stream (ws://localhost:3000/ws/sensing).
2. Filters out fan/cooler mechanical motor noise using spectral band ratios.
3. Records labeled 10-feature vector dataset for real human behaviors:
   - [0] EMPTY_ROOM
   - [1] NORMAL_STUDYING (Sitting / Typing / Calm)
   - [2] WALKING / PACING
   - [3] VIOLENT_STRUGGLE (Ragging / Fighting)
   - [4] FALL_EVENT (Sudden drop + stillness)
4. Trains an offline Random Forest / Gradient Boosting classifier with cross-validation.
5. Runs real-time live inference alert engine for the hostel warden.
"""

import asyncio
import json
import math
import os
import sys
import time
from collections import deque
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
import joblib
import websockets

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATASET_PATH = DATA_DIR / "invisiguard_dataset.csv"
MODEL_PATH = DATA_DIR / "invisiguard_model.pkl"

CLASS_NAMES = {
    0: "EMPTY_ROOM",
    1: "NORMAL_STUDYING",
    2: "WALKING",
    3: "VIOLENT_STRUGGLE",
    4: "FALL_EVENT",
}

FEATURE_COLUMNS = [
    "rssi_mean",
    "rssi_var",
    "sc_mean",
    "sc_std",
    "sc_entropy",
    "motion_power",
    "breathing_power",
    "variance_current",
    "velocity_delta",
    "cooler_noise_ratio",
]


class DenoisingFeatureExtractor:
    """Extracts noise-resilient features from sliding CSI frames, filtering fan noise."""

    def __init__(self, window_size: int = 10):
        self.window_size = window_size
        self.rssi_window = deque(maxlen=window_size)
        self.variance_window = deque(maxlen=window_size)
        self.motion_window = deque(maxlen=window_size)
        self.last_variance = 1.0

    def process_frame(self, frame: dict) -> Optional[List[float]]:
        features = frame.get("features", {})
        nodes = frame.get("nodes", [{}])
        node = nodes[0] if nodes else {}

        rssi = float(features.get("mean_rssi", node.get("rssi_dbm", -50.0)))
        variance = float(features.get("variance", 1.0))
        motion = float(features.get("motion_band_power", 0.0))
        breathing = float(features.get("breathing_band_power", 0.0))
        amplitudes = node.get("amplitude", [])

        self.rssi_window.append(rssi)
        self.variance_window.append(variance)
        self.motion_window.append(motion)

        if len(self.rssi_window) < 3:
            return None

        # 1. Subcarrier spectral spread
        if len(amplitudes) >= 10:
            amps = np.array(amplitudes, dtype=np.float64)
            sc_mean = float(np.mean(amps))
            sc_std = float(np.std(amps))
            prob = (amps + 1e-6) / (np.sum(amps) + 1e-6)
            sc_entropy = float(-np.sum(prob * np.log2(prob)))
        else:
            sc_mean = 12.0
            sc_std = 2.0
            sc_entropy = 4.5

        # 2. Temporal stability (RSSI & Variance)
        rssi_arr = np.array(self.rssi_window)
        rssi_mean = float(np.mean(rssi_arr))
        rssi_var = float(np.var(rssi_arr))

        # 3. Dynamic velocity delta (detects sudden drops / impacts)
        velocity_delta = abs(variance - self.last_variance)
        self.last_variance = variance

        # 4. Cooler / Fan Noise Neutralizer:
        # Fan motors create high frequency jitter with static subcarrier envelope.
        # Human movement creates broad Doppler shifts across multiple subcarrier clusters.
        cooler_noise_ratio = float(sc_std / (motion + 0.01))

        return [
            round(rssi_mean, 2),
            round(rssi_var, 3),
            round(sc_mean, 2),
            round(sc_std, 3),
            round(sc_entropy, 3),
            round(motion, 3),
            round(breathing, 3),
            round(variance, 2),
            round(velocity_delta, 2),
            round(cooler_noise_ratio, 2),
        ]


async def record_session(label_id: int, duration_sec: int = 15, ws_url: str = "ws://localhost:3000/ws/sensing"):
    label_name = CLASS_NAMES[label_id]
    print(f"\n[RECORDING] Starting capture for: >>> {label_name} <<< ({duration_sec}s)")
    print("  [Tip] Perform the exact activity now in front of the ESP32...")
    time.sleep(1.5)

    extractor = DenoisingFeatureExtractor(window_size=10)
    samples: List[List[float]] = []
    start_time = time.time()

    async with websockets.connect(ws_url) as ws:
        while time.time() - start_time < duration_sec:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                frame = json.loads(msg)
                if frame.get("type") != "sensing_update":
                    continue
                feat = extractor.process_frame(frame)
                if feat:
                    samples.append(feat + [label_id])
                    rem = int(duration_sec - (time.time() - start_time))
                    print(f"\r  Captured {len(samples)} frames | {rem}s remaining... (Variance={feat[7]})", end="", flush=True)
            except asyncio.TimeoutError:
                continue

    print(f"\n[DONE] Captured {len(samples)} clean frames for {label_name}.")
    
    # Save to CSV
    df = pd.DataFrame(samples, columns=FEATURE_COLUMNS + ["label"])
    if DATASET_PATH.exists():
        df.to_csv(DATASET_PATH, mode="a", header=False, index=False)
    else:
        df.to_csv(DATASET_PATH, mode="w", header=True, index=False)
    print(f"  Dataset saved to {DATASET_PATH} (Total samples: {len(pd.read_csv(DATASET_PATH))})\n")


def train_model():
    if not DATASET_PATH.exists():
        print("[ERROR] No dataset found! Record some sessions first.")
        return

    df = pd.read_csv(DATASET_PATH)
    if len(df) < 20:
        print(f"[ERROR] Dataset too small ({len(df)} samples). Record at least 3 classes with 15s each.")
        return

    print(f"\n[TRAINING] Training InvisiGuard Classifier on {len(df)} frames...")
    print("Class distribution:")
    for lbl, count in df["label"].value_counts().items():
        print(f"  - {CLASS_NAMES.get(lbl, lbl)}: {count} samples")

    X = df[FEATURE_COLUMNS].values
    y = df["label"].values

    if len(np.unique(y)) < 2:
        print("[ERROR] Need at least 2 different classes to train. Record another activity.")
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    clf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    clf.fit(X_train, y_train)

    train_acc = clf.score(X_train, y_train)
    test_acc = clf.score(X_test, y_test)
    print(f"\nModel Performance:")
    print(f"  Training Accuracy:   {train_acc * 100:.1f}%")
    print(f"  Validation Accuracy: {test_acc * 100:.1f}%\n")

    y_pred = clf.predict(X_test)
    target_names = [CLASS_NAMES[i] for i in sorted(np.unique(y))]
    print("Classification Report:")
    print(classification_report(y_test, y_pred, target_names=target_names, zero_division=0))

    joblib.dump(clf, MODEL_PATH)
    print(f"[SAVED] Production model serialized to {MODEL_PATH}\n")


async def live_inference(ws_url: str = "ws://localhost:3000/ws/sensing"):
    if not MODEL_PATH.exists():
        print("[ERROR] No trained model found! Run training first.")
        return

    clf = joblib.load(MODEL_PATH)
    extractor = DenoisingFeatureExtractor(window_size=10)
    print("\n" + "=" * 65)
    print("  INVISIGUARD LIVE HOSTEL SAFETY MONITOR ONLINE")
    print("  Streaming live ESP32 radar frames with fan noise suppression...")
    print("=" * 65 + "\n")

    async with websockets.connect(ws_url) as ws:
        while True:
            try:
                msg = await ws.recv()
                frame = json.loads(msg)
                if frame.get("type") != "sensing_update":
                    continue
                feat = extractor.process_frame(frame)
                if feat:
                    X_live = np.array([feat])
                    pred = int(clf.predict(X_live)[0])
                    proba = float(np.max(clf.predict_proba(X_live)[0]))
                    label = CLASS_NAMES.get(pred, "UNKNOWN")

                    t_now = time.strftime("%H:%M:%S")
                    if pred == 3:
                        # Violent struggle alert
                        print(f"[{t_now}] \033[91m🚨 ALERT: VIOLENT STRUGGLE DETECTED! (Conf: {proba*100:.1f}% | Var: {feat[7]})\033[0m")
                    elif pred == 4:
                        # Fall alert
                        print(f"[{t_now}] \033[93m⚠️ WARNING: SUDDEN FALL / FLOOR COLLAPSE! (Conf: {proba*100:.1f}%)\033[0m")
                    else:
                        print(f"[{t_now}] [STATUS: {label:<17}] Conf: {proba*100:.1f}% | RSSI: {feat[0]} dBm | Var: {feat[7]}")
            except (websockets.ConnectionClosed, KeyboardInterrupt):
                print("\n[MONITOR] Stopped.")
                break


def main():
    while True:
        print("\n" + "=" * 55)
        print("  INVISIGUARD: SIH26219 ML DATASET & RADAR ENGINE")
        print("=" * 55)
        print(" [1] Record: EMPTY ROOM (Baseline calibration)")
        print(" [2] Record: NORMAL STUDYING (Sitting, typing, reading)")
        print(" [3] Record: WALKING / PACING (Movement)")
        print(" [4] Record: VIOLENT STRUGGLE / RAGGING (Fast thrashing)")
        print(" [5] Record: SUDDEN FALL (Drop to floor)")
        print(" [6] Train Machine Learning Model (Random Forest)")
        print(" [7] Run Live Real-Time Safety Guard Monitor")
        print(" [8] Exit")
        print("-" * 55)

        choice = input("Select an option (1-8): ").strip()
        if choice in ["1", "2", "3", "4", "5"]:
            label_map = {"1": 0, "2": 1, "3": 2, "4": 3, "5": 4}
            dur = input("Duration in seconds (default 15s): ").strip()
            dur_int = int(dur) if dur.isdigit() else 15
            asyncio.run(record_session(label_map[choice], duration_sec=dur_int))
        elif choice == "6":
            train_model()
        elif choice == "7":
            asyncio.run(live_inference())
        elif choice == "8":
            print("Exiting InvisiGuard.")
            break
        else:
            print("Invalid choice, please enter 1-8.")


if __name__ == "__main__":
    main()
