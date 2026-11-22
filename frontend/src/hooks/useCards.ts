import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCard, deleteCard, listCards, updateCard } from '../api/cards'
import { getReviewQueue, reviewCard, unretireCard } from '../api/review'
import type { CardStatus } from '../types'

export const useCards = (deckId: number, status: CardStatus) =>
  useQuery({ queryKey: ['cards', deckId, status], queryFn: () => listCards(deckId, status) })

// Card changes also move the deck's card/due counts, so refresh decks too.
function useCardMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cards'] }),
        queryClient.invalidateQueries({ queryKey: ['decks'] }),
      ]),
  })
}

export const useCreateCard = () => useCardMutation(createCard)
export const useUpdateCard = () => useCardMutation(updateCard)
export const useDeleteCard = () => useCardMutation(deleteCard)
export const useReviewCard = () => useCardMutation(reviewCard)
export const useUnretireCard = () => useCardMutation(unretireCard)

// Fetched once per visit: never stale (no refetch mid-session, so answered cards don't reshuffle),
// and dropped on unmount (gcTime 0) so the next visit loads a fresh queue.
export const useReviewQueue = (deckId?: number) =>
  useQuery({
    queryKey: ['review', deckId ?? 'all'],
    queryFn: () => getReviewQueue(deckId),
    staleTime: Infinity,
    gcTime: 0,
  })
