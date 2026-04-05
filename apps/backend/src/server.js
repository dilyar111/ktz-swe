require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { initSocket, emitToAll } = require('./socket');
const { HistoryBuffer } = require('./historyBuffer');
const { computeHealthForClient } = require('./health');
const { buildRecommendations } = require('./recommendations/buildRecommendations');
const { buildIntelligence } = require('./intelligence/buildIntelligence');
const { evaluateAlerts } = require('./alerts');
const { updateAlertsForLocomotive, getActiveAlerts, ackAlert } = require('./alerts/store');
const { rememberCurrent, getCurrentEntry } = require('./currentStore');
const { buildIncidentReport, reportToCsv } = require('./report/reportBuilder');

const { getAllProfiles, getProfile } = require('./profiles/index');
const { VALID_SCENARIOS, getScenario, setScenario } = require('./scenarioState');
const { getSettings, updateSettings } = require('./settingsStore');
const { computeRouteContext } = require('./routeContext');

const openApiDocument = require('./openapi/openapi.json');

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
/** HK-021 supplementary ML risk (FastAPI) — optional */
const ML_RISK_URL = (process.env.ML_RISK_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

const app = express();
const server = http.createServer(app);

/** @type {import('socket.io').Server | null} */
let io = null;

const history = new HistoryBuffer({ maxMs: 15 * 60 * 1000 });

/** Throughput metrics for highload mode */
const throughputStats = {
  ingestCount: 0,
  totalLatencyMs: 0
};

setInterval(() => {
  if (throughputStats.ingestCount > 0) {
    const rate = throughputStats.ingestCount;
    const avgLatency = throughputStats.totalLatencyMs / rate;
    console.log(`[Highload] Throughput: ${rate} msg/s | Avg Latency: ${avgLatency.toFixed(2)} ms`);
    if (io) {
      io.emit('telemetry:throughput', { rate, avgLatency });
    }
  } else if (io) {
    io.emit('telemetry:throughput', { rate: 0, avgLatency: 0 });
  }
  throughputStats.ingestCount = 0;
  throughputStats.totalLatencyMs = 0;
}, 1000);

/** Состояние для дельт (тормоза, ток, коды) — ключ locomotiveType:locomotiveId */
const telemetryState = new Map();

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '512kb' }));

/** HK-017 — OpenAPI 3 spec (machine-readable) */
app.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

/** HK-017 — Swagger UI */
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'KTZ Digital Twin API',
    customCss: '.swagger-ui .topbar { display: none }',
  })
);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ktz-api',
    uptimeSec: Math.round(process.uptime()),
    at: new Date().toISOString(),
  });
});


app.get('/api/profiles', (_req, res) => {
  res.json({ profiles: getAllProfiles() });
});

app.get('/api/settings', (_req, res) => {
  res.json(getSettings());
});

app.patch('/api/settings', (req, res) => {
  const current = updateSettings(req.body);
  res.json(current);
});

// один профиль по типу
app.get('/api/profiles/:type', (req, res) => {
  const profile = getProfile(req.params.type.toUpperCase());

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json({ profile });
});

app.get('/api/scenario', (_req, res) => {
  const state = getScenario();
  res.json({
    scenario: state.scenario,
    locomotiveType: state.locomotiveType,
    valid: [...VALID_SCENARIOS],
  });
});

app.post('/api/scenario', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const previous = getScenario();
  const result = setScenario(body.scenario, body.locomotiveType);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }
  if (result.scenario !== previous.scenario) {
    console.log(`⚙️ Scenario switched to: ${result.scenario}`);
  }
  if (result.locomotiveType !== previous.locomotiveType) {
    console.log(`🚂 Locomotive type switched to: ${result.locomotiveType}`);
  }
  res.json({ ok: true, scenario: result.scenario, locomotiveType: result.locomotiveType });
});

