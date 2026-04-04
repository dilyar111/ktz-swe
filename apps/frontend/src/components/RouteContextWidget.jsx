import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Human-readable segment id for display (backend sends e.g. "main-line").
 * @param {string | undefined | null} id
 * @returns {string}
 */
export function formatSegmentName(id) {
  if (!id || typeof id !== 'string') return '—';
  return id
    .replace(/-/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * HK-014 — route/track context (no map): segment, position, speed vs limit, restrictions.
 * @param {{
 *   routeContext: {
 *     currentSegmentId: string,
 *     currentPositionLabel: string,
 *     nextSegmentLabel: string,
 *     speedLimitKmh: number,
 *     restrictionReason?: string,
 *   } | null | undefined,
 *   speedKmh: number,
 *   className?: string,
 * }} props
 */
export default function RouteContextWidget({ routeContext, speedKmh, className }) {
  if (!routeContext || typeof routeContext !== 'object') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground',
          className
        )}
      >
        Route context will appear when telemetry includes segment data.
      </div>
    );
  }

  const limit = Number(routeContext.speedLimitKmh);
  const speed = Number(speedKmh);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1;
  const ratio = safeLimit > 0 ? speed / safeLimit : 0;
  const barPct = Math.min(100, ratio * 100);
  const over = speed > safeLimit;
  const near = !over && ratio >= 0.85;

  /** Quantified overspeed vs published limit (same value as Limit row). */
  const delta =
    over && Number.isFinite(speed) && Number.isFinite(limit) && limit > 0
      ? Math.round(speed - limit)
      : null;

  let barClass = 'bg-[hsl(var(--status-ok))]';
  if (over) barClass = 'bg-[hsl(var(--status-critical))]';
  else if (near) barClass = 'bg-[hsl(var(--status-warning))]';

  const segmentLabel = formatSegmentName(routeContext.currentSegmentId);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card/80 text-foreground shadow-sm',
        'ring-1 ring-inset ring-white/5',
        className
      )}
    >
      <div className="border-b border-border/70 px-4 py-2.5 bg-muted/30">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
          Segment
        </p>
        <p className="text-base font-semibold tracking-tight mt-0.5">{segmentLabel}</p>
      </div>

      <div className="px-4 py-3 space-y-3 text-sm">
        <div className="flex justify-between gap-3 text-muted-foreground">
          <span>Position</span>
          <span className="font-mono text-foreground tabular-nums">{routeContext.currentPositionLabel}</span>
        </div>
        <div className="flex justify-between gap-3 text-muted-foreground">
          <span>Next</span>
          <span className="text-foreground text-right leading-snug">{routeContext.nextSegmentLabel}</span>
        </div>

        <div className="pt-1 space-y-1.5">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Speed & limit</p>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Speed</span>
            <span className="font-mono tabular-nums text-foreground">
              {Number.isFinite(speed) ? Math.round(speed) : '—'} km/h
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Limit</span>
            <span className="font-mono tabular-nums text-foreground">
              {Number.isFinite(limit) && limit > 0 ? Math.round(limit) : '—'} km/h
            </span>
          </div>
          {over && delta != null && delta > 0 ? (
            <p className="text-[11px] font-mono text-status-critical pt-0.5 text-right leading-tight">
              <span aria-hidden>⚠️ </span>
              {' '}
              Exceeding by +{delta} km/h
            </p>
          ) : null}
          <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden border border-border/60 mt-2">
            <div
              className={cn('h-full rounded-full transition-all duration-300 ease-out', barClass)}
              style={{ width: `${barPct}%` }}
              role="progressbar"
              aria-valuenow={Number.isFinite(speed) ? speed : 0}
              aria-valuemin={0}
              aria-valuemax={Math.round(safeLimit)}
            />
          </div>
        </div>

        {routeContext.restrictionReason ? (
          <div
            className={cn(
              'rounded-md border px-3 py-2 text-xs leading-relaxed',
              over
                ? 'border-status-critical/45 bg-status-critical/10 text-status-critical'
                : 'border-status-warning/40 bg-status-warning/10 text-status-warning'
            )}
          >
            <span className="font-semibold mr-1" aria-hidden>
              ⚠️
            </span>
            {routeContext.restrictionReason}
          </div>
        ) : null}
      </div>
    </div>
  );
}
