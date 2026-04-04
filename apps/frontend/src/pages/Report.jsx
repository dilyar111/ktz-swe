import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, FileJson, RefreshCw, Table } from 'lucide-react';
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

function buildReportQuery(locomotiveType, locomotiveId, windowMin) {
  const to = Date.now();
  const from = to - windowMin * 60 * 1000;
  return new URLSearchParams({
    locomotiveType,
    locomotiveId,
    from: String(from),
    to: String(to),
  });
}

async function fetchReportJson(params) {
  const q = new URLSearchParams(params);
  q.set('format', 'json');
  const res = await fetch(`${API_BASE}/api/report?${q.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function downloadReportBlob(params, format) {
  const q = new URLSearchParams(params);
  q.set('format', format);
  const res = await fetch(`${API_BASE}/api/report?${q.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.blob();
}

export default function Report() {
  const { locomotiveType } = useOutletContext();
  const locomotiveId = DEFAULT_LOCOMOTIVE_ID[locomotiveType] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;

  const [preset, setPreset] = useState('standard');
  const [windowMin, setWindowMin] = useState(15);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const queryParams = useMemo(
    () => buildReportQuery(locomotiveType, locomotiveId, windowMin),
    [locomotiveType, locomotiveId, windowMin]
  );

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchReportJson(queryParams);
      setReport(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const onExport = async (format) => {
    setError(null);
    try {
      const blob = await downloadReportBlob(queryParams, format);
      const ext = format === 'csv' ? 'csv' : 'json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ktz-incident-report-${locomotiveType}-${locomotiveId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const meta = report?.meta;
  const hs = report?.healthSummary;

  return (
    <div className="max-w-[960px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Отчёт по инциденту</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {locomotiveType} · {locomotiveId} ·{' '}
            <code className="rounded bg-muted px-1">GET /api/report</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPreview()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-secondary"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Обновить превью
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Параметры окна</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPreset('standard');
              setWindowMin(15);
            }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              preset === 'standard'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            )}
          >
            Стандарт
          </button>
          <button
            type="button"
            onClick={() => {
              setPreset('incident');
              setWindowMin(5);
            }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              preset === 'incident'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            )}
            title="Короткое окно (5 мин) для фокуса на последнем эпизоде"
          >
            Пресет «инцидент» (5 мин)
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w.min}
              type="button"
              disabled={preset === 'incident'}
              onClick={() => setWindowMin(w.min)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                windowMin === w.min
                  ? 'bg-secondary text-foreground border-border'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground',
                preset === 'incident' && 'opacity-50 cursor-not-allowed'
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
        {preset === 'incident' ? (
          <p className="text-xs text-muted-foreground">
            Пресет фиксирует окно <strong>5 минут</strong> — удобно для короткого среза перед экспортом.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {loading && !report ? (
        <div className="flex items-center justify-center min-h-[120px] text-muted-foreground text-sm font-mono">
          Загрузка отчёта…
        </div>
      ) : null}

      {report ? (
        <>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Сводка перед экспортом</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Период: {meta?.from ? new Date(meta.from).toLocaleString('ru-RU') : '—'} —{' '}
                  {meta?.to ? new Date(meta.to).toLocaleString('ru-RU') : '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onExport('json')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-secondary"
                >
                  <FileJson className="w-4 h-4" />
                  Экспорт JSON
                </button>
                <button
                  type="button"
                  onClick={() => void onExport('csv')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                >
                  <Table className="w-4 h-4" />
                  Экспорт CSV
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono border-t border-border/60 pt-4">
              <div>
                <dt className="text-muted-foreground">Точек телеметрии</dt>
                <dd className="text-lg font-semibold tabular-nums">{meta?.sampleCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">HI min</dt>
                <dd className="text-lg font-semibold tabular-nums">{hs?.min ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">HI max</dt>
                <dd className="text-lg font-semibold tabular-nums">{hs?.max ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">HI ср.</dt>
                <dd className="text-lg font-semibold tabular-nums">{hs?.avg ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">HI последн. / класс</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {hs?.lastScore ?? '—'}
                  {hs?.class != null ? (
                    <span className="text-muted-foreground ml-1">({hs.class})</span>
                  ) : null}
                </dd>
              </div>
            </dl>

            <div className="grid md:grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Алерты в окне
                </h3>
                {Array.isArray(report.alertsInWindow) && report.alertsInWindow.length > 0 ? (
                  <ul className="text-sm space-y-1.5 list-disc list-inside text-foreground/90">
                    {report.alertsInWindow.slice(0, 6).map((a) => (
                      <li key={`${a.code}-${a.timestamp}`}>
                        <span className="font-medium">{a.title || a.code}</span>
                        {a.severity ? (
                          <span className="text-muted-foreground"> · {a.severity}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет алертов в выбранном интервале.</p>
                )}
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Топ вкладов (последний снимок в окне)
                </h3>
                {Array.isArray(report.topContributors) && report.topContributors.length > 0 ? (
                  <ul className="text-sm space-y-1.5">
                    {report.topContributors.map((c, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="text-foreground/90 truncate">{c.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          −{c.impact}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет вкладов — недостаточно данных.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Рекомендации (сводка)
              </h3>
              {Array.isArray(report.recommendationsSummary) && report.recommendationsSummary.length > 0 ? (
                <ul className="text-sm space-y-1 list-decimal list-inside text-foreground/90">
                  {report.recommendationsSummary.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Нет выделенных рекомендаций.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground font-mono">
            <span className="inline-flex items-center gap-1.5 text-foreground/80">
              <Download className="w-3.5 h-3.5" />
              Экспорт не требует правок кода: те же параметры, что и у превью (
              <span className="text-primary">format=json|csv</span>).
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
