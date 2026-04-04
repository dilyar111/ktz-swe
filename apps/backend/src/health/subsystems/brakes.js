/**
 * Brakes subsystem — pneumatic / brake pipe pressure vs safe minimum.
 * Weight in aggregate: 25%
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

/** @param {Record<string, number|string>} input normalized telemetry */
function computeBrakes(input) {
  let score = 100;
  /** @type {Array<{ name: string, impact: number, reason: string }>} */
  const contributors = [];

  const bp = input.brake_pressure;
  if (Number.isFinite(bp) && bp < 4.5) {
    contributors.push({
      name: 'Low brake pressure',
      impact: 25,
      reason: 'Brake pressure below safe threshold (<4.5 bar) — verify brake pipe and reservoirs',
    });
    score -= 25;
  }

  score = clamp(score);
  return { score, status: statusFromScore(score), contributors };
}

module.exports = { computeBrakes };
