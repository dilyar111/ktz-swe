/**
 * Map ingest snapshot field names → canonical inputs for rule engine (KZ8A / TE33A tolerant).
 */

/**
 * @typedef {object} NormalizedTelemetry
 * @property {number} speed
 * @property {number} engine_temp
 * @property {number} brake_pressure
 * @property {number} voltage
 * @property {number} current
 * @property {number} vibration
 * @property {number} fault_count
 * @property {number} signal_quality
 * @property {number} speed_limit
 * @property {string} locomotiveType
 */

/**
 * @param {Record<string, unknown>} snapshot
 * @returns {NormalizedTelemetry}
 */
function normalizeTelemetry(snapshot) {
  const num = (v, fallback = NaN) => {
    if (v == null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const speed = num(snapshot.speedKmh ?? snapshot.speed, 0);
  const typeEarly = String(snapshot.locomotiveType ?? 'KZ8A').toUpperCase();
  /** TE33A: worst-case among engine / oil / coolant (diesel power unit). KZ8A: engine or oil as before. */
  let engineTemp = num(
    snapshot.engineTempC ?? snapshot.engine_temp ?? snapshot.oilTempC,
    NaN
  );
  if (typeEarly === 'TE33A') {
    const oil = num(snapshot.oilTempC, NaN);
    const cool = num(snapshot.coolantTempC, NaN);
    const eng = num(snapshot.engineTempC, NaN);
    const pool = [oil, cool, eng].filter((x) => Number.isFinite(x));
    if (pool.length > 0) {
      engineTemp = Math.max(...pool);
    }
  }
  const brakePressure = num(snapshot.brakePressureBar ?? snapshot.brake_pressure, NaN);
  const lineV = num(snapshot.lineVoltageV, NaN);
  const batV = num(snapshot.batteryVoltageV, NaN);
  const genV = num(snapshot.voltage, NaN);
  const type = typeEarly;
  const voltage =
    type === 'KZ8A'
      ? (Number.isFinite(lineV) ? lineV : genV)
      : Number.isFinite(genV)
        ? genV
        : Number.isFinite(batV)
          ? batV
          : NaN;

  return {
    speed,
    engine_temp: Number.isFinite(engineTemp) ? engineTemp : 70,
    brake_pressure: Number.isFinite(brakePressure) ? brakePressure : 5,
    voltage: Number.isFinite(voltage) ? voltage : 0,
    current: num(snapshot.tractionCurrentA ?? snapshot.current, 0),
    vibration: num(snapshot.vibrationMmS ?? snapshot.vibration, 0),
    fault_count: num(snapshot.faultCodeCount ?? snapshot.fault_count, 0),
    signal_quality: num(snapshot.signalQualityPct ?? snapshot.signal_quality, 100),
    speed_limit: num(snapshot.speedLimitKmh ?? snapshot.speed_limit, 80),
    locomotiveType: type === 'TE33A' ? 'TE33A' : 'KZ8A',
  };
}

module.exports = { normalizeTelemetry };
