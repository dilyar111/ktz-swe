import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw, SkipBack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';
import { useDemoControls } from '@/hooks/useDemoControls';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';

const DEFAULT_LOCOMOTIVE_ID = {
  KZ8A: 'KZ8A-DEMO-01',
  TE33A: 'TE33A-DEMO-01',
};

/**
 * Первый момент «инцидента»: падение HI ниже предупреждения; иначе точка минимума HI.
 */
function incidentStartIndex(points) {
  if (points.length === 0) return 0;
  const warnIdx = points.findIndex((p) => p.health < 60);
  if (warnIdx >= 0) return warnIdx;
  let minI = 0;
  let minH = points[0].health;
  for (let i = 1; i < points.length; i++) {
    if (points[i].health < minH) {
      minH = points[i].health;
      minI = i;
    }
  }
  return minI;
}

function formatAxisTime(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function Replay() {
  const { t } = useI18n();
  const showDev = useDemoControls();
  const windowOptions = useMemo(
    () =>
      [5, 10, 15].map((min) => ({
        label: t(`replay.windowMin.${min}`),
        min,
      })),
    [t]
  );
  const { locomotiveType: outletLocomotiveType } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const typeParam = searchParams.get('locomotiveType');
  const idParam = searchParams.get('locomotiveId');

  const locomotiveType = typeParam?.trim() || outletLocomotiveType;
  const locomotiveId =
    idParam?.trim() || DEFAULT_LOCOMOTIVE_ID[locomotiveType] || DEFAULT_LOCOMOTIVE_ID.KZ8A;

  const incidentWindow = useMemo(() => {
    if (fromParam == null || toParam == null) return null;
    const from = Number(fromParam);
    const to = Number(toParam);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
    return { from, to };
  }, [fromParam, toParam]);

  const [windowMin, setWindowMin] = useState(15);
  const [rawEntries, setRawEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [scrubIdx, setScrubIdx] = useState(0);

  const chartData = useMemo(() => {
    const isTe = locomotiveType === 'TE33A';
    return rawEntries.map((e) => {
      const snap = e.payload && typeof e.payload === 'object' ? e.payload : {};
      const h = e.health && typeof e.health === 'object' ? e.health : {};
      const oil = Number(snap.oilTempC);
      const cool = Number(snap.coolantTempC);
      const eng = Number(snap.engineTempC);
      const thermalDisplay = isTe
        ? [oil, cool, eng].filter((x) => Number.isFinite(x)).length > 0
          ? Math.max(
              ...[oil, cool, eng].filter((x) => Number.isFinite(x))
            )
          : 0
        : Number(snap.engineTempC ?? snap.oilTempC ?? 0);
      return {
        t: e.ts,
        label: formatAxisTime(e.ts),
        health: Number(h.total_score ?? h.score ?? 0),
        speed: Number(snap.speedKmh ?? snap.speed ?? 0),
        temp: thermalDisplay,
        brake: Number(snap.brakePressureBar ?? snap.brake_pressure ?? 0),
        lineVoltage: Number(snap.lineVoltageV ?? 0),
        fuelLevel: Number(snap.fuelLevelPct ?? 0),
        auxVoltage: Number(snap.voltage ?? snap.batteryVoltageV ?? 0),
      };
    });
  }, [rawEntries, locomotiveType]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    let from;
    let to;
    if (incidentWindow) {
      from = incidentWindow.from;
      to = incidentWindow.to;
    } else {
      to = Date.now();
      from = to - windowMin * 60 * 1000;
    }
    const params = new URLSearchParams({
      from: String(from),
      to: String(to),
      locomotiveType,
      locomotiveId,
      includeHealth: '1',
      order: 'asc',
    });
    try {
      const res = await fetch(`${API_BASE}/api/history?${params}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const entries = Array.isArray(json.entries) ? json.entries : [];
      setRawEntries(entries);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
      setRawEntries([]);
    } finally {
      setLoading(false);
    }
  }, [locomotiveType, locomotiveId, windowMin, incidentWindow]);

  const clearIncidentWindowParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('from');
        next.delete('to');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const selectRollingWindow = useCallback(
    (min) => {
      setWindowMin(min);
      if (incidentWindow) clearIncidentWindowParams();
    },
    [incidentWindow, clearIncidentWindowParams]
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  /** После загрузки с API — курсор на последнюю точку окна (актуальное «сейчас»). */
  useEffect(() => {
    const n = rawEntries.length;
    if (n === 0) {
      setScrubIdx(0);
      return;
    }
    setScrubIdx(n - 1);
  }, [rawEntries]);

  const atScrub = chartData[scrubIdx] ?? null;
  const scrubT = atScrub?.t;
  const incidentIdx = useMemo(() => incidentStartIndex(chartData), [chartData]);

  /** HK-036 — Δ rule-based HI from first point in loaded window to scrub (jury-facing, no extra API). */
  const replayHealthDelta = useMemo(() => {
    if (chartData.length < 2 || scrubIdx < 1) return null;
    const h0 = chartData[0].health;
    const h1 = chartData[scrubIdx].health;
    return Math.round(h1 - h0);
  }, [chartData, scrubIdx]);

  const chartWrap = 'h-[200px] w-full min-w-0';

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('replay.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {locomotiveType} · {locomotiveId}
            {showDev ? (
              <>
                {' '}
                · <span className="font-mono text-[11px]">{t('replay.subtitle')}</span>
              </>
            ) : null}
          </p>
          {incidentWindow ? (
            <p className="text-xs text-primary mt-2 max-w-xl">
              {t('replay.incidentWindowHint', {
                from: formatAxisTime(incidentWindow.from),
                to: formatAxisTime(incidentWindow.to),
              })}{' '}
              <button
                type="button"
                onClick={() => clearIncidentWindowParams()}
                className="ml-2 underline underline-offset-2 hover:text-foreground"
              >
                {t('replay.useLiveWindow')}
              </button>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {windowOptions.map((w) => (
            <button
              key={w.min}
              type="button"
              onClick={() => selectRollingWindow(w.min)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                windowMin === w.min
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {w.label}
            </button>
          ))}
            <button
              type="button"
            onClick={() => void loadHistory()}
            className="ktz-op-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-secondary"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden />
            {t('replay.refresh')}
          </button>
        </div>
      </div>

      {fetchError ? (
        <div
          className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {t('replay.errorPrefix')}: {fetchError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
          {t('replay.loading')}
        </div>
      ) : null}

      {!loading && chartData.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm shadow-sm">
          {t('replay.empty')}
        </div>
      ) : null}

      {!loading && chartData.length > 0 ? (
        <>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('replay.timeline')}</p>
                <p className="text-sm font-mono text-foreground">
                  {atScrub ? formatAxisTime(atScrub.t) : '—'} · {t('replay.point')} {scrubIdx + 1} /{' '}
                  {chartData.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScrubIdx(incidentIdx)}
                className="ktz-op-btn inline-flex items-center gap-2 self-start sm:self-auto px-3 py-2 rounded-lg text-sm font-medium border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 min-h-[44px] sm:min-h-0"
              >
                <SkipBack className="w-4 h-4" aria-hidden />
                {t('replay.incidentBtn')}
              </button>
            </div>
            <input
              type="range"
              className="w-full accent-primary h-2 cursor-grab active:cursor-grabbing"
              min={0}
              max={Math.max(0, chartData.length - 1)}
              value={Math.min(scrubIdx, chartData.length - 1)}
              onChange={(e) => setScrubIdx(Number(e.target.value))}
              aria-label={t('replay.timelineScrub')}
            />
            {atScrub ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono border-t border-border pt-3">
                <div>
                  <span className="text-muted-foreground">{t('replay.hi')}</span>
                  <div className="text-lg font-semibold tabular-nums">{Math.round(atScrub.health)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('replay.speed')}</span>
                  <div className="text-lg font-semibold tabular-nums">{atScrub.speed.toFixed(1)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {locomotiveType === 'TE33A' ? t('replay.tempTe33a') : t('replay.temp')}
                  </span>
                  <div className="text-lg font-semibold tabular-nums">{atScrub.temp.toFixed(1)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('replay.brake')}</span>
                  <div className="text-lg font-semibold tabular-nums">{atScrub.brake.toFixed(2)}</div>
                </div>
              </div>
            ) : null}
            {showDev && replayHealthDelta != null ? (
              <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2 leading-relaxed">
                {t('replay.intelligenceDelta', { delta: String(replayHealthDelta > 0 ? '+' : '') + replayHealthDelta })}
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('replay.hi')}
            </h2>
            <div className={cn(chartWrap, 'rounded-xl border border-border bg-card p-2 shadow-sm')}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border opacity-50" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatAxisTime}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    labelFormatter={(ts) => formatAxisTime(ts)}
                    formatter={(v) => [Math.round(v), t('replay.chartShortHi')]}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line type="monotone" dataKey="health" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  {scrubT != null ? (
                    <ReferenceLine x={scrubT} stroke="hsl(var(--status-warning))" strokeDasharray="4 4" />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('replay.params')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(
                locomotiveType === 'TE33A'
                  ? [
                      { key: 'speed', labelKey: 'replay.chartSpeedLong', color: 'hsl(199 89% 48%)' },
                      { key: 'temp', labelKey: 'replay.chartTempTe33aLong', color: 'hsl(25 95% 53%)' },
                      { key: 'brake', labelKey: 'replay.chartBrakeLong', color: 'hsl(280 65% 60%)' },
                      { key: 'fuelLevel', labelKey: 'replay.chartFuelLong', color: 'hsl(142 55% 42%)' },
                    ]
                  : [
                      { key: 'speed', labelKey: 'replay.chartSpeedLong', color: 'hsl(199 89% 48%)' },
                      { key: 'temp', labelKey: 'replay.chartTempLong', color: 'hsl(25 95% 53%)' },
                      { key: 'brake', labelKey: 'replay.chartBrakeLong', color: 'hsl(280 65% 60%)' },
                      { key: 'lineVoltage', labelKey: 'replay.chartLineVoltageLong', color: 'hsl(48 96% 53%)' },
                    ]
              ).map((spec) => (
                <div
                  key={spec.key}
                  className="rounded-xl border border-border bg-card p-2 min-h-[200px] flex flex-col"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-2">
                    {t(spec.labelKey)}
                  </p>
                  <div className="flex-1 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border opacity-50" />
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={formatAxisTime}
                          tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis tick={{ fontSize: 9 }} width={40} />
                        <Tooltip
                          labelFormatter={(ts) => formatAxisTime(ts)}
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey={spec.key}
                          stroke={spec.color}
                          strokeWidth={2}
                          dot={false}
                        />
                        {scrubT != null ? (
                          <ReferenceLine x={scrubT} stroke="hsl(var(--status-warning))" strokeDasharray="4 4" />
                        ) : null}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
