import React from 'react';
import { Zap, Cog, Disc } from 'lucide-react';
import { cn } from '@/lib/utils';

function engineStatusFor(metrics, locomotiveType) {
  const t = metrics?.engine_temp ?? 0;
  if (locomotiveType === 'TE33A') {
    if (t >= 100) return 'critical';
    if (t >= 90) return 'warning';
    return 'ok';
  }
  if (t >= 95) return 'critical';
  if (t >= 85) return 'warning';
  return 'ok';
}

function brakeStatusFor(metrics) {
  const p = metrics?.brake_pressure ?? 99;
  if (p <= 3.5) return 'critical';
  if (p <= 4.5) return 'warning';
  return 'ok';
}

function electricStatusFor(metrics, locomotiveType) {
  const v = metrics?.voltage ?? 0;
  if (locomotiveType === 'KZ8A') {
    if (v >= 29000 || v < 23000) return 'critical';
    if (v >= 26000 || v < 23500) return 'warning';
    return 'ok';
  }
  if (v <= 480) return 'critical';
  if (v <= 520) return 'warning';
  return 'ok';
}

const statusColors = {
  ok: 'border-status-ok/50 bg-status-ok/10 text-status-ok',
  warning: 'border-status-warning/50 bg-status-warning/10 text-status-warning',
  critical: 'border-status-critical/50 bg-status-critical/10 text-status-critical animate-pulse',
};

const statusGlow = {
  ok: '',
  warning: 'shadow-[0_0_20px_rgba(250,204,21,0.2)]',
  critical: 'shadow-[0_0_25px_rgba(239,68,68,0.3)]',
};

function SystemBlock({ name, status, icon, value, unit }) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 bg-card',
        statusColors[status],
        statusGlow[status]
      )}
    >
      <div className="mb-2">{icon}</div>
      <span className="text-xs font-bold uppercase tracking-wider mb-1 opacity-80">{name}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-mono">{value ?? '--'}</span>
        <span className="text-xs opacity-70">{unit}</span>
      </div>
    </div>
  );
}

export function DigitalTwin({ metrics, locomotiveType = 'KZ8A' }) {
  const eng = engineStatusFor(metrics, locomotiveType);
  const brk = brakeStatusFor(metrics);
  const ele = electricStatusFor(metrics, locomotiveType);
  const voltUnit = locomotiveType === 'KZ8A' ? 'V (25 кВ сеть)' : 'V';

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Подсистемы
      </h3>
      <div className="grid grid-cols-3 gap-3 flex-1">
        <SystemBlock
          name="Тепло / ДВС"
          status={eng}
          icon={
            <Cog
              className={cn('h-8 w-8', eng !== 'ok' && 'animate-spin')}
              style={{ animationDuration: '3s' }}
            />
          }
          value={metrics?.engine_temp != null ? Math.round(metrics.engine_temp) : null}
          unit="°C"
        />
        <SystemBlock
          name="Тормоза"
          status={brk}
          icon={<Disc className="h-8 w-8" />}
          value={metrics?.brake_pressure != null ? metrics.brake_pressure.toFixed(1) : null}
          unit="bar"
        />
        <SystemBlock
          name="Электро"
          status={ele}
          icon={<Zap className="h-8 w-8" />}
          value={metrics?.voltage != null ? Math.round(metrics.voltage) : null}
          unit={voltUnit}
        />
      </div>
      <div className="relative mt-6 h-8">
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 px-3 py-1 rounded-sm bg-secondary text-[10px] font-mono text-muted-foreground tracking-widest uppercase border border-border">
          {locomotiveType} · интегральный вид
        </div>
      </div>
    </div>
  );
}
