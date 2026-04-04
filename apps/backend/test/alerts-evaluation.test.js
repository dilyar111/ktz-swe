'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { evaluateAlerts } = require('../src/alerts/evaluateAlerts');

function ts() {
  return new Date().toISOString();
}

describe('alert evaluation rules', () => {
  it('overheat: critical when engine temp above crit threshold', () => {
    const { alerts } = evaluateAlerts(
      {
        locomotiveType: 'KZ8A',
        speedKmh: 40,
        engineTempC: 102,
        brakePressureBar: 5,
        tractionCurrentA: 200,
        signalQualityPct: 99,
        timestamp: ts(),
      },
      null
    );
    const over = alerts.find((a) => a.code === 'OVERHEATING');
    assert.ok(over);
    assert.strictEqual(over.severity, 'critical');
    assert.strictEqual(over.subsystem, 'thermal');
  });

  it('overheat: warning when engine temp above warn but below crit', () => {
    const { alerts } = evaluateAlerts(
      {
        locomotiveType: 'KZ8A',
        engineTempC: 94,
        brakePressureBar: 5,
        speedKmh: 30,
        tractionCurrentA: 200,
        signalQualityPct: 99,
        timestamp: ts(),
      },
      null
    );
    const over = alerts.find((a) => a.code === 'OVERHEATING');
    assert.ok(over);
    assert.strictEqual(over.severity, 'warning');
  });

  it('brake pressure drop: warns when pressure falls sharply vs previous tick while still above crit', () => {
    const prev = { brake_pressure: 5.2, current: 300, fault_count: 0 };
    const { alerts } = evaluateAlerts(
      {
        locomotiveType: 'KZ8A',
        brakePressureBar: 4.8,
        speedKmh: 40,
        engineTempC: 70,
        tractionCurrentA: 300,
        signalQualityPct: 99,
        timestamp: ts(),
      },
      prev
    );
    const br = alerts.find((a) => a.code === 'BRAKE_PRESSURE_DROP');
    assert.ok(br);
    assert.strictEqual(br.severity, 'warning');
    assert.match(br.message, /упало|→/i);
  });

  it('signal loss: critical when signal quality below crit threshold', () => {
    const { alerts } = evaluateAlerts(
      {
        locomotiveType: 'KZ8A',
        signalQualityPct: 55,
        speedKmh: 40,
        engineTempC: 70,
        brakePressureBar: 5,
        tractionCurrentA: 200,
        timestamp: ts(),
      },
      null
    );
    const sig = alerts.find((a) => a.code === 'SIGNAL_DEGRADATION');
    assert.ok(sig);
    assert.strictEqual(sig.severity, 'critical');
    assert.strictEqual(sig.subsystem, 'signaling');
  });

  it('KZ8A vs TE33A: current anomaly uses different absolute traction limits', () => {
    // Thresholds: TE33A critical > 500 A, KZ8A critical > 650 A — same reading can split profiles.
    const mid = 520;
    const kz = evaluateAlerts(
      {
        locomotiveType: 'KZ8A',
        speedKmh: 30,
        tractionCurrentA: mid,
        brakePressureBar: 5,
        engineTempC: 70,
        signalQualityPct: 99,
        timestamp: ts(),
      },
      null
    );
    const te = evaluateAlerts(
      {
        locomotiveType: 'TE33A',
        speedKmh: 30,
        tractionCurrentA: mid,
        brakePressureBar: 5,
        engineTempC: 70,
        signalQualityPct: 99,
        timestamp: ts(),
      },
      null
    );
    assert.ok(
      !kz.alerts.some((a) => a.code === 'CURRENT_ANOMALY' && a.severity === 'critical'),
      'KZ8A should not treat 520 A as over-limit'
    );
    assert.ok(
      te.alerts.some((a) => a.code === 'CURRENT_ANOMALY' && a.severity === 'critical'),
      'TE33A should treat 520 A as over-limit'
    );
  });

  /**
   * Regression: demo / ingest often hits "speed with near-zero current" — must keep issuing
   * the mismatch alert (was a recurring integration bug source).
   */
  it('regression: low traction current at meaningful speed yields CURRENT_ANOMALY warning', () => {
    const { alerts } = evaluateAlerts(
      {
        locomotiveType: 'KZ8A',
        speedKmh: 50,
        tractionCurrentA: 0,
        brakePressureBar: 5,
        engineTempC: 70,
        signalQualityPct: 99,
        timestamp: ts(),
      },
      null
    );
    const cur = alerts.filter((a) => a.code === 'CURRENT_ANOMALY');
    assert.ok(cur.length >= 1);
    assert.ok(cur.some((a) => a.title.includes('Несоответствие') || a.message.includes('аномально низкий')));
  });
});
