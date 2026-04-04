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

После старта симулятор ждёт готовности `/health`, затем шлёт телеметрию ~1 Гц; фронт подключается по Socket.IO к `http://localhost:5000` и обновляет Cockpit в реальном времени (профиль в UI по умолчанию **KZ8A**, как у симулятора).

### Очистка сгенерированных файлов

Папки вроде `node_modules/`, `apps/frontend/dist/` не коммитятся (см. `.gitignore`). Удалить их можно вручную или, например:

```bash
# из корня репозитория
rm -rf node_modules apps/*/node_modules apps/frontend/dist
```

На Windows аналог — удалить эти каталоги в проводнике или через `Remove-Item -Recurse`.

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

## Честно о текущем состоянии

| Слой | Статус |
|------|--------|
| Monorepo + `npm run dev` | готово |
| Backend ingest, `/health`, `/api/history`, ring buffer | готово |
| WebSocket `telemetry:update` `{ snapshot, health }` | готово |
| Симулятор 1 Гц, `LOCOMOTIVE_TYPE`, ожидание API при старте | готово |
| Cockpit UI (Tailwind, профили KZ8A/TE33A) | готово, данные только если тип потока = выбранный профиль |
| Алерты, replay UI, export, OpenAPI, PostgreSQL | **не заявлены как работающие** — следующие задачи |

## Структура

- `apps/frontend` — React + Vite + Tailwind, маршруты Cockpit / заглушки
- `apps/backend` — Express + Socket.IO
- `apps/simulator` — POST телеметрии в API
- `infra/docker-compose.yml` и корневой `docker-compose.yml` — образ API

## Сборка production-фронта

```bash
npm run build
```

Собирается workspace `@ktz/frontend` (артефакты в `apps/frontend/dist/`).

## Docker

```bash
docker compose up --build
```

Фронт для разработки удобнее с хоста (`npm run dev`).

## Профиль TE33A

Для потока **TE33A** в корневом `.env` задайте `LOCOMOTIVE_TYPE=TE33A` и перезапустите `npm run dev` (или только процесс симулятора). В UI переключите профиль на TE33A.

## Git

- Ветки: `feature/HK-XXX-kratko`, `fix/...`
- Коммиты: `feat(HK-XXX): ...`
- Шаблоны Issues: `.github/ISSUE_TEMPLATE/`

## Мерж двух версий проекта

Эта кодовая база объединяет **инженерный каркас** (workspaces, ingest, history, сокет) и **продуктовый UI** из ветки digital-twin (Layout, Cockpit, промышленная тема). Старый вложенный архив `ktz-digital-twin/ktz-digital-twin` можно не копировать в git — держите его только как референс.
