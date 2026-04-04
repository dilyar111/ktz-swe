const { ALERT_STATUSES } = require('@ktz/shared');

/**
 * compositeKey ({locomotiveType}:{locomotiveId}) -> Map<string, AlertSchema>
 */
const activeAlertsStore = new Map();

/**
 * Retains alert ID and acked state across ticks
 */
function updateAlertsForLocomotive(locomotiveType, locomotiveId, currentAlertsList) {
  const compositeKey = `${locomotiveType}:${locomotiveId}`;
  if (!activeAlertsStore.has(compositeKey)) {
    activeAlertsStore.set(compositeKey, new Map());
  }

  const existingMap = activeAlertsStore.get(compositeKey);
  const nextMap = new Map();
  const activeAlerts = [];

  for (const a of currentAlertsList) {
    if (existingMap.has(a.code)) {
      const old = existingMap.get(a.code);
      const merged = {
        ...a,
        id: old.id,
        acked: old.acked || false,
        ackedAt: old.ackedAt || null,
      };
      nextMap.set(a.code, merged);
      activeAlerts.push(merged);
    } else {
      const fresh = {
        ...a,
        acked: false,
        ackedAt: null,
      };
      nextMap.set(a.code, fresh);
      activeAlerts.push(fresh);
    }
  }

  activeAlertsStore.set(compositeKey, nextMap);
  return activeAlerts.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
}

/**
 * Retrieve active alerts optionally filtered by type and id
 */
function getActiveAlerts(locomotiveType, locomotiveId) {
  let result = [];
  if (locomotiveType && locomotiveId) {
    const store = activeAlertsStore.get(`${locomotiveType}:${locomotiveId}`);
    if (store) result = Array.from(store.values());
  } else {
    for (const [key, store] of activeAlertsStore.entries()) {
      if (locomotiveType && !key.startsWith(locomotiveType + ':')) continue;
      if (locomotiveId && !key.endsWith(':' + locomotiveId)) continue;
      result.push(...store.values());
    }
  }
  return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Acknowledge an alert by ID
 */
function ackAlert(id) {
  for (const store of activeAlertsStore.values()) {
    for (const [code, alert] of store.entries()) {
      if (alert.id === id) {
        alert.acked = true;
        alert.ackedAt = new Date().toISOString();
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  updateAlertsForLocomotive,
  getActiveAlerts,
  ackAlert
};
