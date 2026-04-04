require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSocket, emitToAll } = require('./socket');
const { HistoryBuffer } = require('./historyBuffer');


const { getAllProfiles, getProfile } = require('./profiles/index');

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

/** @type {import('socket.io').Server | null} */
let io = null;

const history = new HistoryBuffer({ maxMs: 15 * 60 * 1000 });

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


app.get('/api/profiles', (_req, res) => {
  res.json({ profiles: getAllProfiles() });
});

// один профиль по типу
app.get('/api/profiles/:type', (req, res) => {
  const profile = getProfile(req.params.type.toUpperCase());

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json({ profile });
});

app.get('/api/current', (req, res) => {
  const type = req.query.locomotiveType?.toUpperCase();
  const rows = history.getRange(Date.now() - 15 * 60 * 1000, Date.now());
  if (rows.length === 0) return res.status(404).json({ error: 'no data' });

  const filtered = type
    ? rows.filter((r) => r.data?.locomotiveType === type)
    : rows;

  const last = filtered.length > 0
    ? filtered[filtered.length - 1].data
    : rows[rows.length - 1].data;

  const health = computeHealthStub(last);
  res.json({ snapshot: last, health });
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

  const health = computeHealthStub(snapshot);

  emitToAll(io, 'telemetry:update', { snapshot, health });
  emitToAll(io, 'health:update', health);

  res.status(202).json({ accepted: true, health });
});

app.get('/api/history', (req, res) => {
  const from = req.query.from ? Number(req.query.from) : Date.now() - 15 * 60 * 1000;
  const to = req.query.to ? Number(req.query.to) : Date.now();
  const rows = history.getRange(from, to);
  res.json({ from, to, count: rows.length, entries: rows });
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
  void printSystemReadyBanner();
});

/**
 * Заглушка health
 */
function computeHealthStub(s) {
  const profile = getProfile(s.locomotiveType);
  const thresholds = profile ? profile.thresholds : {};
  const weights = profile ? profile.healthWeights : {};
  const recommendations = profile ? profile.recommendations : {};

  const contributors = [];
  let totalPenalty = 0;

  // --- Thermal / diesel penalties ---
  const temp = Number(s.oilTempC ?? s.engineTempC ?? s.oil_temp ?? s.inverter_temp ?? 70);
  const tempKey = s.locomotiveType === 'TE33A' ? 'oil_temp' : 'inverter_temp';
  const tempThresh = thresholds[tempKey] ?? { warn: 85, crit: 100 };
  if (temp >= tempThresh.crit) {
    const penalty = 25;
    totalPenalty += penalty;
    contributors.push({ key: 'thermal', label: 'Temperature critical', penalty });
  } else if (temp >= tempThresh.warn) {
    const penalty = 12;
    totalPenalty += penalty;
    contributors.push({ key: 'thermal', label: 'Temperature warning', penalty });
  }

  // --- Brake pressure penalties ---
  const brake = Number(s.brakePressure ?? s.brake_pressure ?? 999);
  const brakeThresh = thresholds['brake_pressure'] ?? { warnLow: 350, critLow: 300 };
  if (brake < brakeThresh.critLow) {
    const penalty = 25;
    totalPenalty += penalty;
    contributors.push({ key: 'brakes', label: 'Brake pressure critical', penalty });
  } else if (brake < brakeThresh.warnLow) {
    const penalty = 12;
    totalPenalty += penalty;
    contributors.push({ key: 'brakes', label: 'Brake pressure low', penalty });
  }

  // --- Speed penalties ---
  const speed = Number(s.speedKmh ?? s.speed ?? 0);
  const speedThresh = thresholds['speed'] ?? { warn: 100, crit: 120 };
  if (speed >= speedThresh.crit) {
    const penalty = 20;
    totalPenalty += penalty;
    contributors.push({ key: 'traction', label: 'Overspeed critical', penalty });
  } else if (speed >= speedThresh.warn) {
    const penalty = 8;
    totalPenalty += penalty;
    contributors.push({ key: 'traction', label: 'Overspeed warning', penalty });
  }

  // --- Fault codes ---
  const faults = Number(s.faultCodeCount ?? s.fault_count ?? 0);
  const faultThresh = thresholds['fault_count'] ?? { warn: 1, crit: 3 };
  if (faults >= faultThresh.crit) {
    const penalty = 20;
    totalPenalty += penalty;
    contributors.push({ key: 'signaling', label: 'Multiple fault codes', penalty });
  } else if (faults >= faultThresh.warn) {
    const penalty = 8;
    totalPenalty += penalty;
    contributors.push({ key: 'signaling', label: 'Fault code active', penalty });
  }

  // --- Signal quality (TE33A only) ---
  const signal = Number(s.signalQuality ?? s.signal_quality ?? 100);
  const sigThresh = thresholds['signal_quality'] ?? { warnLow: 60, critLow: 30 };
  if (signal < sigThresh.critLow) {
    const penalty = 15;
    totalPenalty += penalty;
    contributors.push({ key: 'signaling', label: 'Signal loss critical', penalty });
  } else if (signal < sigThresh.warnLow) {
    const penalty = 7;
    totalPenalty += penalty;
    contributors.push({ key: 'signaling', label: 'Signal quality low', penalty });
  }

  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  // --- Recommendation ---
  let recommendation = recommendations.default ?? 'Продолжать наблюдение';
  if (contributors.length > 0) {
    const top = contributors[0].key;
    const isCrit = score < 50;
    const recKey = `${top}_${isCrit ? 'crit' : 'warn'}`;
    recommendation = recommendations[recKey] ?? recommendations.default ?? recommendation;
  }

  return {
    score: Math.round(score),
    class: score >= 80 ? 'A' : score >= 50 ? 'C' : 'E',
    status: score >= 80 ? 'normal' : score >= 50 ? 'warning' : 'critical',
    contributors: contributors.sort((a, b) => b.penalty - a.penalty).slice(0, 5),
    recommendation,
    locomotiveType: s.locomotiveType,
    profileUsed: profile ? profile.id : 'fallback',
  };
}