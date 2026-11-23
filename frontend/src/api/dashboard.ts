import type { Dashboard } from '../types'
import { api } from './client'

export const getToday = () => api<Dashboard>('/dashboard/today')
