import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCockpitData, STALE_TELEMETRY_MS } from '@/hooks/useCockpitData';
import { useI18n } from '@/i18n/I18nContext';
import { useDemoControls } from '@/hooks/useDemoControls';
import { MetricCards } from '@/components/cockpit/MetricCards';
import { DigitalTwin } from '@/components/cockpit/DigitalTwin';
import { RecommendationsPanel } from '@/components/cockpit/RecommendationsPanel';
import HealthBreakdownWidget from '@/components/HealthBreakdownWidget';
import RiskScoreWidget from '@/components/RiskScoreWidget';
import RouteContextWidget from '@/components/RouteContextWidget';
import ConnectionStatusBadge from '@/components/ConnectionStatusBadge';
import { cn, SeverityIcon } from '@/lib/utils';

function healthStrokeClass(status) {
  if (status === 'critical') return 'stroke-status-critical';
  if (status === 'warning') return 'stroke-status-warning';
  return 'stroke-status-ok';
}

function scenarioLabel(t, id) {
  if (!id || typeof id !== 'string') return '';
  const fullKey = `cockpit.scenarios.${id}`;
  const resolved = t(fullKey);
  if (resolved === fullKey) {
    return id.replace(/_/g, ' ');
  }
  return resolved;
}

export default function Cockpit() {
  const { locomotiveType } = useOutletContext();
  const { t } = useI18n();
  const showDemoControls = useDemoControls();
  const {
    data,
    history,
    connected,
    connectionStatus,
    isStale,
    telemetryAgeSec,
    profileMismatch,
    streamType,
    initialLoading,
    throughput,
  } = useCockpitData(locomotiveType, { trackThroughput: showDemoControls });

  const showLoading = initialLoading || (connected && !lastMeaningfulData(data, profileMismatch));

  const loadingMessage =
    connectionStatus === 'reconnecting'
      ? t('cockpit.loadingReconnect')
      : connected
        ? t('cockpit.loadingTelemetry')
        : connectionStatus === 'connecting'
          ? t('cockpit.loadingConnect')
          : t('cockpit.loadingOffline');

  const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
  const emptyWsPlain =
    connectionStatus === 'reconnecting'
      ? t('cockpit.emptyWsReconnect')
      : connectionStatus === 'connecting'
        ? t('cockpit.emptyWsConnect')
        : `${t('cockpit.emptyWs')} (${wsUrl}).`;

  function severityLabel(sev) {
    if (sev == null || sev === '') return '';
    const k = `cockpit.severity.${sev}`;
    const r = t(k);
    return r === k ? String(sev) : r;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {profileMismatch ? (
        <div
          className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-foreground"
          role="status"
          aria-live="polite"
        >
          <strong>{t('cockpit.profileMismatchTitle')}</strong>{' '}
          {t('cockpit.profileMismatchBody', {
            streamType: String(streamType ?? '—'),
            locomotiveType: String(locomotiveType ?? '—'),
          })}
        </div>
      ) : null}

      {showLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[320px] gap-4" role="status" aria-live="polite">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" aria-hidden />
          <p className="text-muted-foreground text-sm leading-relaxed max-w-md text-center">{loadingMessage}</p>
        </div>
      ) : null}

      {!showLoading && data ? (
        <>
          {isStale ? (
            <div
              className="rounded-lg border border-status-warning/45 bg-status-warning/10 px-4 py-2.5 text-sm text-foreground flex flex-wrap items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <span aria-hidden>⚠️</span>
              <span>
                {t('cockpit.staleBanner', {
                  seconds: telemetryAgeSec != null ? String(telemetryAgeSec) : '—',
                  limitSec: String(Math.round(STALE_TELEMETRY_MS / 1000)),
                })}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{data.locomotive_id}</h2>
              <ConnectionStatusBadge status={connectionStatus} />
              <p className="text-muted-foreground text-sm w-full sm:w-auto">
                {data.locomotiveType} · {data.healthClass}
              </p>
            </div>
            {showDemoControls && throughput?.rate > 0 ? (
              <div
                className="bg-muted/50 rounded-lg px-4 py-2 border border-border text-right flex flex-col justify-center"
                title={t('cockpit.throughputLabel')}
              >
                <span className="text-sm font-bold font-mono text-primary flex items-center gap-2 justify-end">
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  {throughput.rate} {t('cockpit.throughputUnit')}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {t('cockpit.throughputLatency')}: {throughput.avgLatency.toFixed(1)} ms
                </span>
              </div>
            ) : null}
          </div>

          <RecommendationsPanel
            recommendations={data.recommendations}
            healthStatus={data.healthStatus}
          />

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-4 min-h-[400px] shadow-sm">
                <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-muted-foreground">
                  {t('cockpit.alertsTitle')}
                </h3>
                {data.alerts.length > 0 ? (
                  <ul
                    className="space-y-3 max-h-[min(520px,70vh)] overflow-y-auto pr-1"
                    aria-live="polite"
                  >
                    {data.alerts.map((a) => (
                      <li
                        key={a.id}
                        className={cn(
                          'rounded-lg border p-3 text-sm',
                          a.severity === 'critical'
                            ? 'border-status-critical/50 bg-status-critical/10'
                            : a.severity === 'warning'
                              ? 'border-status-warning/50 bg-status-warning/10'
                              : 'border-border bg-muted/30'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold leading-snug text-foreground">{a.title}</span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5 shrink-0 text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded',
                              a.severity === 'critical'
                                ? 'bg-status-critical/20 text-status-critical'
                                : a.severity === 'warning'
                                  ? 'bg-status-warning/20 text-status-warning'
                                  : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <SeverityIcon severity={a.severity} />
                            {severityLabel(a.severity)}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{a.message}</p>
                        <p className="mt-2 pt-2 border-t border-border/60 text-xs leading-relaxed">
                          <span className="text-muted-foreground font-medium">{t('cockpit.recommendation')}: </span>
                          {a.recommendation}
                        </p>
                        {showDemoControls ? (
                          <p className="mt-1.5 text-[10px] font-mono text-muted-foreground/80">
                            {a.code} · {a.subsystem} · {a.locomotiveType}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="min-h-[120px] text-sm text-muted-foreground" aria-hidden>
                    —
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-6 space-y-4">
              <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256" aria-hidden>
                    <circle
                      cx="128"
                      cy="128"
                      r="110"
                      className="stroke-border opacity-30"
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="128"
                      cy="128"
                      r="110"
                      className={cn('transition-all duration-500 ease-out', healthStrokeClass(data.healthStatus))}
                      strokeWidth="16"
                      fill="none"
                      strokeDasharray="690"
                      strokeDashoffset={690 - (690 * data.health) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <span
                      className={cn(
                        'text-7xl font-sans font-bold tabular-nums',
                        data.healthStatus === 'critical'
                          ? 'text-status-critical'
                          : data.healthStatus === 'warning'
                            ? 'text-status-warning'
                            : 'text-status-ok'
                      )}
                    >
                      {data.health}
                    </span>
                    <p className="text-sm font-semibold tracking-wide uppercase opacity-60 mt-1 text-muted-foreground">
                      {t('cockpit.healthIndex')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize inline-flex items-center gap-1 justify-center">
                      <SeverityIcon severity={data.healthStatus} />
                      {severityLabel(data.healthStatus)}
                    </p>
                    {showDemoControls && data.demoScenario ? (
                      <p className="text-xs text-muted-foreground/90 mt-2">
                        {t('cockpit.scenarioLabel')}: {scenarioLabel(t, data.demoScenario)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {data.contributors?.length ? (
                  <div className="mt-6 w-full max-w-md">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      {t('cockpit.topFactors')}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {data.contributors.map((c) => (
                        <li key={c.key} className="flex justify-between border-b border-border/50 py-1 gap-2">
                          <span className="min-w-0" title={c.reason || undefined}>
                            {c.label}
                            {c.subsystem ? (
                              <span className="text-muted-foreground text-xs ml-1">({c.subsystem})</span>
                            ) : null}
                          </span>
                          <span className="text-status-warning shrink-0 tabular-nums">+{c.penalty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-6 w-full max-w-lg space-y-4">
                  <HealthBreakdownWidget health={data.raw?.health} />
                  <RiskScoreWidget
                    locoType={locomotiveType}
                    locomotiveId={data.raw?.snapshot?.locomotiveId}
                  />
                  <RouteContextWidget
                    routeContext={data.routeContext}
                    speedKmh={data.metrics?.speed}
                  />
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-6 min-h-[400px] shadow-sm">
                <DigitalTwin metrics={data.metrics} locomotiveType={locomotiveType} />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <MetricCards
              metrics={data.metrics}
              history={history}
              locomotiveType={locomotiveType}
            />
          </div>
        </>
      ) : null}

      {!showLoading && !data && !profileMismatch ? (
        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 text-muted-foreground text-sm text-center px-4">
          <ConnectionStatusBadge status={connectionStatus} className="text-xs" />
          <p className="max-w-md leading-relaxed">{emptyWsPlain}</p>
          {connectionStatus === 'offline' ? (
            <p className="text-xs text-muted-foreground/90">{t('cockpit.emptyWsHint')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function lastMeaningfulData(data, mismatch) {
  if (mismatch) return true;
  return Boolean(data);
}
