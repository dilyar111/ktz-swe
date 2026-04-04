# KTZ Locomotive Digital Twin

Монорепозиторий для хакатона KTZ: **поток телеметрии → ingest → история → WebSocket → cockpit**.  
Название пакета: `ktz-digital-twin`. После `git clone` папка может называться как угодно — работайте из **корня клона** (там лежат `package.json` и `apps/`).

## Quick start (clean machine)

Требования: **Node.js 18+** и npm.

1. **Клонировать репозиторий** и перейти в корень:

   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Установить зависимости** (один раз):

   ```bash
   npm install
   ```

3. **(Опционально)** скопировать переменные окружения. Без `.env` локальная схема портов уже совпадает с дефолтами (`5000` / `5173`, профиль симулятора `KZ8A`).

   ```bash
   # Windows
   copy .env.example .env

   # macOS / Linux
   cp .env.example .env
   ```

   Vite читает `VITE_*` из **корневого** `.env` (см. `apps/frontend/vite.config.js`).

4. **Запустить всё одной командой** (API + Vite + симулятор):

   ```bash
   npm run dev
   ```

5. **Открыть приложение**

   - Cockpit UI: [http://localhost:5173](http://localhost:5173)
   - Health API: [http://localhost:5000/health](http://localhost:5000/health)
   - OpenAPI (Swagger): [http://localhost:5000/docs](http://localhost:5000/docs)

После старта симулятор ждёт готовности `/health`, затем шлёт телеметрию ~1 Гц; фронт подключается по Socket.IO к `http://localhost:5000` и обновляет Cockpit в реальном времени (профиль в UI по умолчанию **KZ8A**, как у симулятора).

### Очистка сгенерированных файлов

Папки вроде `node_modules/`, `apps/frontend/dist/` не коммитятся (см. `.gitignore`). Удалить их можно вручную или, например:

```bash
# из корня репозитория
rm -rf node_modules apps/*/node_modules apps/frontend/dist
```

На Windows аналог — удалить эти каталоги в проводнике или через `Remove-Item -Recurse`.

## Тесты правил (HK-022)

Юнит-тесты на **движок здоровья (HK-004)** и **оценку алертов** (`node:test`, без отдельного раннера):

```bash
npm test
```

Или только backend:

```bash
npm run test -w @ktz/backend
```

## Debug

Проверить, что API поднялся:

```bash
curl http://localhost:5000/health
```

Пример ответа: `{"status":"ok","service":"ktz-api",...}`.

Windows (PowerShell):

```powershell
Invoke-RestMethod http://localhost:5000/health
```

После запуска `npm run dev` в логах бэкенда появится блок **System ready** (✅ backend / frontend / simulator), когда Vite отвечает и в истории есть хотя бы одна точка телеметрии.

### OpenAPI / Swagger (HK-017)

После старта backend откройте **[http://localhost:5000/docs](http://localhost:5000/docs)** — Swagger UI с описанием REST API, примерами запросов/ответов и двумя примерами телеметрии (**KZ8A** / **TE33A**). Машиночитаемая спецификация: [http://localhost:5000/openapi.json](http://localhost:5000/openapi.json).

## Экспорт отчёта по инциденту (HK-013)

Эндпоинт **`GET /api/report`** строит отчёт за окно `[from, to]` (эпоха в миллисекундах) для пары **locomotiveType** + **locomotiveId**: сводка по индексу здоровья (HK-004), алерты в интервале, маркеры, топ вкладов с последнего снимка, рекомендации. Параметр **`format=json`** (по умолчанию) или **`format=csv`** — табличный файл с UTF-8 BOM для Excel / LibreOffice.

Пример (подставьте актуальные `from` / `to`, например «сейчас − 15 мин» → «сейчас»):

```bash
curl -sS 'http://localhost:5000/api/report?locomotiveType=KZ8A&locomotiveId=KZ8A-DEMO-01&from=1710000000000&to=1710000900000&format=json' | head -c 400
```

В UI: маршрут **Reports** (`/report`) — превью сводки и кнопки экспорта JSON/CSV без смены `.env`.

## Честно о текущем состоянии

| Слой | Статус |
|------|--------|
| Monorepo + `npm run dev` | готово |
| Backend ingest, `/health`, `/api/history`, ring buffer | готово |

**`/api/history` (HK-028):** default response order is **newest → oldest** (`order=desc`). Query `limit=N` returns the **N most recent** points in that window (after `from` / `to` / filters). Use **`order=asc`** to get the same N points **oldest → newest** (replay / charts).
| WebSocket `telemetry:update` `{ snapshot, health }` | готово |
| Симулятор 1 Гц, `LOCOMOTIVE_TYPE`, ожидание API при старте | готово |
| Cockpit UI (Tailwind, профили KZ8A/TE33A) | готово, данные только если тип потока = выбранный профиль |
| Replay UI, отчёт HK-013 (`/api/report`, `/report`) | готово |
| OpenAPI 3 + Swagger UI (`/docs`, `/openapi.json`, HK-017) | готово |
| Правила health + alerts (`npm test`, HK-022) | готово |
| Алерты (центр), OpenAPI, PostgreSQL | **не заявлены как работающие** — следующие задачи |

## Структура

- `apps/frontend` — React + Vite + Tailwind, маршруты Cockpit / заглушки
- `apps/backend` — Express + Socket.IO
- `apps/simulator` — POST телеметрии в API
- `docker-compose.yml` (корень) — единственный стек Docker: backend + frontend (preview/nginx) + simulator

## Сборка production-фронта

```bash
npm run build
```

Собирается workspace `@ktz/frontend` (артефакты в `apps/frontend/dist/`).

## Docker (HK-018)

Один канонический путь из **корня репозитория**:

```bash
docker compose up --build
```

Поднимает три сервиса:

| Сервис | Описание |
|--------|----------|
| `backend` | API + Socket.IO на [http://localhost:5000](http://localhost:5000) (`/health`, `/docs`, …) |
| `frontend` | Собранный Vite + **nginx** на [http://localhost:5173](http://localhost:5173) (preview, не hot-reload) |
| `simulator` | POST телеметрии ~1 Гц на API (`BACKEND_URL=http://backend:5000` внутри сети compose) |

Переменные (как в `.env.example`): **`CLIENT_URL`** — origin UI для CORS (по умолчанию `http://localhost:5173`); **`BACKEND_URL`** / **`SIM_INTERVAL_MS`** / **`LOCOMOTIVE_TYPE`** — симулятор; **`VITE_API_URL`** / **`VITE_WS_URL`** — подставляются в **сборку** фронта (для браузера на хосте остаётся `http://localhost:5000`).

Для разработки с hot-reload по-прежнему удобнее **`npm run dev`** на хосте.

## Профиль TE33A

Для потока **TE33A** в корневом `.env` задайте `LOCOMOTIVE_TYPE=TE33A` и перезапустите `npm run dev` (или только процесс симулятора). В UI переключите профиль на TE33A.

## Git

- Ветки: `feature/HK-XXX-kratko`, `fix/...`
- Коммиты: `feat(HK-XXX): ...`
- Шаблоны Issues: `.github/ISSUE_TEMPLATE/`

## Мерж двух версий проекта

Эта кодовая база объединяет **инженерный каркас** (workspaces, ingest, history, сокет) и **продуктовый UI** из ветки digital-twin (Layout, Cockpit, промышленная тема). Старый вложенный архив `ktz-digital-twin/ktz-digital-twin` можно не копировать в git — держите его только как референс.
