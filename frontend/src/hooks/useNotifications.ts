import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications'

const KEY = ['notifications']

// Refetches on window focus (react-query default); interval pauses while the tab is hidden.
export function useNotifications() {
  const query = useQuery({ queryKey: KEY, queryFn: listNotifications, refetchInterval: 60_000 })
  const warned = useRef(false)

  // Polling fails quietly: one console warning, no UI noise; the last good list stays shown.
  useEffect(() => {
    if (!query.error) {
      warned.current = false // recovered: warn again on the next outage
      return
    }
    if (warned.current) return
    warned.current = true
    console.warn('Could not load /api/notifications', query.error)
  }, [query.error])

  return query
}

function useNotificationMutation<A>(mutationFn: (arg: A) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useMarkNotificationRead = () => useNotificationMutation(markNotificationRead)
export const useMarkAllNotificationsRead = () => useNotificationMutation(markAllNotificationsRead)
