# Demo script & pitch checklist (HK-023)

**Time box:** 3–5 minutes (defense / jury).  
**Goal:** Same flow every rehearsal — no improvisation drift.

---

## One-liner

KTZ gets a **live digital twin**: locomotive telemetry → health index → explainable alerts → replayable history → API contracts (OpenAPI) — so operations can **see risk early**, **act on evidence**, and **integrate** without vendor lock-in on day one.

---

## Before you go live (30 seconds)

| Step | Action |
|------|--------|
| 1 | Terminal at **repo root** (folder with root `package.json`). |
| 2 | Dependencies installed once: `npm install`. |
| 3 | Optional: `copy .env.example .env` (Windows) or `cp .env.example .env` (Unix) — defaults already match `5000` / `5173`. |

---

## Startup command

From repository root:

```bash
npm run dev
```

This starts **concurrently**: backend (`:5000`), Vite frontend (`:5173`), and the default simulator (~1 message/s).

**URLs (bookmark these):**

| What | URL |
|------|-----|
| Cockpit (main UI) | http://localhost:5173 |
| Health check | http://localhost:5000/health |
| Swagger UI (OpenAPI) | http://localhost:5000/docs |
| Machine-readable OpenAPI | http://localhost:5000/openapi.json |

---

## Health check (prove the API is alive)

**Browser:** open http://localhost:5000/health — expect JSON with `"status":"ok"`.

**CLI (optional):**

```bash
curl http://localhost:5000/health
```

**PowerShell:**

```powershell
Invoke-RestMethod http://localhost:5000/health
```

Mention: backend logs may show a **“System ready”** line when frontend + at least one telemetry point are available.

---

## Minute 1 — Cockpit, normal flow

1. Open **http://localhost:5173** → land on **Cockpit** (`/`).
2. Confirm profile **KZ8A** (header) matches the simulator default stream.
3. Point out **in one breath**:
   - **Connection badge** (online / live telemetry).
   - **Health Index** ring + **metric strip** (speed, temps, traction, etc.).
   - **Route context** (where / limit / restrictions) if visible in your build.
4. Keep **Scenario** = **Норма** (`normal`) for the “steady state” story.

---

## Minute 2 — Critical scenario → alert + recommendation

1. In the header, open the **Сценарий** dropdown → choose **Критическая: Перегрев** (`critical`).
2. Wait **2–3 seconds** for the simulator to apply the scenario (POST `/api/scenario`).
3. On Cockpit, call out:
   - **Alerts** panel: severity + code + subsystem.
   - **Recommendations** strip (if present): operator-facing next step.
4. One sentence tie-in: *“We don’t only show a number — we show **why** it dropped and **what to do**.”*

---

## Minute 2:30 — Replay: jump to incident

1. Navigate **Replay & History** → route **`/history`** (Replay page).
2. Ensure window is **5–15 min**; click **Обновить** if the chart is empty.
3. Click **«К началу инцидента»** — scrubs the timeline to the first point where Health Index falls below the warning-style threshold (or the minimum HI in the window).
4. Drag the **range slider** to show the jury “before / during / after” on the charts.

Script line: *“Same data the cockpit uses — **time-ordered**, **queryable**, **replayable** for debriefs and audits.”*

---

## Minute 3 — Highload + “×10” throughput (choose one path)

### Path A — Simple (fits default `npm run dev`)

1. Set scenario **Высокая нагрузка** (`highload`) in the header.
2. On Cockpit, point to the **throughput** badge (messages/s + processing latency) if your UI shows it — narrative: *pipeline stays observable under stress.*

### Path B — **Highload ×10 burst** (optional rehearsal)

**Requires:** backend + frontend running **without** the default bundled simulator (otherwise two writers conflict).

1. Stop only the simulator process, or use from root:

   ```bash
   npm run dev:stack
   ```

   (backend + frontend only — see root `package.json`.)

2. In another terminal, from repo root:

   ```bash
   npm run highload -w @ktz/simulator
   ```

   This uses `apps/simulator/src/highload.js`: **~10 messages/s** (`SIM_INTERVAL_MS=100`) and loads the main simulator entry.

3. On Cockpit, show **throughput ~10 msg/s** and stable UI (badges, no white screen).

**Fallback if Path B breaks:** stay on Path A — the jury cares about the *story*, not the Hz count.

---

## Minute 4 — OpenAPI / Swagger

1. Open **http://localhost:5000/docs**.
2. Show **one** endpoint live: e.g. `GET /health` or `GET /api/current` **Try it out** → **Execute**.
3. Say: *“Partners and internal systems integrate against **the same contract** the UI uses — not a PDF.”*

---

## Minute 5 — Close with business value (KTZ)

Use **your** numbers where you have them; otherwise keep it qualitative:

- **Safety & reliability:** earlier visibility on thermal/brake/signal stress → fewer **surprises** in operation.
- **Cost of downtime:** faster **triage** (alerts + recommendations) and **replay** reduce mean time to understand.
- **Sovereignty & integration:** **REST + OpenAPI** + WebSocket stream — KTZ can host, extend, and connect **SCADA / maintenance / analytics** without betting everything on a black box.

End with: *“This is a **demo stack** — the architecture is the product we’re selling.”*

---

## Presenter checklist (print-friendly)

- [ ] Repo root, `npm install` already done.
- [ ] `npm run dev` — wait until Cockpit shows live data (or health OK + first telemetry).
- [ ] `/health` returns OK (say it or show tab).
- [ ] Cockpit: normal → **critical** → alert + recommendation called out by name.
- [ ] Replay `/history`: **К началу инцидента** + slider scrub.
- [ ] **Highload**: Path A *or* Path B rehearsed once without surprises.
- [ ] `/docs`: one **Execute** in Swagger.
- [ ] Close: **KTZ business value** in ≤3 sentences.
- [ ] Stopwatch: **≤ 5 minutes** end-to-end.

---

## Optional: speaker roles & handoffs

| Segment | Suggested owner | Handoff cue |
|---------|-----------------|-------------|
| Intro + stack + health | **Tech lead** | *“Live UI is next.”* |
| Cockpit normal + scenario + alerts | **Frontend / product** | *“Let’s prove the same data in time.”* |
| Replay incident jump | **Whoever owns observability** | *“And for partners — the contract.”* |
| Swagger + business close | **Tech lead or PM** | *“Questions.”* |

**Rules:** One person drives the mouse; others stay silent unless asked. Agree who answers **“what happens in production?”** (honest: hackathon scope vs roadmap).

---

## If something fails (no panic)

| Symptom | Quick fix |
|---------|-----------|
| Empty Cockpit | Check scenario profile matches simulator (`KZ8A`); wait ~5 s. |
| No WebSocket | Confirm `npm run dev` and URL `http://localhost:5173`; check `VITE_WS_URL` only if customized. |
| Replay empty | Simulator must have run inside the selected time window; click **Обновить**. |
| `/docs` 404 | Backend not running — restart `npm run dev` or backend workspace. |

---

*HK-023 — any teammate can rehearse this flow as written; trim Path B if time is tight.*
