import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCard, deleteCard, listCards, updateCard } from '../api/cards'
import { getReviewQueue, reviewCard, unretireCard } from '../api/review'
import type { CardStatus } from '../types'

export const useCards = (deckId: number, status: CardStatus) =>
  useQuery({ queryKey: ['cards', deckId, status], queryFn: () => listCards(deckId, status) })

// Card changes also move the deck's card/due counts, so refresh decks too.
// onSettled (like useDecks): a failed call (e.g. 404 after another tab deleted it) also resyncs.
// Edits also refresh the open review queue (it sits beside the card list); answering doesn't, so cards don't reshuffle.
function useCardMutation<A, R>(mutationFn: (arg: A) => Promise<R>, refreshQueue = true) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cards'] }),
        queryClient.invalidateQueries({ queryKey: ['decks'] }),
        refreshQueue && queryClient.invalidateQueries({ queryKey: ['review'] }),
      ]),
  })
}

export const useCreateCard = () => useCardMutation(createCard)
export const useUpdateCard = () => useCardMutation(updateCard)
export const useDeleteCard = () => useCardMutation(deleteCard)
export const useReviewCard = () => useCardMutation(reviewCard, false)
export const useUnretireCard = () => useCardMutation(unretireCard)

// Fetched once per visit: never stale (no refetch from answering, so cards don't reshuffle; card edits do refetch),
// and dropped on unmount (gcTime 0) so the next visit loads a fresh queue.
export const useReviewQueue = (deckId?: number) =>
  useQuery({
    queryKey: ['review', deckId ?? 'all'],
    queryFn: () => getReviewQueue(deckId),
    staleTime: Infinity,
    gcTime: 0,
  })
