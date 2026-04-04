/**
 * Locomotive health profiles — weights and light subsystem tuning (HK-004 extension).
 * Default / missing type → KZ8A (electric).
 */

const DEFAULT_PROFILE_ID = 'KZ8A';

/**
 * @typedef {object} ProfileWeights
 * @property {number} traction
 * @property {number} brakes
 * @property {number} thermal
 * @property {number} electrical
 * @property {number} signaling
 */

/**
 * @typedef {object} HealthProfileConfig
 * @property {string} profileId
 * @property {ProfileWeights} weights
 * @property {number} thermalImpactMultiplier — TE33A: slightly stronger thermal penalties
 * @property {number} electricalMaxDeviation — KZ8A: tighter HV band (more sensitive)
 * @property {number} electricalImpactMultiplier — KZ8A: larger penalty when excursion triggers
 */

/**
 * @param {unknown} locomotiveType
 * @returns {HealthProfileConfig}
 */
function getProfileConfig(locomotiveType) {
  const type = String(locomotiveType ?? '')
    .trim()
    .toUpperCase();

  const settings = require('../settingsStore').getSettings();

  if (type === 'TE33A') {
    return {
      profileId: 'TE33A',
      weights: settings.weights.TE33A,
      /** Diesel: cooling load on engine — nudge thermal impacts up ~15% */
      thermalImpactMultiplier: 1.15,
      electricalMaxDeviation: 0.06,
      electricalImpactMultiplier: 1.0,
    };
  }

  return {
    profileId: 'KZ8A',
    weights: settings.weights.KZ8A,
    thermalImpactMultiplier: 1.0,
    /** Electric: catenary quality is safety-critical — trip earlier, penalize harder */
    electricalMaxDeviation: 0.05,
    electricalImpactMultiplier: 1.25,
  };
}

module.exports = {
  getProfileConfig,
  DEFAULT_PROFILE_ID,
};
