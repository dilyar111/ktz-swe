# KTZ Locomotive Digital Twin

> Real-time locomotive health monitoring: telemetry stream → health index → explainable alerts → replayable history → OpenAPI contracts.

**Stack:** Node.js 18 · Express · Socket.IO · React + Vite · Docker Compose  
**Monorepo:** npm workspaces (`apps/backend`, `apps/frontend`, `apps/simulator`)

---

## Quick start

**Requirements:** Node.js 18+, npm 9+

```bash
# 1. Install dependencies (once)
npm install

# 2. Optional — copy env defaults (ports already match without it)
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows

# 3. Start everything
npm run dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Cockpit UI |
| http://localhost:5000/health | API health check |
| http://localhost:5000/docs | Swagger / OpenAPI UI |
| http://localhost:5000/openapi.json | Machine-readable spec |

After startup the simulator sends telemetry at ~1 Hz; the frontend connects via Socket.IO and updates in real time (default profile: **KZ8A**).

---

## Docker

```bash
docker compose up --build
```

| Service | Description |
|---------|-------------|
| `backend` | API + Socket.IO — http://localhost:5000 |
| `frontend` | nginx-served production build — http://localhost:5173 |
| `simulator` | Telemetry generator (~1 msg/s) |

> For hot-reload development prefer `npm run dev`.

---

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Backend + frontend + simulator concurrently |
| `npm run dev:stack` | Backend + frontend only (no simulator) |
| `npm run build` | Production frontend bundle (`apps/frontend/dist/`) |
| `npm test` | Unit tests — health engine + alert evaluation |

---

## Running tests

```bash
npm test                          # all workspaces
npm run test -w @ktz/backend      # backend only
```

---

## Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/api/current` | Latest telemetry snapshot + health |
| GET | `/api/history` | Paginated history (`limit`, `from`, `to`, `order`) |
| GET | `/api/report` | Incident report — JSON or CSV (`format=json\|csv`) |
| POST | `/api/telemetry` | Ingest a telemetry point |
| POST | `/api/scenario` | Switch simulator scenario |
| GET | `/docs` | Swagger UI |

`/api/history` default order: **newest → oldest** (`order=desc`). Use `order=asc` for replay/charts.

---

## Repo structure

```
.
├── apps/
│   ├── backend/       Express API, Socket.IO, health engine, alerts
│   ├── frontend/      React + Vite + Tailwind — Cockpit, Replay, Report
│   └── simulator/     Telemetry generator (1 Hz default, ×10 highload mode)
├── artifacts/
│   └── datasets/      Synthetic CSV dataset (HK-020)
├── docs/
│   └── demo-script.md 5-minute demo + pitch checklist
├── ml/
│   └── hk020/         ML experiment artifacts
├── .env.example       Environment variable reference
├── docker-compose.yml Single-stack Docker definition
└── package.json       Workspace root + npm scripts
```

---

## Locomotive profiles

| Profile | Switch |
|---------|--------|
| **KZ8A** (default) | `LOCOMOTIVE_TYPE=KZ8A` in `.env` |
| **TE33A** | `LOCOMOTIVE_TYPE=TE33A` then restart |

In the UI, switch the profile in the header to match the simulator stream.

---

## Git conventions

- **Branches:** `feature/HK-XXX-short-name` · `fix/HK-XXX-...` · `chore/HK-XXX-...`
- **Commits:** `feat|fix|chore|docs|test|refactor(HK-XXX): description`
- **Issue/PR templates:** `.github/ISSUE_TEMPLATE/` · `.github/pull_request_template.md`

---

## Feature status

| Layer | Status |
|-------|--------|
| Monorepo + `npm run dev` | ✅ ready |
| Backend ingest, `/health`, `/api/history`, ring buffer | ✅ ready |
| WebSocket `telemetry:update` `{ snapshot, health }` | ✅ ready |
| Simulator 1 Hz, `LOCOMOTIVE_TYPE`, API-wait on start | ✅ ready |
| Cockpit UI — live metrics, health ring, recommendations | ✅ ready |
| Scenario control (normal / critical / highload) | ✅ ready |
| Highload ×10 burst mode (`npm run highload -w @ktz/simulator`) | ✅ ready |
| Replay UI + incident jump + range slider | ✅ ready |
| Incident report (`/api/report`, JSON + CSV) | ✅ ready |
| OpenAPI 3 + Swagger UI (`/docs`, `/openapi.json`) | ✅ ready |
| Health engine + alert rule unit tests (`npm test`) | ✅ ready |
| Synthetic dataset export (HK-020) | ✅ ready |
| PostgreSQL persistence | 🔜 not in hackathon scope |
