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

const dashboard: Dashboard = { date: '2026-11-23', decks: [], due_card_total: 0, problems_due: [], events_today: [], roadmaps: [] }
const stamp = { created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }
const decks = [
  { id: 1, title: 'Spanish', card_count: 10, due_count: 3, ...stamp },
  { id: 2, title: 'Networking', card_count: 4, due_count: 0, ...stamp },
]
const problem = (id: number, title: string, difficulty: string, pattern: string, due_date: string) => ({
  id, title, difficulty, pattern, due_date, link: null, key_insight: null, notes: null, minutes: null,
  last_result: null, solved_date: null, review_count: 0, stage: 0, retired_at: null, ...stamp,
})
const problems = [problem(7, 'Two Sum', 'Easy', 'Two Pointers', '2026-11-20'), problem(8, 'LRU Cache', 'Medium', 'Linked List', '2026-11-23')]
const roadmaps = [
  { id: 3, title: 'Backend', description: null, done_count: 1, total_count: 2, ...stamp },
  { id: 4, title: 'System design', description: null, done_count: 0, total_count: 0, ...stamp },
]
const checkpoint = (id: number, title: string, target_date: string | null, done_at: string | null) => ({
  id, roadmap_id: 3, position: id, title, description: null, target_date, done_at,
})
const roadmapDetail = {
  3: { ...roadmaps[0], checkpoints: [checkpoint(1, 'HTTP basics', null, '2026-11-02T00:00:00Z'), checkpoint(2, 'SQL joins', '2026-11-20', null)] },
  4: { ...roadmaps[1], checkpoints: [] },
}

function Search() {
  return <output aria-label="search">{useLocation().search}</output>
}

const noCalendar: CalendarData = { events: [], card_due: [], problems_due: [], checkpoints: [], truncated: false }
const local = (d: number, h: number) => new Date(2026, 10, d, h).toISOString()
const calendar: CalendarData = {
  events: [
    { event_id: 1, title: 'Standup', start: local(23, 9), end: local(23, 10), all_day: false },
    { event_id: 3, title: 'Night shift', start: local(23, 22), end: local(24, 2), all_day: false },
    // All-day, Nov 24-25 (end is exclusive).
    { event_id: 2, title: 'Trip', start: local(24, 0), end: local(26, 0), all_day: true },
  ],
  card_due: [{ date: '2026-11-23', count: 1 }],
  problems_due: [{ id: 7, title: 'Two Sum', date: '2026-11-23' }],
  checkpoints: [{ id: 9, roadmap_id: 3, title: 'Learn SQL', date: '2026-11-27' }],
  truncated: false,
}
const note5 = { id: 5, title: 'Graphs', folder_id: null, content: 'old', updated_at: '2026-11-23T00:00:00Z', created_at: '2026-11-23T00:00:00Z' }
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const recent: RecentPage[] = [
  { id: 5, title: 'Graphs', folder_id: 2, folder_name: 'Algorithms', updated_at: ago(3 * 3600_000) },
  { id: 6, title: 'Scratch', folder_id: null, folder_name: null, updated_at: ago(1000) },
]

type Data = { decks: unknown[]; problems: unknown[]; roadmaps: unknown[]; cal: CalendarData; pages: RecentPage[] }
const full: Data = { decks, problems, roadmaps, cal: noCalendar, pages: [] }
const empty: Data = { decks: [], problems: [], roadmaps: [], cal: noCalendar, pages: [] }

// Every other endpoint answers 404 so focus views render their not-found state.
function renderPage(data: Partial<Data> = {}, { path = '/', status = 200 } = {}) {
  const d = { ...full, ...data }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const roadmap = /^\/api\/roadmaps\/(\d+)$/.exec(url)?.[1] as '3' | '4' | undefined
    if (status !== 200) return Response.json({ detail: 'Boom <b>x</b>' }, { status })
    if (url === '/api/dashboard/today') return Response.json(dashboard)
    if (url === '/api/decks') return Response.json(d.decks)
    if (url.startsWith('/api/problems?')) return Response.json(url.includes('status=due') ? d.problems : [])
    if (url === '/api/roadmaps') return Response.json(d.roadmaps)
    if (roadmap && roadmap in roadmapDetail && path === '/') return Response.json(roadmapDetail[roadmap])
    if (url.startsWith('/api/calendar?')) return Response.json(d.cal)
    if (url === '/api/notes/pages/recent?limit=20') return Response.json(d.pages)
    if (url === '/api/notes/pages' && init?.method === 'POST')
      return Response.json({ id: 42, title: 'Untitled', folder_id: null, content: '' }, { status: 201 })
    if (url === '/api/notes/folders') return Response.json([])
    if (url === '/api/notes/pages') return Response.json([note5])
    if (url === '/api/notes/pages/5') return Response.json(note5)
    if (url.startsWith('/api/review/')) return Response.json([])
    return Response.json({ detail: 'Not found' }, { status: 404 })
  })
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
const link = (scope: HTMLElement, name: string | RegExp) => within(scope).getByRole('link', { name })
const href = (scope: HTMLElement, name: string | RegExp) => link(scope, name).getAttribute('href')
const search = () => screen.getByRole('status', { name: 'search' }).textContent

