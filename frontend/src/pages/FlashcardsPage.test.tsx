import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Deck } from '../types'
import FlashcardsPage from './FlashcardsPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const deck = (id: number, title: string): Deck => ({
  id,
  title,
  card_count: 3,
  due_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

// Tiny in-memory /api/decks so mutations + refetch behave like the real API.
function mockApi(initial: Deck[], fail?: { method: string; status: number; detail: string }) {
  let decks = [...initial]
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    if (fail && fail.method === method) return Response.json({ detail: fail.detail }, { status: fail.status })
    const id = Number(url.split('/')[3])
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (method === 'GET') return Response.json(decks)
    if (method === 'POST') {
      const d = deck(decks.length + 10, body.title)
      decks.push(d)
      return Response.json(d, { status: 201 })
    }
    if (method === 'PATCH') {
      decks = decks.map((d) => (d.id === id ? { ...d, title: body.title } : d))
      return Response.json(decks.find((d) => d.id === id))
    }
    decks = decks.filter((d) => d.id !== id)
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/flashcards']}>
        <Routes>
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/flashcards/:deckId" element={<h1>deck page</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const calls = (fetchMock: { mock: { calls: [string, RequestInit?][] } }, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method)

test('renders decks from the API with counts and links to the deck', async () => {
  mockApi([deck(1, 'Biology'), deck(2, 'History')])
  renderPage()
  expect(await screen.findByText('Biology')).toBeTruthy()
  expect(screen.getByText('History')).toBeTruthy()
  expect(screen.getAllByText('3 cards · 1 due')).toHaveLength(2)
  fireEvent.click(screen.getByText('Biology'))
  expect(screen.getByRole('heading', { name: 'deck page' })).toBeTruthy()
})

test('shows empty state when there are no decks', async () => {
  mockApi([])
  renderPage()
  expect(await screen.findByText(/No decks yet/)).toBeTruthy()
})

test('create dialog validates, trims and submits', async () => {
  const fetchMock = mockApi([])
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'New deck' }))
  const dialog = screen.getByRole('dialog')
  const input = within(dialog).getByLabelText('Title')

  fireEvent.change(input, { target: { value: '   ' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(within(dialog).getByText('Title is required')).toBeTruthy()

  fireEvent.change(input, { target: { value: 'x'.repeat(201) } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(within(dialog).getByText('Max 200 characters')).toBeTruthy()
  expect(calls(fetchMock, 'POST')).toHaveLength(0)

  fireEvent.change(input, { target: { value: '  Chemistry  ' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Chemistry')).toBeTruthy()
  expect(JSON.parse(String(calls(fetchMock, 'POST')[0][1]?.body))).toEqual({ title: 'Chemistry' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('Save is disabled while a create is pending, so double-submit sends one POST', async () => {
  const api = mockApi([])
  // Hold the POST open so the pending state is observable.
  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') await held
    return api(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'New deck' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Chemistry' } })
  const save = within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement
  fireEvent.click(save)
  await waitFor(() => expect(save.disabled).toBe(true))
  fireEvent.click(save)
  fireEvent.submit(save.closest('form')!)
  release()
  expect(await screen.findByText('Chemistry')).toBeTruthy()
  expect(calls(fetchMock, 'POST')).toHaveLength(1)
})

test('rename prefills the title and PATCHes the deck', async () => {
  const fetchMock = mockApi([deck(1, 'Biology')])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Rename Biology' }))
  const input = within(screen.getByRole('dialog')).getByLabelText('Title') as HTMLInputElement
  expect(input.value).toBe('Biology')
  fireEvent.change(input, { target: { value: 'Botany' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Botany')).toBeTruthy()
  expect(calls(fetchMock, 'PATCH')[0][0]).toBe('/api/decks/1')
})

test('delete asks for confirmation before calling the API', async () => {
  const fetchMock = mockApi([deck(1, 'Biology')])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Biology' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(calls(fetchMock, 'DELETE')).toHaveLength(0)

  fireEvent.click(screen.getByRole('button', { name: 'Delete Biology' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(screen.queryByText('Biology')).toBeNull())
  expect(calls(fetchMock, 'DELETE')[0][0]).toBe('/api/decks/1')
})

test('API errors show a snackbar', async () => {
  mockApi([deck(1, 'Biology')], { method: 'DELETE', status: 404, detail: 'Deck not found' })
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Biology' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText('404 Deck not found')).toBeTruthy()
})

test('list load error shows a snackbar', async () => {
  mockApi([], { method: 'GET', status: 500, detail: 'boom' })
  renderPage()
  expect(await screen.findByText('500 boom')).toBeTruthy()
})
