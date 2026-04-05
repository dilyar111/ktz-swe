'use strict';

/**
 * HK-033 — single source of truth for tunable health weights + alert thresholds.
 * Canonical profile metadata (labels, fields, display thresholds) lives in ./profiles/index.js.
 */

const { PROFILES } = require('./profiles');

/** Must match health engine subsystem keys (five fixed buckets). */
const WEIGHT_KEYS = ['traction', 'brakes', 'thermal', 'electrical', 'signaling'];

/**
 * @param {Record<string, number>} w
 */
function assertWeightsShape(w, label) {
  let sum = 0;
  for (const k of WEIGHT_KEYS) {
    const v = Number(w[k]);
    if (!Number.isFinite(v)) {
      throw new Error(`${label}: missing or invalid weight "${k}"`);
    }
    sum += v;
  }
  if (Math.abs(sum - 1) > 0.02) {
    throw new Error(`${label}: weights must sum to 1, got ${sum}`);
  }
}

/**
 * @returns {Record<'KZ8A'|'TE33A', Record<string, number>>}
 */
function getDefaultHealthWeights() {
  const out = {
    KZ8A: { ...PROFILES.KZ8A.healthWeights },
    TE33A: { ...PROFILES.TE33A.healthWeights },
  };
  assertWeightsShape(out.KZ8A, 'PROFILES.KZ8A.healthWeights');
  assertWeightsShape(out.TE33A, 'PROFILES.TE33A.healthWeights');
  return out;
}

/**
 * Alert + rule-engine thresholds (shared by evaluateAlerts + health subsystems).
 * Units: °C, bar, %, A — see README HK-033.
 */
function getDefaultAlertThresholds() {
  return {
    engine_temp_crit: 100,
    engine_temp_warn: 90,
    brake_pressure_crit: 4.5,
    brake_pressure_drop_warn: 0.3,
    speed_margin_warn: 0.98,
    current_anomaly_te33a: 500,
    current_anomaly_kz8a: 650,
    current_delta_warn: 180,
    signal_quality_crit: 70,
    signal_quality_warn: 85,
    fault_count_crit: 3,
  };
}

/**
 * Renormalize partial weight patch to sum 1 across the five keys.
 * @param {string} profileId
 * @param {Record<string, number>} patch
 */
function normalizeWeightsPatch(profileId, patch) {
  const base = getDefaultHealthWeights()[profileId];
  if (!base) return { ...getDefaultHealthWeights().KZ8A };
  const merged = { ...base };
  for (const k of WEIGHT_KEYS) {
    if (patch[k] != null && patch[k] !== '') {
      const v = Number(patch[k]);
      if (Number.isFinite(v)) merged[k] = Math.max(0, Math.min(1, v));
    }
  }
  const sum = WEIGHT_KEYS.reduce((a, k) => a + merged[k], 0);
  if (sum < 1e-9) return { ...base };
  const out = {};
  for (const k of WEIGHT_KEYS) {
    out[k] = merged[k] / sum;
  }
  return out;
}

module.exports = {
  WEIGHT_KEYS,
  getDefaultHealthWeights,
  getDefaultAlertThresholds,
  normalizeWeightsPatch,
  assertWeightsShape,
};
