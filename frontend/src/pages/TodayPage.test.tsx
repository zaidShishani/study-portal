import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../types'
import TodayPage from './TodayPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const empty: Dashboard = {
  date: '2026-11-23',
  decks: [],
  due_card_total: 0,
  problems_due: [],
  events_today: [],
  roadmaps: [],
}

const full: Dashboard = {
  date: '2026-11-23',
  decks: [
    { id: 1, title: 'Spanish', due_count: 3 },
    { id: 2, title: 'Algorithms', due_count: 1 },
  ],
  due_card_total: 4,
  problems_due: [
    { id: 7, title: 'Two Sum', difficulty: 'Easy', due_date: '2026-11-20' },
    { id: 8, title: 'LRU Cache', difficulty: 'Medium', due_date: '2026-11-23' },
  ],
  events_today: [
    { event_id: 5, title: 'Standup', start: '2026-11-23T09:00:00Z', end: '2026-11-23T09:15:00Z', all_day: false },
    { event_id: 6, title: 'Holiday', start: '2026-11-23T00:00:00Z', end: null, all_day: true },
  ],
  roadmaps: [
    { id: 3, title: 'Backend', done: 1, total: 4 },
    { id: 4, title: 'Blank', done: 0, total: 0 },
  ],
}

function renderPage(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => Response.json(body, { status }))
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TodayPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return fetchMock
}

const section = (name: string) => screen.getByRole('region', { name })
const href = (scope: HTMLElement, name: string | RegExp) => within(scope).getByRole('link', { name }).getAttribute('href')

test('renders all four sections from the API with links', async () => {
  const fetchMock = renderPage(full)
  expect(await screen.findByText('4 cards due')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/today', expect.anything())
  expect(screen.getByText(new Date(2026, 10, 23).toLocaleDateString([], { dateStyle: 'full' }))).toBeTruthy()

  const cards = section('Flashcards')
  expect(href(cards, /Spanish/)).toBe('/flashcards/1/review')
  expect(href(cards, /Algorithms/)).toBe('/flashcards/2/review')
  expect(within(cards).getByText('3')).toBeTruthy()
  const start = within(cards).getByRole('link', { name: 'Start review' })
  expect(start.getAttribute('href')).toBe('/flashcards/review')
  expect(start.getAttribute('aria-disabled')).toBeNull()

  const problems = section('LeetCode')
  expect(href(problems, /Two Sum/)).toBe('/leetcode/7')
  expect(href(problems, /LRU Cache/)).toBe('/leetcode/8')
  expect(within(within(problems).getByRole('link', { name: /Two Sum/ })).getByText('Overdue')).toBeTruthy()
  expect(within(within(problems).getByRole('link', { name: /LRU Cache/ })).queryByText('Overdue')).toBeNull()
  expect(within(problems).getByText('Medium')).toBeTruthy()

  const events = section("Today's events")
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  expect(within(events).getByText(`${fmt('2026-11-23T09:00:00Z')} – ${fmt('2026-11-23T09:15:00Z')}`)).toBeTruthy()
  expect(within(events).getByText('All day')).toBeTruthy()
  expect(href(events, /Standup/)).toBe('/calendar')

  const roadmaps = section('Roadmaps')
  expect(href(roadmaps, /Backend/)).toBe('/roadmaps/3')
  expect(within(roadmaps).getByRole('progressbar', { name: 'Progress 1/4 · 25%' })).toBeTruthy()
  expect(within(within(roadmaps).getByRole('link', { name: /Blank/ })).getByText('No checkpoints')).toBeTruthy()
})

test('empty states and Start review disabled at 0', async () => {
  renderPage(empty)
  expect(await screen.findByText('No cards due.')).toBeTruthy()
  expect(within(section('Flashcards')).getByRole('link', { name: 'Start review' }).getAttribute('aria-disabled')).toBe('true')
  expect(screen.getByText('No problems due.')).toBeTruthy()
  expect(screen.getByText('Nothing scheduled today.')).toBeTruthy()
  expect(screen.getByText('No roadmaps yet.')).toBeTruthy()
})

test('shows the error as text', async () => {
  renderPage({ detail: 'Boom <b>x</b>' }, 500)
  expect(await screen.findByText('500 Boom <b>x</b>')).toBeTruthy()
})
