import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { parseId } from '../hooks/useFocus'
import type { Dashboard } from '../types'
import HomePage from './HomePage'

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
  events_today: [],
  roadmaps: [
    { id: 3, title: 'Backend', done: 1, total: 4 },
    { id: 4, title: 'Blank', done: 0, total: 0 },
  ],
}

function Search() {
  return <output aria-label="search">{useLocation().search}</output>
}

// Dashboard from `body`; every other endpoint answers 404 so focus views render their not-found state.
function renderPage(body: unknown = full, { status = 200, path = '/' } = {}) {
  const fetchMock = vi.fn(async (url: string) =>
    url === '/api/dashboard/today'
      ? Response.json(body, { status })
      : url === '/api/decks' || url === '/api/roadmaps' || url.startsWith('/api/problems?') || url.startsWith('/api/review/')
        ? Response.json([])
        : Response.json({ detail: 'Not found' }, { status: 404 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <HomePage />
        <Search />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return fetchMock
}

const panel = (name: string) => screen.getByRole('region', { name })
const href = (scope: HTMLElement, name: string | RegExp) => within(scope).getByRole('link', { name }).getAttribute('href')
const search = () => screen.getByRole('status', { name: 'search' }).textContent

test('renders the five panels with summaries and focus links', async () => {
  const fetchMock = renderPage()
  expect(await screen.findByText('4 cards due')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/today', expect.anything())
  expect(screen.getByText(new Date(2026, 10, 23).toLocaleDateString([], { dateStyle: 'full' }))).toBeTruthy()

  const cards = panel('Flashcards')
  expect(href(cards, /Spanish/)).toBe('/?focus=flashcards&review=1')
  expect(href(cards, /Algorithms/)).toBe('/?focus=flashcards&review=2')
  expect(within(cards).getByText('3')).toBeTruthy()
  const start = within(cards).getByRole('link', { name: 'Start review' })
  expect(start.getAttribute('href')).toBe('/?focus=flashcards&review=all')
  expect(start.getAttribute('aria-disabled')).toBeNull()

  const problems = panel('LeetCode')
  expect(href(problems, /Two Sum/)).toBe('/?focus=leetcode&problem=7')
  expect(href(problems, /LRU Cache/)).toBe('/?focus=leetcode&problem=8')
  expect(within(within(problems).getByRole('link', { name: /Two Sum/ })).getByText('Overdue')).toBeTruthy()
  expect(within(within(problems).getByRole('link', { name: /LRU Cache/ })).queryByText('Overdue')).toBeNull()
  expect(within(problems).getByText('Medium')).toBeTruthy()

  const roadmaps = panel('Roadmaps')
  expect(href(roadmaps, /Backend/)).toBe('/?focus=roadmaps&roadmap=3')
  expect(within(roadmaps).getByRole('progressbar', { name: 'Progress 1/4 · 25%' })).toBeTruthy()
  expect(within(within(roadmaps).getByRole('link', { name: /Blank/ })).getByText('No checkpoints')).toBeTruthy()

  for (const name of ['Calendar', 'Notes']) {
    expect(within(panel(name)).getByText('Coming soon')).toBeTruthy()
    expect(screen.queryByRole('button', { name: `Expand ${name}` })).toBeNull()
  }
})

test('panels cap rows at 5 with a Show all button that expands the panel', async () => {
  const many = Array.from({ length: 7 }, (_, i) => i + 1)
  renderPage({
    ...full,
    decks: many.map((id) => ({ id, title: `Deck ${id}`, due_count: 1 })),
    problems_due: many.map((id) => ({ id, title: `Problem ${id}`, difficulty: 'Easy', due_date: '2026-11-23' })),
    roadmaps: many.map((id) => ({ id, title: `Roadmap ${id}`, done: 0, total: 0 })),
  })
  await screen.findByText('Deck 1')
  for (const [name, row] of [['Flashcards', 'Deck'], ['LeetCode', 'Problem'], ['Roadmaps', 'Roadmap']]) {
    expect(within(panel(name)).getByText(`${row} 5`)).toBeTruthy()
    expect(within(panel(name)).queryByText(`${row} 6`)).toBeNull()
  }
  expect(within(panel('Flashcards')).queryByRole('button', { name: 'Show all (5)' })).toBeNull()
  fireEvent.click(within(panel('LeetCode')).getByRole('button', { name: 'Show all (7)' }))
  expect(search()).toBe('?focus=leetcode')
})

test('a nested view whose h1 waits for data gets focus once the h1 appears', async () => {
  renderPage()
  fireEvent.click(await screen.findByRole('link', { name: /Two Sum/ }))
  expect(search()).toBe('?focus=leetcode&problem=7')
  const h1 = await screen.findByRole('heading', { level: 1, name: 'Problem not found' })
  await waitFor(() => expect(document.activeElement).toBe(h1))
})

test('empty states and Start review disabled at 0', async () => {
  renderPage(empty)
  expect(await screen.findByText('No cards due.')).toBeTruthy()
  expect(within(panel('Flashcards')).getByRole('link', { name: 'Start review' }).getAttribute('aria-disabled')).toBe('true')
  expect(screen.getByText('No problems due.')).toBeTruthy()
  expect(screen.getByText('No roadmaps yet.')).toBeTruthy()
})

test('shows the error as text', async () => {
  renderPage({ detail: 'Boom <b>x</b>' }, { status: 500 })
  expect(await screen.findByText('500 Boom <b>x</b>')).toBeTruthy()
})

test('expand focuses the panel in the URL; back arrow restores the grid and refocuses the heading', async () => {
  renderPage()
  await screen.findByText('4 cards due')
  fireEvent.click(screen.getByRole('button', { name: 'Expand LeetCode' }))
  expect(search()).toBe('?focus=leetcode')
  const h1 = screen.getByRole('heading', { level: 1, name: 'LeetCode' })
  expect(document.activeElement).toBe(h1)
  expect(screen.queryByRole('region', { name: 'Flashcards' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Back to home' }))
  expect(search()).toBe('')
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'LeetCode' }))
  expect(panel('Flashcards')).toBeTruthy()
})

test('Escape exits focus, but not while a dialog or text field has it', async () => {
  renderPage(full, { path: '/?focus=flashcards' })
  fireEvent.click(await screen.findByRole('button', { name: 'New deck' }))
  fireEvent.keyDown(within(screen.getByRole('dialog')).getByLabelText('Title'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(search()).toBe('?focus=flashcards')

  fireEvent.keyDown(document.body, { key: 'Escape' })
  expect(search()).toBe('')
  expect(await screen.findByRole('region', { name: 'Flashcards' })).toBeTruthy()
})

test('nested views render from the URL', async () => {
  const fetchMock = renderPage(full, { path: '/?focus=flashcards&deck=5' })
  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/decks/5', expect.anything())
  cleanup()

  renderPage(full, { path: '/?focus=flashcards&review=all' })
  expect(await screen.findByRole('heading', { name: 'Nothing due' })).toBeTruthy()
  cleanup()

  renderPage(full, { path: '/?focus=leetcode&problem=7' })
  expect(await screen.findByRole('heading', { name: 'Problem not found' })).toBeTruthy()
  cleanup()

  renderPage(full, { path: '/?focus=roadmaps&roadmap=3' })
  expect(await screen.findByRole('heading', { name: 'Roadmap not found' })).toBeTruthy()
})

test('invalid ids fall back to the panel list; an unknown panel shows the grid', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '1e3', '9999999999']) {
    const fetchMock = renderPage(full, { path: `/?focus=flashcards&deck=${id}&review=${id}` })
    expect(await screen.findByRole('heading', { level: 1, name: 'Flashcards' })).toBeTruthy()
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith('/api/decks/') || url.startsWith('/api/review/'))).toBe(false)
    cleanup()
  }
  renderPage(full, { path: '/?focus=bogus' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeTruthy()
})

test('parseId accepts positive integers only', () => {
  expect(parseId('42')).toBe(42)
  for (const v of [null, '', '0', '-3', '07', '1.0', ' 1', '1x', '1234567890']) expect(parseId(v)).toBeUndefined()
})
