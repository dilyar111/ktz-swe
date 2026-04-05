/**
 * Thermal subsystem — engine / oil temperature tiers.
 * Thresholds from settingsStore (same source as alerts).
 */

/** @param {number} score */
function statusFromScore(score) {
  if (score >= 80) return 'normal';
  if (score >= 50) return 'warning';
  return 'critical';
}

function clamp(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * @param {Record<string, number|string>} input normalized telemetry
 * @param {{ thermalImpactMultiplier?: number }} [profile] from getProfileConfig()
 */
function computeThermal(input, profile = {}) {
  const mult = Number(profile.thermalImpactMultiplier) > 0 ? profile.thermalImpactMultiplier : 1;
  const { getSettings } = require('../../settingsStore');
  const t = getSettings().thresholds;
  const crit = Number(t.engine_temp_crit);
  const warn = Number(t.engine_temp_warn);

  let score = 100;
  /** @type {Array<{ name: string, impact: number, reason: string }>} */
  const contributors = [];

  const temp = input.engine_temp;
  if (!Number.isFinite(temp)) {
    return { score: 100, status: 'normal', contributors: [] };
  }

  if (Number.isFinite(crit) && temp > crit) {
    const impact = Math.round(40 * mult);
    contributors.push({
      name: 'Severe engine overheating',
      impact,
      reason: `Engine overheating detected (>${crit}°C) — reduce load and inspect cooling circuit`,
    });
    score -= impact;
  } else if (Number.isFinite(warn) && temp > warn) {
    const impact = Math.round(20 * mult);
    contributors.push({
      name: 'Elevated engine temperature',
      impact,
      reason: `Engine temperature above ${warn}°C — monitor thermal headroom`,
    });
    score -= impact;
  }

  score = clamp(score);
  return { score, status: statusFromScore(score), contributors };
}

module.exports = { computeThermal };
