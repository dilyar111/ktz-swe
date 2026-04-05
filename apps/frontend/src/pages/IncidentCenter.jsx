import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  RefreshCw,
  X,
  FileText,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';

const DEFAULT_LOCOMOTIVE_ID = {
  KZ8A: 'KZ8A-DEMO-01',
  TE33A: 'TE33A-DEMO-01',
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function severityRank(s) {
  return SEVERITY_ORDER[s] ?? 3;
}

function formatTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function incidentWindowMs(alert) {
  const t = new Date(alert.timestamp).getTime();
  if (Number.isNaN(t)) {
    const now = Date.now();
    return { from: now - 15 * 60 * 1000, to: now };
  }
  return {
    from: t - 5 * 60 * 1000,
    to: Math.min(Date.now(), t + 10 * 60 * 1000),
  };
}

function resolveLocoId(alert) {
  if (alert.locomotiveId && String(alert.locomotiveId).trim()) {
    return String(alert.locomotiveId).trim();
  }
  const t = alert.locomotiveType;
  return DEFAULT_LOCOMOTIVE_ID[t] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;
}

/**
 * Incident Center — operational alert triage (GET /api/alerts, POST /api/alerts/:id/ack).
 */
export default function IncidentCenter() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [ackFilter, setAckFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [ackSubmitting, setAckSubmitting] = useState(false);

  const loadAlerts = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (profileFilter === 'KZ8A' || profileFilter === 'TE33A') {
        params.set('locomotiveType', profileFilter);
      }
      const q = params.toString();
      const url = q ? `${API_BASE}/api/alerts?${q}` : `${API_BASE}/api/alerts`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setAlerts(Array.isArray(json.alerts) ? json.alerts : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [profileFilter]);

  useEffect(() => {
    setLoading(true);
    void loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    const id = setInterval(() => void loadAlerts(), 20000);
    return () => clearInterval(id);
  }, [loadAlerts]);

  const filtered = useMemo(() => {
    let list = [...alerts];
    if (severityFilter === 'critical') list = list.filter((a) => a.severity === 'critical');
    else if (severityFilter === 'warning') list = list.filter((a) => a.severity === 'warning');
    else if (severityFilter === 'info') list = list.filter((a) => a.severity === 'info');

    if (ackFilter === 'acknowledged') list = list.filter((a) => a.acked);
    else if (ackFilter === 'unacknowledged') list = list.filter((a) => !a.acked);

    if (profileFilter === 'KZ8A' || profileFilter === 'TE33A') {
      list = list.filter((a) => a.locomotiveType === profileFilter);
    }

    list.sort((a, b) => {
      const sr = severityRank(a.severity) - severityRank(b.severity);
      if (sr !== 0) return sr;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    return list;
  }, [alerts, severityFilter, ackFilter, profileFilter]);

  const openReplay = (alert) => {
    const { from, to } = incidentWindowMs(alert);
    const q = new URLSearchParams({
      from: String(from),
      to: String(to),
      locomotiveType: alert.locomotiveType || 'KZ8A',
      locomotiveId: resolveLocoId(alert),
    });
    navigate({ pathname: '/history', search: `?${q.toString()}` });
  };

  const openReport = (alert) => {
    const { from, to } = incidentWindowMs(alert);
    const q = new URLSearchParams({
      from: String(from),
      to: String(to),
      locomotiveType: alert.locomotiveType || 'KZ8A',
      locomotiveId: resolveLocoId(alert),
    });
    navigate({ pathname: '/report', search: `?${q.toString()}` });
  };

  const acknowledge = async (id) => {
    setAckSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${encodeURIComponent(id)}/ack`, {
        method: 'POST',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      await loadAlerts();
      setSelected((prev) => (prev && prev.id === id ? { ...prev, acked: true, ackedAt: new Date().toISOString() } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAckSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Center</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Активные предупреждения и подтверждения. Правило-based health остаётся источником истины в Cockpit;
            здесь — операторский поток расследования.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadAlerts();
          }}
          className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-secondary"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Обновить
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-status-critical/40 bg-status-critical/10 px-4 py-3 text-sm text-foreground">
          <strong>Ошибка API.</strong> {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            Фильтры
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-muted-foreground">Уровень:</span>
            {[
              { label: 'Все', value: 'all' },
              { label: 'Critical', value: 'critical' },
              { label: 'Warning', value: 'warning' },
              { label: 'Info', value: 'info' },
            ].map((o) => (
              <button
                key={`sev-${o.value}`}
                type="button"
                onClick={() => setSeverityFilter(o.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md border text-xs font-medium',
                  severityFilter === o.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="text-border px-1 hidden sm:inline">|</span>
          <span className="text-muted-foreground hidden sm:inline">Ack:</span>
          {[
            { label: 'Все', value: 'all' },
            { label: 'Подтверждённые', value: 'acknowledged' },
            { label: 'Не подтверждённые', value: 'unacknowledged' },
          ].map((o) => (
            <button
              key={`ack-${o.value}`}
              type="button"
              onClick={() => setAckFilter(o.value)}
              className={cn(
                'px-2.5 py-1 rounded-md border text-xs font-medium',
                ackFilter === o.value
                  ? 'bg-secondary text-foreground border-border'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {o.label}
            </button>
          ))}
          <span className="text-border px-1 hidden md:inline">|</span>
          <span className="text-muted-foreground hidden md:inline">Профиль:</span>
          {[
            { label: 'Все поезда', value: 'all' },
            { label: 'KZ8A', value: 'KZ8A' },
            { label: 'TE33A', value: 'TE33A' },
          ].map((o) => (
            <button
              key={`pf-${o.value}`}
              type="button"
              onClick={() => setProfileFilter(o.value)}
              className={cn(
                'px-2.5 py-1 rounded-md border text-xs font-mono font-medium',
                profileFilter === o.value
                  ? 'bg-secondary text-foreground border-border'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[240px] text-muted-foreground text-sm font-mono">
          Загрузка инцидентов…
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
          <p className="text-lg font-medium text-foreground">Нет инцидентов по выбранным фильтрам</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            При штатном сценарии алертов может не быть. Переключите сценарий симулятора или ослабьте фильтры.
          </p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Уровень</th>
                <th className="px-4 py-3 font-semibold">Подсистема</th>
                <th className="px-4 py-3 font-semibold">Код</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Поезд</th>
                <th className="px-4 py-3 font-semibold">Заголовок</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Время</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelected(a)}
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded text-[11px] font-semibold uppercase',
                        a.severity === 'critical'
                          ? 'bg-status-critical/20 text-status-critical'
                          : a.severity === 'warning'
                            ? 'bg-status-warning/20 text-status-warning'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{a.subsystem}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.code}</td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs">
                    {a.locomotiveType} · {resolveLocoId(a)}
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <span className="line-clamp-2 font-medium">{a.title}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {formatTs(a.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    {a.acked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-status-ok">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        OK
                      </span>
                    ) : (
                      <span className="text-xs text-status-warning">Открыт</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(a);
                      }}
                    >
                      Детали
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="incident-detail-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md h-full bg-card border-l border-border shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
              <div className="min-w-0">
                <p id="incident-detail-title" className="text-lg font-bold leading-tight pr-2">
                  {selected.title}
                </p>
                <p className="text-xs font-mono text-muted-foreground mt-1">{selected.code}</p>
              </div>
              <button
                type="button"
                className="p-2 rounded-md hover:bg-muted shrink-0"
                onClick={() => setSelected(null)}
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-bold uppercase',
                    selected.severity === 'critical'
                      ? 'bg-status-critical/20 text-status-critical'
                      : selected.severity === 'warning'
                        ? 'bg-status-warning/20 text-status-warning'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {selected.severity}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-muted border border-border">
                  {selected.subsystem}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-muted border border-border">
                  {selected.locomotiveType} / {resolveLocoId(selected)}
                </span>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Время</p>
                <p className="font-mono text-foreground">{formatTs(selected.timestamp)}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Сообщение</p>
                <p className="text-foreground leading-relaxed">{selected.message}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Рекомендация</p>
                <p className="text-foreground leading-relaxed border-l-2 border-primary/50 pl-3">
                  {selected.recommendation}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Подтверждение</p>
                {selected.acked ? (
                  <p className="text-status-ok text-sm">
                    Подтверждено
                    {selected.ackedAt ? ` · ${formatTs(selected.ackedAt)}` : ''}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">Не подтверждено</p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Быстрые действия</p>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium"
                  onClick={() => openReplay(selected)}
                >
                  <History className="w-4 h-4" />
                  Replay вокруг инцидента
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium"
                  onClick={() => openReport(selected)}
                >
                  <FileText className="w-4 h-4" />
                  Отчёт за это окно
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-border space-y-2">
              {!selected.acked ? (
                <button
                  type="button"
                  disabled={ackSubmitting}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  onClick={() => void acknowledge(selected.id)}
                >
                  {ackSubmitting ? 'Отправка…' : 'Подтвердить инцидент (ack)'}
                </button>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-2">Инцидент уже подтверждён</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
