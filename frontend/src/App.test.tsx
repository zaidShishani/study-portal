import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.tsx'

const NAV = ['Today', 'Flashcards', 'LeetCode', 'Notes', 'Roadmaps', 'Calendar']

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
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('renders every nav link and navigates to each page', () => {
  renderApp()
  const nav = screen.getByRole('navigation', { name: 'Main' })
  for (const label of NAV) {
    fireEvent.click(within(nav).getByRole('link', { name: label }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(label)
    expect(within(nav).getByRole('link', { name: label }).getAttribute('aria-current')).toBe('page')
  }
})

test('unknown route shows not found', () => {
  renderApp('/nope')
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
})
