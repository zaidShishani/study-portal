import type { CalendarEventDetail, EventInput } from '../types'
import { api } from './client'

export const getEvent = (id: number) => api<CalendarEventDetail>(`/events/${id}`)

export const createEvent = (body: EventInput) => api<CalendarEventDetail>('/events', { method: 'POST', body })

export const updateEvent = ({ id, ...body }: EventInput & { id: number }) =>
  api<CalendarEventDetail>(`/events/${id}`, { method: 'PATCH', body })

export const deleteEvent = (id: number) => api<void>(`/events/${id}`, { method: 'DELETE' })
