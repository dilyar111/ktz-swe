import { useMemo } from 'react';
import { cn, SeverityIcon } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';

/** Fixed display order (matches backend engine). */
const SUBSYSTEM_ORDER = ['traction', 'brakes', 'thermal', 'electrical', 'signaling'];

/** Weights always come from backend health payload (HK-033 single source). */
function resolveWeights(health) {
  if (health?.weights && typeof health.weights === 'object') return health.weights;
  return null;
}

function statusBarClass(status) {
  if (status === 'critical') return 'bg-[hsl(var(--status-critical))]';
  if (status === 'warning') return 'bg-[hsl(var(--status-warning))]';
  return 'bg-[hsl(var(--status-ok))]';
}

/**
 * HK-009 — Explain subsystem scores vs total health (weighted sum).
 * @param {{ health: Record<string, unknown> | null | undefined, className?: string, detailed?: boolean }} props
 */
export default function HealthBreakdownWidget({ health, className, detailed = false }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!health?.subsystems) return null;
    const w = resolveWeights(health);
    if (!w) return null;
    const list = [];
    for (const key of SUBSYSTEM_ORDER) {
      const sub = health.subsystems[key];
      if (!sub || typeof sub.score !== 'number') continue;
      const weight = w[key];
      if (weight == null) continue;
      const contribution = sub.score * weight;
      const label =
        health.profile === 'TE33A' && key === 'thermal'
          ? t('health.subsystem.thermalTe33a')
          : t(`health.subsystem.${key}`) || key;
      list.push({
        key,
        label,
        score: sub.score,
        status: sub.status ?? 'normal',
        weight,
        contribution,
      });
    }
    return list;
  }, [health, t]);

  const worstKey = useMemo(() => {
    if (!rows?.length) return null;
    let min = rows[0];
    for (const r of rows) {
      if (r.score < min.score) min = r;
    }
    return min.key;
  }, [rows]);

  /** Max(score × weight) — which subsystem pulls the index most in absolute points */
  const highestImpactKey = useMemo(() => {
    if (!rows?.length) return null;
    let max = rows[0];
    for (const r of rows) {
      if (r.contribution > max.contribution) max = r;
    }
    return max.key;
  }, [rows]);

  const maxWeight = useMemo(() => {
    if (!rows?.length) return 0;
    return Math.max(...rows.map((r) => r.weight));
  }, [rows]);

  if (!rows?.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-card/50 p-4 text-sm text-muted-foreground',
          className
        )}
      >
        {detailed ? (
          <>
            {t('healthBreakdown.emptyPrefix')} <code className="font-mono">{t('healthBreakdown.emptyCode')}</code>{' '}
            {t('healthBreakdown.emptySuffix')}
          </>
        ) : (
          t('healthBreakdown.emptyOperator')
        )}
      </div>
    );
  }

  const totalScore = health.total_score ?? health.score;

  function rowTooltip(r) {
    const pct = Math.round(r.weight * 100);
    const base = t('healthBreakdown.rowTooltipWeight', {
      label: r.label,
      pct: String(pct),
      contrib: r.contribution.toFixed(1),
    });
    if (Math.abs(r.weight - maxWeight) < 1e-9) {
      return `${base} ${t('healthBreakdown.rowTooltipHeaviest')}`;
    }
    return base;
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/90">
            {t('healthBreakdown.title')}
          </h3>
          {detailed ? (
            <p className="text-xs text-muted-foreground mt-1">
              {t('healthBreakdown.profile')}:{' '}
              <span className="font-mono text-foreground/80">{health.profile ?? '—'}</span>
            </p>
          ) : null}
        </div>
        {totalScore != null && detailed ? (
          <div className="text-right">
            <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0">
              <span className="text-2xl font-bold font-mono tabular-nums text-foreground leading-none">
                {totalScore}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/90 mt-1">{t('healthBreakdown.aggregateIndex')}</p>
          </div>
        ) : null}
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.key}
            title={detailed ? rowTooltip(r) : undefined}
            className={cn(
              'rounded-lg border px-2 py-2 -mx-2 transition-colors',
              worstKey === r.key && highestImpactKey === r.key
                ? 'border-status-warning/50 bg-gradient-to-r from-status-warning/8 to-primary/8'
                : worstKey === r.key
                  ? 'border-status-warning/40 bg-status-warning/5'
                  : highestImpactKey === r.key
                    ? 'border-primary/35 bg-primary/[0.07]'
                    : 'border-transparent'
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="w-[88px] shrink-0 font-medium text-foreground/90">{r.label}</span>
              <div className="flex-1 min-w-[120px] h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-300 ease-out', statusBarClass(r.status))}
                  style={{ width: `${Math.min(100, Math.max(0, r.score))}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono tabular-nums">{r.score}</span>
              {detailed ? (
                <span className="text-muted-foreground font-mono text-xs w-[44px]">
                  ({Math.round(r.weight * 100)}%)
                </span>
              ) : null}
            </div>
            {detailed ? (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-[88px]">
                {r.status === 'warning' || r.status === 'critical' ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 mr-2 font-semibold uppercase text-[10px] tracking-wide',
                      r.status === 'critical' ? 'text-status-critical' : 'text-status-warning'
                    )}
                  >
                    <SeverityIcon severity={r.status} />
                    {t(`cockpit.severity.${r.status}`)}
                  </span>
                ) : null}
                {t('healthBreakdown.contributionLine')}{' '}
                <span className="font-mono text-foreground/80 tabular-nums">{r.contribution.toFixed(1)}</span>
                {worstKey === r.key ? (
                  <span className="ml-2 text-status-warning text-[10px] uppercase tracking-wide">
                    {t('healthBreakdown.minScore')}
                  </span>
                ) : null}
                {highestImpactKey === r.key ? (
                  <span className="ml-2 text-primary text-[10px] uppercase tracking-wide">
                    {t('healthBreakdown.maxContribution')}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-[88px]">
                {r.status === 'warning' || r.status === 'critical' ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 font-semibold uppercase text-[10px] tracking-wide',
                      r.status === 'critical' ? 'text-status-critical' : 'text-status-warning'
                    )}
                  >
                    <SeverityIcon severity={r.status} />
                    {t(`cockpit.severity.${r.status}`)}
                  </span>
                ) : (
                  <span className="text-muted-foreground/80">{t('healthBreakdown.rowStatusOk')}</span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>

      {detailed ? (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground/90">{t('healthBreakdown.footerLead')}</span>{' '}
            {t('healthBreakdown.footerBody')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
