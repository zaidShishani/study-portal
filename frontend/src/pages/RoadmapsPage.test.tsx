import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Roadmap } from '../types'
import RoadmapsPage from './RoadmapsPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const roadmap = (id: number, title: string, done = 0, total = 0): Roadmap => ({
  id,
  title,
  description: null,
  done_count: done,
  total_count: total,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

// Tiny in-memory /api/roadmaps; `hold` keeps POSTs pending until released.
function mockApi(initial: Roadmap[], hold?: Promise<void>) {
  const roadmaps = [...initial]
  const fetchMock = vi.fn(async (_url: string, init: RequestInit = {}) => {
    if (init.method === 'POST') {
      await hold
      const r = roadmap(roadmaps.length + 10, JSON.parse(String(init.body)).title)
      roadmaps.push(r)
      return Response.json({ ...r, checkpoints: [] }, { status: 201 })
    }
    return Response.json(roadmaps)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RoadmapsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const posts = (fetchMock: { mock: { calls: [string, RequestInit?][] } }) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')

test('lists roadmaps with done/total progress', async () => {
  mockApi([roadmap(1, 'Backend', 1, 3), roadmap(2, 'Empty')])
  renderPage()
  expect(await screen.findByText('Backend')).toBeTruthy()
  expect(screen.getByText('1/3 · 33%')).toBeTruthy()
  expect(screen.getByRole('progressbar', { name: 'Progress 1/3 · 33%' }).getAttribute('aria-valuenow')).toBe('33')
  expect(screen.getByText('0/0 · 0%')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Backend/ }).getAttribute('href')).toBe('/?focus=roadmaps&roadmap=1')
})

test('shows empty state when there are no roadmaps', async () => {
  mockApi([])
  renderPage()
  expect(await screen.findByText(/No roadmaps yet/)).toBeTruthy()
})

test('create dialog trims, submits once on double click, then closes', async () => {
  let release = () => {}
  const fetchMock = mockApi([], new Promise<void>((r) => (release = r)))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'New roadmap' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: '  Frontend  ' } })
  const save = within(dialog).getByRole('button', { name: 'Save' })
  fireEvent.click(save)
  fireEvent.click(save) // same tick: only the busy ref can block this one
  await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(true))
  release()
  expect(await screen.findByText('Frontend')).toBeTruthy()
  expect(posts(fetchMock)).toHaveLength(1)
  expect(JSON.parse(String(posts(fetchMock)[0][1]?.body))).toEqual({ title: 'Frontend' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
