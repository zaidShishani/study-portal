# Study Portal — Architecture

A personal study tool: spaced-review flashcards, LeetCode tracking, nested markdown notes, roadmap checklists, and a calendar with in-app reminders.

## Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 (sync, psycopg 3), Alembic, Pydantic v2 + pydantic-settings, python-dateutil.
- **Frontend:** React 18 + TypeScript (Vite), MUI (+ @mui/x-date-pickers, @mui/x-tree-view, dayjs), react-router-dom, @tanstack/react-query, react-markdown + remark-gfm, FullCalendar.
- **DB:** PostgreSQL 17.
- **Runtime:** docker-compose on localhost (`db`, `backend`, `frontend`). Backend container runs `alembic upgrade head` then `uvicorn --reload`. Vite dev server proxies `/api` → backend.
- **Tests:** pytest (unit + integration via TestClient against real Postgres), Vitest + React Testing Library, Playwright e2e.

## Folder structure
```
backend/
  app/main.py                 # app factory, CORS, router mounting
  app/core/                   # config.py db.py deps.py srs.py time.py
  app/models/                 # SQLAlchemy models, one file per resource
  app/schemas/                # Pydantic schemas, same names
  app/routers/                # FastAPI routers, same names (+ dashboard.py, notifications.py)
  app/services/               # ONLY real logic: rrule.py, dashboard.py, notifications.py
  alembic/versions/           # one migration per ticket that changes the schema
  tests/unit/  tests/integration/  tests/conftest.py
frontend/src/
  main.tsx App.tsx theme.ts
  api/          # client.ts (fetch wrapper) + one file per resource
  hooks/        # react-query hooks per resource
  components/   # shared + feature components
  pages/        # one per route
  types/        # TS types mirroring API schemas
  *.test.tsx    # colocated tests
e2e/            # Playwright specs, run against docker compose
```

### Conventions
- Layering: routers → (services when needed) → models. Plain CRUD lives in the router.
- Enums are defined once in `app/models` and reused in schemas; mirrored once in `frontend/src/types`.
- The review ladder exists only in `app/core/srs.py`.
- New features add new files; avoid editing unrelated existing ones.
- All API routes are under `/api`.
- Dates: `date` for due dates, `timestamptz` for instants. "Today" = `core/time.today_for(user)` using `users.timezone`.

## Users / auth
Auth is deferred. `users` table exists; migration seeds user id=1. `core/deps.get_current_user()` returns user 1. Every user-owned table has `user_id` (or reaches it through its parent). WorkOS AuthKit will later replace only `get_current_user()`.

## Review ladder (cards and problems)
```
INTERVALS = [1, 3, 7, 21]       # days
stage 0 = new, due on the day it is created
review(stage, correct, today):
  wrong            -> stage = 1, due = today + 1       # "reset to day 1"
  right, stage < 4 -> due = today + INTERVALS[stage], stage += 1
  right, stage == 4 -> retired: due_date = NULL, retired_at = now
unretire -> stage = 1, due = today + 1, retired_at = NULL
```
- Overdue items stay due (due_date <= today) until reviewed. Intervals count from the actual review day. No randomness.
- Retired items are hidden from review queues but listable with a "retired" filter.
- Problem attempts are allowed before the due date and advance the ladder (user decision); card reviews 409 when not due.

## Data model
| table | columns |
|---|---|
| users | id, email (nullable), timezone (default 'UTC'), created_at |
| decks | id, user_id, title, created_at, updated_at |
| cards | id, deck_id (cascade), front (md), back (md), stage, due_date, review_count, last_reviewed_at, retired_at, created_at, updated_at; index (deck_id, due_date) |
| problems | id, user_id, title, link, difficulty, pattern, key_insight, notes (md), minutes, last_result, solved_date, review_count, stage, due_date, retired_at, created_at, updated_at |
| note_folders | id, user_id, parent_id (self FK, cascade, nullable), name |
| note_pages | id, user_id, folder_id (nullable, cascade), title, content (md), created_at, updated_at |
| roadmaps | id, user_id, title, description, created_at, updated_at |
| checkpoints | id, roadmap_id (cascade), position, title, description, target_date, done_at |
| events | id, user_id, title, description, start_at (tz), end_at (tz, nullable), all_day, rrule (RFC 5545 text, nullable), remind_minutes_before (nullable), created_at, updated_at |
| notifications | id, user_id, event_id (cascade), occurrence_start (tz), fire_at (tz), read_at; UNIQUE(event_id, occurrence_start) |

### Enums
- difficulty: `Easy`, `Medium`, `Hard`
- last_result: `solved`, `solved_with_hint`, `failed` (`failed` counts as wrong for the ladder)
- pattern: `Two Pointers`, `Sliding Window`, `Binary Search`, `Stack`, `Linked List`, `Tree`, `Trie`, `Heap`, `Graph`, `BFS`, `DFS`, `Backtracking`, `DP`, `Greedy`, `Intervals`, `Union Find`, `Bit Manipulation`, `Math`

## Features
- **Flashcards:** decks contain cards with markdown front/back. Review screen: show front → flip → Right/Wrong.
- **LeetCode:** log an attempt (`result`, `minutes`) → updates last_result, review_count, then runs the ladder.
- **Notes:** folders nest to any depth; pages may live in any folder or at root. Markdown editor with Edit/Preview tabs. Moving a folder must reject cycles.
- **Roadmaps:** ordered checkpoints (`position`), toggle done, progress % = done / total.
- **Calendar:** events with optional RRULE and optional reminder. `GET /api/calendar?from&to` returns expanded event occurrences plus derived items (due-card count per day, problem due dates, checkpoint target dates).
- **Notifications (in-app only):** `GET /api/notifications` first inserts any due rows (fire_at = occurrence_start − remind_minutes_before, fire_at <= now) with `ON CONFLICT DO NOTHING`, then returns unread. Frontend polls every 60 s; bell badge. `POST /api/notifications/{id}/read`. No background worker.
- **Dashboard (home):** due cards per deck, due problems, today's event occurrences, roadmap progress.

## Security baseline (every ticket)
- **Ownership:** every query filtered by `current_user.id`; another user's row → 404. Integration tests seed a second user and assert this.
- **Validation at the boundary:** Pydantic max lengths, enums, `HttpUrl` (http/https) for links, bounded ints.
- Request bodies extend `schemas/common.InputModel` (extra=forbid); user strings reject NUL; path ids use `schemas/common.Id`.
- **RRULE:** validated on save; expansion always bounded by the request window (max 1 year) and capped (~1000 occurrences).
- **SQL:** SQLAlchemy expressions / bound params only. No f-string SQL.
- **XSS:** react-markdown without `rehype-raw`; no `dangerouslySetInnerHTML`; external links `rel="noopener noreferrer"`.
- **Secrets:** `.env` only (gitignored); `.env.example` has placeholders. Never log secrets.
- **Network:** CORS allows only the frontend origin; Postgres bound to 127.0.0.1; containers run as non-root.
- **Dependencies:** pinned versions; CI runs `pip-audit` and `npm audit --audit-level=high`.

## Out of scope (for now)
WorkOS auth, email/push notifications, editing single occurrences of a recurring event, image uploads, per-attempt history, production deployment.
