import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ThemeModeProvider } from '../theme/ThemeModeProvider'
import SettingsPage from './SettingsPage'

beforeEach(() => localStorage.clear())

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderPage(patchStatus = 200) {
  let resolvePatch: (() => void) | null = null
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method !== 'PATCH') return Promise.resolve(Response.json({ id: 1, email: null, timezone: 'UTC' }))
    const body = JSON.parse(String(init.body))
    return new Promise<Response>((resolve) => {
      resolvePatch = () =>
        resolve(
          patchStatus === 200
            ? Response.json({ id: 1, email: null, ...body })
            : Response.json({ detail: [{ msg: 'bad' }] }, { status: patchStatus }),
        )
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['calendar', { from: 'a', to: 'b' }], { events: [] })
  client.setQueryData(['dashboard'], { date: 'x' })
  render(
    <QueryClientProvider client={client}>
      <ThemeModeProvider>
        <SettingsPage />
      </ThemeModeProvider>
    </QueryClientProvider>,
  )
  const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
  // The PATCH is held open so the test can double-click while it is in flight.
  const finishPatch = async () => {
    await waitFor(() => expect(resolvePatch).not.toBeNull())
    resolvePatch!()
  }
  return { client, patches, finishPatch }
}

async function timezoneInput() {
  const input = (await screen.findByRole('combobox', { name: 'Timezone' })) as HTMLInputElement
  await waitFor(() => expect(input.value).toBe('UTC'))
  return input
}

async function pickZone(zone: string) {
  const input = await timezoneInput()
  input.focus()
  fireEvent.change(input, { target: { value: zone } })
  fireEvent.click(await screen.findByRole('option', { name: zone }))
}

test('theme toggle switches mode and persists it', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
  expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')
  expect(localStorage.getItem('theme-mode')).toBe('dark')
})

test('saving a timezone PATCHes once, marks it manual and refreshes dependent queries', async () => {
  const { client, patches, finishPatch } = renderPage()
  await pickZone('Asia/Tokyo')
  const save = screen.getByRole('button', { name: 'Save' })
  fireEvent.click(save)
  fireEvent.click(save)
  await finishPatch()
  await waitFor(() => expect(localStorage.getItem('tz-manual')).toBe('1'))
  expect(patches()).toHaveLength(1)
  expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({ timezone: 'Asia/Tokyo' })
  expect(client.getQueryState(['calendar', { from: 'a', to: 'b' }])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['dashboard'])?.isInvalidated).toBe(true)
})

test('a 422 is shown inline and not marked manual', async () => {
  const { finishPatch } = renderPage(422)
  await pickZone('Asia/Tokyo')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await finishPatch()
  expect(await screen.findByText('Not a valid timezone')).toBeTruthy()
  expect(localStorage.getItem('tz-manual')).toBeNull()
})

test('use browser timezone fills the field', async () => {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...real.call(this), timeZone: 'Europe/Amsterdam' }
  })
  renderPage()
  const input = await timezoneInput()
  fireEvent.click(screen.getByRole('button', { name: 'Use browser timezone' }))
  expect(input.value).toBe('Europe/Amsterdam')
})
