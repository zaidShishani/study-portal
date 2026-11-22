import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFolder,
  createPage,
  deleteFolder,
  deletePage,
  getPage,
  listFolders,
  listPages,
  updateFolder,
  updatePage,
} from '../api/notes'
import type { NotePageItem } from '../types'

const KEY = ['notes']

export const useFolders = () => useQuery({ queryKey: [...KEY, 'folders'], queryFn: listFolders })

// shortcut: one request per folder (the API lists pages per folder); add a list-all endpoint if trees get large.
export const useAllPages = (folderIds: number[]) =>
  useQueries({
    queries: [null, ...folderIds].map((id) => ({ queryKey: [...KEY, 'pages', id], queryFn: () => listPages(id) })),
    combine: (results) => ({
      pages: results.flatMap((r) => r.data ?? []),
      error: results.find((r) => r.error)?.error ?? null,
    }),
  })

export const usePage = (id: number | null) =>
  useQuery({ queryKey: [...KEY, 'page', id], queryFn: () => getPage(id!), enabled: id !== null })

const FOLDERS = [...KEY, 'folders']
const PAGES = [...KEY, 'pages']

// Invalidate only what the mutation touched, so a save doesn't refetch every folder's page list.
function useNotesMutation<A, R>(mutationFn: (arg: A) => Promise<R>, keys: (data: R | undefined, arg: A) => unknown[][]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: (data, _err, arg) => Promise.all(keys(data, arg).map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

// Folder deletes drop the subtree's page lists from the tree; root pages are untouched.
export const useCreateFolder = () => useNotesMutation(createFolder, () => [FOLDERS])
export const useUpdateFolder = () => useNotesMutation(updateFolder, () => [FOLDERS])
export const useDeleteFolder = () => useNotesMutation(deleteFolder, () => [FOLDERS])
export const useCreatePage = () => useNotesMutation(createPage, (p) => (p ? [[...PAGES, p.folder_id]] : []))
// A move invalidates all page lists (the old folder isn't known here); a plain save only its own list.
export function useUpdatePage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePage,
    onSuccess: (p, arg) => {
      if (!('folder_id' in arg)) return
      // Drop the moved page from other cached lists now, so a stale old-folder list can't show it twice.
      for (const [key, list] of queryClient.getQueriesData<NotePageItem[]>({ queryKey: PAGES })) {
        if (key[2] !== p.folder_id && list) queryClient.setQueryData(key, list.filter((x) => x.id !== p.id))
      }
    },
    onSettled: (p, _err, arg) =>
      Promise.all(
        [[...KEY, 'page', arg.id], 'folder_id' in arg || !p ? PAGES : [...PAGES, p.folder_id]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
export const useDeletePage = () =>
  useNotesMutation((p: NotePageItem) => deletePage(p.id), (_, p) => [[...PAGES, p.folder_id]])
