import React from 'react';
import { Gauge, Thermometer, CircleDot, Fuel, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROFILES = {
  KZ8A: [
    {
      key: 'speed',
      label: 'Скорость',
      unit: 'km/h',
      icon: <Gauge className="h-4 w-4" />,
      thresholds: { warning: 95, critical: 110 },
    },
    {
      key: 'engine_temp',
      label: 'Темп-ра',
      unit: '°C',
      icon: <Thermometer className="h-4 w-4" />,
      thresholds: { warning: 85, critical: 95 },
    },
    {
      key: 'brake_pressure',
      label: 'Тормоз',
      unit: 'bar',
      icon: <CircleDot className="h-4 w-4" />,
      thresholds: { warning: 4.5, critical: 3.5, inverted: true },
    },
    {
      key: 'fuel',
      label: 'Топливо',
      unit: '%',
      icon: <Fuel className="h-4 w-4" />,
      optional: true,
      thresholds: { warning: 25, critical: 10, inverted: true },
    },
    {
      key: 'voltage',
      label: 'Конт. напряж.',
      unit: 'V',
      icon: <Zap className="h-4 w-4" />,
      thresholds: { warning: 26000, critical: 29000 },
    },
    {
      key: 'current',
      label: 'Ток тяги',
      unit: 'A',
      icon: <Activity className="h-4 w-4" />,
      thresholds: { warning: 900, critical: 1100 },
    },
  ],
  TE33A: [
    {
      key: 'speed',
      label: 'Скорость',
      unit: 'km/h',
      icon: <Gauge className="h-4 w-4" />,
      thresholds: { warning: 75, critical: 90 },
    },
    {
      key: 'engine_temp',
      label: 'Темп-ра',
      unit: '°C',
      icon: <Thermometer className="h-4 w-4" />,
      thresholds: { warning: 90, critical: 100 },
    },
    {
      key: 'brake_pressure',
      label: 'Тормоз',
      unit: 'bar',
      icon: <CircleDot className="h-4 w-4" />,
      thresholds: { warning: 4.5, critical: 3.5, inverted: true },
    },
    {
      key: 'fuel',
      label: 'Топливо',
      unit: '%',
      icon: <Fuel className="h-4 w-4" />,
      thresholds: { warning: 25, critical: 10, inverted: true },
    },
    {
      key: 'voltage',
      label: 'Напряж.',
      unit: 'V',
      icon: <Zap className="h-4 w-4" />,
      thresholds: { warning: 520, critical: 480, inverted: true },
    },
    {
      key: 'current',
      label: 'Ток тяги',
      unit: 'A',
      icon: <Activity className="h-4 w-4" />,
      thresholds: { warning: 700, critical: 900 },
    },
  ],
};

function getStatus(value, thresholds) {
  if (value == null || Number.isNaN(value)) return 'ok';
  if (thresholds.inverted) {
    if (value <= thresholds.critical) return 'critical';
    if (value <= thresholds.warning) return 'warning';
    return 'ok';
  }
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'ok';
}

function getTrend(history, key) {
  if (!history || history.length < 5) return 'stable';
  const recent = history.slice(-5);
  const first = recent[0][key];
  const last = recent[recent.length - 1][key];
  if (first == null || last == null) return 'stable';
  const threshold = Math.abs(first * 0.02) || 0.01;
  const diff = last - first;
  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'stable';
}

const statusClasses = {
  ok: '',
  warning: 'border-status-warning/50 bg-status-warning/5 text-status-warning',
  critical: 'border-status-critical/50 bg-status-critical/5 text-status-critical',
};

const trendArrows = { up: '↑', down: '↓', stable: '→' };

export function MetricCards({ metrics, history, locomotiveType = 'KZ8A' }) {
  if (!metrics) return null;
  const configs = PROFILES[locomotiveType] || PROFILES.KZ8A;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {configs.map((config) => {
        const value = metrics[config.key] ?? null;
        if (config.optional && (value == null || Number.isNaN(value))) {
          return (
            <div
              key={config.key}
              className="rounded-xl border border-border bg-card p-3 shadow-sm opacity-50"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                {config.icon}
                <span className="text-xs font-semibold uppercase tracking-wider truncate">{config.label}</span>
              </div>
              <span className="text-sm text-muted-foreground">—</span>
            </div>
          );
        }
        const status = getStatus(value, config.thresholds);
        const trend = getTrend(history, config.key);
        return (
          <div
            key={config.key}
            className={cn(
              'rounded-xl border border-border bg-card p-3 shadow-sm transition-all',
              statusClasses[status]
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {config.icon}
                <span className="text-xs font-semibold uppercase tracking-wider truncate opacity-80">
                  {config.label}
                </span>
              </div>
              <span
                className={cn(
                  'text-xs font-mono font-bold',
                  trend === 'up'
                    ? config.thresholds.inverted
                      ? 'text-status-ok'
                      : 'text-status-warning'
                    : trend === 'down'
                      ? config.thresholds.inverted
                        ? 'text-status-warning'
                        : 'text-status-ok'
                      : 'text-muted-foreground'
                )}
              >
                {trendArrows[trend]}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono tracking-tight">
                {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value ?? '--'}
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground ml-0.5">
                {config.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
