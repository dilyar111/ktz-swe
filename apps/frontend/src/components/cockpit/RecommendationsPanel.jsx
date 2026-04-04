import React from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_LABEL = {
  alert: 'алерт',
  health: 'здоровье',
  scenario: 'сценарий',
};

function severityBorder(sev) {
  if (sev === 'critical') return 'border-status-critical/45 bg-status-critical/[0.06]';
  if (sev === 'warning') return 'border-status-warning/45 bg-status-warning/[0.06]';
  return 'border-emerald-500/25 bg-emerald-500/[0.04]';
}

/**
 * HK-015 — Top operator actions, separate from the raw alerts list.
 * @param {{ recommendations?: Array<{ severity: string, title: string, message: string, source: string, subsystem: string }>, healthStatus?: string }} props
 */
export function RecommendationsPanel({ recommendations = [], healthStatus = 'normal' }) {
  const list = Array.isArray(recommendations) ? recommendations.slice(0, 3) : [];
  const calm =
    list.length === 0 &&
    (healthStatus === 'normal' || healthStatus === undefined || healthStatus === null);

  return (
    <section
      className="rounded-xl border border-emerald-600/20 bg-gradient-to-br from-emerald-950/20 via-card to-card p-4 shadow-sm"
      aria-label="Рекомендации оператору"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Lightbulb className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wider text-emerald-800/90 dark:text-emerald-300/90">
            Рекомендации
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Сжатые действия (макс. 3) — не дублируют список алертов слева
          </p>
        </div>
      </div>

      {calm ? (
        <div
          className="rounded-lg border border-emerald-500/15 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground leading-relaxed"
          aria-live="polite"
        >
          Показатели в штатном коридоре. Отдельных рекомендаций нет — продолжайте наблюдение.
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-muted/15 px-4 py-5 text-sm text-muted-foreground text-center">
          Рекомендации уточняются по мере поступления телеметрии.
        </div>
      ) : (
        <ul className="space-y-2.5" aria-live="polite">
          {list.map((r, i) => (
            <li
              key={`${r.subsystem}-${r.source}-${i}`}
              className={cn('rounded-lg border p-3 text-sm', severityBorder(r.severity))}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-semibold leading-snug text-foreground">{r.title}</span>
                <div className="flex shrink-0 flex-wrap gap-1.5 justify-end">
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-wide font-mono px-1.5 py-0.5 rounded',
                      r.severity === 'critical'
                        ? 'bg-status-critical/20 text-status-critical'
                        : r.severity === 'warning'
                          ? 'bg-status-warning/20 text-status-warning'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    )}
                  >
                    {r.severity}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {SOURCE_LABEL[r.source] ?? r.source}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                    {r.subsystem}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
