import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Problem } from '../types'
import LeetCodePage from './LeetCodePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const today = new Date().toLocaleDateString('en-CA')

const problem = (id: number, title: string, extra: Partial<Problem> = {}): Problem => ({
  id,
  title,
  link: `https://leetcode.com/problems/${id}`,
  difficulty: 'Medium',
  pattern: 'DP',
  key_insight: null,
  notes: null,
  minutes: null,
  last_result: null,
  solved_date: null,
  review_count: 2,
  stage: 1,
  due_date: '2999-01-01',
  retired_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...extra,
})

// Tiny in-memory /api/problems so mutations + refetch behave like the real API (filters ignored).
function mockApi(initial: Problem[], fail?: { method: string; status: number; detail: string }) {
  let problems = [...initial]
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    if (fail && fail.method === method) return Response.json({ detail: fail.detail }, { status: fail.status })
    const id = Number(url.split(/[/?]/)[3])
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (method === 'GET') return Response.json(problems)
    if (method === 'POST') {
      const p = problem(problems.length + 10, body.title, body)
      problems.push(p)
      return Response.json(p, { status: 201 })
    }
    if (method === 'PATCH') {
      problems = problems.map((p) => (p.id === id ? { ...p, ...body } : p))
      return Response.json(problems.find((p) => p.id === id))
    }
    problems = problems.filter((p) => p.id !== id)
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Focus links land on the home URL; render its query so tests can assert where they went.
const Search = () => <h1>{useLocation().search}</h1>

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/leetcode']}>
        <Routes>
          <Route path="/leetcode" element={<LeetCodePage />} />
          <Route path="/" element={<Search />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

type FetchMock = { mock: { calls: [string, RequestInit?][] } }
const calls = (fetchMock: FetchMock, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method)
const lastQuery = (fetchMock: FetchMock) => {
  const gets = calls(fetchMock, 'GET')
  return Object.fromEntries(new URL(gets[gets.length - 1][0], 'http://x').searchParams)
}

async function openNewDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'New problem' }))
  return screen.getByRole('dialog')
}

function fillRequired(dialog: HTMLElement, title = 'Two Sum') {
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: title } })
  fireEvent.change(within(dialog).getByLabelText('Difficulty'), { target: { value: 'Easy' } })
  fireEvent.change(within(dialog).getByLabelText('Pattern'), { target: { value: 'Two Pointers' } })
}

test('renders problems with safe external links, due marks and row navigation', async () => {
  mockApi([
    problem(1, 'Two Sum', { due_date: '2000-01-01' }),
    problem(2, 'Climbing Stairs', { due_date: today }),
    problem(3, 'Evil', { link: 'javascript:alert(1)' }),
  ])
  renderPage()
  const external = await screen.findByRole('link', { name: 'Open Two Sum on LeetCode' })
  expect(external.getAttribute('href')).toBe('https://leetcode.com/problems/1')
  expect(external.getAttribute('target')).toBe('_blank')
  expect(external.getAttribute('rel')).toBe('noopener noreferrer')
  const row = (name: string) => screen.getByRole('link', { name }).closest('li')!
  expect(within(row('Two Sum')).getByText('Overdue')).toBeTruthy()
  expect(within(row('Climbing Stairs')).getByText('Today')).toBeTruthy()
  expect(within(row('Evil')).queryByText(/Today|Overdue/)).toBeNull()
  expect(within(row('Two Sum')).getByText('Medium')).toBeTruthy()
  // javascript: link gets no external anchor.
  expect(screen.queryByRole('link', { name: 'Open Evil on LeetCode' })).toBeNull()
  expect(document.querySelector('a[href^="javascript"]')).toBeNull()

  fireEvent.click(screen.getByRole('link', { name: 'Evil' }))
  expect(screen.getByRole('heading', { name: '?focus=leetcode&problem=3' })).toBeTruthy()
})

test('shows empty state', async () => {
  mockApi([])
  renderPage()
  expect(await screen.findByText('No problems match these filters.')).toBeTruthy()
})

test('filters change the query params', async () => {
  const fetchMock = mockApi([])
  renderPage()
  await waitFor(() => expect(lastQuery(fetchMock)).toEqual({ status: 'active' }))

  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'Hard' } })
  await waitFor(() => expect(lastQuery(fetchMock)).toEqual({ status: 'active', difficulty: 'Hard' }))

  fireEvent.change(screen.getByLabelText('Pattern'), { target: { value: 'Union Find' } })
  await waitFor(() =>
    expect(lastQuery(fetchMock)).toEqual({ status: 'active', difficulty: 'Hard', pattern: 'Union Find' }),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Due' }))
  await waitFor(() => expect(lastQuery(fetchMock).status).toBe('due'))
  fireEvent.click(screen.getByRole('button', { name: 'Retired' }))
  await waitFor(() => expect(lastQuery(fetchMock).status).toBe('retired'))
  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  await waitFor(() => expect(lastQuery(fetchMock).status).toBe('all'))

  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '' } })
  await waitFor(() => expect(lastQuery(fetchMock)).toEqual({ status: 'all', pattern: 'Union Find' }))
})

