'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { computeHealth, computeHealthForClient } = require('../src/health');

/** Nominal snapshot so one subsystem can be stressed in isolation */
function nominalKz8A(overrides = {}) {
  return {
    locomotiveType: 'KZ8A',
    locomotiveId: 'KZ8A-TEST-01',
    speedKmh: 45,
    engineTempC: 70,
    brakePressureBar: 5.0,
    tractionCurrentA: 350,
    lineVoltageV: 25000,
    faultCodeCount: 0,
    signalQualityPct: 99,
    speedLimitKmh: 80,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function nominalTe33A(overrides = {}) {
  return {
    locomotiveType: 'TE33A',
    locomotiveId: 'TE33A-TEST-01',
    speedKmh: 45,
    engineTempC: 70,
    brakePressureBar: 5.0,
    tractionCurrentA: 300,
    batteryVoltageV: 27.5,
    faultCodeCount: 0,
    signalQualityPct: 99,
    speedLimitKmh: 80,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('HK-004 health engine', () => {
  it('total_score stays within 0–100 for varied snapshots', () => {
    const cases = [
      nominalKz8A(),
      nominalKz8A({ engineTempC: 105, brakePressureBar: 3.0, tractionCurrentA: 950, signalQualityPct: 40 }),
      nominalTe33A({ engineTempC: 98, brakePressureBar: 4.0 }),
      nominalKz8A({ lineVoltageV: 10000 }),
      { locomotiveType: 'KZ8A', speedKmh: 0, timestamp: new Date().toISOString() },
    ];
    for (const snap of cases) {
      const h = computeHealth(snap);
      assert.ok(
        h.total_score >= 0 && h.total_score <= 100,
        `score out of range for ${JSON.stringify(snap).slice(0, 80)}: ${h.total_score}`
      );
      const client = computeHealthForClient(snap);
      assert.ok(client.total_score >= 0 && client.total_score <= 100);
      assert.strictEqual(client.score, client.total_score);
    }
  });

  it('top_contributors and client contributors are populated when subsystems penalize', () => {
    const h = computeHealth(nominalKz8A({ brakePressureBar: 3.5 }));
    assert.ok(h.top_contributors.length >= 1, 'expected brake-related contributors');
    assert.ok(h.top_contributors[0].name && h.top_contributors[0].reason);
    const c = computeHealthForClient(nominalKz8A({ brakePressureBar: 3.5 }));
    assert.ok(Array.isArray(c.contributors));
    assert.ok(c.contributors.length >= 1);
    assert.ok(c.contributors.every((x) => x.label && x.reason));
  });

  it('KZ8A vs TE33A: same overheat stress yields different thermal score (profile weights + multiplier)', () => {
    const stress = {
      engineTempC: 95,
      brakePressureBar: 5.2,
      speedKmh: 40,
      tractionCurrentA: 400,
      faultCodeCount: 0,
      signalQualityPct: 100,
      speedLimitKmh: 80,
      timestamp: new Date().toISOString(),
    };
    const kz = computeHealth({ ...stress, locomotiveType: 'KZ8A', locomotiveId: 'k', lineVoltageV: 25000 });
    const te = computeHealth({
      ...stress,
      locomotiveType: 'TE33A',
      locomotiveId: 't',
      batteryVoltageV: 27,
    });
    assert.ok(te.subsystems.thermal.score < kz.subsystems.thermal.score);
    assert.notStrictEqual(kz.profile, te.profile);
    assert.strictEqual(kz.profile, 'KZ8A');
    assert.strictEqual(te.profile, 'TE33A');
  });

  it('KZ8A vs TE33A: aggregate weights differ (electrical heavier on KZ8A)', () => {
    const kz = computeHealth(nominalKz8A());
    const te = computeHealth(nominalTe33A());
    assert.ok(kz.weights.electrical > te.weights.electrical);
    assert.ok(te.weights.thermal > kz.weights.thermal);
  });

  /**
   * Regression: weighted total must use profile weights (TE33A thermal 0.35 vs KZ8A 0.20 from profiles).
   * If weights were accidentally uniform, total_score would often match across profiles for similar inputs.
   */
  it('regression: TE33A and KZ8A totals diverge for identical multi-subsystem stress', () => {
    const stress = {
      engineTempC: 92,
      brakePressureBar: 4.0,
      speedKmh: 50,
      tractionCurrentA: 200,
      faultCodeCount: 1,
      signalQualityPct: 75,
      speedLimitKmh: 80,
      timestamp: new Date().toISOString(),
    };
    const kz = computeHealth({ ...stress, locomotiveType: 'KZ8A', locomotiveId: 'k', lineVoltageV: 25000 });
    const te = computeHealth({ ...stress, locomotiveType: 'TE33A', locomotiveId: 't', batteryVoltageV: 27 });
    assert.notStrictEqual(kz.total_score, te.total_score);
  });
});
