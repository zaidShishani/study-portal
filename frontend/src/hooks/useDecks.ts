import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDeck, deleteDeck, listDecks, renameDeck } from '../api/decks'

const KEY = ['decks']

export const useDecks = () => useQuery({ queryKey: KEY, queryFn: listDecks })

function useDeckMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateDeck = () => useDeckMutation(createDeck)
export const useRenameDeck = () => useDeckMutation(renameDeck)
export const useDeleteDeck = () => useDeckMutation(deleteDeck)