test('dialog validates fields and submits a trimmed problem', async () => {
  const fetchMock = mockApi([])
  renderPage()
  const dialog = await openNewDialog()
  const save = within(dialog).getByRole('button', { name: 'Save' })

  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: '   ' } })
  fireEvent.click(save)
  expect(within(dialog).getByText('Title is required')).toBeTruthy()
  expect(within(dialog).getByText('Difficulty is required')).toBeTruthy()
  expect(within(dialog).getByText('Pattern is required')).toBeTruthy()

  fillRequired(dialog, 'x'.repeat(256))
  fireEvent.click(save)
  expect(within(dialog).getByText('Max 255 characters')).toBeTruthy()

  fireEvent.change(within(dialog).getByLabelText('Link'), { target: { value: 'javascript:alert(1)' } })
  fireEvent.change(within(dialog).getByLabelText('Minutes'), { target: { value: '1441' } })
  fireEvent.change(within(dialog).getByLabelText('Key insight'), { target: { value: 'x'.repeat(10_001) } })
  fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'x'.repeat(10_001) } })
  fireEvent.click(save)
  expect(within(dialog).getByText('Enter an http(s) URL')).toBeTruthy()
  expect(within(dialog).getByText('Whole minutes, 0–1440')).toBeTruthy()
  expect(within(dialog).getAllByText('Max 10,000 characters')).toHaveLength(2)
  fireEvent.change(within(dialog).getByLabelText('Key insight'), { target: { value: '' } })
  expect(calls(fetchMock, 'POST')).toHaveLength(0)

  fillRequired(dialog, '  Two Sum  ')
  fireEvent.change(within(dialog).getByLabelText('Link'), { target: { value: 'https://leetcode.com/problems/two-sum/' } })
  fireEvent.change(within(dialog).getByLabelText('Minutes'), { target: { value: '1440' } })
  fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: '# hash map' } })
  fireEvent.click(save)
  expect(await screen.findByRole('link', { name: 'Open Two Sum on LeetCode' })).toBeTruthy()
  expect(JSON.parse(String(calls(fetchMock, 'POST')[0][1]?.body))).toEqual({
    title: 'Two Sum',
    link: 'https://leetcode.com/problems/two-sum/',
    difficulty: 'Easy',
    pattern: 'Two Pointers',
    minutes: 1440,
    key_insight: null,
    notes: '# hash map',
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('two back-to-back Save clicks send one POST', async () => {
  const fetchMock = mockApi([])
  renderPage()
  const dialog = await openNewDialog()
  fillRequired(dialog)
  const save = within(dialog).getByRole('button', { name: 'Save' })
  fireEvent.click(save)
  fireEvent.click(save)
  expect(await screen.findByText('Two Sum')).toBeTruthy()
  expect(calls(fetchMock, 'POST')).toHaveLength(1)
})

test('Save is disabled while a create is pending, so double-submit sends one POST', async () => {
  const api = mockApi([])
  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') await held
    return api(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  const dialog = await openNewDialog()
  fillRequired(dialog)
  const save = within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement
  fireEvent.click(save)
  await waitFor(() => expect(save.disabled).toBe(true))
  fireEvent.click(save)
  fireEvent.submit(save.closest('form')!)
  release()
  expect(await screen.findByText('Two Sum')).toBeTruthy()
  expect(calls(fetchMock, 'POST')).toHaveLength(1)
})

test('edit prefills the dialog and PATCHes the problem', async () => {
  const fetchMock = mockApi([problem(1, 'Two Sum', { minutes: 25, notes: 'use a map' })])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Two Sum' }))
  const dialog = screen.getByRole('dialog')
  expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe('Two Sum')
  expect((within(dialog).getByLabelText('Difficulty') as HTMLSelectElement).value).toBe('Medium')
  expect((within(dialog).getByLabelText('Pattern') as HTMLSelectElement).value).toBe('DP')
  expect((within(dialog).getByLabelText('Minutes') as HTMLInputElement).value).toBe('25')
  expect((within(dialog).getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('use a map')
  expect(screen.queryByRole('heading', { name: /focus=/ })).toBeNull()

  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Three Sum' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Three Sum')).toBeTruthy()
  const [url, init] = calls(fetchMock, 'PATCH')[0]
  expect(url).toBe('/api/problems/1')
  expect(JSON.parse(String(init?.body))).toMatchObject({ title: 'Three Sum', minutes: 25, notes: 'use a map' })
})

test('delete asks for confirmation before calling the API', async () => {
  const fetchMock = mockApi([problem(1, 'Two Sum')])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Two Sum' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(calls(fetchMock, 'DELETE')).toHaveLength(0)

  fireEvent.click(screen.getByRole('button', { name: 'Delete Two Sum' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(screen.queryByText('Two Sum')).toBeNull())
  expect(calls(fetchMock, 'DELETE')[0][0]).toBe('/api/problems/1')
})

test('API errors show a snackbar', async () => {
  mockApi([problem(1, 'Two Sum')], { method: 'DELETE', status: 404, detail: 'Problem not found' })
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Two Sum' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText('404 Problem not found')).toBeTruthy()
})
