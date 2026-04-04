# KTZ Locomotive Digital Twin

Монорепозиторий для хакатона KTZ: **поток телеметрии → ingest → история → WebSocket → cockpit**.  
Название репозитория: `ktz-digital-twin` (соответствие формулировке «цифровой двойник»). Папка на диске может называться `ktz-locomotive-twin` — это нормально; на GitHub лучше `ktz-digital-twin`.

## Честно о текущем состоянии

| Слой | Статус |
|------|--------|
| Monorepo + `npm run dev` | готово |
| Backend ingest, `/health`, `/api/history`, ring buffer | готово |
| WebSocket `telemetry:update` `{ snapshot, health }` | готово |
| Симулятор 1 Гц, `LOCOMOTIVE_TYPE` | готово |
| Cockpit UI (Tailwind, профили KZ8A/TE33A) | готово, данные только если тип потока = выбранный профиль |
| Алерты, replay UI, export, OpenAPI, PostgreSQL | **не заявлены как работающие** — следующие задачи |

## Структура

- `apps/frontend` — React + Vite + Tailwind, маршруты Cockpit / заглушки
- `apps/backend` — Express + Socket.IO
- `apps/simulator` — POST телеметрии в API
- `infra/docker-compose.yml` и корневой `docker-compose.yml` — образ API

## Запуск

```bash
cd ktz-locomotive-twin   # или ваша папка клона
npm install
copy .env.example .env    # Windows; на macOS/Linux: cp
npm run dev
```

Откройте http://localhost:5173 · API http://localhost:5000/health  

Для профиля **TE33A** в `.env` задайте `LOCOMOTIVE_TYPE=TE33A` (или второй терминал с переменной окружения) и перезапустите симулятор.

## Docker

```bash
docker compose up --build
```

Фронт для разработки удобнее с хоста (`npm run dev`).

## Git

- Ветки: `feature/HK-XXX-kratko`, `fix/...`
- Коммиты: `feat(HK-XXX): ...`
- Шаблоны Issues: `.github/ISSUE_TEMPLATE/`

## Мерж двух версий проекта

Эта кодовая база объединяет **инженерный каркас** (workspaces, ingest, history, сокет) и **продуктовый UI** из ветки digital-twin (Layout, Cockpit, промышленная тема). Старый вложенный архив `ktz-digital-twin/ktz-digital-twin` можно не копировать в git — держите его только как референс.
