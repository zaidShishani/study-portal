import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import dayjs from 'dayjs'
import type { Card, Deck } from '../types'
import DeckPage from './DeckPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const today = dayjs().format('YYYY-MM-DD')

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
  due_date: retired ? null : today,
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
      cards = cards.map((c) => (c.id === id ? { ...c, retired_at: null, stage: 1, due_date: today } : c))
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

// Focus links land on the home URL; render its query so tests can assert where they went.
const Search = () => <h1>{useLocation().search}</h1>

function renderPage(deckId = 1) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/deck']}>
        <Routes>
          <Route path="/deck" element={<DeckPage deckId={deckId} />} />
          <Route path="/" element={<Search />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const calls = (fetchMock: ReturnType<typeof mockApi>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method)

test('renders the deck title row and two-line card rows: plain front, back, due label', async () => {
  mockApi([card(1, '**What is ATP?**'), { ...card(2, 'Later'), due_date: dayjs().add(3, 'day').format('YYYY-MM-DD') }])
  renderPage()
  expect(await screen.findByRole('heading', { level: 3, name: 'Biology' })).toBeTruthy()
  expect(screen.getByText('2 cards')).toBeTruthy()
  expect(await screen.findByText('What is ATP?')).toBeTruthy()
  expect(screen.queryByText(/\*\*/)).toBeNull()
  expect(screen.getByText('back 1')).toBeTruthy()
  expect(screen.getByText('Due today')).toBeTruthy()
  expect(screen.getByText('In 3 days')).toBeTruthy()
  // Button labels carry a plain-text excerpt of the front (markdown stripped, capped).
  expect(screen.getByRole('button', { name: 'Edit card: What is ATP?' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Delete card: What is ATP?' })).toBeTruthy()
})

test('empty deck says so', async () => {
  mockApi([], 0)
  renderPage()
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
  expect(screen.getByText('Retired', { selector: 'p' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  expect(await screen.findByText('active one')).toBeTruthy()
  expect(screen.getByText('retired one')).toBeTruthy()
  const urls = calls(fetchMock, 'GET').map(([url]) => url)
  expect(urls).toContain('/api/decks/1/cards?status=active')
  expect(urls).toContain('/api/decks/1/cards?status=retired')
  expect(urls).toContain('/api/decks/1/cards?status=all')
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
  expect(screen.getByText('Due today')).toBeTruthy()
})

test('double-clicking Un-retire sends one POST', async () => {
  const fetchMock = mockApi([card(1, 'old news', true)])
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Retired' }))
  const btn = await screen.findByRole('button', { name: 'Un-retire card: old news' })
  fireEvent.click(btn)
  fireEvent.click(btn)
  await waitFor(() => expect(screen.queryByText('old news')).toBeNull())
  expect(calls(fetchMock, 'POST')).toHaveLength(1)
})

test('unknown deck shows not found with a link back', async () => {
  mockApi([])
  renderPage(999)
  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: 'Back to flashcards' }))
  expect(screen.getByRole('heading', { name: '?focus=flashcards' })).toBeTruthy()
})
