import type { Card } from '../types'
import { api } from './client'

export const getReviewQueue = (deckId?: number) =>
  api<Card[]>(deckId === undefined ? '/review/cards' : `/review/cards?deck_id=${deckId}`)

export const reviewCard = ({ id, correct }: { id: number; correct: boolean }) =>
  api<Card>(`/cards/${id}/review`, { method: 'POST', body: { correct } })

export const unretireCard = (id: number) => api<Card>(`/cards/${id}/unretire`, { method: 'POST' })
