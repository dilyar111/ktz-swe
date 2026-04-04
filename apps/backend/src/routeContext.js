/**
 * HK-014 — deterministic route/track context for cockpit (no GIS).
 * @param {object} snapshot — telemetry snapshot (speedKmh, optional speedLimitKmh, demoScenario, …)
 * @param {string} [fallbackScenario] — from server scenario state when payload omits demoScenario
 * @returns {{
 *   currentSegmentId: string,
 *   currentPositionLabel: string,
 *   nextSegmentLabel: string,
 *   speedLimitKmh: number,
 *   restrictionReason?: string
 * }}
 */
function computeRouteContext(snapshot, fallbackScenario = 'normal') {
  const speedKmh = Number(snapshot?.speedKmh ?? snapshot?.speed ?? 0) || 0;
  const published = Number(snapshot?.speedLimitKmh);
  const hasPublished = Number.isFinite(published) && published > 0;

  const scenarioRaw =
    snapshot?.demoScenario != null && snapshot.demoScenario !== ''
      ? String(snapshot.demoScenario)
      : String(fallbackScenario ?? 'normal');

  /** Tier from current speed — segment + nominal limit for this track class */
  let currentSegmentId;
  let tierLimit;
  let nextSegmentLabel;

  if (speedKmh < 40) {
    currentSegmentId = 'station-zone';
    tierLimit = 40;
    nextSegmentLabel = 'Main line';
  } else if (speedKmh <= 80) {
    currentSegmentId = 'main-line';
    tierLimit = 80;
    nextSegmentLabel = 'Curve section';
  } else {
    currentSegmentId = 'high-speed-section';
    tierLimit = 100;
    nextSegmentLabel = 'Station zone';
  }

  /** Stricter of infrastructure limit (e.g. 80) and tier — enables overspeed demo on high-speed tier */
  const speedLimitKmh = hasPublished ? Math.min(tierLimit, published) : tierLimit;

  const ts = snapshot?.timestamp ? Date.parse(String(snapshot.timestamp)) : Date.now();
  const safeTs = Number.isFinite(ts) ? ts : Date.now();
  const km = 110 + ((safeTs % 100000) / 10000) + ((speedKmh * 0.03) % 5);
  const currentPositionLabel = `km ${km.toFixed(1)}`;

  const reasons = [];
  if (speedKmh > speedLimitKmh) {
    reasons.push('Overspeed risk');
  }
  if (scenarioRaw === 'signal_loss') {
    reasons.push('Signal degradation ahead');
  }

  const out = {
    currentSegmentId,
    currentPositionLabel,
    nextSegmentLabel,
    speedLimitKmh,
  };
  if (reasons.length) {
    out.restrictionReason = reasons.join('; ');
  }
  return out;
}

module.exports = { computeRouteContext };
