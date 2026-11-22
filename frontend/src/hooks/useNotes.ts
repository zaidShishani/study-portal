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

function useNotesMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateFolder = () => useNotesMutation(createFolder)
export const useUpdateFolder = () => useNotesMutation(updateFolder)
export const useDeleteFolder = () => useNotesMutation(deleteFolder)
export const useCreatePage = () => useNotesMutation(createPage)
export const useUpdatePage = () => useNotesMutation(updatePage)
export const useDeletePage = () => useNotesMutation(deletePage)
