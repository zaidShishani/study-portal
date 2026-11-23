import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { parseId } from '../hooks/useFocus'
import type { CalendarData, Dashboard, RecentPage } from '../types'
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

const noCalendar: CalendarData = { events: [], card_due: [], problems_due: [], checkpoints: [], truncated: false }
const local = (d: number, h: number) => new Date(2026, 10, d, h).toISOString()
const calendar: CalendarData = {
  events: [
    { event_id: 1, title: 'Standup', start: local(23, 9), end: local(23, 10), all_day: false },
    // All-day, Nov 24-25 (end is exclusive).
    { event_id: 2, title: 'Trip', start: local(24, 0), end: local(26, 0), all_day: true },
  ],
  card_due: [{ date: '2026-11-23', count: 1 }],
  problems_due: [{ id: 7, title: 'Two Sum', date: '2026-11-23' }],
  checkpoints: [
    { id: 9, roadmap_id: 3, title: 'Learn SQL', date: '2026-11-27' },
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ id: 20 + i, roadmap_id: 3, title: `Step ${i}`, date: '2026-11-28' })),
  ],
  truncated: false,
}
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const recent: RecentPage[] = [
  { id: 5, title: 'Graphs', folder_id: 2, folder_name: 'Algorithms', updated_at: ago(3 * 3600_000) },
  { id: 6, title: 'Scratch', folder_id: null, folder_name: null, updated_at: ago(1000) },
]

// Dashboard from `body`; every other endpoint answers 404 so focus views render their not-found state.
function renderPage(
  body: unknown = full,
  { status = 200, path = '/', cal = noCalendar, pages = [] as RecentPage[] } = {},
) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
    url === '/api/dashboard/today'
      ? Response.json(body, { status })
      : url.startsWith('/api/calendar?')
        ? Response.json(cal)
        : url === '/api/notes/pages/recent?limit=8'
          ? Response.json(pages)
          : url === '/api/notes/pages' && init?.method === 'POST'
            ? Response.json({ id: 42, title: 'Untitled', folder_id: null, content: '' }, { status: 201 })
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

  for (const name of ['Calendar', 'Notes']) expect(screen.getByRole('button', { name: `Expand ${name}` })).toBeTruthy()
})

test('mini month: dots on busy days, today agenda, day selection, capped list, month paging', async () => {
  const fetchMock = renderPage(full, { cal: calendar })
  const cal = panel('Calendar')
  expect(await within(cal).findByRole('link', { name: /Standup/ })).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/calendar?from=2026-11-01&to=2026-11-30', expect.anything())
  const day = (n: string) => within(cal).getByRole('gridcell', { name: n })
  for (const n of ['23', '24', '25', '27', '28']) expect(day(n).getAttribute('aria-description')).toBe('Has items')
  for (const n of ['22', '26']) expect(day(n).getAttribute('aria-description')).toBeNull()

  expect(within(cal).getByText('Agenda for today')).toBeTruthy()
  const time = (h: number) => new Date(2026, 10, 23, h).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  expect(within(cal).getByText(`${time(9)} – ${time(10)}`)).toBeTruthy()
  expect(href(cal, /Standup/)).toBe('/?focus=calendar')
  expect(href(cal, /1 card due/)).toBe('/?focus=flashcards&review=all')
  expect(href(cal, /Two Sum/)).toBe('/?focus=leetcode&problem=7')

  fireEvent.click(day('25'))
  expect(within(cal).getByText('Agenda for Nov 25')).toBeTruthy()
  expect(within(within(cal).getByRole('link', { name: /Trip/ })).getByText('All day')).toBeTruthy()
  expect(within(cal).queryByRole('link', { name: /Standup/ })).toBeNull()

  fireEvent.click(day('27'))
  expect(href(cal, /Learn SQL/)).toBe('/?focus=roadmaps&roadmap=3')

  fireEvent.click(day('26'))
  expect(within(cal).getByText('Nothing scheduled.')).toBeTruthy()

  fireEvent.click(day('28'))
  expect(within(cal).getAllByRole('link', { name: /Step/ })).toHaveLength(6)
  expect(href(cal, '+2 more')).toBe('/?focus=calendar')

  fireEvent.click(within(cal).getByRole('button', { name: 'Next month' }))
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/calendar?from=2026-12-01&to=2026-12-31', expect.anything()),
  )
  expect(within(cal).getByText('Agenda for Dec 1')).toBeTruthy()
})

test('notes card: recent pages with folder and relative time; New page opens it in focus', async () => {
  const fetchMock = renderPage(full, { pages: recent })
  const notes = panel('Notes')
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })
  expect(await within(notes).findByText(`Algorithms · ${rtf.format(-3, 'hour')}`)).toBeTruthy()
  expect(within(notes).getByText(`Root · ${rtf.format(0, 'second')}`)).toBeTruthy()
  expect(href(notes, /Graphs/)).toBe('/?focus=notes&page=5')

  fireEvent.click(within(notes).getByRole('button', { name: 'New page' }))
  await waitFor(() => expect(search()).toBe('?focus=notes&page=42'))
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(post[0]).toBe('/api/notes/pages')
  expect(JSON.parse(String(post[1]!.body))).toEqual({ title: 'Untitled', folder_id: null })
})

test('empty states and Start review disabled at 0', async () => {
  renderPage(empty)
  expect(await screen.findByText('No cards due.')).toBeTruthy()
  expect(within(panel('Flashcards')).getByRole('link', { name: 'Start review' }).getAttribute('aria-disabled')).toBe('true')
  expect(screen.getByText('No problems due.')).toBeTruthy()
  expect(screen.getByText('No roadmaps yet.')).toBeTruthy()
  expect(await screen.findByText('No pages yet.')).toBeTruthy()
  expect(await screen.findByText('Nothing scheduled.')).toBeTruthy()
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
  cleanup()

  renderPage(full, { path: '/?focus=calendar' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Back to home' })).toBeTruthy()
  cleanup()

  const notesFetch = renderPage(full, { path: '/?focus=notes&page=5' })
  expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeTruthy()
  await waitFor(() => expect(notesFetch).toHaveBeenCalledWith('/api/notes/pages/5', expect.anything()))
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
