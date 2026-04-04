# Data paths (HK-020 / HK-021)

Synthetic telemetry for training is kept at **`artifacts/datasets/synthetic_dataset.csv`**.  
`ml/train_risk_model.py` uses that path by default; you can copy or symlink it here as `synthetic_telemetry.csv` if you prefer a `data/` layout.
