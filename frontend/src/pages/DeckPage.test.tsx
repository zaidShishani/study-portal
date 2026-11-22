import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Card, Deck } from '../types'
import DeckPage from './DeckPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const deck: Deck = {
  id: 1,
  title: 'Biology',
  card_count: 2,
  due_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const card = (id: number, front: string, retired = false): Card => ({
  id,
  deck_id: 1,
  front,
  back: `back ${id}`,
  stage: retired ? 4 : 1,
  due_date: retired ? null : '2026-11-23',
  review_count: 0,
  last_reviewed_at: null,
  retired_at: retired ? '2026-11-01T00:00:00Z' : null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

// Tiny in-memory API: GET deck, list cards by status, card CRUD.
function mockApi(initial: Card[], deckDue = 1) {
  let cards = [...initial]
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    const u = new URL(url, 'http://x')
    if (u.pathname === '/api/decks/1') return Response.json({ ...deck, due_count: deckDue })
    if (u.pathname.startsWith('/api/decks/') && !u.pathname.endsWith('/cards'))
      return Response.json({ detail: 'Deck not found' }, { status: 404 })
    if (method === 'GET') {
      const status = u.searchParams.get('status')
      return Response.json(cards.filter((c) => status === 'all' || (status === 'retired') === !!c.retired_at))
    }
    if (u.pathname.endsWith('/unretire')) {
      const id = Number(u.pathname.split('/')[3])
      cards = cards.map((c) => (c.id === id ? { ...c, retired_at: null, stage: 1, due_date: '2026-11-23' } : c))
      return Response.json(cards.find((c) => c.id === id))
    }
    if (method === 'POST') {
      const c = { ...card(cards.length + 10, body.front), back: body.back }
      cards.push(c)
      return Response.json(c, { status: 201 })
    }
    const id = Number(u.pathname.split('/')[3])
    if (method === 'PATCH') {
      cards = cards.map((c) => (c.id === id ? { ...c, ...body } : c))
      return Response.json(cards.find((c) => c.id === id))
    }
    cards = cards.filter((c) => c.id !== id)
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(path = '/flashcards/1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/flashcards" element={<h1>flashcards</h1>} />
          <Route path="/flashcards/:deckId" element={<DeckPage />} />
          <Route path="/flashcards/:deckId/review" element={<h1>review</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const calls = (fetchMock: ReturnType<typeof mockApi>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method)

test('renders deck title and cards with markdown front, stage and due date', async () => {
  mockApi([card(1, '**What is ATP?**')])
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Biology' })).toBeTruthy()
  expect((await screen.findByText('What is ATP?')).tagName).toBe('STRONG')
  expect(screen.getByText('Stage 1 · Due 2026-11-23')).toBeTruthy()
  // Button labels carry a plain-text excerpt of the front (markdown stripped, capped).
  expect(screen.getByRole('button', { name: 'Edit card: What is ATP?' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Delete card: What is ATP?' })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: 'Start review (1 due)' }))
  expect(screen.getByRole('heading', { name: 'review' })).toBeTruthy()
})

test('review button is disabled when nothing is due', async () => {
  mockApi([], 0)
  renderPage()
  const btn = await screen.findByRole('link', { name: 'Start review (0 due)' })
  expect(btn.getAttribute('aria-disabled')).toBe('true')
  expect(await screen.findByText('No cards here.')).toBeTruthy()
})

test('filter switches the status query param', async () => {
  const fetchMock = mockApi([card(1, 'active one'), card(2, 'retired one', true)])
  renderPage()
  expect(await screen.findByText('active one')).toBeTruthy()
  expect(screen.queryByText('retired one')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Retired' }))
  expect(await screen.findByText('retired one')).toBeTruthy()
  expect(screen.queryByText('active one')).toBeNull()
  expect(screen.getByText('Stage 4 · Retired')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  expect(await screen.findByText('active one')).toBeTruthy()
  expect(screen.getByText('retired one')).toBeTruthy()
  const urls = calls(fetchMock, 'GET').map(([url]) => url)
  expect(urls).toContain('/api/decks/1/cards?status=active')
  expect(urls).toContain('/api/decks/1/cards?status=retired')
  expect(urls).toContain('/api/decks/1/cards?status=all')
})

test('create dialog validates and submits', async () => {
  const fetchMock = mockApi([])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'New card' }))
  const dialog = screen.getByRole('dialog')
  const save = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  save()
  expect(within(dialog).getByText('Front: Required')).toBeTruthy()
  expect(within(dialog).getByText('Back: Required')).toBeTruthy()

  fireEvent.change(within(dialog).getByLabelText('Front'), { target: { value: 'x'.repeat(10_001) } })
  fireEvent.change(within(dialog).getByLabelText('Back'), { target: { value: 'answer' } })
  save()
  expect(within(dialog).getByText('Front: Max 10000 characters')).toBeTruthy()
  expect(calls(fetchMock, 'POST')).toHaveLength(0)

  fireEvent.change(within(dialog).getByLabelText('Front'), { target: { value: 'question' } })
  save()
  expect(await screen.findByText('question')).toBeTruthy()
  const [url, init] = calls(fetchMock, 'POST')[0]
  expect(url).toBe('/api/decks/1/cards')
  expect(JSON.parse(String(init?.body))).toEqual({ front: 'question', back: 'answer' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('double-clicking Save creates only one card', async () => {
  const fetchMock = mockApi([])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'New card' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Front'), { target: { value: 'q' } })
  fireEvent.change(within(dialog).getByLabelText('Back'), { target: { value: 'a' } })
  const save = within(dialog).getByRole('button', { name: 'Save' })
  fireEvent.click(save)
  fireEvent.click(save)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(calls(fetchMock, 'POST')).toHaveLength(1)
})

test('edit prefills front and back and PATCHes the card', async () => {
  const fetchMock = mockApi([card(1, 'old front')])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit card: old front' }))
  const dialog = screen.getByRole('dialog')
  expect((within(dialog).getByLabelText('Front') as HTMLTextAreaElement).value).toBe('old front')
  expect((within(dialog).getByLabelText('Back') as HTMLTextAreaElement).value).toBe('back 1')
  fireEvent.change(within(dialog).getByLabelText('Front'), { target: { value: 'new front' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('new front')).toBeTruthy()
  expect(calls(fetchMock, 'PATCH')[0][0]).toBe('/api/cards/1')
})

test('delete asks for confirmation before calling the API', async () => {
  const fetchMock = mockApi([card(1, 'keeper'), card(2, 'doomed')])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Delete card: doomed' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(calls(fetchMock, 'DELETE')).toHaveLength(0)

  fireEvent.click(screen.getByRole('button', { name: 'Delete card: doomed' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(screen.queryByText('doomed')).toBeNull())
  expect(screen.getByText('keeper')).toBeTruthy()
  expect(calls(fetchMock, 'DELETE')[0][0]).toBe('/api/cards/2')
})

test('un-retire moves a retired card back to the active list', async () => {
  const fetchMock = mockApi([card(1, 'old news', true)])
  renderPage()
  expect(await screen.findByText('No cards here.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Un-retire/ })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Retired' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Un-retire card: old news' }))
  await waitFor(() => expect(screen.queryByText('old news')).toBeNull())
  expect(calls(fetchMock, 'POST')[0][0]).toBe('/api/cards/1/unretire')

  fireEvent.click(screen.getByRole('button', { name: 'Active' }))
  expect(await screen.findByText('old news')).toBeTruthy()
  expect(screen.getByText('Stage 1 · Due 2026-11-23')).toBeTruthy()
})

test('unknown deck shows not found with a link back', async () => {
  mockApi([])
  renderPage('/flashcards/999')
  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: 'Back to flashcards' }))
  expect(screen.getByRole('heading', { name: 'flashcards' })).toBeTruthy()
})
