import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useTheme } from '@mui/material'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createAppTheme } from './theme'
import { ThemeModeProvider, useThemeMode } from './ThemeModeProvider'
import { radius, tokens } from './tokens'

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
  expect(theme.palette.primary.main).toBe(tokens[mode].primary)
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
