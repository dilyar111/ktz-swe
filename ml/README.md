# HK-021 — supplementary ML risk (baseline)

**Rule-based health (HK-004) remains the primary index.** This folder trains a small classifier on `artifacts/datasets/synthetic_dataset.csv` and serves it via FastAPI for a **secondary** risk indicator in the cockpit.

## Setup

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Train & artifacts

```bash
python train_risk_model.py
# optional: python train_risk_model.py --csv path/to/synthetic_telemetry.csv
```

Produces: `risk_model.joblib`, `feature_importance.json`, `model_meta.json`, `confusion_matrix.png`.

## Run ML API (port 8001)

```bash
uvicorn serve:app --host 0.0.0.0 --port 8001
```

## Node API proxy

The main backend exposes `GET /api/ml/risk` and forwards to `ML_RISK_URL` (default `http://127.0.0.1:8001`).
