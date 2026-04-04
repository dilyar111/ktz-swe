import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

const API_BASE = import.meta.env.VITE_API_URL || WS_URL;

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

function snapshotReceivedAtMs(snapshot) {
  const raw = snapshot?.receivedAt ?? snapshot?.timestamp;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

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
    mlRisk: health.mlRisk && typeof health.mlRisk === 'object' ? health.mlRisk : null,
    raw: { snapshot, health },
  };
}

export function useCockpitData(locomotiveType) {
  const [lastPayload, setLastPayload] = useState(null);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [throughput, setThroughput] = useState({ rate: 0, avgLatency: 0 });
  /** Алерты из alerts:update, пришедшие до первого snapshot (редкий порядок событий). */
  const pendingAlertsRef = useRef(/** @type {unknown[] | null} */ (null));

  // Сброс при смене профиля
  useEffect(() => {
    setHistory([]);
    setLastPayload(null);
    setInitialLoading(true);
    pendingAlertsRef.current = null;
  }, [locomotiveType]);

  // Стартовый снимок + алерты с backend REST (тот же состав, что в WebSocket)
  useEffect(() => {
    let cancelled = false;
    const locomotiveId = DEFAULT_LOCOMOTIVE_ID[locomotiveType] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;
    const params = new URLSearchParams({ locomotiveType, locomotiveId });

    async function fetchCurrent() {
      try {

        const res = await fetch(`${API_BASE}/api/current?${params.toString()}`);
        if (!res.ok) return; // 404 — нет данных, просто ждём сокет

        const json = await res.json();
        if (!cancelled && json.snapshot && json.health) {
          const alerts = Array.isArray(json.alerts)
            ? json.alerts
            : pendingAlertsRef.current ?? [];
          pendingAlertsRef.current = null;
          setLastPayload({
            snapshot: json.snapshot,
            health: json.health,
            alerts,
          });
          const model = buildCockpitModel(locomotiveType, json.snapshot, json.health, alerts);
          if (model?.metrics) {
            setHistory([model.metrics]);
          }
        }
      } catch {
        /* сокет подхватит */
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    void fetchCurrent();
    return () => {
      cancelled = true;
    };
  }, [locomotiveType]);

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'], autoConnect: true });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

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

    socket.on('telemetry:update', handleUpdate);

    socket.on('telemetry:throughput', (t) => {
      setThroughput(t);
    });

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
      socket.removeAllListeners();
      socket.close();
    };
  }, [locomotiveType]);

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
    profileMismatch,
    streamType,
    initialLoading,
    throughput,
  };
}