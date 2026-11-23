import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import dayjs from 'dayjs'
import type { CalendarData } from '../types'
import CalendarPage from './CalendarPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const today = dayjs().format('YYYY-MM-DD')

function mockApi(data: Partial<CalendarData>) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/calendar?'))
      return Response.json({ events: [], card_due: [], problems_due: [], checkpoints: [], truncated: false, ...data })
    if (url === '/api/events/7')
      return Response.json({
        id: 7,
        title: 'Gym',
        description: null,
        start_at: dayjs().hour(18).minute(0).second(0).format(),
        end_at: dayjs().hour(19).minute(0).second(0).format(),
        all_day: false,
        rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
        remind_minutes_before: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })
    return Response.json({ detail: 'Not found' }, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/flashcards/review" element={<p>Review page</p>} />
          <Route path="/leetcode/:id" element={<p>Problem page</p>} />
          <Route path="/roadmaps/:id" element={<p>Roadmap page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('fetches the visible month and renders events and derived items', async () => {
  const fetchMock = mockApi({
    events: [{ event_id: 7, title: 'Gym', start: dayjs().hour(18).toISOString(), end: null, all_day: false }],
    card_due: [{ date: today, count: 4 }],
    problems_due: [{ id: 3, title: 'Two Sum', date: today }],
    checkpoints: [{ id: 5, roadmap_id: 2, title: 'Learn SQL', date: today }],
  })
  renderPage()
  expect(await screen.findByText('4 cards due')).toBeTruthy()
  expect(screen.getByText('Two Sum')).toBeTruthy()
  expect(screen.getByText('Learn SQL')).toBeTruthy()
  expect(screen.getByText('Gym')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()

  // The 6-week month grid around today, as inclusive local dates.
  const url = new URL(fetchMock.mock.calls[0][0], 'http://x')
  const from = url.searchParams.get('from')!
  const to = url.searchParams.get('to')!
  expect(from <= dayjs().startOf('month').format('YYYY-MM-DD')).toBe(true)
  expect(dayjs(to).diff(from, 'day')).toBe(41)

  fireEvent.click(screen.getByText('Two Sum'))
  expect(await screen.findByText('Problem page')).toBeTruthy()
})

test('derived items link to their pages', async () => {
  mockApi({
    card_due: [{ date: today, count: 2 }],
    checkpoints: [{ id: 5, roadmap_id: 2, title: 'Learn SQL', date: today }],
  })
  renderPage()
  fireEvent.click(await screen.findByText('2 cards due'))
  expect(await screen.findByText('Review page')).toBeTruthy()
})

test('clicking an event opens the edit dialog with the fetched event', async () => {
  mockApi({ events: [{ event_id: 7, title: 'Gym', start: dayjs().hour(18).toISOString(), end: null, all_day: false }] })
  renderPage()
  fireEvent.click(await screen.findByText('Gym'))
  expect(await screen.findByRole('heading', { name: 'Edit event' })).toBeTruthy()
  expect(screen.getByLabelText('Title')).toHaveProperty('value', 'Gym')
  expect(screen.getByLabelText('Mon')).toHaveProperty('checked', true)
})

test('shows notices for truncated ranges and invalid rules', async () => {
  mockApi({ truncated: true, invalid_event_ids: [1, 2] })
  renderPage()
  expect(await screen.findByText(/too many items/)).toBeTruthy()
  expect(screen.getByText(/2 event\(s\) have a recurrence rule/)).toBeTruthy()
})
