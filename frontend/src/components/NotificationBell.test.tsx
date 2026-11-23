import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { AppNotification } from '../types'
import NotificationBell from './NotificationBell'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const note = (id: number): AppNotification => ({
  id,
  event_id: id,
  title: `Event ${id}`,
  occurrence_start: '2026-11-23T10:00:00Z',
  fire_at: '2026-11-23T09:55:00Z',
})

// In-memory API: GET returns unread, POSTs mark read.
function mockApi(initial: AppNotification[]) {
  let unread = [...initial]
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') === 'GET') return Response.json(unread)
    if (url === '/api/notifications/read-all') unread = []
    else unread = unread.filter((n) => n.id !== Number(url.split('/')[3]))
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const posts = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => url)
const gets = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([, init]) => !init?.method).length

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationBell />
        <Routes>
          <Route path="/" element={<h1>home</h1>} />
          <Route path="/calendar" element={<h1>calendar</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const bell = (count: string) => screen.findByRole('button', { name: `Notifications, ${count} unread` })

test('badge shows the unread count', async () => {
  mockApi([note(1), note(2), note(3)])
  renderBell()
  expect((await bell('3')).textContent).toContain('3')
})

test('a full (capped) list shows 50+', async () => {
  mockApi(Array.from({ length: 50 }, (_, i) => note(i + 1)))
  renderBell()
  expect((await bell('50+')).textContent).toContain('50+')
})

test('polls again after 60 s', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const fetchMock = mockApi([note(1)])
  renderBell()
  await bell('1')
  expect(gets(fetchMock)).toBe(1)
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  await waitFor(() => expect(gets(fetchMock)).toBe(2))
})

test('clicking a notification marks it read, navigates, and the badge drops', async () => {
  const fetchMock = mockApi([note(1), note(2)])
  renderBell()
  fireEvent.click(await bell('2'))
  fireEvent.click(screen.getByRole('menuitem', { name: /Event 1/ }))
  expect(screen.getByRole('heading', { name: 'calendar' })).toBeTruthy()
  await bell('1')
  expect(posts(fetchMock)).toEqual(['/api/notifications/1/read'])
})

test('double click on an item sends one POST', async () => {
  const fetchMock = mockApi([note(1)])
  renderBell()
  fireEvent.click(await bell('1'))
  const item = screen.getByRole('menuitem', { name: /Event 1/ })
  fireEvent.click(item)
  fireEvent.click(item)
  await bell('0')
  expect(posts(fetchMock)).toEqual(['/api/notifications/1/read'])
})

test('mark all read clears the badge', async () => {
  const fetchMock = mockApi([note(1), note(2)])
  renderBell()
  fireEvent.click(await bell('2'))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Mark all read' }))
  await bell('0')
  expect(posts(fetchMock)).toEqual(['/api/notifications/read-all'])
})

test('empty list shows "No reminders"', async () => {
  mockApi([])
  renderBell()
  fireEvent.click(await bell('0'))
  expect(screen.getByRole('menuitem', { name: 'No reminders' })).toBeTruthy()
})

test('polling errors warn once and show nothing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  renderBell()
  await waitFor(() => expect(warn).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Notifications, 0 unread' })).toBeTruthy()
})
