// The only place color literals live. Values and usage rules: docs/DESIGN.md.
export type Tokens = {
  canvas: string
  surface: string
  border: string
  /** Row dividers and hover background. */
  line: string
  text: string
  textMuted: string
  /** Amber for fills, marks and focus. */
  accent: string
  /** Amber as text (the fill amber fails AA on light surfaces). */
  accentText: string
  accentSoft: string
  easy: string
  medium: string
  hard: string
}

/** The one radius: cards, buttons, inputs, menus, dialogs. Checkboxes (4px) are the only exception. */
export const radius = 8

export const fonts = {
  body: "'Geist Variable', 'Helvetica Neue', system-ui, sans-serif",
  mono: "'Geist Mono Variable', ui-monospace, 'SF Mono', monospace",
}

export const motion = {
  easing: 'cubic-bezier(.2,.8,.2,1)',
  /** Card expand / collapse. */
  expand: 240,
  /** Sibling fade, new list rows. */
  fade: 160,
  hover: 120,
  /** Expanded content fades in after the card starts growing; also the reduced-motion cap. */
  delay: 80,
}

export const tokens: { light: Tokens; dark: Tokens } = {
  light: {
    canvas: '#F6F6F4',
    surface: '#FFFFFF',
    border: '#E6E5E1',
    line: '#EFEEEB',
    text: '#1D1D1B',
    textMuted: '#6A6964',
    accent: '#D97706',
    accentText: '#B45309',
    accentSoft: '#FBF3DB',
    easy: '#3E8E4F',
    medium: '#B7791F',
    hard: '#C2453A',
  },
  dark: {
    canvas: '#121212',
    surface: '#1A1A1A',
    border: '#2A2A29',
    line: '#232322',
    text: '#ECECEA',
    textMuted: '#A09F9A',
    accent: '#FBBF24',
    accentText: '#FBBF24',
    accentSoft: 'rgba(251,191,36,0.12)',
    easy: '#7FC48A',
    medium: '#E8B04A',
    hard: '#EF8F87',
  },
}
