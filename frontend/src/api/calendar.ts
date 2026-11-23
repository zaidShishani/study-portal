import type { CalendarData } from '../types'
import { api } from './client'

// Inclusive local dates, YYYY-MM-DD.
export const getCalendar = (from: string, to: string) =>
  api<CalendarData>(`/calendar?${new URLSearchParams({ from, to })}`)
