import { expect, test } from 'vitest'
import { buildTree } from './notes'

const page = (id: number, folder_id: number | null) => ({ id, title: `P${id}`, folder_id, updated_at: '' })

test('empty input gives an empty root', () => {
  expect(buildTree([], [])).toEqual({ folders: [], pages: [] })
})

test('nests folders and pages under their parents', () => {
  const tree = buildTree(
    [
      { id: 1, parent_id: null, name: 'A' },
      { id: 2, parent_id: 1, name: 'B' },
      { id: 3, parent_id: 2, name: 'C' },
    ],
    [page(10, null), page(11, 1), page(12, 3)],
  )
  expect(tree.pages.map((p) => p.id)).toEqual([10])
  const a = tree.folders[0]
  expect(a.folder.name).toBe('A')
  expect(a.pages.map((p) => p.id)).toEqual([11])
  const c = a.folders[0].folders[0]
  expect(c.folder.name).toBe('C')
  expect(c.pages.map((p) => p.id)).toEqual([12])
  expect(tree.folders).toHaveLength(1)
})

test('a page id listed twice (stale cache after a move) appears once', () => {
  const tree = buildTree([{ id: 1, parent_id: null, name: 'A' }], [page(5, null), page(5, 1)])
  expect(tree.pages.map((p) => p.id)).toEqual([5])
  expect(tree.folders[0].pages).toEqual([])
})

test('orphans (unknown parent) land at root', () => {
  const tree = buildTree([{ id: 2, parent_id: 99, name: 'Orphan' }], [page(5, 42)])
  expect(tree.folders.map((n) => n.folder.name)).toEqual(['Orphan'])
  expect(tree.pages.map((p) => p.id)).toEqual([5])
})
