import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  RefreshCw,
  X,
  FileText,
  History,
  Wifi,
  WifiOff,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

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

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}с назад`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}м назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}ч назад`;
  return formatTs(iso);
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

function SeverityBadge({ severity, size = 'sm' }) {
  const base = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider',
        base,
        severity === 'critical'
          ? 'bg-status-critical/20 text-status-critical border border-status-critical/30'
          : severity === 'warning'
            ? 'bg-status-warning/20 text-status-warning border border-status-warning/30'
            : 'bg-muted text-muted-foreground border border-border'
      )}
    >
      {severity === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-status-critical animate-pulse" />}
      {severity === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />}
      {severity}
    </span>
  );
}

function StatCard({ label, value, color, icon: Icon, pulse }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-1 transition-all',
        color === 'critical'
          ? 'border-status-critical/30 bg-status-critical/5'
          : color === 'warning'
            ? 'border-status-warning/30 bg-status-warning/5'
            : color === 'ok'
              ? 'border-primary/30 bg-primary/5'
              : 'border-border bg-card'
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon
            className={cn(
              'w-4 h-4',
              color === 'critical'
                ? 'text-status-critical'
                : color === 'warning'
                  ? 'text-status-warning'
                  : color === 'ok'
                    ? 'text-primary'
                    : 'text-muted-foreground'
            )}
          />
        )}
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      </div>
      <p
        className={cn(
          'text-3xl font-bold tabular-nums',
          color === 'critical'
            ? 'text-status-critical'
            : color === 'warning'
              ? 'text-status-warning'
              : color === 'ok'
                ? 'text-primary'
                : 'text-foreground'
        )}
      >
        {value}
        {pulse && value > 0 && (
          <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-status-critical animate-ping" />
        )}
      </p>
    </div>
  );
}

function AckToast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/40 bg-card shadow-2xl shadow-black/40 text-sm font-medium animate-in slide-in-from-bottom-4 duration-300">
      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="ml-2 text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Incident Center — operational alert triage (GET /api/alerts, POST /api/alerts/:id/ack).
 * HK-031: Full implementation with WebSocket real-time, summary bar, drawer, ack workflow.
 */
