import React from 'react';
import { cn } from '@/lib/utils';

const CLASS_STYLES = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  medium: 'border-status-warning/40 bg-status-warning/10 text-status-warning',
  high: 'border-status-critical/45 bg-status-critical/10 text-status-critical',
};

/**
 * HK-021 — Supplementary ML risk (synthetic baseline). HK-004 health ring stays primary.
 * @param {{ mlRisk?: { enabled?: boolean, riskScore?: number, riskClass?: string, modelVersion?: string, note?: string, supplementary?: boolean } | null }} props
 */
export function MlRiskBadge({ mlRisk }) {
  if (!mlRisk || typeof mlRisk !== 'object') return null;

  if (!mlRisk.enabled) {
    return (
      <div
        className="mt-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-center"
        title="Дополнительный индикатор HK-021. Основной — правило-based Health Index (HK-004)."
      >
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ML риск (доп.)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {mlRisk.note ?? 'Модель не загружена — см. ml/hk020/README.md'}
        </p>
      </div>
    );
  }

  const rc = mlRisk.riskClass === 'high' || mlRisk.riskClass === 'medium' || mlRisk.riskClass === 'low'
    ? mlRisk.riskClass
    : 'low';

  return (
    <div
      className={cn('mt-3 rounded-lg border px-3 py-2 text-center', CLASS_STYLES[rc])}
      title="Вероятность «повышенного риска» по baseline LR на синтетике HK-020. Не заменяет HK-004 и алерты."
    >
      <p className="text-[10px] uppercase tracking-wider opacity-80">ML риск (дополнительно)</p>
      <p className="text-lg font-bold font-mono tabular-nums mt-0.5">
        {typeof mlRisk.riskScore === 'number' ? mlRisk.riskScore : '—'}%
        <span className="text-xs font-semibold capitalize ml-2 opacity-90">· {rc}</span>
      </p>
      {mlRisk.modelVersion ? (
        <p className="text-[10px] font-mono opacity-70 mt-1">{mlRisk.modelVersion}</p>
      ) : null}
    </div>
  );
}
