/** In-memory demo scenario for simulator telemetry (HK-010). No persistence. */

const VALID_SCENARIOS = Object.freeze([
  'normal',
  'critical',
  'highload',
  'brake_drop',
  'signal_loss',
]);

const VALID_TYPES = Object.freeze(['KZ8A', 'TE33A']);

let currentScenario = 'normal';
let currentLocomotiveType = 'KZ8A';

function getScenario() {
  return { 
    scenario: currentScenario, 
    locomotiveType: currentLocomotiveType 
  };
}

/**
 * @param {unknown} scenario
 * @param {unknown} locomotiveType
 * @returns {{ ok: true, scenario: string, locomotiveType: string } | { ok: false, error: string }}
 */
function setScenario(scenario, locomotiveType) {
  if (scenario != null) {
    const s = String(scenario).trim().toLowerCase();
    if (!VALID_SCENARIOS.includes(s)) {
      return { ok: false, error: `invalid scenario (allowed: ${VALID_SCENARIOS.join(', ')})` };
    }
    currentScenario = s;
  }

  if (locomotiveType != null) {
    const t = String(locomotiveType).trim().toUpperCase();
    if (!VALID_TYPES.includes(t)) {
      return { ok: false, error: `invalid locomotiveType (allowed: ${VALID_TYPES.join(', ')})` };
    }
    currentLocomotiveType = t;
  }

  return { ok: true, scenario: currentScenario, locomotiveType: currentLocomotiveType };
}

module.exports = {
  VALID_SCENARIOS,
  VALID_TYPES,
  getScenario,
  setScenario,
};
