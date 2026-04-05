import React from 'react';
import { Brain, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';

/**
 * HK-036 — Supplementary intelligence (trend / short horizon / anomaly). Rule-based health stays primary.
 */
export default function IntelligenceInsightWidget({ intelligence, className }) {
  const { t } = useI18n();

  if (!intelligence || typeof intelligence !== 'object') {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/80 bg-card/40 p-4 text-xs text-muted-foreground',
          className
        )}
      >
        {t('intelligence.unavailable')}
      </div>
    );
  }

  const risk = intelligence.riskNext30Min || {};
  const band = risk.band || 'low';
  const changes = Array.isArray(intelligence.metricChanges5m) ? intelligence.metricChanges5m : [];
  const hint = intelligence.smartHint || {};

  const bandClass =
    band === 'high'
      ? 'border-status-critical/40 bg-status-critical/[0.07] text-status-critical'
      : band === 'medium'
        ? 'border-status-warning/40 bg-status-warning/[0.08] text-status-warning'
        : 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400';

  function metricLabel(key) {
    const k = `intelligence.metric.${key}`;
    const r = t(k);
    return r === k ? key : r;
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/25 via-card to-card p-4 shadow-sm space-y-3',
        className
      )}
      aria-label={t('intelligence.aria')}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
          <Brain className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wider text-foreground/90">
            {t('intelligence.title')}
          </h3>
          <p className="text-[10px] text-muted-foreground leading-snug">{t('intelligence.subtitle')}</p>
        </div>
      </div>

      <div className={cn('rounded-lg border px-3 py-2.5', bandClass)}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <TrendingDown className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {t('intelligence.risk30Title')}
        </div>
        <p className="text-[11px] mt-1 opacity-95 leading-relaxed">
          {t('intelligence.risk30Band', { band: t(`intelligence.band.${band}`) })}{' '}
          <span className="font-mono tabular-nums">
            {t('intelligence.risk30Projected', { value: String(risk.projectedHealth ?? '—') })}
          </span>
          {typeof risk.score01 === 'number' ? (
            <span className="ml-1 opacity-80">
              · {t('intelligence.riskScore', { v: String(Math.round(risk.score01 * 100)) })}
            </span>
          ) : null}
        </p>
        <p className="text-[10px] mt-1.5 text-muted-foreground">{t('intelligence.risk30Disclaimer')}</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center text-xs">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">{t('intelligence.anomaly')}:</span>
          <span className="font-mono font-semibold tabular-nums">{intelligence.anomalyScore ?? '—'}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
        {typeof intelligence.healthScoreDelta5m === 'number' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t('intelligence.delta5')}:</span>
            <span
              className={cn(
                'font-mono tabular-nums font-medium',
                intelligence.healthScoreDelta5m < 0 ? 'text-status-warning' : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {intelligence.healthScoreDelta5m > 0 ? '+' : ''}
              {intelligence.healthScoreDelta5m}
            </span>
          </div>
        ) : null}
        <span className="text-[10px] text-muted-foreground">
          n={intelligence.sampleCount5m ?? 0} / {t('intelligence.windowMin')}
        </span>
      </div>

      {changes.length > 0 ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" aria-hidden />
            {t('intelligence.change5Title')}
          </p>
          <ul className="space-y-1 text-[11px] text-foreground/90">
            {changes.slice(0, 4).map((c, i) => (
              <li key={`${c.key}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="text-muted-foreground">{metricLabel(c.key)}:</span>
                <span className="font-mono tabular-nums">
                  {typeof c.delta === 'number' && c.delta > 0 ? '+' : ''}
                  {c.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{t('intelligence.noChange5')}</p>
      )}

      {hint.title ? (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2">
          <p className="text-xs font-medium text-foreground">{hint.title}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{hint.detail}</p>
        </div>
      ) : null}
    </section>
  );
}
