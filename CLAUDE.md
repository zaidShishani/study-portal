# Study Portal — Agent Guide

Read `docs/ARCHITECTURE.md` before doing anything. It holds every product decision, the schema, and the folder layout.

## Picking up work
Work is tracked as GitHub Issues (one per ticket, milestone per phase).
1. `gh issue list --state open --milestone "<earliest open phase>"`.
2. Take the lowest-numbered open issue whose "Depends on" issues are all closed.
3. Branch: `git checkout -b ticket/<number>-<slug>` from up-to-date `main`.
4. Implement **only** that issue's scope. If something is unclear, ask the user; do not assume product behavior.
5. Write the tests the issue requires (unit / integration / e2e) and run them locally.
6. Open a PR whose body contains `Closes #<number>` and fill in the PR checklist.
7. Merge with a merge commit (not squash — PRs are often stacked on each other) only when CI is green and the QA + security reviews pass. The merge closes the issue.
8. If the issue is wrong or too big, comment on it and split it — don't silently widen scope.

## Commands
```
docker compose up --build                       # app: http://localhost:5173, API: http://localhost:8000/api
docker compose exec backend pytest              # backend unit + integration
docker compose exec backend alembic revision --autogenerate -m "<msg>"
cd frontend && npm run lint && npx tsc -b && npm test   # lint = oxlint
npx playwright test                             # e2e (stack must be up)
```
(Commands become valid as the P1 tickets land; update this list if they change.)

## Security — always
- Filter every query by `current_user.id`; foreign rows return 404. Test it with a second user.
- Validate input with Pydantic (lengths, enums, URLs, ranges).
- No raw SQL strings, no `dangerouslySetInnerHTML`, no `rehype-raw`.
- Secrets only in `.env`; never commit or log them.
- Bound anything user-controlled that can grow (RRULE expansion, list sizes).

## Avoid over-engineering — always
- Build only what the acceptance criteria ask. No speculative options, flags, or "for later" code.
- `app/services/` only for real logic; plain CRUD stays in the router.
- No generic base classes/repositories, no extra state library beyond react-query.
- No new dependency without a one-line reason in the PR.
- Reuse existing helpers/components first. Known limits get `# shortcut: <limit>, <when to upgrade>`.
