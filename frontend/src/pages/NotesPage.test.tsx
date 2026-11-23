import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import type { NoteFolder, NotePage } from '../types'
import NotesPage from './NotesPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const mkPage = (id: number, title: string, folder_id: number | null, content = ''): NotePage => ({
  id,
  title,
  folder_id,
  content,
  updated_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
})

// Tiny in-memory /api/notes so mutations + refetch behave like the real API.
function mockApi(initialFolders: NoteFolder[], initialPages: NotePage[], opts: { cycle?: boolean } = {}) {
  let folders = [...initialFolders]
  let pages = [...initialPages]
  let nextId = 100
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const u = new URL(url, 'http://x')
    const [, , , kind, rawId] = u.pathname.split('/') // /api/notes/<kind>/<id>
    const id = Number(rawId)
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (kind === 'folders') {
      if (method === 'GET') return Response.json(folders)
      if (method === 'POST') {
        const f = { id: nextId++, name: body.name, parent_id: body.parent_id }
        folders.push(f)
        return Response.json(f, { status: 201 })
      }
      if (method === 'PATCH') {
        if (opts.cycle && 'parent_id' in body)
          return Response.json({ detail: 'Cannot move a folder into itself or a descendant' }, { status: 400 })
        folders = folders.map((f) => (f.id === id ? { ...f, ...body } : f))
        return Response.json(folders.find((f) => f.id === id))
      }
      folders = folders.filter((f) => f.id !== id)
      return new Response(null, { status: 204 })
    }
    if (!rawId) {
      if (method === 'GET') {
        const fid = u.searchParams.get('folder_id')
        return Response.json(pages.filter((p) => p.folder_id === (fid === null ? null : Number(fid))))
      }
      const p = mkPage(nextId++, body.title, body.folder_id)
      pages.push(p)
      return Response.json(p, { status: 201 })
    }
    if (method === 'GET') return Response.json(pages.find((p) => p.id === id))
    if (method === 'PATCH') {
      pages = pages.map((p) => (p.id === id ? { ...p, ...body } : p))
      return Response.json(pages.find((p) => p.id === id))
    }
    pages = pages.filter((p) => p.id !== id)
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(initialPageId?: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <NotesPage initialPageId={initialPageId} />
    </QueryClientProvider>,
  )
  return client
}

const calls = (fetchMock: { mock: { calls: [string, RequestInit?][] } }, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method)
const lastBody = (fetchMock: { mock: { calls: [string, RequestInit?][] } }, method: string) => {
  const c = calls(fetchMock, method).at(-1)!
  return { url: c[0], body: JSON.parse(String(c[1]?.body)) }
}

const FOLDERS: NoteFolder[] = [
  { id: 1, parent_id: null, name: 'Algorithms' },
  { id: 2, parent_id: 1, name: 'Graphs' },
]
const PAGES = [mkPage(10, 'Root note', null, 'root body'), mkPage(11, 'Dijkstra', 2, '# Dijkstra')]

test('tree renders nested folders with pages under them and root pages at root', async () => {
  mockApi(FOLDERS, PAGES)
  renderPage()
  const tree = await screen.findByRole('tree')
  expect(await within(tree).findByText('Root note')).toBeTruthy()
  fireEvent.click(within(tree).getByText('Algorithms'))
  fireEvent.click(await within(tree).findByText('Graphs'))
  const graphs = within(tree).getByText('Graphs').closest('[role="treeitem"]') as HTMLElement
  expect(await within(graphs).findByText('Dijkstra')).toBeTruthy()
  // Graphs lives inside the Algorithms item.
  const algorithms = within(tree).getByText('Algorithms').closest('[role="treeitem"]') as HTMLElement
  expect(algorithms.contains(graphs)).toBe(true)
})

