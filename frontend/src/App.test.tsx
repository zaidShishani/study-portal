import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.tsx'
import { ThemeModeProvider } from './theme/ThemeModeProvider.tsx'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no API in tests')))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function Url() {
  const { pathname, search } = useLocation()
  return <output aria-label="url">{pathname + search}</output>
}

function renderApp(path = '/') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeModeProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Url />
        </MemoryRouter>
      </ThemeModeProvider>
    </QueryClientProvider>,
  )
}

test('top bar links navigate to Settings and Home, marking the active one', () => {
  renderApp('/flashcards')
  const nav = screen.getByRole('navigation', { name: 'Main' })
  fireEvent.click(within(nav).getByRole('link', { name: 'Settings' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Settings')
  expect(within(nav).getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(within(nav).getByRole('link', { name: 'Home' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Today')
  expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
})

test('wordmark links home and there is no sidebar', () => {
  renderApp('/notes')
  expect(screen.getByRole('link', { name: 'Study Portal' }).getAttribute('href')).toBe('/')
  expect(within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')).toHaveLength(2)
  expect(screen.queryByRole('link', { name: 'Flashcards' })).toBeNull()
})

// jsdom has no :focus-visible, so the keyboard-focus tooltip is covered in e2e/smoke.spec.ts.
test('logout is disabled, focusable through its wrapper, and explains why', async () => {
  renderApp()
  const logout = screen.getByRole('button', { name: 'Logout' }) as HTMLButtonElement
  expect(logout.disabled).toBe(true)
  const wrapper = logout.parentElement!
  expect(wrapper.tabIndex).toBe(0)
  fireEvent.mouseOver(wrapper)
  expect((await screen.findByRole('tooltip')).textContent).toBe('Available once login is set up')
})

test('old section URLs redirect to the home focus view', () => {
  for (const [from, to] of [
    ['/flashcards', '/?focus=flashcards'],
    ['/flashcards/review', '/?focus=flashcards&review=all'],
    ['/flashcards/3', '/?focus=flashcards&deck=3'],
    ['/flashcards/3/review', '/?focus=flashcards&review=3'],
    ['/leetcode', '/?focus=leetcode'],
    ['/leetcode/7', '/?focus=leetcode&problem=7'],
    ['/roadmaps', '/?focus=roadmaps'],
    ['/roadmaps/2', '/?focus=roadmaps&roadmap=2'],
    // Junk is encoded, then rejected by useFocus.
    ['/flashcards/a&focus=x', '/?focus=flashcards&deck=a%26focus%3Dx'],
  ]) {
    renderApp(from)
    expect(screen.getByRole('status', { name: 'url' }).textContent).toBe(to)
    cleanup()
  }
})

test('existing section routes still render', () => {
  renderApp('/calendar')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Calendar')
})

test('unknown route shows not found', () => {
  renderApp('/nope')
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
})
