require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSocket, emitToAll } = require('./socket');
const { HistoryBuffer } = require('./historyBuffer');

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

server.listen(PORT, () => {
  console.log(`KTZ API: http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/health`);
});

/**
 * Заглушка: прозрачная формула для демо (заменить rule engine + ML слой).
 * @param {object} s
 */
function computeHealthStub(s) {
  const speed = Number(s.speedKmh ?? s.speed ?? 0);
  const temp = Number(s.engineTempC ?? s.oilTempC ?? 70);
  const penaltyTemp = Math.max(0, temp - 85) * 2;
  const penaltySpeed = speed > 100 ? (speed - 100) * 0.5 : 0;
  const score = Math.max(0, Math.min(100, 100 - penaltyTemp - penaltySpeed));
  const contributors = [];
  if (penaltyTemp > 0) contributors.push({ key: 'thermal', label: 'Temperature', penalty: Math.round(penaltyTemp) });
  if (penaltySpeed > 0) contributors.push({ key: 'speed', label: 'Overspeed', penalty: Math.round(penaltySpeed) });
  return {
    score: Math.round(score),
    class: score >= 80 ? 'A' : score >= 50 ? 'C' : 'E',
    status: score >= 80 ? 'normal' : score >= 50 ? 'warning' : 'critical',
    contributors,
    locomotiveType: s.locomotiveType,
  };
}
