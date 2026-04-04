import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/** Fixed display order (matches backend engine). */
const SUBSYSTEM_ORDER = ['traction', 'brakes', 'thermal', 'electrical', 'signaling'];

const LABELS = {
  traction: 'Traction',
  brakes: 'Brakes',
  thermal: 'Thermal',
  electrical: 'Electrical',
  signaling: 'Signaling',
};

/** Fallback if older API omits `weights` — mirrors apps/backend/src/health/profiles.js */
const FALLBACK_WEIGHTS = {
  KZ8A: { traction: 0.25, brakes: 0.2, thermal: 0.15, electrical: 0.3, signaling: 0.1 },
  TE33A: { traction: 0.3, brakes: 0.25, thermal: 0.25, electrical: 0.1, signaling: 0.1 },
};

function resolveWeights(health) {
  if (health?.weights && typeof health.weights === 'object') return health.weights;
  const id = health?.profile === 'TE33A' ? 'TE33A' : 'KZ8A';
  return FALLBACK_WEIGHTS[id];
}

function statusBarClass(status) {
  if (status === 'critical') return 'bg-[hsl(var(--status-critical))]';
  if (status === 'warning') return 'bg-[hsl(var(--status-warning))]';
  return 'bg-[hsl(var(--status-ok))]';
}

/**
 * HK-009 — Explain subsystem scores vs total health (weighted sum).
 * @param {{ health: Record<string, unknown> | null | undefined, className?: string }} props
 */
export default function HealthBreakdownWidget({ health, className }) {
  const rows = useMemo(() => {
    if (!health?.subsystems) return null;
    const w = resolveWeights(health);
    const list = [];
    for (const key of SUBSYSTEM_ORDER) {
      const sub = health.subsystems[key];
      if (!sub || typeof sub.score !== 'number') continue;
      const weight = w[key];
      if (weight == null) continue;
      const contribution = sub.score * weight;
      list.push({
        key,
        label: LABELS[key] ?? key,
        score: sub.score,
        status: sub.status ?? 'normal',
        weight,
        contribution,
      });
    }
    return list;
  }, [health]);

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

  const formulaParts = useMemo(() => {
    if (!rows?.length) return '';
    return rows.map((r) => `${r.label} (${r.score} × ${r.weight.toFixed(2)})`);
  }, [rows]);

  const sumRounded = useMemo(() => {
    if (!rows?.length) return null;
    return Math.round(rows.reduce((a, r) => a + r.contribution, 0));
  }, [rows]);

  if (!rows?.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-card/50 p-4 text-sm text-muted-foreground',
          className
        )}
      >
        Subsystem breakdown will appear when health data includes <code className="font-mono">subsystems</code>.
      </div>
    );
  }

  const totalScore = health.total_score ?? health.score;

  function rowTooltip(r) {
    const pct = Math.round(r.weight * 100);
    const base = `${r.label} affects the total in proportion to its profile weight (${pct}%). Impact = score × weight = ${r.contribution.toFixed(1)}.`;
    if (Math.abs(r.weight - maxWeight) < 1e-9) {
      return `${base} Highest weight in this profile — small score changes move the index more.`;
    }
    return base;
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/90">
            Subsystem health
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Profile: <span className="font-mono text-foreground/80">{health.profile ?? '—'}</span>
          </p>
        </div>
        {totalScore != null ? (
          <div className="text-right">
            <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0">
              <span className="text-2xl font-bold font-mono tabular-nums text-foreground leading-none">
                {totalScore}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono leading-none">
                = Σ(score × weight)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/90 mt-1">Composite health index</p>
          </div>
        ) : null}
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.key}
            title={rowTooltip(r)}
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
              <span className="text-muted-foreground font-mono text-xs w-[44px]">
                ({Math.round(r.weight * 100)}%)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 pl-[88px]">
              Impact on total:{' '}
              <span className="font-mono text-foreground/80 tabular-nums">{r.contribution.toFixed(1)}</span>
              {worstKey === r.key ? (
                <span className="ml-2 text-status-warning text-[10px] uppercase tracking-wide">
                  lowest score
                </span>
              ) : null}
              {highestImpactKey === r.key ? (
                <span className="ml-2 text-primary text-[10px] uppercase tracking-wide">
                  highest impact
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>

      <div className="pt-2 border-t border-border space-y-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground/90">Total score</span> = Σ(score × weight) — same value as
          above; rows show each product.
        </p>
        <p className="text-[11px] font-mono text-muted-foreground break-words leading-relaxed">
          {formulaParts.join(' + ')}
          {sumRounded != null ? (
            <>
              {' '}
              ≈ <span className="text-foreground">{sumRounded}</span>
              {totalScore != null && sumRounded !== totalScore ? (
                <span className="text-muted-foreground"> (reported: {totalScore})</span>
              ) : null}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/*
Example (mock) for Storybook / manual test:

<HealthBreakdownWidget
  health={{
    total_score: 61,
    profile: 'TE33A',
    weights: { traction: 0.3, brakes: 0.25, thermal: 0.25, electrical: 0.1, signaling: 0.1 },
    subsystems: {
      traction: { score: 78, status: 'warning' },
      brakes: { score: 75, status: 'warning' },
      thermal: { score: 55, status: 'critical' },
      electrical: { score: 90, status: 'normal' },
      signaling: { score: 88, status: 'normal' },
    },
  }}
/>
*/
