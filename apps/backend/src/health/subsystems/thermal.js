/**
 * Thermal subsystem — engine / oil temperature tiers (industrial thresholds).
 * Aggregate weight depends on profile (KZ8A vs TE33A).
 *
 * Rules (worst tier only): >100°C → −40, else >90°C → −20
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

  let score = 100;
  /** @type {Array<{ name: string, impact: number, reason: string }>} */
  const contributors = [];

  const temp = input.engine_temp;
  if (!Number.isFinite(temp)) {
    return { score: 100, status: 'normal', contributors: [] };
  }

  if (temp > 100) {
    const impact = Math.round(40 * mult);
    contributors.push({
      name: 'Severe engine overheating',
      impact,
      reason: 'Engine overheating detected (>100°C) — reduce load and inspect cooling circuit',
    });
    score -= impact;
  } else if (temp > 90) {
    const impact = Math.round(20 * mult);
    contributors.push({
      name: 'Elevated engine temperature',
      impact,
      reason: 'Engine temperature above 90°C — monitor thermal headroom',
    });
    score -= impact;
  }

  score = clamp(score);
  return { score, status: statusFromScore(score), contributors };
}

module.exports = { computeThermal };
