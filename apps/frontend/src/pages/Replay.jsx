import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';

const DEFAULT_LOCOMOTIVE_ID = {
  KZ8A: 'KZ8A-DEMO-01',
  TE33A: 'TE33A-DEMO-01',
};

const WINDOW_OPTIONS = [
  { label: '5 мин', min: 5 },
  { label: '10 мин', min: 10 },
  { label: '15 мин', min: 15 },
];

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
  const { locomotiveType } = useOutletContext();
  const [windowMin, setWindowMin] = useState(15);
  const [rawEntries, setRawEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [scrubIdx, setScrubIdx] = useState(0);

  const locomotiveId = DEFAULT_LOCOMOTIVE_ID[locomotiveType] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;

  const chartData = useMemo(() => {
    return rawEntries.map((e) => {
      const snap = e.payload && typeof e.payload === 'object' ? e.payload : {};
      const h = e.health && typeof e.health === 'object' ? e.health : {};
      return {
        t: e.ts,
        label: formatAxisTime(e.ts),
        health: Number(h.total_score ?? h.score ?? 0),
        speed: Number(snap.speedKmh ?? snap.speed ?? 0),
        temp: Number(snap.engineTempC ?? snap.oilTempC ?? 0),
        brake: Number(snap.brakePressureBar ?? snap.brake_pressure ?? 0),
      };
    });
  }, [rawEntries]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const to = Date.now();
    const from = to - windowMin * 60 * 1000;
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
  }, [locomotiveType, locomotiveId, windowMin]);

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

  const chartWrap = 'h-[200px] w-full min-w-0';

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Replay</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {locomotiveType} · {locomotiveId} · данные из{' '}
            <code className="rounded bg-muted px-1">
              {'GET /api/history?includeHealth=1&order=asc'}
            </code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w.min}
              type="button"
              onClick={() => setWindowMin(w.min)}
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-secondary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Обновить
          </button>
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm">
          Не удалось загрузить историю: {fetchError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm font-mono">
          Загрузка окна…
        </div>
      ) : null}

      {!loading && chartData.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Нет точек за выбранное окно. Запустите симулятор и обновите страницу.
        </div>
      ) : null}

      {!loading && chartData.length > 0 ? (
        <>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Таймлайн</p>
                <p className="text-sm font-mono text-foreground">
                  {atScrub ? formatAxisTime(atScrub.t) : '—'} · точка {scrubIdx + 1} / {chartData.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScrubIdx(incidentIdx)}
                className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-2 rounded-lg text-sm font-medium border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              >
                <SkipBack className="w-4 h-4" />
                К началу инцидента
              </button>
            </div>
            <input
              type="range"
              className="w-full accent-primary h-2 cursor-grab active:cursor-grabbing"
              min={0}
              max={Math.max(0, chartData.length - 1)}
              value={Math.min(scrubIdx, chartData.length - 1)}
              onChange={(e) => setScrubIdx(Number(e.target.value))}
              aria-label="Позиция на таймлайне"
            />
            {atScrub ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono border-t border-border pt-3">
                <div>
                  <span className="text-muted-foreground">Health Index</span>
                  <div className="text-lg font-semibold tabular-nums">{Math.round(atScrub.health)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Скорость, км/ч</span>
                  <div className="text-lg font-semibold tabular-nums">{atScrub.speed.toFixed(1)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Температура, °C</span>
                  <div className="text-lg font-semibold tabular-nums">{atScrub.temp.toFixed(1)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Тормоза, бар</span>
                  <div className="text-lg font-semibold tabular-nums">{atScrub.brake.toFixed(2)}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Health Index
            </h2>
            <div className={cn(chartWrap, 'rounded-xl border border-border bg-card p-2')}>
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
                    formatter={(v) => [Math.round(v), 'HI']}
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
              Ключевые параметры
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'speed', label: 'Скорость (км/ч)', color: 'hsl(199 89% 48%)' },
                { key: 'temp', label: 'Температура двигателя (°C)', color: 'hsl(25 95% 53%)' },
                { key: 'brake', label: 'Давление тормозов (бар)', color: 'hsl(280 65% 60%)' },
              ].map((spec) => (
                <div
                  key={spec.key}
                  className="rounded-xl border border-border bg-card p-2 min-h-[200px] flex flex-col"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-2">
                    {spec.label}
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
