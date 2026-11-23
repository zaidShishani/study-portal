import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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

// Tiny in-memory API: /api/decks CRUD, deck detail, card list/create, review queue.
function mockApi(initial: Deck[], fail?: { method: string; status: number; detail: string }) {
  let decks = [...initial]
  const cards: unknown[] = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    if (fail && fail.method === method) return Response.json({ detail: fail.detail }, { status: fail.status })
    const path = url.split('?')[0]
    const id = Number(path.split('/')[3])
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (path.startsWith('/api/review/')) return Response.json([])
    if (path.endsWith('/cards')) {
      if (method === 'GET') return Response.json(cards)
      const c = { id: cards.length + 1, deck_id: id, ...body, stage: 0, due_date: null, retired_at: null }
      cards.push(c)
      return Response.json(c, { status: 201 })
    }
    if (method === 'GET' && path === '/api/decks') return Response.json(decks)
    if (method === 'GET') return Response.json(decks.find((d) => d.id === id))
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

// Focus links land on the home URL; render its query so tests can assert where they went.
const Search = () => <h1>{useLocation().search}</h1>

function renderPage(props: { deckId?: number; reviewAll?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/flashcards']}>
        <Routes>
          <Route path="/flashcards" element={<FlashcardsPage {...props} />} />
          <Route path="/" element={<Search />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const calls = (fetchMock: { mock: { calls: [string, RequestInit?][] } }, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method)

test('three panes: deck list (first selected), its cards, and its review; decks link to themselves', async () => {
  const fetchMock = mockApi([deck(1, 'Biology'), deck(2, 'History')])
  renderPage()
  const nav = await screen.findByRole('navigation', { name: 'Decks' })
  const biology = await within(nav).findByRole('link', { name: /Biology/ })
  expect(biology.getAttribute('aria-current')).toBe('page')
  expect(within(nav).getByRole('link', { name: /History/ }).getAttribute('aria-current')).toBeNull()
  expect(biology.textContent).toContain('1')
  expect(await screen.findByRole('heading', { level: 3, name: 'Biology' })).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Card filter' })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: 'Review · Biology' })).toBeTruthy()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/review/cards?deck_id=1', expect.anything()))
  fireEvent.click(within(nav).getByRole('link', { name: /History/ }))
  expect(screen.getByRole('heading', { name: '?focus=flashcards&deck=2' })).toBeTruthy()
})

test('deckId selects that deck; reviewAll reviews every deck', async () => {
  const fetchMock = mockApi([deck(1, 'Biology'), deck(2, 'History')])
  renderPage({ deckId: 2, reviewAll: true })
  const nav = await screen.findByRole('navigation', { name: 'Decks' })
  expect((await within(nav).findByRole('link', { name: /History/ })).getAttribute('aria-current')).toBe('page')
  expect(await screen.findByRole('heading', { level: 3, name: 'History' })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: 'Review · All decks' })).toBeTruthy()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/review/cards', expect.anything()))
})

test('header actions: Review all links to the all-decks review, disabled when nothing is due', async () => {
  mockApi([deck(1, 'Biology')])
  renderPage()
  const review = await screen.findByRole('link', { name: 'Review all' })
  await waitFor(() => expect(review.getAttribute('aria-disabled')).toBeNull())
  expect(review.getAttribute('href')).toBe('/?focus=flashcards&review=all')
  cleanup()

  mockApi([{ ...deck(1, 'Biology'), due_count: 0 }])
  renderPage()
  expect((await screen.findByRole('link', { name: 'Review all' })).getAttribute('aria-disabled')).toBe('true')
})

test('New card validates and creates a card in the selected deck', async () => {
  const fetchMock = mockApi([deck(1, 'Biology')])
  renderPage()
  const newCard = await screen.findByRole('button', { name: 'New card' })
  await waitFor(() => expect((newCard as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(newCard)
  const dialog = screen.getByRole('dialog')
  const save = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  save()
  expect(within(dialog).getByText('Front: Required')).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText('Front'), { target: { value: 'x'.repeat(10_001) } })
  fireEvent.change(within(dialog).getByLabelText('Back'), { target: { value: 'answer' } })
  save()
  expect(within(dialog).getByText('Front: Max 10000 characters')).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText('Front'), { target: { value: 'question' } })
  save()
  save()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const posts = calls(fetchMock, 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0][0]).toBe('/api/decks/1/cards')
  expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ front: 'question', back: 'answer' })
  expect(await screen.findByText('question')).toBeTruthy()
})

test('New card is disabled without decks', async () => {
  mockApi([])
  renderPage()
  expect(await screen.findByText(/No decks yet/)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'New card' }) as HTMLButtonElement).disabled).toBe(true)
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
  expect(await screen.findByRole('link', { name: /Chemistry/ })).toBeTruthy()
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

test('back-to-back Save clicks create only one deck', async () => {
  const fetchMock = mockApi([])
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'New deck' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Chemistry' } })
  const save = within(dialog).getByRole('button', { name: 'Save' })
  fireEvent.click(save)
  fireEvent.click(save)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
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
  expect(await screen.findByRole('link', { name: /Botany/ })).toBeTruthy()
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
  await waitFor(() => expect(screen.queryByRole('link', { name: /Biology/ })).toBeNull())
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
