import { afterEach, expect, test, vi } from 'vitest'
import { api, ApiError } from './client'

afterEach(() => vi.unstubAllGlobals())

function mockFetch(res: Response) {
  const fetchMock = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

test('prefixes /api, sends JSON and parses the response', async () => {
  const fetchMock = mockFetch(Response.json({ ok: 1 }))
  await expect(api('/me', { method: 'PATCH', body: { timezone: 'UTC' } })).resolves.toEqual({ ok: 1 })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/me')
  expect(init.body).toBe('{"timezone":"UTC"}')
  expect(init.headers.get('Content-Type')).toBe('application/json')
})

test('throws ApiError with status and detail on non-2xx', async () => {
  mockFetch(Response.json({ detail: 'Not found' }, { status: 404 }))
  const err = (await api('/x').catch((e) => e)) as ApiError
  expect(err).toBeInstanceOf(ApiError)
  expect(err.status).toBe(404)
  expect(err.message).toContain('Not found')
})

test('throws even when the error body is not JSON', async () => {
  mockFetch(new Response('oops', { status: 500, statusText: 'Server Error' }))
  await expect(api('/x')).rejects.toMatchObject({ status: 500 })
})

test('returns undefined on 204', async () => {
  mockFetch(new Response(null, { status: 204 }))
  await expect(api('/x', { method: 'DELETE' })).resolves.toBeUndefined()
})