test('panels render from the API: all decks, due problems, roadmap checkpoints; no page title or date', async () => {
  const fetchMock = renderPage()
  const cards = panel('Flashcards')
  expect(await within(cards).findAllByText('3 due')).toHaveLength(2)
  expect(within(cards).getByText('0 due')).toBeTruthy()
  expect(within(cards).getByRole('heading', { level: 2 }).parentElement!.textContent).toContain('3 due')
  // A deck with cards due opens its review; one without opens the deck.
  expect(href(cards, /Spanish/)).toBe('/?focus=flashcards&review=1')
  expect(href(cards, /Networking/)).toBe('/?focus=flashcards&deck=2')
  const start = link(cards, 'Start review')
  expect(start.getAttribute('href')).toBe('/?focus=flashcards&review=all')
  expect(start.getAttribute('aria-disabled')).toBeNull()

  const leet = panel('LeetCode')
  expect(fetchMock).toHaveBeenCalledWith('/api/problems?status=due', expect.anything())
  expect(href(leet, /Two Sum/)).toBe('/?focus=leetcode&problem=7')
  expect(await within(link(leet, /Two Sum/)).findByText('Overdue')).toBeTruthy()
  expect(within(link(leet, /LRU Cache/)).getByText('Today')).toBeTruthy()
  expect(within(link(leet, /LRU Cache/)).getByText('Medium')).toBeTruthy()
  expect(within(link(leet, /LRU Cache/)).getByText('Linked List')).toBeTruthy()
  expect(within(leet).getByText('2 due')).toBeTruthy()

  const road = panel('Roadmaps')
  expect(await within(road).findByText('SQL joins')).toBeTruthy()
  expect(within(road).getByRole('button', { name: 'Backend' }).getAttribute('aria-pressed')).toBe('true')
  expect(within(road).getByText('1 / 2')).toBeTruthy()
  expect(within(road).getByRole('progressbar', { name: 'Backend progress' })).toBeTruthy()
  expect((within(road).getByRole('checkbox', { name: 'HTTP basics' }) as HTMLInputElement).checked).toBe(true)
  expect(within(link(road, /HTTP basics/)).getByText('Done')).toBeTruthy()
  expect(href(road, /SQL joins/)).toBe('/?focus=roadmaps&roadmap=3')

  fireEvent.click(within(road).getByRole('button', { name: 'System design' }))
  expect(await within(road).findByText('No checkpoints yet.')).toBeTruthy()
  expect(within(road).getByText('0 / 0')).toBeTruthy()

  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  expect(screen.queryByText(/November 23/)).toBeNull()
  for (const name of ['Calendar', 'Notes']) expect(screen.getByRole('button', { name: `Expand ${name}` })).toBeTruthy()
})

test('one-column order: Flashcards, Calendar, LeetCode, Notes, Roadmaps', async () => {
  renderPage()
  const order = (name: string) => Number(getComputedStyle(panel(name).parentElement!).order)
  const names = ['Flashcards', 'Calendar', 'LeetCode', 'Notes', 'Roadmaps']
  expect(names.map(order)).toEqual([1, 2, 3, 4, 5])
})

