import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, updateMe } from '../api/me'

export function useMe() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false })
  const { mutate } = useMutation({
    mutationFn: updateMe,
    onSuccess: (me) => {
      queryClient.setQueryData(['me'], me)
      // The calendar and Today may have loaded with the old timezone's dates before this PATCH landed.
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => console.warn('Could not save timezone', err),
  })
  const synced = useRef(false)
  const me = query.data

  useEffect(() => {
    if (query.error) console.warn('Could not load /api/me', query.error)
  }, [query.error])

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!me || synced.current || me.timezone === timezone) return
    synced.current = true
    mutate({ timezone })
  }, [me, mutate])

  return query
}
