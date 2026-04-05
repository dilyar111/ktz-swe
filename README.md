# KTZ Locomotive Digital Twin

> Real-time locomotive health monitoring: telemetry stream → health index → explainable alerts → replayable history → OpenAPI contracts.

**Stack:** Node.js 20 LTS (see `.nvmrc`) · Express · Socket.IO · React + Vite · Docker Compose  
**Monorepo:** npm workspaces (`apps/backend`, `apps/frontend`, `apps/simulator`, `ml`)

---

## Quick start (local dev)

**Requirements:** Node.js **18+** (CI uses **20** — see `.nvmrc`), npm **9+**

```bash
git clone <repo-url> ktz-swe && cd ktz-swe
npm install
```

Optional env (defaults work without it):

```bash
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows
```

**Recommended demo commands**

| Goal | Command |
|------|---------|
| Full stack + ML risk API (needs Python + `pip install -r ml/requirements.txt`) | `npm run dev` |
| Full stack **without** Python / ML | `npm run dev:no-ml` |
| API + UI only (no simulator) | `npm run dev:stack` |

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Landing → login (demo: `operator` / `demo` or `admin` / `demo`) → app |
| http://localhost:5173/cockpit | Cockpit (requires login) |
| http://localhost:5000/health | API liveness JSON `{ "status": "ok", ... }` |
| http://localhost:5000/openapi.json | OpenAPI 3 JSON |
| http://localhost:5000/docs/ | Swagger UI (trailing slash) |

After startup the simulator sends telemetry at ~1 Hz (default profile **KZ8A** via `LOCOMOTIVE_TYPE` in `.env`). Align the **cockpit profile** in the header with the simulator (`KZ8A` / `TE33A`).

**HK-034:** UI defaults to Russian. English: `localStorage.setItem('ktz_locale','en')` then reload. **`VITE_DEMO_CONTROLS=true`** in root `.env` shows the scenario selector to non-admin users.

---

## Verify install (CI parity)

From repo root:

```bash
npm test              # backend unit tests
npm run build         # Vite production bundle
node scripts/ci-smoke-api.js   # optional: needs free port (default 5000); use PORT=5059 node scripts/ci-smoke-api.js if 5000 is busy
```

---

## Docker (single compose)

Canonical stack — **no ML container** (ML is optional on the host).

```bash
docker compose up --build
```

| Service | Description |
|---------|-------------|
| `backend` | API + Socket.IO — http://localhost:5000 |
| `frontend` | nginx + static `dist` — http://localhost:5173 |
| `simulator` | Telemetry POSTs to `http://backend:5000` |

Use the same `.env.example` variables; compose injects `BACKEND_URL` for the simulator.

> Hot reload: prefer `npm run dev` or `npm run dev:no-ml` over Compose during development.

---

## Scripts (root)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Backend + frontend + simulator + ML uvicorn (`:8001`) |
| `npm run dev:no-ml` | Backend + frontend + simulator (no Python) |
| `npm run dev:stack` | Backend + frontend only |
| `npm run build` | Production frontend → `apps/frontend/dist/` |
| `npm test` | Backend unit tests (`health` + `alerts`) |
| `npm run ci` | `npm test` then `npm run build` |
| `npm run smoke:api` | HTTP smoke: `/health`, `/openapi.json`, `/docs/` |
| `npm run ml:train` | Train `ml/risk_model.joblib` from CSV |
| `npm run ml:serve` | ML API only on port 8001 |

---

## CI (GitHub Actions)

On push/PR to `main` or `master`: `npm ci` → `npm test` → `npm run build` → `node scripts/ci-smoke-api.js` (port **5059**).

---

## Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/openapi.json` | OpenAPI document |
| GET | `/docs/` | Swagger UI |
| GET | `/api/current` | Latest snapshot + health (404 if no telemetry for query) |
| GET | `/api/history` | Paginated history (`limit`, `from`, `to`, `order`) |
| GET | `/api/report` | Incident report — JSON or CSV (`format=json\|csv`) |
| GET | `/api/scenario` | Current demo scenario + `valid[]` list |
| POST | `/api/telemetry` | Ingest telemetry |
| POST | `/api/scenario` | Switch simulator scenario |
| PATCH | `/api/settings` | Admin tunables (weights/thresholds) |

`/api/history` default order: **newest → oldest** (`order=desc`). Use `order=asc` for replay/charts.

---

## Repo structure

```
.
├── apps/
│   ├── backend/       Express API, Socket.IO, health engine, alerts
│   ├── frontend/      React + Vite + Tailwind
│   └── simulator/     Telemetry generator
├── ml/                HK-021 ML risk (FastAPI): train_risk_model.py, serve.py, artifacts
├── scripts/           ci-smoke-api.js (HTTP smoke)
├── artifacts/datasets/  Synthetic CSV (HK-020)
├── docs/              demo-script.md
├── .env.example       Canonical env reference
├── docker-compose.yml
└── package.json
```

---

## Locomotive profiles (HK-033)

| Profile | Switch |
|---------|--------|
| **KZ8A** (default) | `LOCOMOTIVE_TYPE=KZ8A` in `.env` |
| **TE33A** | `LOCOMOTIVE_TYPE=TE33A` then restart |

**Single source of truth:** `apps/backend/src/profiles/index.js` defines catalog fields, display thresholds, and default **healthWeights** (five subsystems: `traction`, `brakes`, `thermal`, `electrical`, `signaling`). Runtime tunables (`/api/settings`) are initialized from those defaults via `profileDefaults.js`. Alert rules and thermal/brake **health** subsystems read the same numeric thresholds from `settingsStore` as `evaluateAlerts`.

**TE33A semantics:** subsystem key `thermal` represents the diesel power unit (oil / coolant / engine temps). Normalized telemetry uses **max(oil, coolant, engine)** °C for rule evaluation. **KZ8A** uses line voltage (V) for electrical; **TE33A** uses auxiliary/battery voltage bands in the electrical subsystem.

**Scenarios:** simulator and API accept the same set (including `warning_overheat`); see `GET /api/scenario` → `valid`.

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
| Monorepo + `npm run dev` / `dev:no-ml` | ✅ ready |
| `npm test`, `npm run build`, CI smoke | ✅ ready |
| Backend ingest, `/health`, `/api/history` | ✅ ready |
| WebSocket `telemetry:update` | ✅ ready |
| Simulator 1 Hz, `LOCOMOTIVE_TYPE` | ✅ ready |
| Cockpit, replay, report | ✅ ready |
| Docker Compose (backend + frontend + simulator) | ✅ ready |
| OpenAPI + Swagger (`/openapi.json`, `/docs/`) | ✅ ready |
| Optional ML (`ml/`, `GET /api/ml/risk`) | ✅ ready (host Python) |
| PostgreSQL persistence | 🔜 not in hackathon scope |