export default function IncidentCenter() {
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [ackFilter, setAckFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [ackSubmitting, setAckSubmitting] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [tick, setTick] = useState(0);

  // Relative timestamps ticker
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // ─── REST load ─────────────────────────────────────────────────────────────
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
      setLastUpdatedAt(Date.now());
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

  // REST polling fallback every 20s
  useEffect(() => {
    const id = setInterval(() => void loadAlerts(), 20000);
    return () => clearInterval(id);
  }, [loadAlerts]);

  // ─── WebSocket real-time ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'], autoConnect: true });
    socketRef.current = socket;

    socket.on('connect', () => setLiveConnected(true));
    socket.on('disconnect', () => setLiveConnected(false));
    socket.io.on('reconnect_attempt', () => setLiveConnected(false));

    socket.on('alerts:update', (payload) => {
      if (!payload || !Array.isArray(payload.alerts)) return;
      // Apply profile filter — if we're filtering by type, skip other types
      if (
        (profileFilter === 'KZ8A' || profileFilter === 'TE33A') &&
        payload.locomotiveType !== profileFilter
      ) {
        return;
      }
      setAlerts((prev) => {
        // Merge: update existing alerts for this locomotive, keep others
        if (!payload.locomotiveType || !payload.locomotiveId) {
          return payload.alerts;
        }
        const updatedIds = new Set(payload.alerts.map((a) => a.id));
        const locoKey = `${payload.locomotiveType}:${payload.locomotiveId}`;
        const otherAlerts = prev.filter(
          (a) => `${a.locomotiveType}:${resolveLocoId(a)}` !== locoKey
        );
        return [...otherAlerts, ...payload.alerts];
      });
      setLastUpdatedAt(Date.now());
      // Update selected panel if it's from the same locomotive
      setSelected((prev) => {
        if (!prev) return prev;
        const fresh = payload.alerts.find((a) => a.id === prev.id);
        return fresh ? fresh : prev;
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.io.off('reconnect_attempt');
      socket.close();
      socketRef.current = null;
    };
  }, [profileFilter]);

  // ─── Escape key for drawer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    function handler(e) {
      if (e.key === 'Escape') setSelected(null);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected]);

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const critical = alerts.filter((a) => !a.acked && a.severity === 'critical');
    const warning = alerts.filter((a) => !a.acked && a.severity === 'warning');
    const unacked = alerts.filter((a) => !a.acked);
    return {
      total: alerts.length,
      critical: critical.length,
      warning: warning.length,
      unacked: unacked.length,
    };
  }, [alerts, tick]);

  // ─── Filtered list ─────────────────────────────────────────────────────────
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
      // Unacked always first
      if (!a.acked && b.acked) return -1;
      if (a.acked && !b.acked) return 1;
      const sr = severityRank(a.severity) - severityRank(b.severity);
      if (sr !== 0) return sr;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    return list;
  }, [alerts, severityFilter, ackFilter, profileFilter]);

  // ─── Navigation actions ────────────────────────────────────────────────────
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

  // ─── Acknowledge ───────────────────────────────────────────────────────────
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
      const ackedAt = new Date().toISOString();
      // Optimistic update — no reload needed
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, acked: true, ackedAt } : a))
      );
      setSelected((prev) => (prev && prev.id === id ? { ...prev, acked: true, ackedAt } : prev));
      setToast('Инцидент подтверждён — статус обновлён');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAckSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1600px] mx-auto space-y-5">
      {/* ── Toast ── */}
      {toast && <AckToast message={toast} onDismiss={() => setToast(null)} />}

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Incident Center</h1>
            {/* Live status pill */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                liveConnected
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-border'
              )}
            >
              {liveConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <Wifi className="w-3 h-3" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  Polling
                </>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Операторский экран расследования и обработки инцидентов. Нажмите на строку для деталей.
          </p>
          {lastUpdatedAt && (
            <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
              Обновлено: {timeAgo(new Date(lastUpdatedAt).toISOString())}
            </p>
          )}
        </div>
        <button
          type="button"
          id="incident-refresh-btn"
          onClick={() => {
            setLoading(true);
            void loadAlerts();
          }}
          className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-secondary transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Обновить
        </button>
      </div>

      {/* ── API Error ── */}
      {error ? (
        <div className="rounded-lg border border-status-critical/40 bg-status-critical/10 px-4 py-3 text-sm text-foreground flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-status-critical shrink-0" />
          <span>
            <strong>Ошибка API.</strong> {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Всего алертов" value={stats.total} icon={Zap} />
        <StatCard
          label="Критических"
          value={stats.critical}
          color="critical"
          icon={ShieldAlert}
          pulse
        />
        <StatCard label="Предупреждений" value={stats.warning} color="warning" icon={AlertTriangle} />
        <StatCard label="Не подтверждено" value={stats.unacked} icon={Clock} />
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Фильтры
          </span>

          {/* Severity filter */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-muted-foreground shrink-0">Уровень:</span>
            {[
              { label: 'Все', value: 'all' },
              { label: 'Critical', value: 'critical' },
              { label: 'Warning', value: 'warning' },
              { label: 'Info', value: 'info' },
            ].map((o) => (
              <button
                key={`sev-${o.value}`}
                id={`filter-severity-${o.value}`}
                type="button"
                onClick={() => setSeverityFilter(o.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md border text-xs font-medium transition-all',
                  severityFilter === o.value
                    ? o.value === 'critical'
                      ? 'bg-status-critical/20 text-status-critical border-status-critical/40'
                      : o.value === 'warning'
                        ? 'bg-status-warning/20 text-status-warning border-status-warning/40'
                        : 'bg-primary/20 text-primary border-primary/40'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <span className="text-border hidden sm:inline">|</span>

          {/* Ack filter */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-muted-foreground hidden sm:inline shrink-0">Статус:</span>
            {[
              { label: 'Все', value: 'all' },
              { label: '✓ Подтверждённые', value: 'acknowledged' },
              { label: '⚠ Открытые', value: 'unacknowledged' },
            ].map((o) => (
              <button
                key={`ack-${o.value}`}
                id={`filter-ack-${o.value}`}
                type="button"
                onClick={() => setAckFilter(o.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md border text-xs font-medium transition-all',
                  ackFilter === o.value
                    ? 'bg-secondary text-foreground border-border'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <span className="text-border hidden md:inline">|</span>

          {/* Profile filter */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-muted-foreground hidden md:inline shrink-0">Профиль:</span>
            {[
              { label: 'Все поезда', value: 'all' },
              { label: 'KZ8A', value: 'KZ8A' },
              { label: 'TE33A', value: 'TE33A' },
            ].map((o) => (
              <button
                key={`pf-${o.value}`}
                id={`filter-profile-${o.value}`}
                type="button"
                onClick={() => setProfileFilter(o.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md border text-xs font-mono font-medium transition-all',
                  profileFilter === o.value
                    ? 'bg-secondary text-foreground border-border'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[240px] gap-3 text-muted-foreground text-sm font-mono">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Загрузка инцидентов…
        </div>
      ) : null}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-8 py-16 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            {alerts.length === 0
              ? 'Нет активных алертов'
              : 'Нет инцидентов по выбранным фильтрам'}
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {alerts.length === 0
              ? 'Все системы в штатном режиме. При возникновении отклонений инциденты появятся здесь автоматически.'
              : 'Переключите фильтры или переключите сценарий симулятора для генерации алертов.'}
          </p>
          {alerts.length === 0 && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Запустите симулятор в сценарии overheat / brake_failure для демонстрации
            </p>
          )}
        </div>
      ) : null}

      {/* ── Alert table ── */}
      {!loading && filtered.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold w-4" />
                <th className="px-4 py-3 font-semibold">Уровень</th>
                <th className="px-4 py-3 font-semibold">Подсистема</th>
                <th className="px-4 py-3 font-semibold">Код</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Поезд</th>
                <th className="px-4 py-3 font-semibold">Заголовок</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Время</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr
                  key={a.id}
                  id={`incident-row-${a.id}`}
                  className={cn(
                    'border-b border-border/60 cursor-pointer transition-colors group',
                    selected?.id === a.id
                      ? 'bg-secondary/80'
                      : 'hover:bg-muted/30',
                    a.acked && 'opacity-60'
                  )}
                  onClick={() => setSelected(a)}
                >
                  {/* Left severity stripe */}
                  <td className="w-1 p-0">
                    <div
                      className={cn(
                        'w-1 h-full min-h-[52px]',
                        a.severity === 'critical'
                          ? 'bg-status-critical'
                          : a.severity === 'warning'
                            ? 'bg-status-warning'
                            : 'bg-muted'
                      )}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={a.severity} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{a.subsystem}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.code}</td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted border border-border text-foreground">
                      {a.locomotiveType}
                    </span>
                    <span className="text-muted-foreground ml-1">{resolveLocoId(a)}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <span className="line-clamp-2 font-medium text-foreground">{a.title}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{formatTs(a.timestamp)}</p>
                    <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">{timeAgo(a.timestamp)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {a.acked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Подтверждено
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          a.severity === 'critical' ? 'text-status-critical' : 'text-status-warning'
                        )}
                      >
                        Открыт
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      id={`incident-details-${a.id}`}
                      className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(a);
                      }}
                    >
                      Детали →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Показано {filtered.length} из {alerts.length} инцидентов
          </div>
        </div>
      ) : null}

      {/* ── Detail drawer ── */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="incident-detail-title"
          onClick={() => setSelected(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative w-full max-w-lg h-full bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden"
            style={{ animation: 'slideInRight 0.2s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div
              className={cn(
                'px-5 py-4 border-b border-border',
                selected.severity === 'critical'
                  ? 'bg-status-critical/5 border-b-status-critical/20'
                  : selected.severity === 'warning'
                    ? 'bg-status-warning/5'
                    : 'bg-card'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SeverityBadge severity={selected.severity} size="lg" />
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                      {selected.subsystem}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                      {selected.locomotiveType} / {resolveLocoId(selected)}
                    </span>
                  </div>
                  <p id="incident-detail-title" className="text-base font-bold leading-snug">
                    {selected.title}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{selected.code}</p>
                </div>
                <button
                  type="button"
                  id="incident-drawer-close"
                  className="p-2 rounded-md hover:bg-muted shrink-0 transition-colors"
                  onClick={() => setSelected(null)}
                  aria-label="Закрыть (Esc)"
                  title="Закрыть (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">

              {/* Timestamp */}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Время инцидента</p>
                  <p className="font-mono text-foreground">{formatTs(selected.timestamp)}</p>
                  <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">{timeAgo(selected.timestamp)}</p>
                </div>
              </div>

              {/* Message */}
              <div className="rounded-lg bg-muted/40 border border-border p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Описание</p>
                <p className="text-foreground leading-relaxed">{selected.message}</p>
              </div>

              {/* Recommendation */}
              <div className="rounded-lg border-l-4 border-l-primary/60 bg-primary/5 border-y border-r border-primary/20 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">💡 Рекомендация</p>
                <p className="text-foreground leading-relaxed">{selected.recommendation}</p>
              </div>

              {/* Ack status */}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Подтверждение</p>
                {selected.acked ? (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Подтверждено{selected.ackedAt ? ` · ${formatTs(selected.ackedAt)}` : ''}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Ожидает подтверждения оператора</p>
                )}
              </div>

              {/* Quick actions */}
              <div className="space-y-2 pt-1 border-t border-border">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Быстрые действия</p>
                <button
                  type="button"
                  id="incident-open-replay"
                  className="w-full inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium transition-colors"
                  onClick={() => openReplay(selected)}
                >
                  <History className="w-4 h-4 text-primary" />
                  <span>Replay вокруг инцидента</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-50 ml-auto" />
                </button>
                <button
                  type="button"
                  id="incident-open-report"
                  className="w-full inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium transition-colors"
                  onClick={() => openReport(selected)}
                >
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Отчёт за это окно</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-50 ml-auto" />
                </button>
              </div>
            </div>

            {/* Drawer footer — Ack action */}
            <div className="p-5 border-t border-border bg-card">
              {!selected.acked ? (
                <button
                  type="button"
                  id="incident-ack-btn"
                  disabled={ackSubmitting}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  onClick={() => void acknowledge(selected.id)}
                >
                  {ackSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Отправка…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Подтвердить инцидент
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Инцидент уже подтверждён
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Drawer slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
