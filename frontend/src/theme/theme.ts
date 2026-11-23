import { alpha, createTheme, type Shadows } from '@mui/material/styles'
import type {} from '@mui/x-date-pickers/themeAugmentation'
import { fonts, motion, radius, tokens } from './tokens'

const px = (n: number) => `${n / 16}rem`
const heading = (size: number) => ({ fontSize: px(size), fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' })

export function createAppTheme(mode: 'light' | 'dark') {
  const t = tokens[mode]
  // accentText: the light fill amber is only 2.94:1 on canvas; the ring needs 3:1 on every background.
  const ring = { outline: `2px solid ${t.accentText}`, outlineOffset: 2 }
  // main = difficulty / meaning color (dots, fills, borders); light = its soft background.
  const meaning = (main: string) => ({ main, light: alpha(main, 0.14) })

  return createTheme({
    palette: {
      mode,
      // AA for text on filled colors (MUI picks white or dark text against this ratio).
      contrastThreshold: 4.5,
      // Primary button = solid text color on surface.
      primary: { main: t.text, contrastText: t.surface },
      // secondary = the amber accent (focus, selected, progress, unread); never large backgrounds.
      secondary: { main: t.accent, dark: t.accentText },
      success: meaning(t.easy),
      warning: meaning(t.medium),
      error: meaning(t.hard),
      info: meaning(t.textMuted),
      background: { default: t.canvas, paper: t.surface },
      text: { primary: t.text, secondary: t.textMuted },
      divider: t.border,
      action: { active: t.textMuted, hover: t.line, selected: t.accentSoft },
    },
    shape: { borderRadius: radius },
    shadows: Array(25).fill('none') as Shadows,
    mixins: { toolbar: { minHeight: 56 } },
    transitions: {
      easing: { easeInOut: motion.easing, easeOut: motion.easing },
      duration: {
        shortest: motion.hover,
        shorter: motion.hover,
        short: motion.fade,
        standard: motion.fade,
        complex: motion.expand,
        enteringScreen: motion.expand,
        leavingScreen: motion.fade,
      },
    },
    typography: {
      fontFamily: fonts.body,
      h1: heading(28),
      h2: heading(24),
      h3: heading(22),
      h4: heading(20),
      h5: heading(16),
      h6: heading(14),
      // Card title.
      subtitle1: { fontSize: px(14), fontWeight: 600, lineHeight: 1.5 },
      subtitle2: { fontSize: px(13), fontWeight: 600, lineHeight: 1.5 },
      body1: { fontSize: px(13), lineHeight: 1.5 },
      // Meta.
      body2: { fontSize: px(12), lineHeight: 1.5 },
      caption: { fontSize: px(12), lineHeight: 1.5 },
      // Section label.
      overline: { fontSize: px(11), fontWeight: 500, lineHeight: 1.5, letterSpacing: '0.04em', textTransform: 'uppercase' },
      button: { fontSize: px(13), fontWeight: 500, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--fc-border-color': t.border,
            '--fc-page-bg-color': t.surface,
            '--fc-neutral-bg-color': t.line,
            '--fc-today-bg-color': t.line,
            '--fc-highlight-color': t.accentSoft,
            '--fc-now-indicator-color': t.accent,
            '--fc-list-event-hover-bg-color': t.line,
            '--fc-event-bg-color': t.text,
            '--fc-event-border-color': t.text,
            '--fc-event-text-color': t.surface,
            '--fc-button-text-color': t.text,
            '--fc-button-bg-color': t.surface,
            '--fc-button-border-color': t.border,
            '--fc-button-hover-bg-color': t.line,
            '--fc-button-hover-border-color': t.border,
            '--fc-button-active-bg-color': t.accentSoft,
            '--fc-button-active-border-color': t.accent,
          },
          // FullCalendar ships its own focus shadow; the accent ring replaces it.
          '.fc .fc-button': { borderRadius: radius, boxShadow: 'none !important' },
          // Pull FullCalendar's own type onto the scale.
          '.fc .fc-toolbar-title': { fontSize: px(14), fontWeight: 600 },
          '.fc th': { fontWeight: 500 },
          '.fc .fc-event': { fontSize: px(12) },
          ':focus-visible': ring,
          a: { color: 'inherit', textDecorationColor: t.accent, textUnderlineOffset: '0.2em' },
          'code, kbd, pre': { fontFamily: fonts.mono },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },
      MuiButtonBase: { styleOverrides: { root: { '&.Mui-focusVisible': ring } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${t.border}` } } },
      MuiAppBar: {
        defaultProps: { color: 'inherit' },
        styleOverrides: { root: { border: 0, borderBottom: `1px solid ${t.border}`, backgroundColor: t.surface } },
      },
      MuiDrawer: { styleOverrides: { paper: { border: 0, borderRight: `1px solid ${t.border}` } } },
      // Small tables fall back to body2 (12px meta); table text is list text (13px).
      MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${t.border}` }, body: { fontSize: px(13) } } },
      // Variants: text = ghost, outlined = secondary, contained = primary.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: radius,
            minHeight: 32,
            paddingBlock: 0,
            transition: `background-color ${motion.hover}ms, border-color ${motion.hover}ms, color ${motion.hover}ms, transform ${motion.hover}ms`,
            '&:active': { transform: 'scale(.98)' },
          },
          sizeSmall: { minHeight: 28 },
          outlined: { borderColor: t.border },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: radius } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radius, '&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: t.accent } },
          notchedOutline: { borderColor: t.border },
        },
      },
      // Date/time picker fields use their own input, so they need the same border/focus rules.
      MuiPickersOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radius, '&.Mui-focused:not(.Mui-error) .MuiPickersOutlinedInput-notchedOutline': { borderColor: t.accent } },
          notchedOutline: { borderColor: t.border },
        },
      },
      // Controls are 28–32px: fields default to the small (32px, 13px text) size, dialogs included.
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiPickersTextField: { defaultProps: { size: 'small' } },
      MuiFormHelperText: { styleOverrides: { root: { fontSize: px(12), marginInline: 0 } } },
      // Dialogs: radius 8 (shape) + 1px border from MuiPaper; 14/600 title, 24px gutters on the 4px scale.
      MuiDialogTitle: { styleOverrides: { root: { fontSize: px(14), fontWeight: 600, lineHeight: 1.5, padding: '20px 24px 12px' } } },
      MuiDialogContent: { styleOverrides: { root: { padding: '4px 24px 8px' } } },
      MuiDialogContentText: { styleOverrides: { root: { fontSize: px(13), color: t.textMuted } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px 20px', gap: 8, '& > :not(style) ~ :not(style)': { marginLeft: 0 } } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: t.text, color: t.surface, borderRadius: radius } } },
      MuiToggleButton: {
        styleOverrides: { root: { borderRadius: radius, '&.Mui-selected': { backgroundColor: t.accentSoft, color: t.text } } },
      },
      MuiLinearProgress: {
        defaultProps: { color: 'secondary' },
        styleOverrides: { root: { borderRadius: radius, backgroundColor: t.accentSoft }, bar: { borderRadius: radius } },
      },
    },
  })
}
