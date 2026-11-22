import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Problem } from '../types'
import ProblemPage from './ProblemPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base: Problem = {
  id: 7,
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum',
  difficulty: 'Easy',
  pattern: 'Two Pointers',
  key_insight: 'Use a **hash map**',
  notes: 'Some notes',
  minutes: 12,
  last_result: null,
  solved_date: null,
  review_count: 0,
  stage: 0,
  due_date: '2026-11-22',
  retired_at: null,
  created_at: '2026-11-22T00:00:00Z',
  updated_at: '2026-11-22T00:00:00Z',
}

// In-memory /api/problems/7; attempt applies a fixed fake result so the page update is visible.
function mockApi(initial: Problem | null, hold?: Promise<void>) {
  let problem = initial
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (!problem) return Response.json({ detail: 'Problem not found' }, { status: 404 })
    if (init.method === 'DELETE') return new Response(null, { status: 204 })
    if (url.endsWith('/attempt')) {
      await hold
      const body = JSON.parse(String(init.body))
      problem = { ...problem, last_result: body.result, minutes: body.minutes ?? problem.minutes, stage: 1, due_date: '2026-11-23', review_count: problem.review_count + 1 }
    } else if (url.endsWith('/unretire')) {
      problem = { ...problem, retired_at: null, stage: 1, due_date: '2026-11-23' }
    }
    return Response.json(problem)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(path = '/leetcode/7') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/leetcode" element={<h1>problem list</h1>} />
          <Route path="/leetcode/:problemId" element={<ProblemPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const detail = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
const posts = (fetchMock: ReturnType<typeof mockApi>, suffix: string) =>
  fetchMock.mock.calls.filter(([url, init]) => init?.method === 'POST' && url.endsWith(suffix))

async function logAttempt(result: string, minutes?: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Log attempt' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByLabelText(result))
  if (minutes) fireEvent.change(within(dialog).getByLabelText('Minutes (optional)'), { target: { value: minutes } })
  return within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement
}

test('renders problem details, safe link and markdown', async () => {
  mockApi(base)
  renderPage()
  const link = await screen.findByRole('link', { name: 'Two Sum' })
  expect(link.getAttribute('href')).toBe('https://leetcode.com/problems/two-sum')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(screen.getByText('Easy')).toBeTruthy()
  expect(detail('Pattern')).toBe('Two Pointers')
  expect(detail('Stage')).toBe('0')
  expect(detail('Next due')).toBe('2026-11-22')
  expect(detail('Minutes')).toBe('12')
  expect(screen.getByText('hash map').tagName).toBe('STRONG')
  expect(screen.getByText('Some notes')).toBeTruthy()
})

test('non-http link renders as plain title', async () => {
  mockApi({ ...base, link: 'javascript:alert(1)' })
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Two Sum' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Two Sum' })).toBeNull()
})

test('attempt dialog validates, submits result + minutes and the page updates', async () => {
  const fetchMock = mockApi(base)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Log attempt' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(within(dialog).getByText('Choose a result')).toBeTruthy()
  fireEvent.click(within(dialog).getByLabelText('Failed'))
  fireEvent.change(within(dialog).getByLabelText('Minutes (optional)'), { target: { value: '1441' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(within(dialog).getByText('Whole minutes, 0–1440')).toBeTruthy()
  expect(posts(fetchMock, '/attempt')).toHaveLength(0)

  fireEvent.change(within(dialog).getByLabelText('Minutes (optional)'), { target: { value: '25' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(detail('Stage')).toBe('1'))
  expect(detail('Next due')).toBe('2026-11-23')
  expect(detail('Last result')).toBe('Failed')
  expect(detail('Minutes')).toBe('25')
  const [url, init] = posts(fetchMock, '/attempt')[0]
  expect(url).toBe('/api/problems/7/attempt')
  expect(JSON.parse(String(init?.body))).toEqual({ result: 'failed', minutes: 25 })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('omitted minutes are sent as null', async () => {
  const fetchMock = mockApi(base)
  renderPage()
  fireEvent.click(await logAttempt('Solved with hint'))
  await waitFor(() => expect(posts(fetchMock, '/attempt')).toHaveLength(1))
  expect(JSON.parse(String(posts(fetchMock, '/attempt')[0][1]?.body))).toEqual({ result: 'solved_with_hint', minutes: null })
})

test('double-clicking Save sends one attempt', async () => {
  let release = () => {}
  const fetchMock = mockApi(base, new Promise<void>((r) => (release = r)))
  renderPage()
  const save = await logAttempt('Solved')
  fireEvent.click(save)
  fireEvent.click(save)
  fireEvent.submit(save.closest('form')!)
  release()
  await waitFor(() => expect(detail('Stage')).toBe('1'))
  expect(posts(fetchMock, '/attempt')).toHaveLength(1)
})

test('retired problem shows Retired and can be un-retired', async () => {
  const fetchMock = mockApi({ ...base, stage: 4, due_date: null, retired_at: '2026-11-22T00:00:00Z' })
  renderPage()
  expect(await screen.findByText('Retired')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Log attempt' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Un-retire' }))
  expect(await screen.findByRole('button', { name: 'Log attempt' })).toBeTruthy()
  expect(detail('Next due')).toBe('2026-11-23')
  expect(posts(fetchMock, '/unretire')[0][0]).toBe('/api/problems/7/unretire')
})

test('double-clicking Un-retire sends one POST', async () => {
  const fetchMock = mockApi({ ...base, stage: 4, due_date: null, retired_at: '2026-11-22T00:00:00Z' })
  renderPage()
  const button = await screen.findByRole('button', { name: 'Un-retire' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(await screen.findByRole('button', { name: 'Log attempt' })).toBeTruthy()
  expect(posts(fetchMock, '/unretire')).toHaveLength(1)
})

test('unknown problem shows not found', async () => {
  mockApi(null)
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Problem not found' })).toBeTruthy()
})

test('attempt error shows a snackbar', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/attempt')
        ? Response.json({ detail: 'Problem is retired' }, { status: 409 })
        : Response.json(base),
    ),
  )
  renderPage()
  fireEvent.click(await logAttempt('Solved'))
  expect(await screen.findByText('409 Problem is retired')).toBeTruthy()
})

test('delete asks for confirmation then returns to the list', async () => {
  const fetchMock = mockApi(base)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByRole('heading', { name: 'problem list' })).toBeTruthy()
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
  // The deleted detail is not refetched.
  expect(fetchMock.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(1)
})
