import type { NoteFolder, NotePage, NotePageItem, RecentPage } from '../types'
import { api } from './client'

export const listFolders = () => api<NoteFolder[]>('/notes/folders')

export const createFolder = (body: { name: string; parent_id: number | null }) =>
  api<NoteFolder>('/notes/folders', { method: 'POST', body })

// parent_id: null moves to root; omit it to keep the parent.
export const updateFolder = ({ id, ...body }: { id: number; name?: string; parent_id?: number | null }) =>
  api<NoteFolder>(`/notes/folders/${id}`, { method: 'PATCH', body })

export const deleteFolder = (id: number) => api<void>(`/notes/folders/${id}`, { method: 'DELETE' })

// null = root pages.
export const listPages = (folderId: number | null) =>
  api<NotePageItem[]>(folderId === null ? '/notes/pages' : `/notes/pages?folder_id=${folderId}`)

// 5 rows show on home; the 6th only tells it there are more.
export const listRecentPages = () => api<RecentPage[]>('/notes/pages/recent?limit=6')

export const getPage = (id: number) => api<NotePage>(`/notes/pages/${id}`)

export const createPage = (body: { title: string; folder_id: number | null }) =>
  api<NotePage>('/notes/pages', { method: 'POST', body })

// folder_id: null moves to root; omit it to keep the folder.
export const updatePage = ({
  id,
  ...body
}: {
  id: number
  title?: string
  content?: string
  folder_id?: number | null
}) => api<NotePage>(`/notes/pages/${id}`, { method: 'PATCH', body })

export const deletePage = (id: number) => api<void>(`/notes/pages/${id}`, { method: 'DELETE' })

export type TreeLevel = { folders: TreeNode[]; pages: NotePageItem[] }
export type TreeNode = TreeLevel & { folder: NoteFolder }

// Flat lists -> nested tree. Items whose parent isn't in the list (orphans) land at root.
export function buildTree(folders: NoteFolder[], pages: NotePageItem[]): TreeLevel {
  const root: TreeLevel = { folders: [], pages: [] }
  const nodes = new Map<number, TreeNode>(folders.map((f) => [f.id, { folder: f, folders: [], pages: [] }]))
  for (const node of nodes.values()) {
    const parent = node.folder.parent_id === null ? undefined : nodes.get(node.folder.parent_id)
    ;(parent ?? root).folders.push(node)
  }
  const seen = new Set<number>()
  for (const page of pages) {
    // A page can briefly sit in two cached lists after a move; the tree needs unique ids.
    if (seen.has(page.id)) continue
    seen.add(page.id)
    const parent = page.folder_id === null ? undefined : nodes.get(page.folder_id)
    ;(parent ?? root).pages.push(page)
  }
  return root
}
