import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let computeHealth = null;
try {
  // Try to load backend logic to derive health class
  // It requires relative path into the backend package
  const healthModule = require('../../backend/src/health/index.js');
  computeHealth = healthModule.computeHealth;
} catch (err) {
  console.warn("⚠️ Could not load backend health module. Health class will be omitted. Exception:", err.message);
}

const OUT_DIR = path.resolve(__dirname, '../../../artifacts/datasets');
const OUT_FILE = path.join(OUT_DIR, 'synthetic_dataset.csv');

// Replicate simulator telemetry generation
let tick = 0;

function sampleTelemetry(type) {
  tick += 1;
  const t = Date.now() - (1000 * 60 * 60 * 24) + (tick * 1000); // Spread across yesterday
  const isTe = type === 'TE33A';
  const base = isTe
    ? {
        locomotiveType: 'TE33A',
        locomotiveId: 'TE33A-SM-1',
        speedKmh: 45 + Math.sin(tick / 20) * 8,
        engineTempC: 72 + (tick % 400) * 0.05,
        oilTempC: 68 + (tick % 300) * 0.04,
        brakePressureBar: 4.8 + Math.sin(tick / 15) * 0.1,
        fuelLevelPct: 62 - tick * 0.001,
        tractionCurrentA: 280 + Math.sin(tick / 10) * 40,
        batteryVoltageV: 27.5 + Math.sin(tick / 30) * 0.3,
        faultCodeCount: tick > 200 && tick < 260 ? 1 : 0,
        signalQualityPct: 97,
      }
    : {
        locomotiveType: 'KZ8A',
        locomotiveId: 'KZ8A-SM-1',
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
    routeId: 'dataset-run-1',
    speedLimitKmh: 80,
  };
}

function applyScenario(baseTelemetry, scenario) {
  const s = String(scenario || 'normal').toLowerCase();
  const limit = Number(baseTelemetry.speedLimitKmh) || 80;
  const isTe = baseTelemetry.locomotiveType === 'TE33A';
  const out = { ...baseTelemetry, demoScenario: s };

  switch (s) {
    case 'normal': {
      const stableTemp = isTe ? 72 + Math.sin(tick / 40) * 2 : 68 + Math.sin(tick / 40) * 2;
      return {
        ...out,
        engineTempC: stableTemp,
        oilTempC: isTe ? stableTemp - 2 : out.oilTempC,
        brakePressureBar: isTe ? 4.85 : 5.0,
        signalQualityPct: 98,
        faultCodeCount: 0,
        speedKmh: Math.min(Number(out.speedKmh) || 0, limit - 5),
        vibrationMmS: 2 + Math.sin(tick / 22) * 0.5,
      };
    }
    case 'warning_overheat': {
      const hi = 92 + (tick % 7);
      return { ...out, engineTempC: hi, oilTempC: isTe ? hi - 1 : out.oilTempC, vibrationMmS: 4 };
    }
    case 'critical': {
      const hi = 103 + (tick % 5);
      return { ...out, engineTempC: hi, oilTempC: isTe ? hi - 1 : out.oilTempC, tractionCurrentA: Number(out.tractionCurrentA) + 80, vibrationMmS: 6 };
    }
    case 'brake_drop': {
      const low = 3.9 + (tick % 5) * 0.08;
      return { ...out, brakePressureBar: low };
    }
    case 'signal_loss': {
      return { ...out, signalQualityPct: 52 + (tick % 5), faultCodeCount: 2 + (tick % 2) };
    }
    case 'highload': {
      const over = limit + 18 + (tick % 4);
      const next = { ...out, speedKmh: over, tractionCurrentA: isTe ? 920 : 980, vibrationMmS: 12 + (tick % 3) };
      if (!isTe) next.lineVoltageV = 26800;
      else next.batteryVoltageV = 34;
      return next;
    }
    default:
      return { ...out, demoScenario: 'normal' };
  }
}

// Convert camelCase object to CSV row
const ALL_KEYS = [
  'timestamp', 'locomotiveType', 'locomotiveId', 'demoScenario',
  'speedKmh', 'speedLimitKmh', 'engineTempC', 'oilTempC', 'brakePressureBar',
  'fuelLevelPct', 'tractionCurrentA', 'batteryVoltageV', 'lineVoltageV',
  'faultCodeCount', 'signalQualityPct', 'vibrationMmS', 'lat', 'lon',
  'healthScore', 'healthClass', 'healthStatus'
];

function flattenToCsvRow(obj) {
  return ALL_KEYS.map(k => {
    let v = obj[k];
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return `"${v}"`;
    if (typeof v === 'number') {
      // Small precision for neatness
      return Number.isInteger(v) ? v : v.toFixed(3);
    }
    return v;
  }).join(',');
}

async function run() {
  console.log(`🚀 Starting generation of Synthetic Dataset...`);
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const fd = fs.openSync(OUT_FILE, 'w');
  fs.writeSync(fd, ALL_KEYS.join(',') + '\n');

  const types = ['KZ8A', 'TE33A'];
  const scenarios = ['normal', 'warning_overheat', 'critical', 'brake_drop', 'signal_loss', 'highload'];
  const TICKS_PER = 1000; // 1000 data points per scenario per locomotive = approx 16 mins of data each

  let totalRows = 0;

  for (const type of types) {
    for (const scenario of scenarios) {
      for (let i = 0; i < TICKS_PER; i++) {
        const raw = sampleTelemetry(type);
        const data = applyScenario(raw, scenario);
        
        let healthScore = '', healthClass = '', healthStatus = '';
        if (computeHealth) {
          try {
             // Translate names for the backend compatibility
             const mappedData = { 
               ...data, 
               speed: data.speedKmh, 
               speed_limit: data.speedLimitKmh,
               engine_temp: data.engineTempC,
               brake_pressure: data.brakePressureBar,
               current: data.tractionCurrentA,
               signal_quality: data.signalQualityPct,
               fault_count: data.faultCodeCount
             };

             // This requires dotenv to process health settings correctly if settingsStore throws
             const h = computeHealth(mappedData);
             healthScore = h.total_score;
             healthClass = h.class;
             healthStatus = h.status;
          } catch(e) { 
             /* ignore normalize failures */ 
          }
        }

        const out = {
          ...data,
          healthScore,
          healthClass,
          healthStatus
        };

        fs.writeSync(fd, flattenToCsvRow(out) + '\n');
        totalRows++;
      }
    }
  }

  fs.closeSync(fd);
  console.log(`✅ Generated ${totalRows} rows of telemetry.`);
  console.log(`✅ Dataset saved to: ${OUT_FILE}`);
}

run().catch(console.error);
