/**
 * @typedef {'info' | 'warning' | 'critical'} AlertSeverity
 */

/**
 * @typedef {object} AlertSchema
 * @property {string} id
 * @property {AlertSeverity} severity
 * @property {string} subsystem
 * @property {string} code
 * @property {string} title
 * @property {string} message
 * @property {string} recommendation
 * @property {string} timestamp
 * @property {string} locomotiveType
 * @property {boolean} [acked]
 * @property {string} [ackedAt]
 */

const ALERT_STATUSES = {
  ACTIVE: 'active',
  ACKED: 'acked',
  RESOLVED: 'resolved'
};

module.exports = {
  ALERT_STATUSES
};
