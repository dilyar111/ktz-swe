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

  if (type === 'TE33A') {
    return {
      profileId: 'TE33A',
      weights: {
        traction: 0.3,
        brakes: 0.25,
        thermal: 0.25,
        electrical: 0.1,
        signaling: 0.1,
      },
      /** Diesel: cooling load on engine — nudge thermal impacts up ~15% */
      thermalImpactMultiplier: 1.15,
      electricalMaxDeviation: 0.06,
      electricalImpactMultiplier: 1.0,
    };
  }

  return {
    profileId: 'KZ8A',
    weights: {
      traction: 0.25,
      brakes: 0.2,
      thermal: 0.15,
      electrical: 0.3,
      signaling: 0.1,
    },
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
