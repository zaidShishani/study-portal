# Design system

Single source of truth for the UI. Code lives in `frontend/src/theme/`:
`tokens.ts` (every color literal), `theme.ts` (`createAppTheme(mode)` → MUI theme), `ThemeModeProvider.tsx` (light / dark / system).
Components never contain color literals: use theme palette keys (`text.secondary`, `secondary.main`, `success.light`…) or `tokens`.

Direction: modern, clean, minimalist. Warm monochrome with one amber accent.

## Theme mode
- `light` | `dark` | `system`; default `system` (follows `prefers-color-scheme`) when nothing is saved.
- Saved in `localStorage['theme-mode']`; storage failures fall back to `system`.
- `useThemeMode()` → `{ mode, resolvedMode, setMode }`. `color-scheme` on `<html>` follows the resolved mode.

## Color tokens

| Token | Light | Dark | MUI palette |
|---|---|---|---|
| canvas (page bg) | `#FBFBFA` | `#191919` | `background.default` |
| surface (cards, dialogs, menus) | `#FFFFFF` | `#202020` | `background.paper` |
| surface-hover | `#F7F6F3` | `#262626` | `action.hover` |
| border | `#EAEAEA` | `rgba(255,255,255,0.08)` | `divider` |
| text | `#2F3437` | `#E6E6E3` | `text.primary` |
| text-muted | `#73726E` ¹ | `#9B9A97` | `text.secondary` |
| primary-action (solid buttons) | `#111111` on `#FFFFFF` | `#EDEDED` on `#191919` | `primary` |
| accent (amber) | `#D97706` | `#FBBF24` | `secondary.main` |
| accent-soft | `#FBF3DB` | `rgba(251,191,36,0.12)` | `action.selected` |

¹ The brief's `#787774` is 4.32:1 on canvas (fails AA); `#73726E` is the closest value that passes.

### Semantic pastels (chips, calendar items)
`palette.<color>.light` = background, `palette.<color>.main` = text. A filled `<Chip color="success|warning|error|info">` renders as a pastel automatically.

| | Light bg / text | Dark bg / text |
|---|---|---|
| green (`success`) | `#EDF3EC` / `#346538` | `rgba(76,175,80,0.12)` / `#8CC793` |
| yellow (`warning`) | `#FBF3DB` / `#956400` | `rgba(251,191,36,0.12)` / `#F0C35B` |
| red (`error`) | `#FDEBEC` / `#9F2F2D` | `rgba(239,68,68,0.12)` / `#F2948F` |
| blue (`info`) | `#E1F3FE` / `#1F6C9F` | `rgba(59,130,246,0.12)` / `#8CC2EE` |

Usage: difficulty Easy/Medium/Hard = green/yellow/red; overdue = red, due = yellow. Due rows are not tinted amber (that would hide yellow chips); they use surface-hover and the chip carries the meaning. Calendar: own events solid primary, cards due green, problems due yellow, checkpoints blue.

### Contrast (WCAG AA ≥ 4.5:1)
| | on canvas | on surface |
|---|---|---|
| text, light | 12.16 | 12.60 |
| text-muted, light | 4.65 | 4.82 |
| text, dark | 14.06 | 13.03 |
| text-muted, dark | 6.25 | 5.79 |

Pastel chip text on its own bg: light 4.62–6.26, dark 6.47–7.55. The palette's `contrastThreshold` is 4.5, so MUI picks AA text on any filled color.

## Accent rules
Amber only for: focus rings, active/selected states (nav item, toggle), progress bars, badges, links (underline color — link text stays `text` because amber text is 3.19:1 on white), and the due/overdue emphasis (e.g. overdue checkpoint border). Never large backgrounds. Primary buttons are solid monochrome (`primary`).

## Shape
- ONE radius: `10px` (`theme.shape.borderRadius`; `borderRadius: 1` in `sx`). Every container, card, dialog, menu, input, button and chip.
- Borders `1px solid border` on every Paper (cards, dialogs, menus). No drop shadows (`theme.shadows` are all `none`).

## Spacing
8px grid (`theme.spacing(1)` = 8px). Card padding 24px (`p: 3`). Page max width 1200px. Gaps 24px (`gap: 3`).

## Type
- UI/body: `Geist Variable` (self-hosted, `@fontsource-variable/geist`), fallback `'Helvetica Neue', system-ui, sans-serif`. Body line-height 1.6.
- Headings: any element rendered as `<h1>`/`<h2>` uses `Instrument Serif` (`@fontsource/instrument-serif`), weight 400, letter-spacing -0.02em, line-height 1.1 — applied by semantic tag, so `variant="h4" component="h1"` page titles get it.
- Mono: `ui-monospace, 'SF Mono', monospace` for code/kbd/pre.
- Never Roboto or Inter. No third-party font CDN.

## Motion
Transitions 150–200ms (theme `transitions.duration`), on color / opacity / transform only. `prefers-reduced-motion: reduce` disables transitions and animations globally.

## Third-party widgets
FullCalendar reads its `--fc-*` CSS variables, which the theme sets on `:root` from tokens (borders, page bg, today = surface-hover, buttons = surface/border, active button = accent). MUI X picker fields (`MuiPickersOutlinedInput`) get the same border/focus rules as regular inputs. Markdown code blocks use surface-hover + mono.