/** Minimal ingest — расширить валидацией и профилями KZ8A / TE33A */
app.post('/api/telemetry/ingest', (req, res) => {
  const startMs = performance.now();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const ts = body.timestamp ? Date.parse(body.timestamp) : Date.now();
  if (Number.isNaN(ts)) {
    return res.status(400).json({ error: 'invalid timestamp' });
  }

  const locomotiveId = body.locomotiveId ?? 'demo-001';
  const locomotiveType = body.locomotiveType ?? 'KZ8A';

  const snapshot = {
    ...body,
    locomotiveId,
    locomotiveType,
    timestamp: new Date(ts).toISOString(),
    receivedAt: new Date().toISOString(),
  };

  const routeContext = computeRouteContext(snapshot, getScenario().scenario);
  const snapshotWithRoute = { ...snapshot, routeContext };

  history.push(ts, snapshotWithRoute);

  const compositeKey = `${locomotiveType}:${locomotiveId}`;
  const prevState = telemetryState.get(compositeKey) ?? null;
  const { alerts: freshAlerts, nextState } = evaluateAlerts(snapshotWithRoute, prevState);
  telemetryState.set(compositeKey, nextState);

  const activeAlerts = updateAlertsForLocomotive(locomotiveType, locomotiveId, freshAlerts);

  const healthBase = computeHealthForClient(snapshotWithRoute);
  const intelligence = buildIntelligence(
    snapshotWithRoute,
    healthBase,
    history,
    locomotiveType,
    locomotiveId,
    ts
  );
  const recommendations = buildRecommendations(snapshotWithRoute, healthBase, activeAlerts, intelligence);
  const health = { ...healthBase, recommendations, intelligence };
  rememberCurrent(snapshotWithRoute, health, activeAlerts);

  const alertsPayload = {
    locomotiveId,
    locomotiveType,
    alerts: activeAlerts,
    timestamp: snapshot.timestamp,
  };

  emitToAll(io, 'telemetry:update', { snapshot: snapshotWithRoute, health, alerts: activeAlerts });
  emitToAll(io, 'alerts:update', alertsPayload);
  emitToAll(io, 'health:update', health);

  const endMs = performance.now();
  throughputStats.ingestCount += 1;
  throughputStats.totalLatencyMs += (endMs - startMs);

  res.status(202).json({ accepted: true, health, alerts: activeAlerts });
});

/**
 * Текущий snapshot из currentStore (health вычислен движком HK-004 на ingest).
 * Query: locomotiveType, locomotiveId — вместе или по отдельности; без query — последний глобально.
 */
app.get('/api/current', (req, res) => {
  const pair = getCurrentEntry(req.query);
  if (!pair) {
    return res.status(404).json({ error: 'no snapshot' });
  }
  res.json({
    snapshot: pair.snapshot,
    health: pair.health,
    alerts: Array.isArray(pair.alerts) ? pair.alerts : [],
  });
});

/**
 * HK-021 — proxy to Python ML risk service (supplementary indicator; rule-based health is primary).
 * GET /api/ml/risk?locomotiveType=&locomotiveId=
 */
function mlPayloadFromPair(pair) {
  const snap = pair.snapshot && typeof pair.snapshot === 'object' ? pair.snapshot : {};
  const health = pair.health && typeof pair.health === 'object' ? pair.health : {};
  const num = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    speedKmh: num(snap.speedKmh),
    speedLimitKmh: num(snap.speedLimitKmh),
    engineTempC: num(snap.engineTempC),
    oilTempC: num(snap.oilTempC),
    brakePressureBar: num(snap.brakePressureBar),
    fuelLevelPct: snap.fuelLevelPct != null ? num(snap.fuelLevelPct) : null,
    tractionCurrentA: num(snap.tractionCurrentA ?? snap.current),
    batteryVoltageV: num(snap.batteryVoltageV),
    lineVoltageV: num(snap.lineVoltageV),
    faultCodeCount: num(snap.faultCodeCount),
    signalQualityPct: num(snap.signalQualityPct),
    vibrationMmS: num(snap.vibrationMmS),
    healthScore: num(health.total_score ?? health.score),
    locomotiveType: String(snap.locomotiveType ?? 'KZ8A'),
  };
}

