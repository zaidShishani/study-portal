import type { AppNotification } from '../types'
import { api } from './client'

export const listNotifications = () => api<AppNotification[]>('/notifications')

export const markNotificationRead = (id: number) => api<void>(`/notifications/${id}/read`, { method: 'POST' })

export const markAllNotificationsRead = () => api<void>('/notifications/read-all', { method: 'POST' })
