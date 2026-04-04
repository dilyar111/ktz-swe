# Supplementary risk indicator — not a replacement for rule-based health index
"""
HK-021 — FastAPI microservice: loads risk_model.joblib from train_risk_model.py
Run: uvicorn serve:app --host 0.0.0.0 --port 8001
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="KTZ ML Risk (supplementary)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ML_DIR = Path(__file__).resolve().parent

_bundle = None
_importance: dict[str, float] = {}
_meta: dict = {}


def load_artifacts() -> None:
    global _bundle, _importance, _meta
    bundle_path = ML_DIR / "risk_model.joblib"
    if not bundle_path.is_file():
        raise FileNotFoundError(f"Missing {bundle_path} — run ml/train_risk_model.py first")
    _bundle = joblib.load(bundle_path)
    imp_path = ML_DIR / "feature_importance.json"
    if imp_path.is_file():
        with open(imp_path, encoding="utf-8") as f:
            _importance = json.load(f)
    meta_path = ML_DIR / "model_meta.json"
    if meta_path.is_file():
        with open(meta_path, encoding="utf-8") as f:
            _meta = json.load(f)


@app.on_event("startup")
def _startup() -> None:
    load_artifacts()


LOWER_IS_WORSE = {"signalQualityPct", "brakePressureBar"}


class PredictBody(BaseModel):
    speedKmh: float | None = None
    speedLimitKmh: float | None = None
    engineTempC: float | None = None
    oilTempC: float | None = None
    brakePressureBar: float | None = None
    fuelLevelPct: float | None = None
    tractionCurrentA: float | None = None
    batteryVoltageV: float | None = None
    lineVoltageV: float | None = None
    faultCodeCount: float | None = None
    signalQualityPct: float | None = None
    vibrationMmS: float | None = None
    healthScore: float | None = None
    locomotiveType: str = "KZ8A"


def _row_from_body(body: PredictBody) -> pd.DataFrame:
    assert _bundle is not None
    feature_names: list[str] = _bundle["feature_names"]
    medians: pd.Series = _bundle["medians"]
    le = _bundle["label_encoder"]
    raw = body.model_dump()
    row: list[float] = []
    for c in feature_names:
        if c == "locomotiveType":
            lt = str(raw.get("locomotiveType") or "KZ8A").upper()
            if lt not in set(le.classes_):
                lt = "KZ8A"
            row.append(float(le.transform([lt])[0]))
            continue
        v = raw.get(c)
        if v is None or (isinstance(v, float) and np.isnan(v)):
            v = medians[c]
        row.append(float(v))
    return pd.DataFrame([row], columns=feature_names)


def _elevated_risk(c: str, val: float, med: float) -> bool:
    if c == "locomotiveType":
        return False
    if c in LOWER_IS_WORSE:
        return val < med
    return val > med


def _top_factors(body: PredictBody, feature_names: list[str], medians: pd.Series) -> list[str]:
    raw = body.model_dump()
    scored: list[tuple[float, str, bool]] = []
    for c in sorted(_importance.keys(), key=lambda k: -_importance.get(k, 0)):
        if c not in feature_names:
            continue
        imp = _importance.get(c, 0)
        if c == "locomotiveType":
            continue
        v = raw.get(c)
        if v is None:
            v = float(medians[c])
        v = float(v)
        med = float(medians[c])
        scored.append((imp, c, _elevated_risk(c, v, med)))
    elevated = [c for _, c, e in scored if e]
    by_imp = [c for _, c, _ in scored]
    out: list[str] = []
    for c in elevated:
        if c not in out:
            out.append(c)
        if len(out) >= 3:
            break
    for c in by_imp:
        if c not in out and c != "locomotiveType":
            out.append(c)
        if len(out) >= 3:
            break
    return out[:3]


@app.get("/health")
def health_ml() -> dict:
    return {"status": "ok", "service": "ktz-ml-risk"}


@app.post("/predict")
def predict(body: PredictBody) -> dict:
    assert _bundle is not None
    model = _bundle["model"]
    scaler = _bundle["scaler"]
    name = _bundle["model_name"]
    medians = _bundle["medians"]
    feature_names: list[str] = _bundle["feature_names"]
    num_cols: list[str] = _bundle["numeric_columns"]

    X = _row_from_body(body)
    if name == "LogisticRegression":
        assert scaler is not None
        Xp = X.copy()
        Xp[num_cols] = scaler.transform(X[num_cols])
        X_in = Xp
    else:
        X_in = X

    proba = model.predict_proba(X_in)[0]
    risk_score = float(np.dot(proba, np.array([0.0, 0.5, 1.0])))
    risk_class = int(np.argmax(proba))
    labels_en = ["normal", "warning", "critical"]
    risk_label = labels_en[risk_class]

    factors = _top_factors(body, feature_names, medians)

    return {
        "riskScore": round(risk_score, 4),
        "riskClass": risk_class,
        "riskLabel": risk_label,
        "topFactors": factors,
    }
