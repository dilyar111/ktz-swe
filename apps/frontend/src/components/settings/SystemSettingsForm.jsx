import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || '';

/** Must match backend HK-033 health subsystem keys. */
const WEIGHT_KEYS = ['traction', 'brakes', 'thermal', 'electrical', 'signaling'];

/**
 * Health weights + alert thresholds editor (shared by admin settings page).
 */
export default function SystemSettingsForm({ className }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('weights');

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load settings', err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        console.error('Failed to save settings');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleWeightChange = (profile, key, value) => {
    const num = parseFloat(value);
    setSettings((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        [profile]: {
          ...prev.weights[profile],
          [key]: Number.isNaN(num) ? '' : num,
        },
      },
    }));
  };

  const handleThresholdChange = (key, value) => {
    const num = parseFloat(value);
    setSettings((prev) => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [key]: Number.isNaN(num) ? '' : num,
      },
    }));
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-24', className)}>
        <RefreshCw className="w-8 h-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (!settings) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">{t('systemSettings.loadError')}</p>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary shrink-0" />
        <h2 className="text-lg font-semibold tracking-tight">{t('systemSettings.title')}</h2>
      </div>

      <div className="flex border-b border-border bg-muted/20 rounded-t-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab('weights')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'weights'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t('systemSettings.tabWeights')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('thresholds')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'thresholds'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t('systemSettings.tabThresholds')}
        </button>
      </div>

      <div className="space-y-6 p-1">
        {activeTab === 'weights' && (
          <div className="space-y-6">
            {['KZ8A', 'TE33A'].map((profile) => (
              <div key={profile} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground capitalize flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/50" />
                  {profile}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {WEIGHT_KEYS.map((key) => {
                    const value = settings.weights[profile]?.[key];
                    if (value == null) return null;
                    return (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground tracking-wide capitalize">
                        {key}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={value}
                        onChange={(e) => handleWeightChange(profile, key, e.target.value)}
                        className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'thresholds' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(settings.thresholds).map(([key, value]) => (
              <div
                key={key}
                className="flex flex-col space-y-1.5 p-3 rounded-lg border border-border/50 bg-secondary/20"
              >
                <label className="text-xs font-semibold text-foreground tracking-wide break-words">
                  {key.replace(/_/g, ' ')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => handleThresholdChange(key, e.target.value)}
                  className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('systemSettings.save')}
        </button>
      </div>
    </div>
  );
}
