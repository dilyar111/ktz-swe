'use strict';

const fs = require('fs');
const path = require('path');

/** @typedef {{ version?: string, featureNames?: string[], mean?: number[], scale?: number[], coef?: number[], intercept?: number, primaryHealthEngine?: string }} LrModelJson */

let cached = /** @type {{ mtime: number, doc: LrModelJson } | null} */ (null);

function modelPath() {
  const override = process.env.ML_RISK_MODEL_PATH;
  if (override && String(override).trim()) {
    return path.resolve(String(override).trim());
  }
  return path.join(__dirname, '../../../../ml/hk020/artifacts/risk_model_lr.json');
}

/**
 * Load JSON model (cached; invalidate on file mtime change for dev).
 * @returns {LrModelJson | null}
 */
function loadModelDoc() {
  const p = modelPath();
  try {
    const st = fs.statSync(p);
    if (cached && cached.mtime === st.mtimeMs) return cached.doc;
    const raw = fs.readFileSync(p, 'utf8');
    const doc = JSON.parse(raw);
    cached = { mtime: st.mtimeMs, doc };
    return doc;
  } catch {
    cached = null;
    return null;
  }
}

function sigmoid(z) {
  if (z > 35) return 1;
  if (z < -35) return 0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Feature order must match HK-020 / train_baseline_risk.py FEATURE_COLS.
 * @param {Record<string, unknown>} snapshot
 * @returns {number[] | null}
 */
function featureRowFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const type = String(snapshot.locomotiveType ?? 'KZ8A').toUpperCase() === 'TE33A' ? 1 : 0;
  const speed = Number(snapshot.speedKmh ?? snapshot.speed ?? 0);
  const limitRaw = Number(snapshot.speedLimitKmh ?? snapshot.speed_limit ?? 80);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 80;
  const ratio = limit > 0 ? speed / limit : 0;

  return [
    speed,
    Number(snapshot.engineTempC ?? snapshot.engine_temp ?? snapshot.oilTempC ?? 70),
    Number(snapshot.brakePressureBar ?? snapshot.brake_pressure ?? 5),
    Number(snapshot.tractionCurrentA ?? snapshot.current ?? 0),
    Number(snapshot.signalQualityPct ?? snapshot.signal_quality ?? 100),
    Number(snapshot.faultCodeCount ?? snapshot.fault_count ?? 0),
    Number(snapshot.vibrationMmS ?? snapshot.vibration ?? 0),
    type,
    ratio,
  ];
}

/**
 * HK-021 supplementary ML risk (Logistic Regression prob. for positive class).
 * Does not replace HK-004 health.
 * @param {Record<string, unknown>} snapshot
 */
function computeMlRisk(snapshot) {
  const doc = loadModelDoc();
  if (!doc || !Array.isArray(doc.coef) || !Array.isArray(doc.mean) || !Array.isArray(doc.scale)) {
    return {
      supplementary: true,
      enabled: false,
      note: 'ML risk model not loaded (run ml/hk020/scripts/train_baseline_risk.py)',
    };
  }
  const n = doc.mean.length;
  if (doc.coef.length !== n || doc.scale.length !== n) {
    return { supplementary: true, enabled: false, note: 'ML risk model schema mismatch' };
  }

  const row = featureRowFromSnapshot(snapshot);
  if (!row || row.length !== n) {
    return { supplementary: true, enabled: false, note: 'ML risk: feature extraction failed' };
  }

  let logit = typeof doc.intercept === 'number' ? doc.intercept : 0;
  for (let i = 0; i < n; i += 1) {
    const scale = doc.scale[i];
    const denom = scale === 0 || !Number.isFinite(scale) ? 1 : scale;
    const z = (row[i] - doc.mean[i]) / denom;
    logit += doc.coef[i] * z;
  }
  const p = sigmoid(logit);
  const riskScore = Math.round(p * 100);
  let riskClass = 'low';
  if (p >= 0.66) riskClass = 'high';
  else if (p >= 0.33) riskClass = 'medium';

  return {
    supplementary: true,
    enabled: true,
    modelVersion: doc.version ?? 'hk021-lr',
    riskScore,
    riskClass,
    /** Probability of elevated synthetic risk label (not a clinical/production score). */
    riskProbability: Math.round(p * 1000) / 1000,
  };
}

module.exports = {
  computeMlRisk,
  featureRowFromSnapshot,
  loadModelDoc,
};
