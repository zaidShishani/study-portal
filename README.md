# Study Portal

A personal study tool, built like a todo app with reminders. Everything you need to study fits on one screen.

- **Flashcards:** decks of markdown cards on a spaced-review ladder.
- **LeetCode:** track problems and attempts on the same ladder.
- **Notes:** markdown pages in folders nested to any depth.
- **Roadmaps:** ordered checkpoint checklists with progress.
- **Calendar:** events with full RRULE recurrence and in-app reminders.

Runs locally with docker-compose. Login is not built yet; the app uses a seeded user (see [Decisions](#decisions)).

## Quick start

```bash
cp .env.example .env            # replace the placeholder password
docker compose up --build       # app: http://localhost:5173   API: http://localhost:8000/api
```

Only `frontend/src` and `frontend/public` hot-reload. After editing `index.html`, `vite.config.ts`, `tsconfig*` or `package*.json`, run `docker compose up -d --build`.

### Tests and checks

```bash
docker compose exec backend pytest                         # backend unit + integration (real Postgres)
cd frontend && npm run lint && npx tsc -b && npm test      # oxlint, type-check, Vitest
cd e2e && npm ci && npx playwright test                    # end to end (stack must be up)
docker compose exec backend alembic revision --autogenerate -m "<msg>"   # new migration
```

CI (GitHub Actions) runs the backend tests with `pip-audit`, the frontend lint, type-check, tests and `npm audit`, and the Playwright suite.

## Using it

The home page (`/`) is one screen with five cards. Nothing needs opening to do the daily work:

| Card | Do it in place |
|---|---|
| Flashcards | Review a deck or all decks, add a card, create a deck |
| LeetCode | Mark each due problem Solved, Hint or Failed, add a problem |
| Roadmaps | Tick checkpoints, add a checkpoint, switch roadmap |
| Calendar | Mini month plus today's agenda, add an event |
| Notes | Capture a thought into a folder, open a recent page |

**Expand** (the corner button) grows a card in place to fill the screen for depth: the three-pane Flashcards view, problem details, the roadmap editor, the full calendar, the notes tree and editor. Browser Back, refresh and `Escape` all work, because the state lives in the URL (for example `/?focus=flashcards&review=3`).

Settings holds the theme (light, dark or system) and your timezone, which decides what "today" means.

### The review ladder

New cards and problems are due the day they are created. A right answer moves them up the ladder: **same day, then +1, +3, +7 and +21 days, then retired**. A wrong answer resets to day 1. Overdue items stay due until reviewed, and intervals count from the day you actually reviewed. Retired items stay viewable and can be un-retired, which restarts them at day 1.

## Architecture

```
┌────────────┐  /api   ┌──────────────┐  SQLAlchemy 2   ┌─────────────┐
│ React + MUI │ ─────▶ │   FastAPI    │ ──────────────▶ │ PostgreSQL  │
│ Vite (5173) │ proxy  │  (8000)      │   Alembic       │     17      │
└────────────┘         └──────────────┘                  └─────────────┘
```

| Layer | Stack |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (sync, psycopg 3), Alembic, Pydantic v2, python-dateutil |
| Frontend | React 18, TypeScript, Vite, MUI 9, react-query, react-router, react-markdown (no raw HTML), FullCalendar, dayjs |
| Database | PostgreSQL 17, 11 linear Alembic migrations |
| Tests | pytest, Vitest with React Testing Library, Playwright |
| Runtime | docker-compose: `db`, `backend`, `frontend` |

### Folder layout

```
backend/
  app/core/        config, db, deps (current user), srs (the ladder), time (today for a user)
  app/models/      SQLAlchemy models, one file per resource
  app/schemas/     Pydantic schemas (InputModel, Id, NoNul, NotBlank in common.py)
  app/routers/     FastAPI routers, plain CRUD stays here
  app/services/    only real logic: RRULE expansion, calendar, dashboard, notifications
  alembic/versions one migration per schema-changing ticket
  tests/           unit + integration (per-test transaction rollback)
frontend/src/
  theme/           tokens.ts, theme.ts, theme mode provider (see docs/DESIGN.md)
  api/ hooks/      fetch client + react-query hooks, one file per resource
  components/      Card, ListRow, quick forms, dialogs, calendar card, notification bell
  pages/           HomePage plus the expanded view for each section
e2e/               Playwright specs
docs/              ARCHITECTURE.md (schema, rules, home page spec), DESIGN.md (design system)
```

Layering is routers, then services only when there is real logic, then models. The ladder lives in exactly one place, `core/srs.py`, and both cards and problems use it.

### Data model

`users`, `decks`, `cards`, `problems`, `note_folders`, `note_pages`, `roadmaps`, `checkpoints`, `events`, `notifications`. Every user-owned table carries `user_id` (or reaches it through its parent). Due dates are `date`; instants are `timestamptz`. The full column list and enums are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Notable mechanisms

- **Calendar:** `GET /api/calendar?from&to` returns expanded event occurrences plus derived items (cards due per day, problem due dates, checkpoint targets). Recurrence is expanded in the user's timezone so it stays correct across DST.
- **Reminders:** in-app only and without a background worker. `GET /api/notifications` inserts any rows that have become due (idempotent, `UNIQUE(event_id, occurrence_start)`) and returns the unread ones. The bell polls every 60 seconds.
- **Concurrency:** card reviews, problem attempts, folder moves and roadmap reorders take row locks so double clicks and parallel tabs cannot corrupt state.
- **Home page:** a 12-column by 3-row grid that fills the viewport from 1100px wide, one column below. Expanding a card uses a FLIP animation between measured grid cells (`hooks/useExpandFlip`), and respects reduced motion.

## Decisions

The decisions below came out of the planning and review conversations. Each one is also recorded where the code lives.

**Product**

| Question | Decision |
|---|---|
| Login | Deferred. A seeded user 1 is returned by one function, `get_current_user()`. WorkOS AuthKit replaces only that function later. Every table already has an owner, and tests use a second user to prove other users' rows return 404. |
| Wrong answer | Reset to day 1 (not a step back). No randomness or jitter in intervals. |
| LeetCode | Same ladder as cards. Attempts are allowed before the due date and still advance the ladder. `failed` counts as wrong. Pattern is a fixed list of 18 values. |
| Cards | Markdown front and back. Reviews are rejected when a card is not due. Retired items are viewable, with an un-retire action. |
| Notes | Markdown, folders nest to any depth, pages can sit at any level, moving a folder rejects cycles. |
| Roadmaps | An ordered checklist, with progress as done over total. |
| Reminders | Events with an optional RRULE and an optional "remind N minutes before". In-app notifications only, no email or push. |
| Today | Computed in the user's timezone, which the browser sets and Settings can override. |

**Engineering process**

- Work is tracked as one GitHub Issue per small, isolated ticket, one milestone per phase, so any session can pick one up cold from `CLAUDE.md` and `docs/ARCHITECTURE.md`.
- Each ticket is built on its own branch and merged by a PR with a merge commit (PRs are often stacked), only after CI is green. Each ticket also gets an independent QA review and an independent security review, and fixes go back to the implementer.
- Every ticket is tested before it closes: unit, integration, and end to end where a user flow is involved.
- Frontend and backend work run as separate implementers.
- Backend is organised by layer and frontend by type, so new features add files instead of editing old ones.

**Security rules** (applied to every ticket, listed in `CLAUDE.md`)

- Filter every query by the current user. Validate every input with Pydantic (lengths, enums, URLs, ranges). Request bodies reject unknown fields.
- No raw SQL strings, no `dangerouslySetInnerHTML`, no raw HTML in markdown, external links get `rel="noopener noreferrer"`.
- Anything user-controlled that can grow is bounded: RRULE expansion is limited by the request window and an occurrence cap, list sizes are capped, request bodies have a size limit.
- Secrets live only in `.env`. Dependencies are pinned and audited in CI.

**Avoiding over-engineering**

Build only what the acceptance criteria ask for. Services only for real logic, no generic base classes or repositories, no state library beyond react-query, no new dependency without a stated reason, and known limits get a `# shortcut: <limit>, <when to upgrade>` comment.

**Design** (full spec in [docs/DESIGN.md](docs/DESIGN.md))

The first redesign put each section on its own page. Feedback was that it scrolled, wasted space, hid the main actions behind "expand", repeated the date and title, and felt like navigation. The second design follows one idea, **one screen, one glance**:

- Every card does its main job inline, so expanding is for depth and never for access.
- One card anatomy: a 48px header with title, quiet count, actions and expand.
- Geist for everything (Geist Mono for numbers), one 8px radius, 1px borders, no shadows, no chips, no helper copy.
- Neutral palette with a single amber accent reserved for meaning: today, overdue, progress, active.
- Light, dark or system theme, defaulting to system.
- Short motion: 240ms expand in place, siblings fade out, reduced motion falls back to opacity only.

## Known limits and next steps

- **Auth:** there is no login. Do not expose this to a network. When WorkOS lands, add SameSite cookies and a CSRF or Origin check on state-changing routes, and note that `GET /api/notifications` has a side effect.
- **Not built yet:** editing a single occurrence of a recurring event, image uploads, per-attempt history, email or push notifications, production deployment.
- The request body size limit only reads `Content-Length`, so chunked bodies are not counted.
- `docs/DESIGN.md` does not yet describe the header-actions slot and the text toggle component.

See [CLAUDE.md](CLAUDE.md) for the working agreement used by contributors and agents.
