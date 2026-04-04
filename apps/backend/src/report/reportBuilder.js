'use strict';

const { computeHealthForClient } = require('../health');

/**
 * @param {{ ts?: number, payload?: object }} entry
 */
function historyEntryTimeMs(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  const tBuf = entry.ts;
  if (typeof tBuf === 'number' && Number.isFinite(tBuf)) return tBuf;
  const p = entry.payload;
  if (!p || typeof p !== 'object') return 0;
  const raw = p.timestamp ?? p.createdAt ?? p.receivedAt ?? p.ts;
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @param {object} alert
 * @param {number} fromMs
 * @param {number} toMs
 */
function alertInWindow(alert, fromMs, toMs) {
  const t = new Date(alert.timestamp).getTime();
  return Number.isFinite(t) && t >= fromMs && t <= toMs;
}

/**
 * @param {number[]} scores
 * @param {Array<{ ts: number }>} rows
 */
function healthDropMarkers(scores, rows) {
  /** @type {object[]} */
  const out = [];
  for (let i = 1; i < scores.length; i++) {
    const drop = scores[i - 1] - scores[i];
    if (drop >= 12) {
      out.push({
        kind: 'health_drop',
        at: new Date(rows[i].ts).toISOString(),
        ts: rows[i].ts,
        previousScore: scores[i - 1],
        score: scores[i],
        delta: Math.round(drop * 10) / 10,
      });
    }
  }
  return out;
}

/**
 * HK-013 — Incident / replay window report (in-memory history + alert store).
 *
 * @param {{
 *   history: import('../historyBuffer').HistoryBuffer,
 *   getActiveAlerts: (locomotiveType: string, locomotiveId: string) => object[],
 * }} deps
 * @param {{
 *   locomotiveType: string,
 *   locomotiveId: string,
 *   fromMs: number,
 *   toMs: number,
 * }} q
 */
function buildIncidentReport(deps, q) {
  const { history, getActiveAlerts } = deps;
  const { locomotiveType, locomotiveId, fromMs, toMs } = q;

  let rows = history.getRange(fromMs, toMs);
  rows = rows.filter(
    (r) =>
      r.payload &&
      r.payload.locomotiveType === locomotiveType &&
      r.payload.locomotiveId === locomotiveId
  );
  rows.sort((a, b) => historyEntryTimeMs(a) - historyEntryTimeMs(b));

  /** @type {number[]} */
  const scores = [];
  /** @type {object[]} */
  const healthSeries = [];

  for (const e of rows) {
    const h = computeHealthForClient(e.payload);
    const score = Number(h.total_score ?? h.score ?? 0);
    scores.push(score);
    healthSeries.push({ ts: e.ts, health: h });
  }

  const lastHealth = healthSeries.length ? healthSeries[healthSeries.length - 1].health : null;

  let healthSummary;
  if (scores.length === 0) {
    healthSummary = {
      min: null,
      max: null,
      avg: null,
      lastScore: null,
      class: null,
      samples: 0,
    };
  } else {
    const sum = scores.reduce((a, b) => a + b, 0);
    healthSummary = {
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: Math.round((sum / scores.length) * 10) / 10,
      lastScore: scores[scores.length - 1],
      class: lastHealth && lastHealth.class != null ? String(lastHealth.class) : null,
      samples: scores.length,
    };
  }

  const activeAlertsSnapshot = getActiveAlerts(locomotiveType, locomotiveId);
  const alertsInWindow = activeAlertsSnapshot.filter((a) => alertInWindow(a, fromMs, toMs));

  const fromAlerts = alertsInWindow.map((a) => ({
    kind: 'alert',
    at: a.timestamp,
    code: a.code,
    severity: a.severity,
    title: a.title,
  }));

  const healthDrops = scores.length > 1 ? healthDropMarkers(scores, rows) : [];
  const incidentMarkers = [...fromAlerts, ...healthDrops];

  const topContributors = lastHealth?.top_contributors
    ? lastHealth.top_contributors.slice(0, 5).map((c) => ({
        name: c.name,
        impact: c.impact,
        subsystem: c.subsystem,
        reason: c.reason,
      }))
    : [];

  const recSet = new Set();
  for (const a of alertsInWindow) {
    if (a.recommendation && String(a.recommendation).trim()) {
      recSet.add(String(a.recommendation).trim());
    }
  }
  if (recSet.size === 0 && topContributors[0]?.reason) {
    recSet.add(String(topContributors[0].reason));
  }

  const recommendationsSummary = [...recSet].slice(0, 12);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      locomotiveType,
      locomotiveId,
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      sampleCount: rows.length,
    },
    healthSummary,
    activeAlertsSnapshot,
    alertsInWindow,
    incidentMarkers,
    topContributors,
    recommendationsSummary,
  };
}

