'use strict';

const { getDefaultHealthWeights, getDefaultAlertThresholds, normalizeWeightsPatch } = require('./profileDefaults');

const DEFAULT_SETTINGS = {
  weights: getDefaultHealthWeights(),
  thresholds: getDefaultAlertThresholds(),
};

let currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

function getSettings() {
  return currentSettings;
}

function updateSettings(patch) {
  if (patch.weights) {
    if (patch.weights.TE33A) {
      currentSettings.weights.TE33A = normalizeWeightsPatch('TE33A', {
        ...currentSettings.weights.TE33A,
        ...patch.weights.TE33A,
      });
    }
    if (patch.weights.KZ8A) {
      currentSettings.weights.KZ8A = normalizeWeightsPatch('KZ8A', {
        ...currentSettings.weights.KZ8A,
        ...patch.weights.KZ8A,
      });
    }
  }
  if (patch.thresholds) {
    currentSettings.thresholds = { ...currentSettings.thresholds, ...patch.thresholds };
  }
  return currentSettings;
}

function resetSettingsToDefaults() {
  currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  return currentSettings;
}

module.exports = {
  getSettings,
  updateSettings,
  resetSettingsToDefaults,
  DEFAULT_SETTINGS,
};
