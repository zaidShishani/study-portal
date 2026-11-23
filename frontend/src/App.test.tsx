import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
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

function renderApp(path = '/') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeModeProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
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
  expect(document.getElementById(logout.getAttribute('aria-describedby')!)?.textContent).toBe('Available once login is set up')
  const wrapper = logout.parentElement!
  expect(wrapper.tabIndex).toBe(0)
  fireEvent.mouseOver(wrapper)
  expect((await screen.findByRole('tooltip')).textContent).toBe('Available once login is set up')
})

test('existing section routes still render', () => {
  renderApp('/calendar')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Calendar')
})

test('unknown route shows not found', () => {
  renderApp('/nope')
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
})
