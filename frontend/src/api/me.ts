import type { Me } from '../types'
import { api } from './client'

export const getMe = () => api<Me>('/me')

export const updateMe = (body: { timezone: string }) =>
  api<Me>('/me', { method: 'PATCH', body })
