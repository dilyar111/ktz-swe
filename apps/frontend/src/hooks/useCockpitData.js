import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE, WS_URL, createSocketIo, waitForBackendHealth } from '@/lib/socketIo';

/** HK-019 — if no telemetry for this long while socket is up, treat as stale (simulator stopped, etc.). */
export const STALE_TELEMETRY_MS = 8000;

function throttle(func, wait) {
  let timeout = null;
  let previous = 0;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

/** ID по умолчанию — как в симуляторе (см. apps/simulator) */
const DEFAULT_LOCOMOTIVE_ID = {
  KZ8A: 'KZ8A-DEMO-01',
  TE33A: 'TE33A-DEMO-01',
};

function normalizeMetrics(snap, locomotiveType) {
  const isKz = locomotiveType === 'KZ8A';
  return {
    speed: Number(snap.speedKmh ?? snap.speed ?? 0),
    engine_temp: Number(snap.engineTempC ?? snap.oilTempC ?? 0),
    brake_pressure: Number(snap.brakePressureBar ?? snap.brake_pressure ?? 0),
    fuel: snap.fuelLevelPct != null ? Number(snap.fuelLevelPct) : null,
    voltage: isKz
      ? Number(snap.lineVoltageV ?? snap.voltage ?? 0)
      : Number(snap.voltage ?? snap.batteryVoltageV ?? 0),
    current: Number(snap.tractionCurrentA ?? snap.current ?? 0),
  };
}

/**
 * @param {unknown[]} alerts
 */
function buildCockpitModel(locomotiveType, snapshot, health, alerts = []) {
  if (!snapshot || snapshot.locomotiveType !== locomotiveType) return null;
  const list = Array.isArray(alerts) ? alerts : [];
  const demoScenario =
    snapshot.demoScenario != null
      ? String(snapshot.demoScenario)
      : health.demoScenario != null
        ? String(health.demoScenario)
        : null;

  return {
    locomotive_id: snapshot.locomotiveId ?? '—',
    locomotiveType: snapshot.locomotiveType,
    demoScenario,
    routeContext: snapshot.routeContext ?? null,
    health: health.score ?? health.total_score,
    healthClass: health.class,
    healthStatus: health.status,
    contributors: health.contributors ?? [],
    /** HK-009 breakdown — optional if backend older */
    subsystems: health.subsystems ?? null,
    profile: health.profile ?? null,
    weights: health.weights ?? null,
    total_score: health.total_score ?? health.score,
    metrics: normalizeMetrics(snapshot, locomotiveType),
    alerts: list,
    recommendations: Array.isArray(health.recommendations) ? health.recommendations : [],
    raw: { snapshot, health },
  };
}

/**
 * HK-019 — single badge state for UI (transport + freshness).
 * @param {boolean} connected
 * @param {boolean} hasEverConnected
 * @param {boolean} isReconnecting
 * @param {boolean} isStale
 */
export function deriveConnectionStatus(connected, hasEverConnected, isReconnecting, isStale) {
  if (!connected) {
    if (isReconnecting) return 'reconnecting';
    if (!hasEverConnected) return 'connecting';
    return 'offline';
  }
  if (isStale) return 'stale';
  return 'online';
}

/**
 * @param {string} locomotiveType
 * @param {{ trackThroughput?: boolean }} [options]
 */
export function useCockpitData(locomotiveType, options = {}) {
  const { trackThroughput = false } = options;
  const [lastPayload, setLastPayload] = useState(null);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastTelemetryAt, setLastTelemetryAt] = useState(/** @type {number | null} */ (null));
  const [tick, setTick] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [throughput, setThroughput] = useState({ rate: 0, avgLatency: 0 });
  /** Алерты из alerts:update, пришедшие до первого snapshot (редкий порядок событий). */
  const pendingAlertsRef = useRef(/** @type {unknown[] | null} */ (null));

  // Сброс при смене профиля
  useEffect(() => {
    setHistory([]);
    setLastPayload(null);
    setInitialLoading(true);
    setLastTelemetryAt(null);
    pendingAlertsRef.current = null;
  }, [locomotiveType]);

  const bootstrapFromRest = useCallback(async () => {
    const locomotiveId = DEFAULT_LOCOMOTIVE_ID[locomotiveType] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;
    const params = new URLSearchParams({ locomotiveType, locomotiveId });

    try {
      const res = await fetch(`${API_BASE}/api/current?${params.toString()}`);
      if (!res.ok) return;

      const json = await res.json();
      if (json.snapshot && json.health) {
        const alerts = Array.isArray(json.alerts) ? json.alerts : pendingAlertsRef.current ?? [];
        pendingAlertsRef.current = null;
        setLastPayload({
          snapshot: json.snapshot,
          health: json.health,
          alerts,
        });
        setLastTelemetryAt(Date.now());
        const model = buildCockpitModel(locomotiveType, json.snapshot, json.health, alerts);
        if (model?.metrics) {
          setHistory([model.metrics]);
        }
      }
    } catch {
      /* сокет подхватит */
    }
  }, [locomotiveType]);

  // Стартовый снимок + алерты с backend REST (тот же состав, что в WebSocket)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      await bootstrapFromRest();
      if (!cancelled) setInitialLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [locomotiveType, bootstrapFromRest]);

  // HK-019 — recompute stale detection every second without new telemetry
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const isStale = useMemo(() => {
    if (!connected || lastTelemetryAt == null) return false;
    return Date.now() - lastTelemetryAt > STALE_TELEMETRY_MS;
  }, [connected, lastTelemetryAt, tick]);

  const telemetryAgeSec = useMemo(() => {
    if (lastTelemetryAt == null) return null;
    return Math.max(0, Math.floor((Date.now() - lastTelemetryAt) / 1000));
  }, [lastTelemetryAt, tick]);

  const connectionStatus = useMemo(
    () => deriveConnectionStatus(connected, hasEverConnected, isReconnecting, isStale),
    [connected, hasEverConnected, isReconnecting, isStale]
  );

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const socket = createSocketIo(WS_URL);

    (async () => {
      await waitForBackendHealth({ signal: ac.signal });
      if (cancelled) return;
      socket.connect();
    })();

    socket.on('connect', () => {
      setConnected(true);
      setHasEverConnected(true);
      setIsReconnecting(false);
      void bootstrapFromRest();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.io.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    const handleUpdate = throttle((payload) => {
      setInitialLoading(false);
      const fromPayload = payload?.alerts;
      const mergedAlerts = Array.isArray(fromPayload)
        ? fromPayload
        : pendingAlertsRef.current ?? [];
      pendingAlertsRef.current = null;
      setLastPayload({
        ...payload,
        alerts: mergedAlerts,
      });
      const snap = payload?.snapshot;
      const health = payload?.health;
      if (!snap || !health) return;
      const model = buildCockpitModel(locomotiveType, snap, health, mergedAlerts);
      if (model?.metrics) {
        setHistory((prev) => [...prev, model.metrics].slice(-120));
      }
    }, 200);

    socket.on('telemetry:update', (payload) => {
      setLastTelemetryAt(Date.now());
      handleUpdate(payload);
    });

    const onThroughput = (t) => setThroughput(t);
    if (trackThroughput) {
      socket.on('telemetry:throughput', onThroughput);
    }

    socket.on('alerts:update', (p) => {
      const expectedId = DEFAULT_LOCOMOTIVE_ID[locomotiveType] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;
      if (!p?.locomotiveId || p.locomotiveType !== locomotiveType || p.locomotiveId !== expectedId) {
        return;
      }
      const next = Array.isArray(p.alerts) ? p.alerts : [];
      setLastPayload((prev) => {
        if (!prev?.snapshot) {
          pendingAlertsRef.current = next;
          return prev;
        }
        if (prev.snapshot.locomotiveId !== p.locomotiveId) return prev;
        return { ...prev, alerts: next };
      });
    });
    return () => {
      cancelled = true;
      ac.abort();
      if (trackThroughput) {
        socket.off('telemetry:throughput', onThroughput);
      }
      socket.removeAllListeners();
      socket.io.off('reconnect_attempt');
      socket.close();
    };
  }, [locomotiveType, bootstrapFromRest, trackThroughput]);

  const data = lastPayload
    ? buildCockpitModel(
        locomotiveType,
        lastPayload.snapshot,
        lastPayload.health,
        lastPayload.alerts ?? []
      )
    : null;

  const streamType = lastPayload?.snapshot?.locomotiveType;
  const profileMismatch = Boolean(lastPayload && streamType && streamType !== locomotiveType);

  return {
    data,
    history,
    connected,
    connectionStatus,
    isStale,
    lastTelemetryAt,
    telemetryAgeSec,
    profileMismatch,
    streamType,
    initialLoading,
    throughput,
  };
}
