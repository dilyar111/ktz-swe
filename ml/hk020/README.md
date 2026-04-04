# HK-020 / HK-021 — Synthetic data & baseline ML risk

## What this is

- **HK-020**: Labeled **synthetic telemetry** (CSV) generated from the same field names the digital twin ingest uses (`speedKmh`, `engineTempC`, `brakePressureBar`, …). Labels are **rule-based** (with noise), not from production logs.
- **HK-021**: A **small baseline classifier** trained offline on that CSV. It outputs a **supplementary** `riskScore` / `riskClass` for demos only.

## Primary vs ML (important)

The **HK-004 explainable health index** (subsystem weights, contributors, alerts) remains the **authoritative** operator signal. The ML risk layer:

- Does **not** drive alerts, recommendations, or core API behavior.
- Is **optional** at runtime: if `artifacts/risk_model_lr.json` is missing, the API omits scores gracefully.
- Is trained on **synthetic** data; it is **not** a production safety model.

## Layout

| Path | Purpose |
|------|---------|
| `scripts/generate_synthetic_dataset.py` | HK-020 — writes `data/synthetic_telemetry_risk.csv` |
| `scripts/train_baseline_risk.py` | HK-021 — trains Logistic Regression (+ RF for comparison), exports LR JSON for Node |
| `artifacts/risk_model_lr.json` | Portable LR + scaler (used by `apps/backend` for inference) |
| `artifacts/metrics.json` | Written when you train (accuracy, ROC-AUC, brief RF vs LR) |

## Train & evaluate locally

```bash
cd ml/hk020
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix:    source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/generate_synthetic_dataset.py --rows 12000 --seed 42
python scripts/train_baseline_risk.py
```

After training, copy or keep `artifacts/risk_model_lr.json` where the backend expects it (repo default path is `ml/hk020/artifacts/risk_model_lr.json` relative to monorepo root).

## Out of scope (by design)

- Deep learning, online learning, production model serving, real fleet data.
