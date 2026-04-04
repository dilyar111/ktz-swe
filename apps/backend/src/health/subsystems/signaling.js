/**
 * Signaling & control — telemetry link quality and active fault codes (diagnostics).
 * Weight in aggregate: 10%
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
function computeSignaling(input) {
  let score = 100;
  /** @type {Array<{ name: string, impact: number, reason: string }>} */
  const contributors = [];

  const sq = Number.isFinite(input.signal_quality) ? input.signal_quality : 100;
  if (sq < 70) {
    contributors.push({
      name: 'Poor signal quality',
      impact: 20,
      reason: 'Telemetry / cab signaling quality below 70% — risk of delayed updates',
    });
    score -= 20;
  }

  const fc = Number.isFinite(input.fault_count) ? input.fault_count : 0;
  if (fc > 0) {
    const impact = Math.min(25, fc * 8);
    contributors.push({
      name: 'Active fault codes',
      impact,
      reason: `${fc} unresolved on-board fault(s) — verify diagnostics and interlocks`,
    });
    score -= impact;
  }

  score = clamp(score);
  return { score, status: statusFromScore(score), contributors };
}

module.exports = { computeSignaling };