/**
 * @param {string} cell
 */
function csvCell(cell) {
  const s = cell == null ? '' : String(cell);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {ReturnType<typeof buildIncidentReport>} report
 */
function reportToCsv(report) {
  const lines = [];
  lines.push(['section', 'key', 'value'].map(csvCell).join(','));
  const m = report.meta;
  for (const [k, v] of Object.entries(m)) {
    lines.push(['meta', k, v].map(csvCell).join(','));
  }
  const hs = report.healthSummary;
  for (const [k, v] of Object.entries(hs)) {
    lines.push(['healthSummary', k, v === null || v === undefined ? '' : v].map(csvCell).join(','));
  }
  lines.push(['section', 'text'].map(csvCell).join(','));
  for (const r of report.recommendationsSummary) {
    lines.push(['recommendation', r].map(csvCell).join(','));
  }
  lines.push(
    ['topContributors', 'name', 'impact', 'subsystem', 'reason']
      .map(csvCell)
      .join(',')
  );
  for (const c of report.topContributors) {
    lines.push(
      ['', c.name, c.impact, c.subsystem, c.reason].map(csvCell).join(',')
    );
  }
  lines.push(
    [
      'incidentMarkers',
      'kind',
      'at',
      'code',
      'severity',
      'title',
      'delta',
      'score',
    ]
      .map(csvCell)
      .join(',')
  );
  for (const x of report.incidentMarkers) {
    if (x.kind === 'alert') {
      lines.push(
        [
          '',
          x.kind,
          x.at,
          x.code,
          x.severity,
          x.title,
          '',
          '',
        ]
          .map(csvCell)
          .join(',')
      );
    } else {
      lines.push(
        [
          '',
          x.kind,
          x.at,
          '',
          '',
          '',
          x.delta,
          x.score,
        ]
          .map(csvCell)
          .join(',')
      );
    }
  }
  lines.push(
    [
      'alertsInWindow',
      'timestamp',
      'code',
      'severity',
      'title',
      'message',
      'recommendation',
      'acked',
    ]
      .map(csvCell)
      .join(',')
  );
  for (const a of report.alertsInWindow) {
    lines.push(
      [
        '',
        a.timestamp,
        a.code,
        a.severity,
        a.title,
        a.message,
        a.recommendation,
        a.acked ? 'yes' : 'no',
      ]
        .map(csvCell)
      .join(',')
    );
  }
  lines.push(
    [
      'activeAlertsSnapshot',
      'timestamp',
      'code',
      'severity',
      'title',
      'acked',
    ]
      .map(csvCell)
      .join(',')
  );
  for (const a of report.activeAlertsSnapshot) {
    lines.push(
      [
        '',
        a.timestamp,
        a.code,
        a.severity,
        a.title,
        a.acked ? 'yes' : 'no',
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return '\ufeff' + lines.join('\r\n');
}

module.exports = {
  buildIncidentReport,
  reportToCsv,
  historyEntryTimeMs,
};
