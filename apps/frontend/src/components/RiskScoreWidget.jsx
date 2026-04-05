import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { SeverityIcon } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';

const POLL_MS = 5000;
/** After any failure (HTTP 503, network, invalid body) — do not hammer the API. */
const BACKOFF_MS = 60000;

/** Align with --status-* tokens (approximate hex for canvas/SVG-free bar) */
const COLOR_GREEN = '#2eb87c';
const COLOR_AMBER = '#d97706';
const COLOR_RED = '#e11d48';

const BG = '#1e2330';

/**
 * @param {{ riskScore: number }} p
 */
function riskColor(riskScore) {
  if (riskScore < 0.3) return COLOR_GREEN;
  if (riskScore <= 0.6) return COLOR_AMBER;
  return COLOR_RED;
}

/**
 * HK-021 — supplementary ML risk (not the primary health index).
 * @param {{ locoType: 'KZ8A' | 'TE33A', locomotiveId?: string }} props
 */
export default function RiskScoreWidget({ locoType, locomotiveId }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    const id = locomotiveId && String(locomotiveId).trim() ? String(locomotiveId).trim() : '';

    setLoading(true);
    setData(null);

    function scheduleNext(ms) {
      if (timeoutId != null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => void runFetch(), ms);
    }

    let firstFetchComplete = false;

    async function runFetch() {
      if (cancelled) return;
      try {
        const q = new URLSearchParams({ locomotiveType: locoType });
        if (id) q.set('locomotiveId', id);
        const res = await fetch(`${API_BASE}/api/ml/risk?${q.toString()}`);

        if (!res.ok) {
          throw new Error('API unavailable');
        }

        const json = await res.json();
        if (cancelled) return;

        if (json.mlAvailable === false || typeof json.riskScore !== 'number') {
          setData(null);
          scheduleNext(BACKOFF_MS);
          return;
        }

        setData(json);
        scheduleNext(POLL_MS);
      } catch {
        if (!cancelled) {
          setData(null);
        }
        scheduleNext(BACKOFF_MS);
      } finally {
        if (!cancelled && !firstFetchComplete) {
          firstFetchComplete = true;
          setLoading(false);
        }
      }
    }

    scheduleNext(0);

    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [locoType, locomotiveId]);

  function badgeFor(riskLabel, riskScore) {
    if (riskLabel === 'critical' || riskScore > 0.6) {
      return { text: t('risk.badgeCritical'), color: COLOR_RED, severity: 'critical' };
    }
    if (riskLabel === 'warning' || riskScore > 0.3) {
      return { text: t('risk.badgeWarning'), color: COLOR_AMBER, severity: 'warning' };
    }
    return { text: t('risk.badgeNormal'), color: COLOR_GREEN, severity: 'normal' };
  }

  if (loading) {
    return (
      <div
        className="rounded-lg border border-border/80 p-3 w-full max-w-[260px] animate-pulse"
        style={{ backgroundColor: BG, fontSize: 11 }}
      >
        <p className="text-muted-foreground">{t('risk.loading')}</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div
        className="rounded-lg border border-border/80 p-3 w-full max-w-[260px]"
        style={{ backgroundColor: BG, fontSize: 11 }}
      >
        <div className="flex items-center justify-between gap-2">
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{t('risk.label')}</span>
          <span className="text-muted-foreground font-mono tabular-nums">—</span>
        </div>
        <p className="text-muted-foreground leading-snug mt-2">{t('risk.unavailable')}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-2">{t('risk.subtitle')}</p>
      </div>
    );
  }

  const score = Math.max(0, Math.min(1, data.riskScore));
  const pct = Math.round(score * 100);
  const barColor = riskColor(score);
  const badge = badgeFor(data.riskLabel, score);
  const factors = Array.isArray(data.topFactors) ? data.topFactors : [];

  return (
    <div
      className="rounded-lg border border-border/80 p-3 w-full max-w-[260px] space-y-2"
      style={{ backgroundColor: BG }}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{t('risk.label')}</span>
        <span
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
        >
          <SeverityIcon severity={badge.severity} />
          {badge.text}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span style={{ fontSize: 20, fontWeight: 700, color: barColor }}>{pct}%</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{t('risk.riskWord')}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {factors.length > 0 ? (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.35 }}>
          <span className="text-muted-foreground">{t('risk.factorsPrefix')} </span>
          {factors.join(', ')}
        </p>
      ) : null}
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{t('risk.subtitle')}</p>
    </div>
  );
}
