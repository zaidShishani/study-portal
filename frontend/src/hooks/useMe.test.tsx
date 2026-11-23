import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { markTimezoneManual, useMe } from './useMe'

const browserTz = 'Europe/Amsterdam'

beforeEach(() => {
  localStorage.clear()
  const real = Intl.DateTimeFormat.prototype.resolvedOptions
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...real.call(this), timeZone: browserTz }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(meTz: string) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      Response.json(
        init?.method === 'PATCH'
          ? { id: 1, email: null, ...JSON.parse(String(init.body)) }
          : { id: 1, email: null, timezone: meTz },
      ),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useMe(), { wrapper })
  const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
  return { hook, patches, client }
}

test('PATCHes the browser timezone once when the server still has the UTC default', async () => {
  const { hook, patches } = setup('UTC')
  await waitFor(() => expect(hook.result.current.data?.timezone).toBe(browserTz))
  expect(patches()).toHaveLength(1)
  expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({ timezone: browserTz })
})

test('refreshes calendar and dashboard queries once the new timezone is saved', async () => {
  const { hook, client } = setup('UTC')
  client.setQueryData(['calendar', { from: '2026-11-01', to: '2026-11-30' }], { events: [] })
  client.setQueryData(['dashboard'], { date: '2026-11-23' })
  await waitFor(() => expect(hook.result.current.data?.timezone).toBe(browserTz))
  await waitFor(() =>
    expect(client.getQueryState(['calendar', { from: '2026-11-01', to: '2026-11-30' }])?.isInvalidated).toBe(true),
  )
  expect(client.getQueryState(['dashboard'])?.isInvalidated).toBe(true)
})

test('does not PATCH when the timezone already matches', async () => {
  const { hook, patches } = setup(browserTz)
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  expect(patches()).toHaveLength(0)
})

test('does not overwrite a non-default server timezone', async () => {
  const { hook, patches } = setup('Asia/Tokyo')
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  expect(patches()).toHaveLength(0)
})

test('does not overwrite a timezone saved manually, even UTC', async () => {
  markTimezoneManual()
  const { hook, patches } = setup('UTC')
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  expect(patches()).toHaveLength(0)
})

test('warns instead of throwing when the API is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const client = new QueryClient()
  renderHook(() => useMe(), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(warn).toHaveBeenCalled())
})
