'use strict';

/**
 * HK-036 — Supplementary intelligence (rule-based, explainable).
 * Does not replace HK-004 health; exposes trends, short-horizon risk heuristics, and operator hints.
 */

const { computeHealthForClient } = require('../health');

function num(v, fallback = NaN) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {Array<{ ts: number, payload: object }>} entries
 * @param {string} locomotiveType
 * @param {string} locomotiveId
 */
function filterLoco(entries, locomotiveType, locomotiveId) {
  const id = String(locomotiveId);
  return entries.filter((e) => {
    const p = e.payload && typeof e.payload === 'object' ? e.payload : {};
    return String(p.locomotiveType) === String(locomotiveType) && String(p.locomotiveId ?? '') === id;
  });
}

/**
 * @param {object} snap
 */
function thermalProbe(snap) {
  const t = num(snap.engineTempC, NaN);
  const oil = num(snap.oilTempC, NaN);
  const cool = num(snap.coolantTempC, NaN);
  if (String(snap.locomotiveType).toUpperCase() === 'TE33A') {
    const pool = [t, oil, cool].filter((x) => Number.isFinite(x));
    return pool.length ? Math.max(...pool) : NaN;
  }
  return Number.isFinite(t) ? t : oil;
}

/**
 * @param {object} snapshot
 * @param {object} health — computeHealthForClient result
 * @param {{ getRange: (from: number, to: number) => Array<{ ts: number, payload: object }> }} historyBuffer
 * @param {string} locomotiveType
 * @param {string} locomotiveId
 * @param {number} [atMs] — ingest timestamp (aligns with history `ts`)
 */
function buildIntelligence(snapshot, health, historyBuffer, locomotiveType, locomotiveId, atMs) {
  const now = Number.isFinite(atMs) ? atMs : Date.now();
  const windowMs = 5 * 60 * 1000;
  const range = historyBuffer.getRange(now - windowMs, now);
  const locoEntries = filterLoco(range, locomotiveType, locomotiveId).sort((a, b) => a.ts - b.ts);

  const hNow = Number(health.total_score ?? health.score ?? 0);
  let healthAtWindowStart = null;
  let oldestTs = null;
  if (locoEntries.length > 0) {
    const oldest = locoEntries[0];
    oldestTs = oldest.ts;
    healthAtWindowStart = computeHealthForClient(oldest.payload).total_score ?? 0;
  }

  const healthDelta5 =
    healthAtWindowStart != null && Number.isFinite(healthAtWindowStart)
      ? Math.round(hNow - healthAtWindowStart)
      : null;

  let slopePerMin = 0;
  if (oldestTs != null && locoEntries.length >= 2) {
    const dtMin = (now - oldestTs) / 60000;
    if (dtMin > 0.05) {
      slopePerMin = (hNow - healthAtWindowStart) / dtMin;
    }
  }

  /** Linear extrapolation: current score + slope * 30 min (6 × 5-min steps) */
  const projected30 = Math.round(hNow + slopePerMin * 30);
  const projectedClamped = Math.max(0, Math.min(100, projected30));
  const riskRaw = (100 - projectedClamped) / 100;
  let band = 'low';
  if (riskRaw > 0.5) band = 'high';
  else if (riskRaw > 0.22) band = 'medium';

  /** Anomaly: deviation of thermal + brake from window median (rule-based, not ML) */
  let anomalyScore = 0;
  const temps = locoEntries.map((e) => thermalProbe(e.payload)).filter((x) => Number.isFinite(x));
  const brakes = locoEntries.map((e) => num(e.payload.brakePressureBar, NaN)).filter((x) => Number.isFinite(x));
  const curTemp = thermalProbe(snapshot);
  const curBrake = num(snapshot.brakePressureBar, NaN);
  if (temps.length >= 3 && Number.isFinite(curTemp)) {
    const sorted = [...temps].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    anomalyScore += Math.min(45, Math.abs(curTemp - med) * 1.2);
  }
  if (brakes.length >= 3 && Number.isFinite(curBrake)) {
    const sorted = [...brakes].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    anomalyScore += Math.min(40, Math.abs(curBrake - med) * 25);
  }
  anomalyScore = Math.round(Math.min(100, anomalyScore + (health.top_contributors?.length ? 5 : 0)));

  /** What changed — metric deltas oldest → current */
  const changes = [];
  if (locoEntries.length > 0) {
    const first = locoEntries[0].payload;
    const sp0 = num(first.speedKmh, NaN);
    const sp1 = num(snapshot.speedKmh, NaN);
    if (Number.isFinite(sp0) && Number.isFinite(sp1) && Math.abs(sp1 - sp0) > 0.5) {
      changes.push({ key: 'speedKmh', from: sp0, to: sp1, delta: Math.round((sp1 - sp0) * 10) / 10 });
    }
    const t0 = thermalProbe(first);
    const t1 = thermalProbe(snapshot);
    if (Number.isFinite(t0) && Number.isFinite(t1) && Math.abs(t1 - t0) > 0.3) {
      changes.push({ key: 'thermal', from: t0, to: t1, delta: Math.round((t1 - t0) * 10) / 10 });
    }
    const b0 = num(first.brakePressureBar, NaN);
    const b1 = num(snapshot.brakePressureBar, NaN);
    if (Number.isFinite(b0) && Number.isFinite(b1) && Math.abs(b1 - b0) > 0.02) {
      changes.push({ key: 'brakePressureBar', from: b0, to: b1, delta: Math.round((b1 - b0) * 100) / 100 });
    }
    const sq0 = num(first.signalQualityPct, NaN);
    const sq1 = num(snapshot.signalQualityPct, NaN);
    if (Number.isFinite(sq0) && Number.isFinite(sq1) && Math.abs(sq1 - sq0) > 1) {
      changes.push({ key: 'signalQualityPct', from: sq0, to: sq1, delta: Math.round(sq1 - sq0) });
    }
  }

  const top = Array.isArray(health.top_contributors) && health.top_contributors[0] ? health.top_contributors[0] : null;
  const smartHint = buildSmartHint({
    band,
    healthDelta5,
    slopePerMin,
    projectedHealth: projectedClamped,
    topContributor: top,
    locomotiveType,
    demoScenario: snapshot.demoScenario,
  });

  return {
    primaryTruth: 'rule_based_health',
    windowMinutes: 5,
    sampleCount5m: locoEntries.length,
    healthScore: hNow,
    healthScoreDelta5m: healthDelta5,
    slopeHealthPerMin: Math.round(slopePerMin * 100) / 100,
    riskNext30Min: {
      band,
      score01: Math.round(riskRaw * 1000) / 1000,
      projectedHealth: projectedClamped,
      /** Rule: if slope stable ~5m, linear extrapolation; capped 0–100 */
      method: 'linear_extrapolation_5m_window',
    },
    anomalyScore,
    anomalyMethod: 'median_deviation_thermal_brake',
    metricChanges5m: changes,
    smartHint,
  };
}

