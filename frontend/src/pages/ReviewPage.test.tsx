import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import type { Card } from '../types'
import ReviewPage from './ReviewPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const card = (id: number, front: string, back: string): Card => ({
  id,
  deck_id: 1,
  front,
  back,
  stage: 0,
  due_date: '2026-11-22',
  review_count: 0,
  last_reviewed_at: null,
  retired_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

function mockApi(queue: Card[], conflictId?: number) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') === 'GET') return Response.json(queue)
    const id = Number(url.split('/')[3])
    if (id === conflictId) return Response.json({ detail: 'Card is not due' }, { status: 409 })
    return Response.json({ ...queue.find((c) => c.id === id), stage: 1 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(deckId: number | 'all' = 1) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ReviewPage deckId={deckId === 'all' ? undefined : deckId} title={deckId === 'all' ? 'All decks' : 'Biology'} />
    </QueryClientProvider>,
  )
  return client
}

const posts = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => [url, JSON.parse(String(init?.body))])

test('flip then answer calls the API and advances', async () => {
  const fetchMock = mockApi([card(1, 'Q one', '**A one**'), card(2, 'Q two', 'A two')])
  renderPage()
  expect(await screen.findByText('Q one')).toBeTruthy()
  expect(screen.getByText('1 of 2')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Review · Biology' })).toBeTruthy()
  expect(screen.getByRole('progressbar', { name: 'Review progress' }).getAttribute('aria-valuenow')).toBe('0')
  expect(screen.queryByText('A one')).toBeNull()
  expect(fetchMock.mock.calls[0][0]).toBe('/api/review/cards?deck_id=1')

  fireEvent.click(screen.getByRole('button', { name: 'Show answer Space' }))
  expect(screen.getByText('A one').tagName).toBe('STRONG')
  fireEvent.click(screen.getByRole('button', { name: 'Right 2' }))

  expect(await screen.findByText('Q two')).toBeTruthy()
  expect(screen.getByText('2 of 2')).toBeTruthy()
  expect(screen.getByRole('progressbar', { name: 'Review progress' }).getAttribute('aria-valuenow')).toBe('50')
  expect(screen.queryByText('A two')).toBeNull()
  expect(posts(fetchMock)).toEqual([['/api/cards/1/review', { correct: true }]])

  fireEvent.click(screen.getByRole('button', { name: 'Show answer Space' }))
  fireEvent.click(screen.getByRole('button', { name: 'Wrong 1' }))
  expect(await screen.findByText('Done! Reviewed 2 cards.')).toBeTruthy()
  expect(posts(fetchMock)[1]).toEqual(['/api/cards/2/review', { correct: false }])
  // The queue is fetched once per session.
  expect(fetchMock.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(1)
})

test('keyboard: Space flips, 1 = Wrong, 2 = Right, ignored before flip and double presses', async () => {
  const fetchMock = mockApi([card(1, 'Q one', 'A one'), card(2, 'Q two', 'A two')])
  renderPage()
  expect(await screen.findByText('Q one')).toBeTruthy()

  fireEvent.keyDown(window, { key: '2' })
  expect(posts(fetchMock)).toHaveLength(0)

  fireEvent.keyDown(window, { key: ' ' })
  expect(screen.getByText('A one')).toBeTruthy()
  fireEvent.keyDown(window, { key: '2' })
  fireEvent.keyDown(window, { key: '2' })
  expect(await screen.findByText('Q two')).toBeTruthy()
  expect(posts(fetchMock)).toEqual([['/api/cards/1/review', { correct: true }]])

  fireEvent.keyDown(window, { key: ' ' })
  fireEvent.keyDown(window, { key: '1' })
  expect(await screen.findByText('Done! Reviewed 2 cards.')).toBeTruthy()
  expect(posts(fetchMock)[1]).toEqual(['/api/cards/2/review', { correct: false }])
})

test('shortcuts are ignored while typing in an input', async () => {
  mockApi([card(1, 'Q one', 'A one')])
  renderPage()
  expect(await screen.findByText('Q one')).toBeTruthy()
  const input = document.createElement('input')
  document.body.appendChild(input)
  fireEvent.keyDown(input, { key: ' ' })
  expect(screen.queryByText('A one')).toBeNull()
  input.remove()
})

test('shortcuts leave a focused button alone', async () => {
  mockApi([card(1, 'Q one', 'A one')])
  renderPage()
  expect(await screen.findByText('Q one')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Show answer Space' }), { key: ' ' })
  expect(screen.queryByText('A one')).toBeNull()
})

test('a 409 (already reviewed elsewhere) shows the error and advances', async () => {
  mockApi([card(1, 'Q one', 'A one'), card(2, 'Q two', 'A two')], 1)
  renderPage()
  expect(await screen.findByText('Q one')).toBeTruthy()
  fireEvent.keyDown(window, { key: ' ' })
  fireEvent.keyDown(window, { key: '2' })
  expect(await screen.findByText('Q two')).toBeTruthy()
  expect(screen.getByText('409 Card is not due')).toBeTruthy()
})

test('a queue refetch (after a card edit) keeps the position and picks up new cards', async () => {
  const queue = [card(1, 'Q one', 'A one'), card(2, 'Q two', 'A two')]
  const fetchMock = mockApi(queue)
  const client = renderPage()
  expect(await screen.findByText('Q one')).toBeTruthy()
  fireEvent.keyDown(window, { key: ' ' })
  fireEvent.keyDown(window, { key: '2' })
  expect(await screen.findByText('Q two')).toBeTruthy()
  // The server no longer lists the answered card, and a new card was added.
  queue.splice(0, 2, card(2, 'Q two', 'A two'), card(3, 'Q three', 'A three'))
  await client.invalidateQueries({ queryKey: ['review'] })
  expect(await screen.findByText('2 of 3')).toBeTruthy()
  expect(screen.getByText('Q two')).toBeTruthy()
  expect(fetchMock.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2)
})

test('empty queue shows "Nothing due" for all decks', async () => {
  const fetchMock = mockApi([])
  renderPage('all')
  expect(await screen.findByRole('heading', { name: 'Nothing due' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Review · All decks' })).toBeTruthy()
  expect(fetchMock.mock.calls[0][0]).toBe('/api/review/cards')
})
