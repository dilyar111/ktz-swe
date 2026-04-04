#!/usr/bin/env python3
"""
HK-021 — Train a modest baseline on HK-020 CSV.

- Logistic Regression + StandardScaler → exported JSON for Node (no Python at runtime).
- Random Forest for offline comparison metrics only (not shipped to production Node path).

Rule-based HK-004 health remains primary; this model is supplementary demo signal only.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_COLS = [
    "speed_kmh",
    "engine_temp_c",
    "brake_pressure_bar",
    "traction_current_a",
    "signal_quality_pct",
    "fault_code_count",
    "vibration_mm_s",
    "type_te33a",
    "speed_ratio",
]


def load_dataset(csv_path: Path) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    df = pd.read_csv(csv_path)
    missing = set(FEATURE_COLS + ["risk_label"]) - set(df.columns)
    if missing:
        raise SystemExit(f"CSV missing columns: {missing}")
    X = df[FEATURE_COLS].astype(float).values
    y = df["risk_label"].astype(int).values
    return df, X, y


def export_lr_json(pipe: Pipeline, out_path: Path) -> None:
    scaler: StandardScaler = pipe.named_steps["scale"]
    lr: LogisticRegression = pipe.named_steps["clf"]

    mean = scaler.mean_.tolist()
    scale = scaler.scale_.tolist()
    coef = lr.coef_.ravel().tolist()
    intercept = float(lr.intercept_.ravel()[0])

    doc = {
        "version": "hk021-lr-v1",
        "primaryHealthEngine": "HK-004 (rule-based) — this file is supplementary only",
        "featureNames": FEATURE_COLS,
        "mean": mean,
        "scale": scale,
        "coef": coef,
        "intercept": intercept,
        "classes": [int(c) for c in lr.classes_],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print(f"Wrote portable LR weights to {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv",
        type=Path,
        default=None,
        help="HK-020 CSV (default: ml/hk020/data/synthetic_telemetry_risk.csv)",
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    csv_path = args.csv or (root / "data" / "synthetic_telemetry_risk.csv")
    if not csv_path.is_file():
        raise SystemExit(
            f"Dataset not found: {csv_path}\nRun: python scripts/generate_synthetic_dataset.py"
        )

    _, X, y = load_dataset(csv_path)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y
    )

    lr_pipe = Pipeline(
        steps=[
            ("scale", StandardScaler()),
            (
                "clf",
                LogisticRegression(max_iter=500, random_state=args.seed, class_weight="balanced"),
            ),
        ]
    )
    lr_pipe.fit(X_train, y_train)
    y_proba_lr = lr_pipe.predict_proba(X_test)[:, 1]
    y_hat_lr = lr_pipe.predict(X_test)

    rf = RandomForestClassifier(
        n_estimators=120, max_depth=8, random_state=args.seed, class_weight="balanced"
    )
    rf.fit(X_train, y_train)
    y_proba_rf = rf.predict_proba(X_test)[:, 1]
    y_hat_rf = rf.predict(X_test)

    metrics = {
        "logistic_regression": {
            "accuracy": float(accuracy_score(y_test, y_hat_lr)),
            "roc_auc": float(roc_auc_score(y_test, y_proba_lr)),
        },
        "random_forest_offline_only": {
            "accuracy": float(accuracy_score(y_test, y_hat_rf)),
            "roc_auc": float(roc_auc_score(y_test, y_proba_rf)),
        },
        "note": "Random Forest is for offline comparison; runtime demo uses Logistic Regression JSON only.",
    }

    art = root / "artifacts"
    art.mkdir(parents=True, exist_ok=True)
    (art / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("=== Logistic Regression (exported to Node) ===")
    print(classification_report(y_test, y_hat_lr, digits=3))
    print("ROC-AUC:", metrics["logistic_regression"]["roc_auc"])

    print("\n=== Random Forest (offline benchmark only) ===")
    print(classification_report(y_test, y_hat_rf, digits=3))
    print("ROC-AUC:", metrics["random_forest_offline_only"]["roc_auc"])

    export_lr_json(lr_pipe, art / "risk_model_lr.json")
    print(f"Metrics saved to {art / 'metrics.json'}")


if __name__ == "__main__":
    main()