test('mini month: dots on busy days, today agenda, day selection, month paging', async () => {
  const fetchMock = renderPage({ cal: calendar })
  const cal = panel('Calendar')
  expect(await within(cal).findByRole('link', { name: /Standup/ })).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/calendar?from=2026-11-01&to=2026-11-30', expect.anything())
  const day = (n: number) => within(cal).getByRole('button', { name: `November ${n}` })
  for (const n of [23, 24, 25, 27]) expect(day(n).getAttribute('aria-description')).toBe('Has items')
  for (const n of [22, 26]) expect(day(n).getAttribute('aria-description')).toBeNull()
  expect(day(23).getAttribute('aria-current')).toBe('date')

  expect(within(cal).getByRole('heading', { name: 'Today' })).toBeTruthy()
  expect(within(link(cal, /Standup/)).getByText('09:00')).toBeTruthy()
  expect(href(cal, /Standup/)).toBe('/?focus=calendar')
  expect(href(cal, /1 card due/)).toBe('/?focus=flashcards&review=all')
  expect(href(cal, /Two Sum/)).toBe('/?focus=leetcode&problem=7')

  // An overnight event on its second day has no start time that day.
  fireEvent.click(day(24))
  expect(within(link(cal, /Night shift/)).getByText('—')).toBeTruthy()
  expect(day(24).getAttribute('aria-pressed')).toBe('true')

  fireEvent.click(day(27))
  expect(within(cal).getByRole('heading', { name: 'Nov 27' })).toBeTruthy()
  expect(href(cal, /Learn SQL/)).toBe('/?focus=roadmaps&roadmap=3')

  fireEvent.click(day(26))
  expect(within(cal).getByText('Nothing scheduled.')).toBeTruthy()

  fireEvent.click(within(cal).getByRole('button', { name: 'Next month' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/calendar?from=2026-12-01&to=2026-12-31', expect.anything()))
  expect(within(cal).getByRole('heading', { name: 'Dec 1' })).toBeTruthy()
  expect(within(cal).getByText('December 2026')).toBeTruthy()
})

test('notes card: RECENT pages with folder and relative time; New page opens it in focus', async () => {
  const fetchMock = renderPage({ pages: recent })
  const notes = panel('Notes')
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })
  expect(await within(notes).findByText(`Algorithms · ${rtf.format(-3, 'hour')}`)).toBeTruthy()
  expect(within(notes).getByRole('heading', { name: 'Recent' })).toBeTruthy()
  expect(within(notes).getByText(`Root · ${rtf.format(0, 'second')}`)).toBeTruthy()
  expect(href(notes, /Graphs/)).toBe('/?focus=notes&page=5')

  fireEvent.click(within(notes).getByRole('button', { name: 'New page' }))
  await waitFor(() => expect(search()).toBe('?focus=notes&page=42'))
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(post[0]).toBe('/api/notes/pages')
  expect(JSON.parse(String(post[1]!.body))).toEqual({ title: 'Untitled', folder_id: null })
})

test('opening a nested view from home focuses the card title; views render no h1 of their own', async () => {
  renderPage()
  fireEvent.click(await screen.findByRole('link', { name: /Two Sum/ }))
  expect(search()).toBe('?focus=leetcode&problem=7')
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'LeetCode' }))
  expect(await screen.findByRole('heading', { name: 'Problem not found' })).toBeTruthy()
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
})