/**
 * @param {object} p
 */
function buildSmartHint(p) {
  const { band, healthDelta5, topContributor, locomotiveType, demoScenario } = p;
  const projectedHealth = p.projectedHealth;
  const sev = band === 'high' ? 'critical' : band === 'medium' ? 'warning' : 'normal';
  let title = 'Режим стабилен по краткосрочному тренду';
  let detail =
    'Индекс здоровья и ключевые параметры в выбранном окне не показывают устойчивого ухудшения. Продолжайте мониторинг подсистем.';

  if (band === 'high') {
    title = 'Повышенный риск снижения индекса в горизонте ~30 мин';
    detail =
      'По линейной экстраполяции тренда за 5 мин индекс может приблизиться к ' +
      (typeof projectedHealth === 'number' ? projectedHealth : 'нижним') +
      ' баллам. Сфокусируйтесь на доминирующем факторе и снизьте нагрузку на проблемную подсистему.';
  } else if (band === 'medium') {
    title = 'Умеренный риск: наблюдайте тренд';
    detail =
      'Зафиксировано изменение индекса за окно. Проверьте тепловой режим, тормозной ресурс и качество связи до выхода в критический коридор.';
  }

  if (typeof healthDelta5 === 'number' && healthDelta5 < -5) {
    title = 'Индекс снижается за последние 5 минут';
    detail = `Δ индекса ≈ ${healthDelta5} пунктов. Сопоставьте с топ-факторами и ограничьте режим до стабилизации.`;
  } else if (typeof healthDelta5 === 'number' && healthDelta5 > 4) {
    title = 'Положительная динамика индекса';
    detail = `Индекс вырос примерно на ${healthDelta5} пунктов относительно начала 5-минутного окна.`;
  }

  if (topContributor && topContributor.name) {
    detail += ` Приоритет внимания: ${topContributor.name} (${topContributor.subsystem ?? 'подсистема'}).`;
  }

  if (demoScenario && String(demoScenario).toLowerCase() !== 'normal') {
    detail += ` Учитывайте активный учебный сценарий «${demoScenario}».`;
  }

  if (locomotiveType === 'TE33A') {
    detail += ' Профиль TE33A: контролируйте силовую установку и вспомогательное напряжение.';
  }

  return { severity: sev, title, detail };
}

module.exports = { buildIntelligence };
