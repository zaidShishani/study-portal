import { createTheme, type Shadows } from '@mui/material/styles'
import type {} from '@mui/x-date-pickers/themeAugmentation'
import { fonts, radius, tokens } from './tokens'

const PASTEL_COLORS = ['success', 'warning', 'error', 'info'] as const

export function createAppTheme(mode: 'light' | 'dark') {
  const t = tokens[mode]
  const ring = { outline: `2px solid ${t.accent}`, outlineOffset: 2 }
  const heading = { fontFamily: fonts.heading, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }

  return createTheme({
    palette: {
      mode,
      // AA for text on filled colors (MUI picks white or dark text against this ratio).
      contrastThreshold: 4.5,
      primary: { main: t.primary, contrastText: t.onPrimary },
      // secondary = the amber accent (focus, selected, progress, badges); never large backgrounds.
      secondary: { main: t.accent },
      // main = chip/label text, light = chip background.
      success: { main: t.green.text, light: t.green.bg },
      warning: { main: t.yellow.text, light: t.yellow.bg },
      error: { main: t.red.text, light: t.red.bg },
      info: { main: t.blue.text, light: t.blue.bg },
      background: { default: t.canvas, paper: t.surface },
      text: { primary: t.text, secondary: t.textMuted },
      divider: t.border,
      action: { active: t.textMuted, hover: t.surfaceHover, selected: t.accentSoft },
    },
    shape: { borderRadius: radius },
    shadows: Array(25).fill('none') as Shadows,
    transitions: {
      duration: { shortest: 150, shorter: 150, short: 200, standard: 200, complex: 200, enteringScreen: 200, leavingScreen: 150 },
    },
    typography: {
      fontFamily: fonts.body,
      body1: { lineHeight: 1.6 },
      body2: { lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--fc-border-color': t.border,
            '--fc-page-bg-color': t.surface,
            '--fc-neutral-bg-color': t.surfaceHover,
            '--fc-today-bg-color': t.surfaceHover,
            '--fc-highlight-color': t.accentSoft,
            '--fc-now-indicator-color': t.accent,
            '--fc-list-event-hover-bg-color': t.surfaceHover,
            '--fc-event-bg-color': t.primary,
            '--fc-event-border-color': t.primary,
            '--fc-event-text-color': t.onPrimary,
            '--fc-button-text-color': t.text,
            '--fc-button-bg-color': t.surface,
            '--fc-button-border-color': t.border,
            '--fc-button-hover-bg-color': t.surfaceHover,
            '--fc-button-hover-border-color': t.border,
            '--fc-button-active-bg-color': t.accentSoft,
            '--fc-button-active-border-color': t.accent,
          },
          // FullCalendar ships its own focus shadow; the accent ring replaces it.
          '.fc .fc-button': { borderRadius: radius, boxShadow: 'none !important' },
          'h1, h2': heading,
          ':focus-visible': ring,
          a: { color: 'inherit', textDecorationColor: t.accent, textUnderlineOffset: '0.2em' },
          'code, kbd, pre': { fontFamily: fonts.mono },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },
      // Semantic h1/h2 use the display serif whatever their visual variant (page titles are variant h4).
      MuiTypography: { styleOverrides: { root: { '&:is(h1, h2)': heading } } },
      MuiButtonBase: { styleOverrides: { root: { '&.Mui-focusVisible': ring } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${t.border}` } } },
      MuiAppBar: {
        defaultProps: { color: 'inherit' },
        styleOverrides: { root: { border: 0, borderBottom: `1px solid ${t.border}`, backgroundColor: t.surface } },
      },
      MuiDrawer: { styleOverrides: { paper: { border: 0, borderRight: `1px solid ${t.border}` } } },
      MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${t.border}` } } },
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: radius } } },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: radius,
            variants: PASTEL_COLORS.map((color) => ({
              props: { color, variant: 'filled' },
              style: ({ theme }) => ({ backgroundColor: theme.palette[color].light, color: theme.palette[color].main }),
            })),
          },
        },
      },
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
