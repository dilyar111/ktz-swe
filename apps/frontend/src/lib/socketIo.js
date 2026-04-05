import { io } from 'socket.io-client';

export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

/** Base URL for REST (health check). Matches RiskScoreWidget / useCockpitData fallbacks. */
export const API_BASE =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';

/**
 * Wait until backend GET /health returns { status: "ok" } so Socket.IO does not race a cold server.
 * @param {{ signal?: AbortSignal, timeoutMs?: number, intervalMs?: number, apiBase?: string }} [options]
 * @returns {Promise<boolean>} true if health ok, false if timed out or aborted
 */
export async function waitForBackendHealth(options = {}) {
  const { signal, timeoutMs = 120_000, intervalMs = 350, apiBase = API_BASE } = options;
  const base = String(apiBase || '').replace(/\/$/, '') || 'http://localhost:5000';
  const healthUrl = `${base}/health`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) return false;
    try {
      const r = await fetch(healthUrl, { cache: 'no-store', signal });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j?.status === 'ok') return true;
      }
    } catch {
      /* server not listening yet */
    }
    await sleep(intervalMs, signal);
    if (signal?.aborted) return false;
  }
  return false;
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}

/**
 * Socket.IO client tuned for local dev: polling first (avoids "WebSocket closed before established"
 * when the upgrade races a slow backend), then upgrade. Connect after {@link waitForBackendHealth}.
 */
export function createSocketIo(url = WS_URL, extra = {}) {
  return io(url, {
    transports: ['polling', 'websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    timeout: 20000,
    ...extra,
  });
}
