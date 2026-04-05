#!/usr/bin/env node
/**
 * HK-035 — optional smoke: start backend briefly, GET /health, /openapi.json, /docs, exit 0/1.
 * Usage (from repo root): node scripts/ci-smoke-api.js
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT) || 5000;
const ROOT = path.resolve(__dirname, '..');
const SERVER_JS = path.join(ROOT, 'apps', 'backend', 'src', 'server.js');

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `http://127.0.0.1:${PORT}${urlPath}`,
      { timeout: 5000 },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function waitForReady(maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const code = await get('/health');
      if (code === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server did not become ready in time');
}

async function main() {
  const child = spawn(process.execPath, [SERVER_JS], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });

  child.on('error', (err) => {
    console.error('ci-smoke-api: failed to spawn server', err);
    process.exit(1);
  });

  const kill = () => {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('SIGINT', kill);
  process.on('SIGTERM', kill);

  try {
    await waitForReady();
    const h = await get('/health');
    if (h !== 200) throw new Error(`/health expected 200, got ${h}`);
    const o = await get('/openapi.json');
    if (o !== 200) throw new Error(`/openapi.json expected 200, got ${o}`);
    /** Swagger UI may 301 /docs → /docs/ */
    const d = await get('/docs/');
    if (d !== 200) throw new Error(`/docs/ expected 200, got ${d}`);
    console.log('ci-smoke-api: OK (/health, /openapi.json, /docs)');
  } finally {
    kill();
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((e) => {
  console.error('ci-smoke-api:', e.message || e);
  process.exit(1);
});
