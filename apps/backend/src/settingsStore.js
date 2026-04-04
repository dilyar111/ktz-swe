'use strict';

const DEFAULT_SETTINGS = {
  weights: {
    TE33A: {
      traction: 0.3,
      brakes: 0.25,
      thermal: 0.25,
      electrical: 0.1,
      signaling: 0.1,
    },
    KZ8A: {
      traction: 0.25,
      brakes: 0.2,
      thermal: 0.15,
      electrical: 0.3,
      signaling: 0.1,
    }
  },
  thresholds: {
    engine_temp_crit: 100,
    engine_temp_warn: 90,
    brake_pressure_crit: 4.5,
    brake_pressure_drop_warn: 0.3,
    speed_margin_warn: 0.98,
    current_anomaly_te33a: 500,
    current_anomaly_kz8a: 650,
    current_delta_warn: 180,
    signal_quality_crit: 70,
    signal_quality_warn: 85,
    fault_count_crit: 3,
  }
};

let currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

function getSettings() {
  return currentSettings;
}

function updateSettings(patch) {
  if (patch.weights) {
    if (patch.weights.TE33A) currentSettings.weights.TE33A = { ...currentSettings.weights.TE33A, ...patch.weights.TE33A };
    if (patch.weights.KZ8A) currentSettings.weights.KZ8A = { ...currentSettings.weights.KZ8A, ...patch.weights.KZ8A };
  }
  if (patch.thresholds) {
    currentSettings.thresholds = { ...currentSettings.thresholds, ...patch.thresholds };
  }
  return currentSettings;
}

module.exports = {
  getSettings,
  updateSettings,
};
