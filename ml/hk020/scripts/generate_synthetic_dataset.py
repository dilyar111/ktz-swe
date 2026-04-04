#!/usr/bin/env python3
"""
HK-020 — Synthetic labeled telemetry for baseline ML (hackathon / lab only).

Rows mimic ingest field names. Binary label `risk_label` is rule-based with label noise,
independent of the HK-004 health engine (so the model is a *parallel* risk signal, not a copy).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

RNG = np.random.default_rng()


def base_risk_label(row: pd.Series) -> int:
    if row["engine_temp_c"] > 95:
        return 1
    if row["brake_pressure_bar"] < 4.5:
        return 1
    if row["signal_quality_pct"] < 78:
        return 1
    if row["fault_code_count"] >= 2:
        return 1
    lim = max(row["speed_limit_kmh"], 1.0)
    if row["speed_kmh"] > lim * 1.02:
        return 1
    return 0


def generate_rows(n: int, seed: int) -> pd.DataFrame:
    global RNG
    RNG = np.random.default_rng(seed)

    locomotive_type = RNG.choice(["KZ8A", "TE33A"], size=n)
    type_te33a = (locomotive_type == "TE33A").astype(np.int8)

    speed_limit_kmh = RNG.uniform(60, 90, size=n).round(1)
    speed_kmh = RNG.uniform(0, 100, size=n).round(1)
    # Pull some samples into overspeed tail
    overshoot = RNG.random(n) < 0.12
    speed_kmh = np.where(overshoot, speed_limit_kmh * RNG.uniform(1.0, 1.15, size=n), speed_kmh)

    engine_temp_c = RNG.normal(72, 14, size=n).clip(55, 115).round(1)
    brake_pressure_bar = RNG.normal(4.95, 0.35, size=n).clip(2.5, 6.0).round(2)
    traction_current_a = np.where(
        type_te33a == 1,
        RNG.normal(320, 120, size=n).clip(0, 1200),
        RNG.normal(450, 160, size=n).clip(0, 1200),
    ).round(0)
    signal_quality_pct = RNG.normal(94, 8, size=n).clip(40, 100).round(0)
    fault_code_count = RNG.integers(0, 5, size=n, endpoint=False)
    vibration_mm_s = RNG.exponential(2.5, size=n).clip(0, 25).round(1)

    speed_ratio = speed_kmh / np.maximum(speed_limit_kmh, 1.0)

    df = pd.DataFrame(
        {
            "locomotive_type": locomotive_type,
            "speed_kmh": speed_kmh,
            "speed_limit_kmh": speed_limit_kmh,
            "engine_temp_c": engine_temp_c,
            "brake_pressure_bar": brake_pressure_bar,
            "traction_current_a": traction_current_a,
            "signal_quality_pct": signal_quality_pct,
            "fault_code_count": fault_code_count,
            "vibration_mm_s": vibration_mm_s,
            "type_te33a": type_te33a,
            "speed_ratio": speed_ratio.round(3),
        }
    )

    df["risk_label"] = df.apply(base_risk_label, axis=1).astype(np.int8)
    flip = RNG.random(n) < 0.08
    df.loc[flip, "risk_label"] = 1 - df.loc[flip, "risk_label"]

    return df


def main() -> None:
    p = argparse.ArgumentParser(description="HK-020 synthetic telemetry + risk labels")
    p.add_argument("--rows", type=int, default=12000)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    root = Path(__file__).resolve().parents[1]
    out_dir = root / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "synthetic_telemetry_risk.csv"

    df = generate_rows(args.rows, args.seed)
    df.to_csv(out_path, index=False)
    pos = int(df["risk_label"].sum())
    print(f"Wrote {len(df)} rows to {out_path} (risk_label=1: {pos}, ~{100 * pos / len(df):.1f}%)")


if __name__ == "__main__":
    main()
