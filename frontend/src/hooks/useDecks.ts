import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDeck, deleteDeck, getDeck, listDecks, renameDeck } from '../api/decks'

const KEY = ['decks']

export const useDecks = () => useQuery({ queryKey: KEY, queryFn: listDecks })

// Under ['decks'] so any deck or card mutation refreshes it (title, due_count).
export const useDeck = (id: number) => useQuery({ queryKey: [...KEY, id], queryFn: () => getDeck(id) })

function useDeckMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateDeck = () => useDeckMutation(createDeck)
export const useRenameDeck = () => useDeckMutation(renameDeck)
export const useDeleteDeck = () => useDeckMutation(deleteDeck)
