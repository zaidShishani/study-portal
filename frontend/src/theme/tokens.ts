// The only place color literals live. Values and usage rules: docs/DESIGN.md.
type Pastel = { bg: string; text: string }

export type Tokens = {
  canvas: string
  surface: string
  surfaceHover: string
  border: string
  text: string
  textMuted: string
  primary: string
  onPrimary: string
  accent: string
  accentSoft: string
  green: Pastel
  yellow: Pastel
  red: Pastel
  blue: Pastel
}

export const radius = 10

export const fonts = {
  body: "'Geist Variable', 'Helvetica Neue', system-ui, sans-serif",
  heading: "'Instrument Serif', Georgia, serif",
  mono: "ui-monospace, 'SF Mono', monospace",
}

export const tokens: { light: Tokens; dark: Tokens } = {
  light: {
    canvas: '#FBFBFA',
    surface: '#FFFFFF',
    surfaceHover: '#F7F6F3',
    border: '#EAEAEA',
    text: '#2F3437',
    // Darker than the brief's #787774 so muted text meets WCAG AA (4.65:1 on canvas).
    textMuted: '#73726E',
    primary: '#111111',
    onPrimary: '#FFFFFF',
    accent: '#D97706',
    accentSoft: '#FBF3DB',
    green: { bg: '#EDF3EC', text: '#346538' },
    yellow: { bg: '#FBF3DB', text: '#956400' },
    red: { bg: '#FDEBEC', text: '#9F2F2D' },
    blue: { bg: '#E1F3FE', text: '#1F6C9F' },
  },
  dark: {
    canvas: '#191919',
    surface: '#202020',
    surfaceHover: '#262626',
    border: 'rgba(255,255,255,0.08)',
    text: '#E6E6E3',
    textMuted: '#9B9A97',
    primary: '#EDEDED',
    onPrimary: '#191919',
    accent: '#FBBF24',
    accentSoft: 'rgba(251,191,36,0.12)',
    green: { bg: 'rgba(76,175,80,0.12)', text: '#8CC793' },
    yellow: { bg: 'rgba(251,191,36,0.12)', text: '#F0C35B' },
    red: { bg: 'rgba(239,68,68,0.12)', text: '#F2948F' },
    blue: { bg: 'rgba(59,130,246,0.12)', text: '#8CC2EE' },
  },
}
