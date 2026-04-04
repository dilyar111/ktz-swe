/**
 * HK-004 — Explainable Health Index (rule-based, no ML).
 *
 * Weighted subsystem scores → total index, letter class, overall status, top contributors.
 *
 * Example output (illustrative):
 * {
 *   "total_score": 72,
 *   "class": "C",
 *   "status": "warning",
 *   "profile": "KZ8A",
 *   "subsystems": {
 *     "traction": { "score": 90, "status": "normal", "contributors": [] },
 *     "brakes": { "score": 75, "status": "warning", "contributors": [{ "name": "Low brake pressure", "impact": 25, "reason": "..." }] },
 *     ...
 *   },
 *   "top_contributors": [
 *     { "name": "Low brake pressure", "impact": 25, "subsystem": "brakes", "reason": "Brake pressure below safe threshold (<4.5 bar)..." }
 *   ]
 * }
 */

const { normalizeTelemetry } = require('./normalize');
const { getProfileConfig } = require('./profiles');
const { computeTraction } = require('./subsystems/traction');
const { computeBrakes } = require('./subsystems/brakes');
const { computeThermal } = require('./subsystems/thermal');
const { computeElectrical } = require('./subsystems/electrical');
const { computeSignaling } = require('./subsystems/signaling');

/** @deprecated use getProfileConfig(type).weights — KZ8A defaults for backward compatibility */
const WEIGHTS = getProfileConfig('KZ8A').weights;

/** @param {number} total */
function classFromTotal(total) {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 50) return 'D';
  return 'E';
}

/** @param {number} total — same bands as legacy cockpit ring */
function statusFromTotal(total) {
  if (total >= 80) return 'normal';
  if (total >= 50) return 'warning';
  return 'critical';
}

/**
 * @param {Record<string, unknown>} snapshot — raw telemetry row from ingest
 */
function computeHealth(snapshot) {
  const input = normalizeTelemetry(snapshot);
  const profile = getProfileConfig(input.locomotiveType ?? snapshot.locomotiveType);

  const traction = computeTraction(input);
  const brakes = computeBrakes(input);
  const thermal = computeThermal(input, profile);
  const electrical = computeElectrical(input, profile);
  const signaling = computeSignaling(input);

  const subsystems = {
    traction: {
      score: traction.score,
      status: traction.status,
      contributors: traction.contributors,
    },
    brakes: {
      score: brakes.score,
      status: brakes.status,
      contributors: brakes.contributors,
    },
    thermal: {
      score: thermal.score,
      status: thermal.status,
      contributors: thermal.contributors,
    },
    electrical: {
      score: electrical.score,
      status: electrical.status,
      contributors: electrical.contributors,
    },
    signaling: {
      score: signaling.score,
      status: signaling.status,
      contributors: signaling.contributors,
    },
  };

  const w = profile.weights;
  const total_score = Math.round(
    w.traction * traction.score +
      w.brakes * brakes.score +
      w.thermal * thermal.score +
      w.electrical * electrical.score +
      w.signaling * signaling.score
  );

  /** @type {Array<{ name: string, impact: number, reason: string, subsystem: string }>} */
  const flat = [];
  for (const [key, sub] of Object.entries(subsystems)) {
    for (const c of sub.contributors) {
      flat.push({ ...c, subsystem: key });
    }
  }
  flat.sort((a, b) => b.impact - a.impact);
  const top_contributors = flat.slice(0, 5).map(({ name, impact, reason, subsystem }) => ({
    name,
    impact,
    reason,
    subsystem,
  }));

  return {
    total_score,
    class: classFromTotal(total_score),
    status: statusFromTotal(total_score),
    profile: profile.profileId,
    subsystems,
    top_contributors,
  };
}

/**
 * Payload for WebSocket + HTTP: full explainability + legacy fields for existing UI.
 * @param {Record<string, unknown>} snapshot
 */
function computeHealthForClient(snapshot) {
  const engine = computeHealth(snapshot);
  const locomotiveType = String(snapshot.locomotiveType ?? 'KZ8A');

  return {
    ...engine,
    /** @deprecated use total_score — kept for cockpit ring */
    score: engine.total_score,
    locomotiveType,
    contributors: engine.top_contributors.map((c, i) => ({
      key: `${c.subsystem}_${i}`,
      label: c.name,
      penalty: c.impact,
      reason: c.reason,
      subsystem: c.subsystem,
    })),
  };
}

module.exports = {
  computeHealth,
  computeHealthForClient,
  normalizeTelemetry,
  getProfileConfig,
  WEIGHTS,
};
