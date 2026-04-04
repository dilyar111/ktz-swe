/**
 * Electrical subsystem — voltage stability vs nominal (catenary for KZ8A, aux for TE33A when present).
 * Aggregate weight and HV band depend on profile (KZ8A: tighter ±%, stronger impact).
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
 * @param {{ electricalMaxDeviation?: number, electricalImpactMultiplier?: number }} [profile] from getProfileConfig()
 */
function computeElectrical(input, profile = {}) {
  const maxDev =
    Number(profile.electricalMaxDeviation) > 0 && Number(profile.electricalMaxDeviation) < 1
      ? profile.electricalMaxDeviation
      : 0.06;
  const impactMult =
    Number(profile.electricalImpactMultiplier) > 0 ? profile.electricalImpactMultiplier : 1;
  const baseImpact = 15;

  let score = 100;
  /** @type {Array<{ name: string, impact: number, reason: string }>} */
  const contributors = [];

  const v = input.voltage;
  const type = input.locomotiveType;

  if (!Number.isFinite(v) || v <= 0) {
    return { score: 100, status: 'normal', contributors: [] };
  }

  if (type === 'KZ8A' && v > 1000) {
    const nominal = 25000;
    const dev = Math.abs(v - nominal) / nominal;
    if (dev > maxDev) {
      const impact = Math.round(baseImpact * impactMult);
      const pctLabel = Math.round(maxDev * 100);
      contributors.push({
        name: 'Catenary voltage excursion',
        impact,
        reason: `Line voltage unstable — outside ±${pctLabel}% of 25 kV nominal (pantograph / grid interaction)`,
      });
      score -= impact;
    }
  } else if (type === 'TE33A' && v > 10 && v < 1000) {
    const low = 22;
    const high = 32;
    if (v < low || v > high) {
      const impact = Math.round(baseImpact * impactMult);
      contributors.push({
        name: 'Auxiliary electrical out of band',
        impact,
        reason: 'Battery / auxiliary voltage outside safe operating range',
      });
      score -= impact;
    }
  }

  score = clamp(score);
  return { score, status: statusFromScore(score), contributors };
}

module.exports = { computeElectrical };
