import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCalendar } from '../api/calendar'
import { createEvent, deleteEvent, getEvent, updateEvent } from '../api/events'

// Event details live under KEY too, so one invalidation refreshes the grid and any open event.
const KEY = ['calendar']

export type Range = { from: string; to: string }

export const useCalendar = (range: Range | null) =>
  useQuery({
    queryKey: [...KEY, range],
    queryFn: () => getCalendar(range!.from, range!.to),
    enabled: !!range,
    // The grid keeps the old items while the next range loads.
    placeholderData: keepPreviousData,
  })

export const useEvent = (id: number | null) =>
  useQuery({ queryKey: [...KEY, 'event', id], queryFn: () => getEvent(id!), enabled: id !== null, retry: false })

function useEventMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateEvent = () => useEventMutation(createEvent)
export const useUpdateEvent = () => useEventMutation(updateEvent)
export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteEvent,
    // Drop the deleted detail first so onSettled doesn't refetch it into a 404.
    onSuccess: (_, id) => queryClient.removeQueries({ queryKey: [...KEY, 'event', id] }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
