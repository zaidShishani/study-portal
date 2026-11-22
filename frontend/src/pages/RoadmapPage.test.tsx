import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Checkpoint } from '../types'
import RoadmapPage from './RoadmapPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const cp = (id: number, title: string, extra: Partial<Checkpoint> = {}): Checkpoint => ({
  id,
  roadmap_id: 1,
  position: id,
  title,
  description: null,
  target_date: null,
  done_at: null,
  ...extra,
})

// In-memory roadmap 1; any other id is a 404. `hold` keeps writes pending until released.
function mockApi(initial: Checkpoint[], hold?: Promise<void>) {
  let checkpoints = [...initial]
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (method !== 'GET') await hold
    if (method === 'GET') {
      if (url !== '/api/roadmaps/1') return Response.json({ detail: 'Roadmap not found' }, { status: 404 })
      return Response.json({
        id: 1,
        title: 'Backend',
        description: null,
        done_count: checkpoints.filter((c) => c.done_at).length,
        total_count: checkpoints.length,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        checkpoints,
      })
    }
    if (method === 'PATCH') {
      const id = Number(url.split('/').pop())
      checkpoints = checkpoints.map((c) => (c.id === id ? { ...c, done_at: body.done ? '2026-01-02T00:00:00Z' : null } : c))
      return Response.json(checkpoints.find((c) => c.id === id))
    }
    if (method === 'PUT') {
      checkpoints = body.ids.map((id: number) => checkpoints.find((c) => c.id === id))
      return Response.json(checkpoints)
    }
    const created = cp(99, body.title, body)
    checkpoints.push(created)
    return Response.json(created, { status: 201 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(path = '/roadmaps/1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/roadmaps/:roadmapId" element={<RoadmapPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const calls = (fetchMock: { mock: { calls: [string, RequestInit?][] } }, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method)
const bodyOf = (call: [string, RequestInit?]) => JSON.parse(String(call[1]?.body))
const titles = () => screen.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)

test('toggling a checkbox PATCHes done once and progress updates', async () => {
  let release = () => {}
  const fetchMock = mockApi([cp(1, 'Learn SQL'), cp(2, 'Learn HTTP'), cp(3, 'Learn Docker')], new Promise<void>((r) => (release = r)))
  renderPage()
  const box = await screen.findByRole('checkbox', { name: 'Done: Learn SQL' })
  expect(screen.getByText('0/3 · 0%')).toBeTruthy()
  fireEvent.click(box)
  fireEvent.click(box) // same tick: only the ref guard can block this one
  await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(true))
  release()
  expect(await screen.findByText('1/3 · 33%')).toBeTruthy()
  expect(calls(fetchMock, 'PATCH')).toHaveLength(1)
  expect(calls(fetchMock, 'PATCH')[0][0]).toBe('/api/checkpoints/1')
  expect(bodyOf(calls(fetchMock, 'PATCH')[0])).toEqual({ done: true })
  expect((screen.getByRole('checkbox', { name: 'Done: Learn SQL' }) as HTMLInputElement).checked).toBe(true)
})

test('move up / move down PUT the swapped order', async () => {
  const fetchMock = mockApi([cp(1, 'A'), cp(2, 'B'), cp(3, 'C')])
  renderPage()
  await screen.findByText('A')
  expect((screen.getByRole('button', { name: 'Move up: A' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Move down: C' }) as HTMLButtonElement).disabled).toBe(true)

  fireEvent.click(screen.getByRole('button', { name: 'Move up: C' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move up: C' })) // double click: one PUT
  await waitFor(() => expect(titles()).toEqual(['A', 'C', 'B']))
  expect(calls(fetchMock, 'PUT')).toHaveLength(1)
  expect(calls(fetchMock, 'PUT')[0][0]).toBe('/api/roadmaps/1/checkpoints/order')
  expect(bodyOf(calls(fetchMock, 'PUT')[0])).toEqual({ ids: [1, 3, 2] })

  await waitFor(() => expect((screen.getByRole('button', { name: 'Move down: A' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Move down: A' }))
  await waitFor(() => expect(titles()).toEqual(['C', 'A', 'B']))
  expect(bodyOf(calls(fetchMock, 'PUT')[1])).toEqual({ ids: [3, 1, 2] })
})

test('highlights only not-done checkpoints whose target date is past; description is plain text', async () => {
  mockApi([
    cp(1, 'Late', { target_date: '2000-01-01', description: 'line one\n**not bold**' }),
    cp(2, 'Late but done', { target_date: '2000-01-01', done_at: '2000-01-02T00:00:00Z' }),
    cp(3, 'Future', { target_date: '2999-01-01' }),
  ])
  renderPage()
  expect(await screen.findByText('Overdue · target 2000-01-01')).toBeTruthy()
  expect(screen.getAllByText(/^Overdue/)).toHaveLength(1)
  expect(screen.getByText('Target 2000-01-01')).toBeTruthy()
  expect(screen.getByText('Target 2999-01-01')).toBeTruthy()
  // Rendered verbatim (newline kept, markdown not parsed).
  expect(screen.getByText((_, el) => el?.textContent === 'line one\n**not bold**' && el.tagName === 'P')).toBeTruthy()
})

test('new checkpoint dialog POSTs title, description and empty date', async () => {
  const fetchMock = mockApi([])
  renderPage()
  expect(await screen.findByText('No checkpoints yet.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'New checkpoint' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(within(dialog).getByText('Title is required')).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: ' Ship it ' } })
  fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'a\nb' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Ship it')).toBeTruthy()
  expect(calls(fetchMock, 'POST')[0][0]).toBe('/api/roadmaps/1/checkpoints')
  expect(bodyOf(calls(fetchMock, 'POST')[0])).toEqual({ title: 'Ship it', description: 'a\nb', target_date: null })
})

test('shows not-found for an unknown roadmap', async () => {
  mockApi([])
  renderPage('/roadmaps/42')
  expect(await screen.findByRole('heading', { name: 'Roadmap not found' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Back to roadmaps' }).getAttribute('href')).toBe('/roadmaps')
})