test('new folder is created under the selected folder', async () => {
  const fetchMock = mockApi(FOLDERS, [])
  renderPage()
  fireEvent.click(await screen.findByText('Algorithms'))
  fireEvent.click(screen.getByRole('button', { name: 'New folder' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: ' Trees ' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Trees')).toBeTruthy()
  expect(lastBody(fetchMock, 'POST').body).toEqual({ name: 'Trees', parent_id: 1 })
})

test('new page with nothing selected goes to root and opens in the editor', async () => {
  const fetchMock = mockApi([], [])
  renderPage()
  expect(await screen.findByText('No notes yet.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'New page' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Scratch' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByDisplayValue('Scratch')).toBeTruthy()
  expect(lastBody(fetchMock, 'POST')).toEqual({ url: '/api/notes/pages', body: { title: 'Scratch', folder_id: null } })
})

test('rename PATCHes the folder name', async () => {
  const fetchMock = mockApi(FOLDERS, [])
  renderPage()
  fireEvent.click(await screen.findByText('Algorithms'))
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Algos' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Algos')).toBeTruthy()
  expect(lastBody(fetchMock, 'PATCH')).toEqual({ url: '/api/notes/folders/1', body: { name: 'Algos' } })
})

test('delete warns that contents go too, then DELETEs the folder', async () => {
  const fetchMock = mockApi(FOLDERS, [])
  renderPage()
  fireEvent.click(await screen.findByText('Algorithms'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/all its subfolders and pages will be deleted/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(screen.queryByText('Algorithms')).toBeNull())
  expect(calls(fetchMock, 'DELETE')[0][0]).toBe('/api/notes/folders/1')
})

test('move a page to root sends folder_id: null', async () => {
  const fetchMock = mockApi([FOLDERS[0]], [mkPage(11, 'Dijkstra', 1)])
  renderPage()
  const folder = (await screen.findByText('Algorithms')).closest('[role="treeitem"]')!
  // Only items with children expand; wait until the folder's pages have loaded.
  await waitFor(() => expect(folder.getAttribute('aria-expanded')).toBe('false'))
  fireEvent.click(screen.getByText('Algorithms'))
  fireEvent.click(await screen.findByText('Dijkstra'))
  fireEvent.click(screen.getByRole('button', { name: 'Move' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.mouseDown(within(dialog).getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: '(Root)' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(lastBody(fetchMock, 'PATCH')).toEqual({ url: '/api/notes/pages/11', body: { folder_id: null } })
})

test('move picker hides the folder itself and its descendants', async () => {
  mockApi([...FOLDERS, { id: 3, parent_id: null, name: 'Math' }], [])
  renderPage()
  fireEvent.click(await screen.findByText('Algorithms'))
  fireEvent.click(screen.getByRole('button', { name: 'Move' }))
  fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox'))
  const options = (await screen.findAllByRole('option')).map((o) => o.textContent)
  expect(options).toEqual(['(Root)', 'Math'])
})

test('a cycle error from the API is shown and the move dialog stays open', async () => {
  // e.g. another tab moved folders meanwhile, so the client-side filter didn't catch it.
  const fetchMock = mockApi(FOLDERS, [], { cycle: true })
  renderPage()
  const folder = (await screen.findByText('Algorithms')).closest('[role="treeitem"]')!
  await waitFor(() => expect(folder.getAttribute('aria-expanded')).toBe('false'))
  fireEvent.click(screen.getByText('Algorithms'))
  fireEvent.click(await screen.findByText('Graphs'))
  fireEvent.click(screen.getByRole('button', { name: 'Move' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.mouseDown(within(dialog).getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: '(Root)' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('400 Cannot move a folder into itself or a descendant')).toBeTruthy()
  expect(lastBody(fetchMock, 'PATCH')).toEqual({ url: '/api/notes/folders/2', body: { parent_id: null } })
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('deleting the folder holding the open page with unsaved edits warns about them', async () => {
  mockApi([FOLDERS[0]], [mkPage(11, 'Dijkstra', 1, 'a')])
  renderPage()
  const folder = (await screen.findByText('Algorithms')).closest('[role="treeitem"]')!
  await waitFor(() => expect(folder.getAttribute('aria-expanded')).toBe('false'))
  fireEvent.click(screen.getByText('Algorithms'))
  fireEvent.click(await screen.findByText('Dijkstra'))
  fireEvent.change(await screen.findByLabelText('Content'), { target: { value: 'edited' } })
  fireEvent.click(screen.getByText('Algorithms'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(within(screen.getByRole('dialog')).getByText(/Unsaved changes to the open page will be lost/)).toBeTruthy()
})

test('editing a page shows unsaved state; Save PATCHes and clears it', async () => {
  const fetchMock = mockApi([], [mkPage(10, 'Root note', null, 'old')])
  renderPage()
  fireEvent.click(await screen.findByText('Root note'))
  const content = await screen.findByLabelText('Content')
  expect(screen.getByText('All changes saved')).toBeTruthy()
  fireEvent.change(content, { target: { value: '# New' } })
  expect(screen.getByText('Unsaved changes')).toBeTruthy()
  const before = fetchMock.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('All changes saved')).toBeTruthy()
  expect(lastBody(fetchMock, 'PATCH')).toEqual({
    url: '/api/notes/pages/10',
    body: { title: 'Root note', content: '# New' },
  })
  // Only the page and its own folder's list refetch, not the folder list.
  await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 3))
  expect(fetchMock.mock.calls.slice(before).map(([url]) => url).sort()).toEqual([
    '/api/notes/pages',
    '/api/notes/pages/10',
    '/api/notes/pages/10',
  ])
})

test('double-click Save sends one PATCH', async () => {
  const fetchMock = mockApi([], [mkPage(10, 'Root note', null, 'old')])
  renderPage()
  fireEvent.click(await screen.findByText('Root note'))
  fireEvent.change(await screen.findByLabelText('Content'), { target: { value: 'new' } })
  const save = screen.getByRole('button', { name: 'Save' })
  fireEvent.click(save)
  fireEvent.click(save)
  expect(await screen.findByText('All changes saved')).toBeTruthy()
  expect(calls(fetchMock, 'PATCH')).toHaveLength(1)
})

test('switching pages with unsaved changes asks first', async () => {
  mockApi([], [mkPage(10, 'First', null, 'a'), mkPage(12, 'Second', null, 'b')])
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderPage()
  fireEvent.click(await screen.findByText('First'))
  fireEvent.change(await screen.findByLabelText('Content'), { target: { value: 'edited' } })
  fireEvent.click(screen.getByText('Second'))
  expect(confirm).toHaveBeenCalledOnce()
  expect(screen.getByDisplayValue('First')).toBeTruthy()
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByText('Second'))
  expect(await screen.findByDisplayValue('Second')).toBeTruthy()
})

test('initialPageId opens that page and expands its folders', async () => {
  mockApi(FOLDERS, PAGES)
  renderPage(11)
  expect(await screen.findByDisplayValue('Dijkstra')).toBeTruthy()
  const item = (await within(screen.getByRole('tree')).findByText('Dijkstra')).closest('[role="treeitem"]')!
  expect(item.getAttribute('aria-selected')).toBe('true')
})

test('page create, save, move and delete refresh the recent pages', async () => {
  mockApi([], [mkPage(10, 'Root note', null, 'old')])
  const client = renderPage(10)
  const spy = vi.spyOn(client, 'invalidateQueries')
  const recentCalls = () => spy.mock.calls.filter(([f]) => JSON.stringify(f?.queryKey) === '["notes","recent"]').length
  fireEvent.change(await screen.findByLabelText('Content'), { target: { value: 'new' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(recentCalls()).toBe(1))

  fireEvent.click(screen.getByRole('button', { name: 'Move' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(recentCalls()).toBe(2))

  fireEvent.click(screen.getByRole('button', { name: 'New page' }))
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Name'), { target: { value: 'Scratch' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(recentCalls()).toBe(3))

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(recentCalls()).toBe(4))
})