app.get('/api/ml/risk', async (req, res) => {
  const locomotiveType =
    typeof req.query.locomotiveType === 'string' ? req.query.locomotiveType.trim() : '';
  const locomotiveId =
    typeof req.query.locomotiveId === 'string' ? req.query.locomotiveId.trim() : '';
  const pair = getCurrentEntry({ locomotiveType, locomotiveId });
  if (!pair) {
    return res.status(404).json({ mlAvailable: false, error: 'no snapshot' });
  }
  const body = mlPayloadFromPair(pair);
  try {
    const r = await fetch(`${ML_RISK_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) {
      const text = await r.text();
      // 200 so DevTools does not treat optional ML as a failed HTTP request; clients use mlAvailable.
      return res.status(200).json({ mlAvailable: false, error: text || `ML HTTP ${r.status}` });
    }
    const json = await r.json();
    return res.json({ mlAvailable: true, ...json });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(200).json({ mlAvailable: false, error: msg });
  }
});

/**
 * HK-028 — deterministic time for sorting / limiting history rows.
 * Uses buffer `ts` first; then payload.timestamp, createdAt, receivedAt (parsed safely).
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

const HISTORY_LIMIT_MAX = 100000;

/**
 * Returns the latest `limit` rows by time (or all if limit is 0), then orders for the response.
 *
 * - Default: newest → oldest (desc). Same request + same data → same order (stable tie-break by input index).
 * - `limit` applies to the *most recent* N entries by timestamp (after filters), not “first N in buffer order”.
 * - `order=asc`: same N entries, reversed → oldest → newest (replay / time-series charts).
 */
function applyHistoryLimitAndOrder(rows, limit, orderAsc) {
  const indexed = rows.map((row, i) => ({ row, i }));
  indexed.sort((a, b) => {
    const dt = historyEntryTimeMs(b.row) - historyEntryTimeMs(a.row);
    if (dt !== 0) return dt;
    return a.i - b.i;
  });
  let ordered = indexed.map((x) => x.row);
  if (limit > 0 && ordered.length > limit) {
    ordered = ordered.slice(0, limit);
  }
  if (orderAsc) {
    ordered = ordered.slice().reverse();
  }
  return ordered;
}
app.get('/api/alerts', (req, res) => {
  const locomotiveType = typeof req.query.locomotiveType === 'string' ? req.query.locomotiveType.trim() : '';
  const locomotiveId = typeof req.query.locomotiveId === 'string' ? req.query.locomotiveId.trim() : '';
  
  const alerts = getActiveAlerts(locomotiveType, locomotiveId);
  res.json({ alerts });
});

app.post('/api/alerts/:id/ack', (req, res) => {
  const success = ackAlert(req.params.id);
  if (success) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

app.get('/api/history', (req, res) => {
  const from = req.query.from ? Number(req.query.from) : Date.now() - 15 * 60 * 1000;
  const to = req.query.to ? Number(req.query.to) : Date.now();
  const locomotiveType = typeof req.query.locomotiveType === 'string' ? req.query.locomotiveType.trim() : '';
  const locomotiveId = typeof req.query.locomotiveId === 'string' ? req.query.locomotiveId.trim() : '';

  let limit = 0;
  const limitRaw = req.query.limit;
  if (limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== '') {
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(Math.floor(n), HISTORY_LIMIT_MAX);
    }
  }

  const orderRaw = String(req.query.order ?? '')
    .trim()
    .toLowerCase();
  const orderAsc = orderRaw === 'asc' || orderRaw === 'chronological';

  let rows = history.getRange(from, to);

  if (locomotiveType) {
    rows = rows.filter((r) => r.payload && r.payload.locomotiveType === locomotiveType);
  }

  if (locomotiveId) {
    rows = rows.filter((r) => r.payload && r.payload.locomotiveId === locomotiveId);
  }

  rows = applyHistoryLimitAndOrder(rows, limit, orderAsc);

  const includeHealth = ['1', 'true', 'yes'].includes(
    String(req.query.includeHealth ?? '').toLowerCase()
  );

  const entries = rows.map((e) => {
    const base = { ts: e.ts, payload: e.payload };
    if (includeHealth) {
      return { ...base, health: computeHealthForClient(e.payload) };
    }
    return base;
  });

  res.json({
    from,
    to,
    count: entries.length,
    locomotiveType: locomotiveType || undefined,
    locomotiveId: locomotiveId || undefined,
    limit: limit || undefined,
    order: orderAsc ? 'asc' : 'desc',
    includeHealth: includeHealth || undefined,
    entries,
  });
});

/**
 * HK-013 — Incident / replay window export (JSON or CSV).
 * Query: locomotiveType, locomotiveId, from, to (epoch ms), optional format=json|csv
 */
app.get('/api/report', (req, res) => {
  const locomotiveType =
    typeof req.query.locomotiveType === 'string' ? req.query.locomotiveType.trim() : '';
  const locomotiveId =
    typeof req.query.locomotiveId === 'string' ? req.query.locomotiveId.trim() : '';
  const fromMs = Number(req.query.from);
  const toMs = Number(req.query.to);

  if (!locomotiveType || !locomotiveId) {
    return res.status(400).json({ error: 'locomotiveType and locomotiveId are required' });
  }
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return res.status(400).json({ error: 'from and to must be numeric epoch timestamps (ms)' });
  }
  if (fromMs > toMs) {
    return res.status(400).json({ error: 'from must be <= to' });
  }

  const formatRaw = String(req.query.format ?? 'json')
    .trim()
    .toLowerCase();
  const asCsv = formatRaw === 'csv';

  const report = buildIncidentReport(
    { history, getActiveAlerts },
    { locomotiveType, locomotiveId, fromMs, toMs }
  );

  if (asCsv) {
    const safeId = locomotiveId.replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ktz-incident-report-${locomotiveType}-${safeId}.csv"`
    );
    return res.send(reportToCsv(report));
  }

  res.json(report);
});

