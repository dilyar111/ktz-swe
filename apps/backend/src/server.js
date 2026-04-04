require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSocket, emitToAll } = require('./socket');
const { HistoryBuffer } = require('./historyBuffer');
const { computeHealthForClient } = require('./health');

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

/** @type {import('socket.io').Server | null} */
let io = null;

const history = new HistoryBuffer({ maxMs: 15 * 60 * 1000 });

/** Последний snapshot + health для быстрого REST и демо без ожидания WebSocket */
const currentStore = {
  /** @type {{ snapshot: object, health: object } | null} */
  lastOverall: null,
  /** @type {Map<string, { snapshot: object, health: object }>} */
  byComposite: new Map(),
  /** @type {Map<string, { snapshot: object, health: object }>} */
  byType: new Map(),
  /** @type {Map<string, { snapshot: object, health: object }>} */
  byLocomotiveId: new Map(),
};

/**
 * @param {object} snapshot
 * @param {object} health
 */
function rememberCurrent(snapshot, health) {
  const pair = { snapshot, health };
  currentStore.lastOverall = pair;
  currentStore.byComposite.set(`${snapshot.locomotiveType}:${snapshot.locomotiveId}`, pair);
  currentStore.byType.set(snapshot.locomotiveType, pair);
  currentStore.byLocomotiveId.set(snapshot.locomotiveId, pair);
}

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '512kb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ktz-api',
    uptimeSec: Math.round(process.uptime()),
    at: new Date().toISOString(),
  });
});

/** Minimal ingest — расширить валидацией и профилями KZ8A / TE33A */
app.post('/api/telemetry/ingest', (req, res) => {
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

  history.push(ts, snapshot);


  const health = computeHealthForClient(snapshot);
  rememberCurrent(snapshot, health);

  emitToAll(io, 'telemetry:update', { snapshot, health });
  emitToAll(io, 'health:update', health);

  res.status(202).json({ accepted: true, health });
});

/**
 * Текущий snapshot (после ingest симулятора данные всегда актуальны).
 * Query: locomotiveType, locomotiveId — можно вместе или по отдельности; без query — последний глобально.
 */
app.get('/api/current', (req, res) => {
  const locomotiveType = typeof req.query.locomotiveType === 'string' ? req.query.locomotiveType.trim() : '';
  const locomotiveId = typeof req.query.locomotiveId === 'string' ? req.query.locomotiveId.trim() : '';

  let pair = null;
  if (locomotiveType && locomotiveId) {
    pair = currentStore.byComposite.get(`${locomotiveType}:${locomotiveId}`) ?? null;
  } else if (locomotiveType) {
    pair = currentStore.byType.get(locomotiveType) ?? null;
  } else if (locomotiveId) {
    pair = currentStore.byLocomotiveId.get(locomotiveId) ?? null;
  } else {
    pair = currentStore.lastOverall;
  }

  if (!pair) {
    return res.status(404).json({ error: 'no snapshot' });
  }
  res.json({ snapshot: pair.snapshot, health: pair.health });
});

app.get('/api/history', (req, res) => {
  const from = req.query.from ? Number(req.query.from) : Date.now() - 15 * 60 * 1000;
  const to = req.query.to ? Number(req.query.to) : Date.now();
  const locomotiveType = typeof req.query.locomotiveType === 'string' ? req.query.locomotiveType.trim() : '';
  const locomotiveId = typeof req.query.locomotiveId === 'string' ? req.query.locomotiveId.trim() : '';
  const limit = req.query.limit ? Number(req.query.limit) : 0;

  let rows = history.getRange(from, to);

  if (locomotiveType) {
    rows = rows.filter((r) => r.payload && r.payload.locomotiveType === locomotiveType);
  }

  if (locomotiveId) {
    rows = rows.filter((r) => r.payload && r.payload.locomotiveId === locomotiveId);
  }

  if (limit > 0) {
    rows = rows.slice(0, limit);
  }

  res.json({
    from,
    to,
    count: rows.length,
    locomotiveType: locomotiveType || undefined,
    locomotiveId: locomotiveId || undefined,
    limit: limit || undefined,
    entries: rows,
  });
});

io = initSocket(server, CLIENT_URL);

/**
 * One-shot DX banner: backend is up; poll until Vite answers and telemetry exists (or timeout).
 * No stack traces — only console lines.
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
    } catch {
      /* dev server not up yet */
    }

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
  void printSystemReadyBanner();
});
