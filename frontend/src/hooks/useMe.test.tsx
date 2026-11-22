import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { useMe } from './useMe'

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone

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
  return { hook, patches }
}

test('PATCHes the browser timezone once when it differs', async () => {
  const otherTz = browserTz === 'Pacific/Kiritimati' ? 'UTC' : 'Pacific/Kiritimati'
  const { hook, patches } = setup(otherTz)
  await waitFor(() => expect(hook.result.current.data?.timezone).toBe(browserTz))
  expect(patches()).toHaveLength(1)
  expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({ timezone: browserTz })
})

test('does not PATCH when the timezone already matches', async () => {
  const { hook, patches } = setup(browserTz)
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
