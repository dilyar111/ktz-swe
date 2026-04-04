/**
 * Синтетическая телеметрия → POST /api/telemetry/ingest
 * Частота по умолчанию 1 Гц (1000 ms). Профиль: KZ8A или TE33A через LOCOMOTIVE_TYPE.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const root = resolve(__dirname, '../../../.env');
  try {
    const raw = readFileSync(root, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      let v = m[2].trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* no root .env */
  }
}

loadEnv();

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS) || 1000;
const TYPE = (process.env.LOCOMOTIVE_TYPE || 'KZ8A').toUpperCase();

let tick = 0;

function sampleTelemetry() {
  tick += 1;
  const t = Date.now();
  const base =
    TYPE === 'TE33A'
      ? {
          locomotiveType: 'TE33A',
          locomotiveId: 'TE33A-DEMO-01',
          speedKmh: 45 + Math.sin(tick / 20) * 8,
          engineTempC: 72 + (tick % 400) * 0.05,
          oilTempC: 68 + (tick % 300) * 0.04,
          brakePressureBar: 4.8 + Math.sin(tick / 15) * 0.1,
          fuelLevelPct: 62 - tick * 0.001,
          tractionCurrentA: 280 + Math.sin(tick / 10) * 40,
          faultCodeCount: tick > 200 && tick < 260 ? 1 : 0,
          signalQualityPct: 97,
        }
      : {
          locomotiveType: 'KZ8A',
          locomotiveId: 'KZ8A-DEMO-01',
          speedKmh: 52 + Math.cos(tick / 18) * 10,
          engineTempC: 65 + (tick % 350) * 0.06,
          oilTempC: 60 + (tick % 280) * 0.05,
          brakePressureBar: 5.0 + Math.sin(tick / 12) * 0.08,
          tractionCurrentA: 420 + Math.sin(tick / 8) * 60,
          lineVoltageV: 25000 + Math.sin(tick / 25) * 200,
          faultCodeCount: 0,
          signalQualityPct: 99,
        };

  return {
    ...base,
    timestamp: new Date(t).toISOString(),
    lat: 51.12 + tick * 1e-5,
    lon: 71.43 + tick * 1e-5,
    routeId: 'route-demo-1',
    speedLimitKmh: 80,
  };
}

async function sendOnce() {
  const body = sampleTelemetry();
  const res = await fetch(`${BACKEND}/api/telemetry/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`ingest failed ${res.status}: ${text}`);
  }
}

console.log(`Simulator → ${BACKEND} every ${INTERVAL_MS}ms type=${TYPE}`);
sendOnce().catch(console.error);
setInterval(() => sendOnce().catch(console.error), INTERVAL_MS);
