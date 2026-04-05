import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Download, FileJson, RefreshCw, Table } from 'lucide-react';
import { cn, SeverityIcon } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';
import { useDemoControls } from '@/hooks/useDemoControls';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';

const DEFAULT_LOCOMOTIVE_ID = {
  KZ8A: 'KZ8A-DEMO-01',
  TE33A: 'TE33A-DEMO-01',
};

function buildReportQuery(locomotiveType, locomotiveId, windowMin, fixedWindow) {
  if (fixedWindow && Number.isFinite(fixedWindow.from) && Number.isFinite(fixedWindow.to)) {
    return new URLSearchParams({
      locomotiveType,
      locomotiveId,
      from: String(fixedWindow.from),
      to: String(fixedWindow.to),
    });
  }
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

function alertSeverityLabel(t, sev) {
  if (sev == null || sev === '') return '';
  const k = `cockpit.severity.${sev}`;
  const r = t(k);
  return r === k ? String(sev) : r;
}

export default function Report() {
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

  const [preset, setPreset] = useState('standard');
  const [windowMin, setWindowMin] = useState(15);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const queryParams = useMemo(
    () => buildReportQuery(locomotiveType, locomotiveId, windowMin, incidentWindow),
    [locomotiveType, locomotiveId, windowMin, incidentWindow]
  );

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('report.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {locomotiveType} · {locomotiveId}
            {showDev ? (
              <>
                {' '}
                · <code className="rounded bg-muted px-1 text-[11px] font-mono">GET /api/report</code>
              </>
            ) : null}
          </p>
          {incidentWindow ? (
            <p className="text-xs text-primary mt-2 max-w-xl">
              {t('report.incidentPeriodHint')}{' '}
              {new Date(incidentWindow.from).toLocaleString()} —{' '}
              {new Date(incidentWindow.to).toLocaleString()}.
              <button
                type="button"
                onClick={() => clearIncidentWindowParams()}
                className="ml-2 underline underline-offset-2 hover:text-foreground"
              >
                {t('report.resetStandardWindow')}
              </button>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPreview()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-secondary"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {t('report.refreshPreview')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('report.windowParams')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPreset('standard');
              setWindowMin(15);
              if (incidentWindow) clearIncidentWindowParams();
            }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              preset === 'standard'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {t('report.presetStandard')}
          </button>
          <button
            type="button"
            onClick={() => {
              setPreset('incident');
              setWindowMin(5);
              if (incidentWindow) clearIncidentWindowParams();
            }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              preset === 'incident'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            )}
            title={t('report.presetIncidentTitle')}
          >
            {t('report.presetIncident')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {windowOptions.map((w) => (
            <button
              key={w.min}
              type="button"
              disabled={preset === 'incident'}
              onClick={() => {
                setWindowMin(w.min);
                if (incidentWindow) clearIncidentWindowParams();
              }}
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
          <p className="text-xs text-muted-foreground">{t('report.presetIncidentHint')}</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm" role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      {loading && !report ? (
        <div className="flex items-center justify-center min-h-[120px] text-muted-foreground text-sm font-mono">
          {t('report.loading')}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('report.summaryTitle')}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('report.period')}: {meta?.from ? new Date(meta.from).toLocaleString() : '—'} —{' '}
                  {meta?.to ? new Date(meta.to).toLocaleString() : '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onExport('json')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-secondary"
                >
                  <FileJson className="w-4 h-4" />
                  {t('report.exportJson')}
                </button>
                <button
                  type="button"
                  onClick={() => void onExport('csv')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                >
                  <Table className="w-4 h-4" />
                  {t('report.exportCsv')}
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono border-t border-border/60 pt-4">
              <div>
                <dt className="text-muted-foreground">{t('report.telemetryPoints')}</dt>
                <dd className="text-lg font-semibold tabular-nums">{meta?.sampleCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('report.hiMin')}</dt>
                <dd className="text-lg font-semibold tabular-nums">{hs?.min ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('report.hiMax')}</dt>
                <dd className="text-lg font-semibold tabular-nums">{hs?.max ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('report.hiAvg')}</dt>
                <dd className="text-lg font-semibold tabular-nums">{hs?.avg ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('report.hiLastClass')}</dt>
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
                  {t('report.alertsInWindow')}
                </h3>
                {Array.isArray(report.alertsInWindow) && report.alertsInWindow.length > 0 ? (
                  <ul className="text-sm space-y-1.5 list-disc list-inside text-foreground/90">
                    {report.alertsInWindow.slice(0, 6).map((a) => (
                      <li key={`${a.code}-${a.timestamp}`}>
                        <span className="font-medium">{a.title || a.code}</span>
                        {a.severity ? (
                          <span className="text-muted-foreground inline-flex items-center gap-0.5">
                            {' · '}
                            <SeverityIcon severity={a.severity} />
                            {alertSeverityLabel(t, a.severity)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('report.noAlertsInWindow')}</p>
                )}
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {t('report.topContributors')}
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
                  <p className="text-sm text-muted-foreground">{t('report.noContributors')}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t('report.recommendationsSummary')}
              </h3>
              {Array.isArray(report.recommendationsSummary) && report.recommendationsSummary.length > 0 ? (
                <ul className="text-sm space-y-1 list-decimal list-inside text-foreground/90">
                  {report.recommendationsSummary.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('report.noRecommendations')}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground font-mono">
            <span className="inline-flex items-center gap-1.5 text-foreground/80">
              <Download className="w-3.5 h-3.5" />
              {t('report.exportFooter')}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
