/**
 * Authoritative snapshot + health (from HK-004 engine at ingest) + active alerts for REST bootstrap.
 */

/** @type {{ snapshot: object, health: object, alerts: object[] } | null} */
let lastOverall = null;

/** @type {Map<string, { snapshot: object, health: object, alerts: object[] }>} */
const byComposite = new Map();

/** @type {Map<string, { snapshot: object, health: object, alerts: object[] }>} */
const byType = new Map();

/** @type {Map<string, { snapshot: object, health: object, alerts: object[] }>} */
const byLocomotiveId = new Map();

/**
 * @param {object} snapshot
 * @param {object} health — from computeHealthForClient (health engine)
 * @param {object[]} alerts
 */
function rememberCurrent(snapshot, health, alerts) {
  const pair = { snapshot, health, alerts };
  lastOverall = pair;
  byComposite.set(`${snapshot.locomotiveType}:${snapshot.locomotiveId}`, pair);
  byType.set(snapshot.locomotiveType, pair);
  byLocomotiveId.set(snapshot.locomotiveId, pair);
}

/**
 * @param {{ locomotiveType?: string, locomotiveId?: string }} q
 * @returns {{ snapshot: object, health: object, alerts: object[] } | null}
 */
function getCurrentEntry(q) {
  const locomotiveType = typeof q.locomotiveType === 'string' ? q.locomotiveType.trim() : '';
  const locomotiveId = typeof q.locomotiveId === 'string' ? q.locomotiveId.trim() : '';

  if (locomotiveType && locomotiveId) {
    return byComposite.get(`${locomotiveType}:${locomotiveId}`) ?? null;
  }
  if (locomotiveType) {
    return byType.get(locomotiveType) ?? null;
  }
  if (locomotiveId) {
    return byLocomotiveId.get(locomotiveId) ?? null;
  }
  return lastOverall;
}

module.exports = {
  rememberCurrent,
  getCurrentEntry,
};