test('view actions render in the expanded card header, before the collapse button', async () => {
  renderPage({}, { path: '/?focus=leetcode' })
  const header = screen.getByRole('heading', { level: 2, name: 'LeetCode' }).parentElement!
  const add = await within(header).findByRole('button', { name: 'New problem' })
  const collapse = within(header).getByRole('button', { name: 'Collapse LeetCode' })
  expect(add.compareDocumentPosition(collapse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('empty states and Start review disabled at 0', async () => {
  renderPage(empty)
  expect(await screen.findByText('No decks yet.')).toBeTruthy()
  expect(link(panel('Flashcards'), 'Start review').getAttribute('aria-disabled')).toBe('true')
  expect(await screen.findByText('No problems due.')).toBeTruthy()
  expect(await screen.findByText('No roadmaps yet.')).toBeTruthy()
  expect(await screen.findByText('No pages yet.')).toBeTruthy()
  expect(await screen.findByText('Nothing scheduled.')).toBeTruthy()
})

test('shows errors as text', async () => {
  renderPage({}, { status: 500 })
  expect((await screen.findAllByText('500 Boom <b>x</b>')).length).toBeGreaterThan(0)
})

test('expand: the card stays and shows the view, siblings hide; collapse restores the grid and refocuses the button', async () => {
  renderPage()
  await screen.findByText('2 due')
  const expand = screen.getByRole('button', { name: 'Expand LeetCode' })
  expect(expand.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(expand)
  expect(search()).toBe('?focus=leetcode')
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'LeetCode' }))
  expect(panel('LeetCode')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Flashcards' })).toBeNull()

  const collapse = screen.getByRole('button', { name: 'Collapse LeetCode' })
  expect(collapse.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(collapse)
  expect(search()).toBe('')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Expand LeetCode' }))
  expect(panel('Flashcards')).toBeTruthy()
})

test('Escape exits focus, but not while a dialog or text field has it', async () => {
  renderPage({}, { path: '/?focus=flashcards' })
  fireEvent.click(await screen.findByRole('button', { name: 'New deck' }))
  fireEvent.keyDown(within(screen.getByRole('dialog')).getByLabelText('Title'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(search()).toBe('?focus=flashcards')

  fireEvent.keyDown(document.body, { key: 'Escape' })
  expect(search()).toBe('')
  expect(await screen.findByRole('region', { name: 'Calendar' })).toBeTruthy()
})

test('nested views render from the URL', async () => {
  const fetchMock = renderPage({}, { path: '/?focus=flashcards&deck=5' })
  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/decks/5', expect.anything())
  cleanup()

  renderPage({}, { path: '/?focus=flashcards&review=all' })
  expect(await screen.findByRole('heading', { name: 'Nothing due' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Review · All decks' })).toBeTruthy()
  cleanup()

  renderPage({}, { path: '/?focus=leetcode&problem=7' })
  expect(await screen.findByRole('heading', { name: 'Problem not found' })).toBeTruthy()
  cleanup()

  renderPage({}, { path: '/?focus=roadmaps&roadmap=3' })
  expect(await screen.findByRole('heading', { name: 'Roadmap not found' })).toBeTruthy()
  cleanup()

  renderPage({}, { path: '/?focus=calendar' })
  expect(await screen.findByRole('list', { name: 'Legend' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Collapse Calendar' })).toBeTruthy()
  cleanup()

  const notesFetch = renderPage({}, { path: '/?focus=notes&page=5' })
  expect(await screen.findByRole('tree', { name: 'Notes' })).toBeTruthy()
  await waitFor(() => expect(notesFetch).toHaveBeenCalledWith('/api/notes/pages/5', expect.anything()))
})

test('invalid ids fall back to the panel list; an unknown panel shows the grid', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '1e3', '9999999999']) {
    const fetchMock = renderPage({}, { path: `/?focus=flashcards&deck=${id}&review=${id}` })
    expect(await screen.findByRole('navigation', { name: 'Decks' })).toBeTruthy()
    await screen.findByText('Networking')
    // The bad id is never sent; the first deck (Spanish, id 1) is shown instead.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/decks/1', expect.anything()))
    const deckUrls = fetchMock.mock.calls.map(([url]) => url).filter((u) => u.startsWith('/api/decks/') || u.startsWith('/api/review/'))
    expect(deckUrls.every((u) => /^\/api\/(decks\/1(\/cards\?status=active)?|review\/cards\?deck_id=1)$/.test(u))).toBe(true)
    cleanup()
  }
  renderPage({}, { path: '/?focus=bogus' })
  expect(await screen.findByRole('button', { name: 'Expand Flashcards' })).toBeTruthy()
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
})

test('parseId accepts positive integers only', () => {
  expect(parseId('42')).toBe(42)
  for (const v of [null, '', '0', '-3', '07', '1.0', ' 1', '1x', '1234567890']) expect(parseId(v)).toBeUndefined()
})

test('double-clicking New page creates one page', async () => {
  const fetchMock = renderPage()
  const button = await within(panel('Notes')).findByRole('button', { name: 'New page' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(search()).toBe('?focus=notes&page=42'))
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test('leaving the notes view with unsaved edits asks first (collapse and Escape)', async () => {
  renderPage({}, { path: '/?focus=notes&page=5' })
  fireEvent.change(await screen.findByLabelText('Content'), { target: { value: 'draft' } })
  const confirm = vi.fn(() => false)
  vi.stubGlobal('confirm', confirm)

  fireEvent.click(screen.getByRole('button', { name: 'Collapse Notes' }))
  fireEvent.keyDown(document.body, { key: 'Escape' })
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(search()).toBe('?focus=notes&page=5')

  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Notes' }))
  expect(search()).toBe('')
})