io = initSocket(server, CLIENT_URL);

/**
 * One-shot DX banner
 */
async function printSystemReadyBanner() {
  const maxWaitMs = 60000;
  const deadline = Date.now() + maxWaitMs;
  let frontendOk = false;
  let telemetryOk = false;

  while (Date.now() < deadline && (!frontendOk || !telemetryOk)) {
    try {
      const r = await fetch(CLIENT_URL, { signal: AbortSignal.timeout(2000) });
      if (r.ok) frontendOk = true;
    } catch {}

    const rows = history.getRange(Date.now() - 120000, Date.now());
    if (rows.length > 0) telemetryOk = true;

    if (frontendOk && telemetryOk) {
      console.log('\n🚀 System ready:');
      console.log('  ✅ backend: OK');
      console.log('  ✅ frontend: OK');
      console.log('  ✅ simulator: OK\n');
      return;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n🚀 System ready:');
  console.log('  ✅ backend: OK');
  console.log(
    frontendOk ? '  ✅ frontend: OK' : `  ⚠️ frontend: not reachable yet (${CLIENT_URL})`
  );
  console.log(
    telemetryOk
      ? '  ✅ simulator: OK'
      : '  ⚠️ simulator: no telemetry yet (is the simulator running?)'
  );
  console.log('');
}

server.listen(PORT, () => {
  console.log(`✅ KTZ API: http://localhost:${PORT}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
  console.log(`   OpenAPI: http://localhost:${PORT}/docs`);
  void printSystemReadyBanner();
});
