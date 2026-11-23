# Design system (v2)

Single source of truth for the UI. Approved design: https://claude.ai/artifact/GkZyR45X53h1rqNhnTQ6c2 (issue #75 carries the same spec).
Code lives in `frontend/src/theme/`: `tokens.ts` (every color literal, `radius`, `fonts`, `motion`), `theme.ts` (`createAppTheme(mode)` → MUI theme), `ThemeModeProvider.tsx` (light / dark / system).
Components never contain color literals: use theme palette keys (`text.secondary`, `secondary.main`, `success.main`…) or `tokens`.

**Ideology — "One screen, one glance":** every study task is reachable from home without scrolling or opening anything; expanding is for depth, never for access; color is reserved for meaning.

## Theme mode
- `light` | `dark` | `system`; default `system` (follows `prefers-color-scheme`) when nothing is saved.
- Saved in `localStorage['theme-mode']`; storage failures fall back to `system`.
- `useThemeMode()` → `{ mode, resolvedMode, setMode }`. `color-scheme` on `<html>` follows the resolved mode.

## Color tokens

| Token | Light | Dark | MUI palette |
|---|---|---|---|
| canvas (page bg) | `#F6F6F4` | `#121212` | `background.default` |
| surface (cards, dialogs, menus) | `#FFFFFF` | `#1A1A1A` | `background.paper` |
| border (card/input outlines) | `#E6E5E1` | `#2A2A29` | `divider` |
| line (row dividers, hover bg) | `#EFEEEB` | `#232322` | `action.hover` |
| text | `#1D1D1B` | `#ECECEA` | `text.primary`, `primary.main` |
| muted | `#6A6964` | `#A09F9A` | `text.secondary` |
| accent (amber fills/marks) | `#D97706` | `#FBBF24` | `secondary.main` |
| accent-text (amber as text) | `#B45309` | `#FBBF24` | `secondary.dark` |
| accent-soft (selection bg, progress track) | `#FBF3DB` | `rgba(251,191,36,0.12)` | `action.selected` |
| easy | `#3E8E4F` | `#7FC48A` | `success.main` |
| medium | `#B7791F` | `#E8B04A` | `warning.main` |
| hard | `#C2453A` | `#EF8F87` | `error.main` |

- **Primary button** = solid text color on surface (`primary.main` = text, `primary.contrastText` = surface).
- `success|warning|error.light` = the meaning color at 14% alpha (calendar item tint). `info` = muted (checkpoints).
- Difficulty colors are for dots/fills, not text: easy/medium are below 4.5:1 on light surfaces. Text stays `text`.

### Contrast (WCAG AA ≥ 4.5:1 for text)
| | light on surface / canvas | dark on surface / canvas |
|---|---|---|
| text | 16.88 / 15.60 | 14.71 / 15.84 |
| muted | 5.50 / 5.08 | 6.56 / 7.07 |
| accent-text | 5.02 / 4.64 | 10.43 / 11.22 |
| hard (error text) | 4.99 / 4.61 | 7.42 / 7.98 |

Light accent `#D97706` is 3.19:1 on white: fills, rings and marks only, never text.

## Accent rules
Amber only for: today, overdue, progress, active tab/selection, unread, focus ring. Never large backgrounds. Links keep text color with an amber underline.

## Type
- **Geist only** (`@fontsource-variable/geist`), fallback `'Helvetica Neue', system-ui, sans-serif`. No serif anywhere. Never Roboto or Inter. No third-party font CDN.
- **Geist Mono** (`@fontsource-variable/geist-mono`, `fonts.mono`) for numbers, counts, times, code.

| Role | Size / weight | MUI |
|---|---|---|
| wordmark | 15 / 600 | top bar link |
| card title | 14 / 600 | `subtitle1` |
| body & list | 13 / 400, line-height 1.5 | `body1` |
| meta | 12 / 400, muted | `body2` |
| section label | 11 / 500, uppercase, +4% tracking | `overline` |
| numbers | Mono 12 | `body2` + `fontFamily: fonts.mono` |

Page headings (`h4`/`h5` on sub-pages) are Geist 600; there is no page title or date on home.

## Shape & spacing
- ONE radius: **8px** (`radius`, `theme.shape.borderRadius`; `borderRadius: 1` in `sx`) on cards, buttons, icon buttons, inputs, menus, dialogs, tooltips. Checkbox 4px is the only exception.
- 1px `border` on every Paper. No shadows (`theme.shadows` are all `none`).
- 4px scale: 4 · 8 · 12 · 16 · 24 · 32. List row 40px with a 1px `line` divider. Controls 28–32px (buttons 32, `size="small"` 28). Top bar 56px.

## Components
- **`Card`** (`components/Card.tsx`): 1px border, radius 8, no shadow; 48px header = title (`h2`, 14/600), optional quiet Mono `count` ("22 due"), `actions`, expand icon button last (`onExpand`, `expanded` → "Expand/Collapse <title>", `aria-expanded`); body below fills the rest and scrolls.
- **`ListRow`** (`components/ListRow.tsx`): 40px, 1px divider, hover background 120ms; a button when `onClick` is given.
- **`DifficultyDot`** (`components/DifficultyDot.tsx`): 6px colored dot + plain text.
- **Buttons**: MUI `Button` variants — `text` = ghost, `outlined` = secondary (neutral border), `contained` = primary. Press scales to .98.
- **No chips and no helper copy.** Difficulty = `DifficultyDot`; counts are plain Mono numbers; status (Due / Overdue) is plain text, Overdue in accent-text.
- **Top bar**: wordmark 15/600; nav Home (active = amber underline), Settings, Logout (disabled); bell with an amber unread dot (no numeric badge) — the exact count stays in the aria-label ("Notifications, 2 unread").

## Home layout (≥1100px)
Top bar 56px; content = 12-column grid, 3 equal rows, 16px gap, padding 20px 32px 24px, filling the viewport height exactly (page never scrolls; lists scroll inside cards). Left cols 1–8: Flashcards (row 1), LeetCode (row 2), Roadmaps (row 3). Right cols 9–12: Calendar (row 1), Notes (rows 2–3). Below 1100px: one column (Flashcards, Calendar, LeetCode, Notes, Roadmaps), page may scroll, cards get a sensible min-height.

## Motion
Tokens in `motion` (`tokens.ts`); MUI `transitions` use them.
- Expand: the card grows from its own rect to the full grid area, 240ms `cubic-bezier(.2,.8,.2,1)`, header stays pinned, content fades in after 80ms; siblings fade to 0 + scale .98 over 160ms (reverse on collapse).
- Hover row bg 120ms; buttons press scale .98. New list rows fade + rise 4px over 160ms. No staggered load animations.
- `prefers-reduced-motion: reduce`: opacity only, ≤80ms (globally transitions/animations collapse to ~0ms).

## Third-party widgets
FullCalendar reads its `--fc-*` CSS variables, which the theme sets on `:root` from tokens (borders, page bg, today = line, own events = solid text color, active button = accent). Derived calendar items (cards due / problem due / checkpoint) use a soft tint of their meaning color with text-color labels; the legend uses 6px dots. MUI X picker fields (`MuiPickersOutlinedInput`) get the same border/focus rules as regular inputs. Markdown code blocks use the line color + Geist Mono.
