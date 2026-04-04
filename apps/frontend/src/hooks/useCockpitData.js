import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

/**
 * Приводит сырой snapshot бэкенда к полям карточек cockpit.
 * @param {Record<string, unknown>} snap
 * @param {'KZ8A' | 'TE33A'} locomotiveType
 */
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

function buildCockpitModel(locomotiveType, snapshot, health) {
  if (!snapshot || snapshot.locomotiveType !== locomotiveType) return null;
  return {
    locomotive_id: snapshot.locomotiveId ?? '—',
    locomotiveType: snapshot.locomotiveType,
    health: health.score,
    healthClass: health.class,
    healthStatus: health.status,
    contributors: health.contributors ?? [],
    metrics: normalizeMetrics(snapshot, locomotiveType),
    alerts: [],
    raw: { snapshot, health },
  };
}

export function useCockpitData(locomotiveType) {
  const [lastPayload, setLastPayload] = useState(null);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setHistory([]);
  }, [locomotiveType]);

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'], autoConnect: true });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('telemetry:update', (payload) => {
      setLastPayload(payload);
      const snap = payload?.snapshot;
      const health = payload?.health;
      if (!snap || !health) return;
      const model = buildCockpitModel(locomotiveType, snap, health);
      if (model?.metrics) {
        setHistory((prev) => [...prev, model.metrics].slice(-120));
      }
    });
    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [locomotiveType]);

  const data = lastPayload
    ? buildCockpitModel(locomotiveType, lastPayload.snapshot, lastPayload.health)
    : null;

  const streamType = lastPayload?.snapshot?.locomotiveType;
  const profileMismatch = Boolean(lastPayload && streamType && streamType !== locomotiveType);

  return {
    data,
    history,
    connected,
    profileMismatch,
    streamType,
  };
}
