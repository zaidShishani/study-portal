import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useTheme } from '@mui/material'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createAppTheme } from './theme'
import { ThemeModeProvider, useThemeMode } from './ThemeModeProvider'
import { fonts, radius, tokens } from './tokens'

function stubSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
}

const wrapper = ({ children }: { children: ReactNode }) => <ThemeModeProvider>{children}</ThemeModeProvider>
const renderMode = () => renderHook(() => ({ ...useThemeMode(), theme: useTheme() }), { wrapper })

beforeEach(() => localStorage.clear())

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test.each(['light', 'dark'] as const)('createAppTheme(%s) uses the tokens', (mode) => {
  const theme = createAppTheme(mode)
  expect(theme.shape.borderRadius).toBe(radius)
  expect(theme.palette.mode).toBe(mode)
  expect(theme.palette.background).toMatchObject({ default: tokens[mode].canvas, paper: tokens[mode].surface })
  expect(theme.palette.secondary.main).toBe(tokens[mode].accent)
  // Primary button = solid text color on surface.
  expect(theme.palette.primary).toMatchObject({ main: tokens[mode].text, contrastText: tokens[mode].surface })
  expect(theme.palette.divider).toBe(tokens[mode].border)
  expect(theme.palette.action.hover).toBe(tokens[mode].line)
  expect(theme.palette.success.main).toBe(tokens[mode].easy)
  expect(theme.palette.warning.main).toBe(tokens[mode].medium)
  expect(theme.palette.error.main).toBe(tokens[mode].hard)
})

test('v2 values: radius 8, Geist only, spec type scale', () => {
  expect(radius).toBe(8)
  expect(tokens.light).toMatchObject({ canvas: '#F6F6F4', surface: '#FFFFFF', accent: '#D97706', accentText: '#B45309' })
  expect(tokens.dark).toMatchObject({ canvas: '#121212', surface: '#1A1A1A', accent: '#FBBF24' })
  expect(Object.values(fonts).join()).not.toMatch(/Instrument|Georgia|[^-]serif/)
  const { typography } = createAppTheme('light')
  expect(typography.body1).toMatchObject({ fontSize: '0.8125rem', lineHeight: 1.5 })
  expect(typography.subtitle1).toMatchObject({ fontSize: '0.875rem', fontWeight: 600 })
  expect(typography.overline).toMatchObject({ fontSize: '0.6875rem', letterSpacing: '0.04em', textTransform: 'uppercase' })
})

test('defaults to following the system preference', () => {
  stubSystemDark(true)
  const { result } = renderMode()
  expect(result.current.mode).toBe('system')
  expect(result.current.resolvedMode).toBe('dark')
  expect(result.current.theme.palette.background.default).toBe(tokens.dark.canvas)
})

test('a saved value wins over the system preference', () => {
  stubSystemDark(true)
  localStorage.setItem('theme-mode', 'light')
  const { result } = renderMode()
  expect(result.current.resolvedMode).toBe('light')
  expect(result.current.theme.palette.background.default).toBe(tokens.light.canvas)
})

test('setMode switches the theme and persists', () => {
  stubSystemDark(false)
  const { result } = renderMode()
  act(() => result.current.setMode('dark'))
  expect(result.current.resolvedMode).toBe('dark')
  expect(localStorage.getItem('theme-mode')).toBe('dark')
})

test('storage failures are tolerated', () => {
  stubSystemDark(false)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const { result } = renderMode()
  expect(result.current.mode).toBe('system')
  act(() => result.current.setMode('dark'))
  expect(result.current.resolvedMode).toBe('dark')
})
