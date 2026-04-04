/**
 * Traction subsystem — speed envelope vs route limit, mechanical vibration (demo rule).
 * Weight in aggregate: 30%
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
function computeTraction(input) {
  let score = 100;
  /** @type {Array<{ name: string, impact: number, reason: string }>} */
  const contributors = [];

  const speed = Number.isFinite(input.speed) ? input.speed : 0;
  const limit = Number.isFinite(input.speed_limit) ? input.speed_limit : 80;

  if (speed > limit) {
    contributors.push({
      name: 'Route overspeed',
      impact: 10,
      reason: `Travel speed exceeds permitted route limit (${limit} km/h) — traction monitoring`,
    });
    score -= 10;
  }

  if (speed > limit + 20) {
    contributors.push({
      name: 'Critical overspeed margin',
      impact: 15,
      reason: 'Speed far above route envelope — risk to traction equipment and braking distance',
    });
    score -= 15;
  }

  const vib = Number.isFinite(input.vibration) ? input.vibration : 0;
  if (vib > 10) {
    contributors.push({
      name: 'High drivetrain vibration',
      impact: 12,
      reason: 'Vibration above maintenance threshold — check bogies / motor mounts',
    });
    score -= 12;
  }

  score = clamp(score);
  return { score, status: statusFromScore(score), contributors };
}

module.exports = { computeTraction };
