/** In-memory demo scenario for simulator telemetry (HK-010). No persistence. */

const VALID_SCENARIOS = Object.freeze([
  'normal',
  'warning_overheat',
  'critical_overheat',
  'brake_drop',
  'signal_loss',
  'highload',
]);

let currentScenario = 'normal';

function getScenario() {
  return currentScenario;
}

/**
 * @param {unknown} scenario
 * @returns {{ ok: true, scenario: string } | { ok: false, error: string }}
 */
function setScenario(scenario) {
  const s = String(scenario ?? '')
    .trim()
    .toLowerCase();
  if (!VALID_SCENARIOS.includes(s)) {
    return { ok: false, error: `invalid scenario (allowed: ${VALID_SCENARIOS.join(', ')})` };
  }
  currentScenario = s;
  return { ok: true, scenario: s };
}

module.exports = {
  VALID_SCENARIOS,
  getScenario,
  setScenario,
};
