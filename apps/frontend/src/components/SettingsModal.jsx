import React, { useState, useEffect } from 'react';
import { Settings, X, Save, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || '';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('weights');
  
  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load settings', err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        onClose();
      } else {
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
    setSettings(prev => ({
      ...prev,
      weights: {
        ...prev.weights,
        [profile]: {
          ...prev.weights[profile],
          [key]: isNaN(num) ? '' : num
        }
      }
    }));
  };

  const handleThresholdChange = (key, value) => {
    const num = parseFloat(value);
    setSettings(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [key]: isNaN(num) ? '' : num
      }
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel-elevated border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">System Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-border bg-muted/20">
          <button
            onClick={() => setActiveTab('weights')}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'weights' 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Health Weights
          </button>
          <button
            onClick={() => setActiveTab('thresholds')}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'thresholds' 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Alert Thresholds
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'weights' && (
            <div className="space-y-6">
              {['KZ8A', 'TE33A'].map(profile => (
                <div key={profile} className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground capitalize flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                    {profile} Weights
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(settings.weights[profile]).map(([key, value]) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground tracking-wide capitalize">{key}</label>
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
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'thresholds' && (
            <div className="space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(settings.thresholds).map(([key, value]) => (
                    <div key={key} className="flex flex-col space-y-1.5 p-3 rounded-lg border border-border/50 bg-secondary/20">
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
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-transparent hover:bg-secondary text-foreground rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
