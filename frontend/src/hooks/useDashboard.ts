import { useQuery } from '@tanstack/react-query'
import { getToday } from '../api/dashboard'

// react-query's default refetch-on-focus/mount keeps this fresh after reviewing.
export const useToday = () => useQuery({ queryKey: ['dashboard'], queryFn: getToday })
