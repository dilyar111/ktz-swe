#!/usr/bin/env python3
# riskScore is supplementary — rule-based healthIndex remains primary
"""
HK-021 — Train baseline risk classifier on synthetic telemetry (HK-020).
Default CSV: artifacts/datasets/synthetic_dataset.csv
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.ensemble import RandomForestClassifier  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix  # noqa: E402
from sklearn.model_selection import train_test_split  # noqa: E402
from sklearn.preprocessing import LabelEncoder, StandardScaler  # noqa: E402

SCENARIO_TO_RISK = {
    "normal": 0,
    "warning_overheat": 1,
    "brake_drop": 1,
    "critical": 2,
    "signal_loss": 2,
    "highload": 2,
}

DROP_COLS = [
    "timestamp",
    "locomotiveId",
    "lat",
    "lon",
    "healthStatus",
    "healthClass",
    "demoScenario",
]


def build_Xy(df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray, LabelEncoder, pd.Series]:
    y = df["demoScenario"].map(SCENARIO_TO_RISK).astype(int)
    X = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

    num_cols = [c for c in X.columns if c != "locomotiveType"]
    for c in num_cols:
        X[c] = pd.to_numeric(X[c], errors="coerce")

    medians = X[num_cols].median()
    X[num_cols] = X[num_cols].fillna(medians)

    le = LabelEncoder()
    X = X.copy()
    X["locomotiveType"] = le.fit_transform(X["locomotiveType"].astype(str))

    return X, y.values, le, medians


def lr_importance(lr: LogisticRegression, feature_names: list[str]) -> dict[str, float]:
    coef = np.abs(lr.coef_).mean(axis=0)
    total = float(coef.sum()) or 1.0
    return {n: float(c) / total for n, c in zip(feature_names, coef)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "artifacts" / "datasets" / "synthetic_dataset.csv",
    )
    args = parser.parse_args()
    ml_dir = Path(__file__).resolve().parent

    df = pd.read_csv(args.csv)
    X, y, le, medians = build_Xy(df)
    feature_names = list(X.columns)
    num_cols = [c for c in feature_names if c != "locomotiveType"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_lr = X_train.copy()
    X_test_lr = X_test.copy()
    X_train_lr[num_cols] = scaler.fit_transform(X_train[num_cols])
    X_test_lr[num_cols] = scaler.transform(X_test[num_cols])

    lr = LogisticRegression(max_iter=500, class_weight="balanced", random_state=42)
    lr.fit(X_train_lr, y_train)
    pred_lr = lr.predict(X_test_lr)
    acc_lr = accuracy_score(y_test, pred_lr)
    print("--- LogisticRegression ---")
    print(classification_report(y_test, pred_lr, digits=3))
    print(f"accuracy: {acc_lr:.4f}")

    rf = RandomForestClassifier(
        n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    pred_rf = rf.predict(X_test)
    acc_rf = accuracy_score(y_test, pred_rf)
    print("--- RandomForest ---")
    print(classification_report(y_test, pred_rf, digits=3))
    print(f"accuracy: {acc_rf:.4f}")

    if acc_rf >= acc_lr:
        best = rf
        best_name = "RandomForest"
        importances = dict(zip(feature_names, rf.feature_importances_.tolist()))
    else:
        best = lr
        best_name = "LogisticRegression"
        importances = lr_importance(lr, feature_names)

    print(f"\nSelected: {best_name} (acc_lr={acc_lr:.4f}, acc_rf={acc_rf:.4f})")

    pred_best = best.predict(X_test if best_name == "RandomForest" else X_test_lr)
    cm = confusion_matrix(y_test, pred_best)
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.imshow(cm, cmap="Blues")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center", color="black")
    fig.tight_layout()
    cm_path = ml_dir / "confusion_matrix.png"
    fig.savefig(cm_path, dpi=120)
    plt.close(fig)
    print(f"Saved {cm_path}")

    bundle = {
        "model_name": best_name,
        "model": best,
        "scaler": scaler if best_name == "LogisticRegression" else None,
        "numeric_columns": num_cols,
        "feature_names": feature_names,
        "label_encoder": le,
        "medians": medians,
    }
    joblib.dump(bundle, ml_dir / "risk_model.joblib")

    s = sum(importances.values()) or 1.0
    importance_norm = {k: round(v / s, 4) for k, v in sorted(importances.items(), key=lambda x: -x[1])}

    meta = {
        "feature_names": feature_names,
        "numeric_columns": num_cols,
        "medians": medians.to_dict(),
        "label_encoder_classes": le.classes_.tolist(),
        "model_name": best_name,
        "test_accuracy": float(max(acc_lr, acc_rf)),
    }
    with open(ml_dir / "model_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    with open(ml_dir / "feature_importance.json", "w", encoding="utf-8") as f:
        json.dump(importance_norm, f, indent=2)

    print("\nTop-5 features by importance:")
    for name, val in list(importance_norm.items())[:5]:
        print(f"  {name}: {val:.4f}")

    acc_final = accuracy_score(y_test, pred_best)
    if acc_final < 0.85:
        print(f"\nWARNING: test accuracy {acc_final:.4f} < 0.85 — tune data or model.")


if __name__ == "__main__":
    main()
