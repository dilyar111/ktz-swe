import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

const API_BASE = import.meta.env.VITE_API_URL || WS_URL;

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
  return {
    locomotive_id: snapshot.locomotiveId ?? '—',
    locomotiveType: snapshot.locomotiveType,
    health: health.score,
    healthClass: health.class,
    healthStatus: health.status,
    contributors: health.contributors ?? [],
    metrics: normalizeMetrics(snapshot, locomotiveType),
    alerts: list,
    raw: { snapshot, health },
  };
}

export function useCockpitData(locomotiveType) {
  const [lastPayload, setLastPayload] = useState(null);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const socketRef = useRef(null);

  // Сброс при смене профиля
  useEffect(() => {
    setHistory([]);
    setLastPayload(null);
    setInitialLoading(true);
  }, [locomotiveType]);

  // Шаг 1: при монтировании запросить /api/current
  useEffect(() => {
    let cancelled = false;

    async function fetchCurrent() {
      try {
        const res = await fetch(
          `${API_URL}/api/current?locomotiveType=${locomotiveType}`
        );
        if (!res.ok) return; // 404 — нет данных, просто ждём сокет
        const json = await res.json();
        if (!cancelled && json.snapshot && json.health) {
          setLastPayload(json);
          const model = buildCockpitModel(locomotiveType, json.snapshot, json.health);
          if (model?.metrics) {
            setHistory([model.metrics]);
          }
        }
      } catch {
        // API недоступен — ничего, сокет подхватит
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    fetchCurrent();
    return () => { cancelled = true; };
  }, [locomotiveType]);

  // Шаг 2: слушать сокет
  useEffect(() => {
    const locomotiveId = DEFAULT_LOCOMOTIVE_ID[locomotiveType] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;
    const params = new URLSearchParams({ locomotiveType, locomotiveId });
    let cancelled = false;

    fetch(`${API_BASE}/api/current?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.snapshot || !body?.health) return;
        setLastPayload((prev) => {
          const prevMs = prev?.snapshot ? snapshotReceivedAtMs(prev.snapshot) : 0;
          const nextMs = snapshotReceivedAtMs(body.snapshot);
          if (prev && prevMs >= nextMs) return prev;
          return {
            snapshot: body.snapshot,
            health: body.health,
            alerts: body.alerts ?? [],
          };
        });
        setHistory((prev) => {
          if (prev.length > 0) return prev;
          const model = buildCockpitModel(
            locomotiveType,
            body.snapshot,
            body.health,
            body.alerts
          );
          return model?.metrics ? [model.metrics] : [];
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [locomotiveType]);

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'], autoConnect: true });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('telemetry:update', (payload) => {
      setInitialLoading(false);
      setLastPayload(payload);
      const snap = payload?.snapshot;
      const health = payload?.health;
      if (!snap || !health) return;
      const model = buildCockpitModel(locomotiveType, snap, health, payload?.alerts);
      if (model?.metrics) {
        setHistory((prev) => [...prev, model.metrics].slice(-120));
      }
    });

    socket.on('alerts:update', (p) => {
      const expectedId = DEFAULT_LOCOMOTIVE_ID[locomotiveType] ?? DEFAULT_LOCOMOTIVE_ID.KZ8A;
      if (!p?.locomotiveId || p.locomotiveType !== locomotiveType || p.locomotiveId !== expectedId) {
        return;
      }
      setLastPayload((prev) => {
        if (!prev?.snapshot) return prev;
        if (prev.snapshot.locomotiveId !== p.locomotiveId) return prev;
        return { ...prev, alerts: Array.isArray(p.alerts) ? p.alerts : [] };
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
  };
}