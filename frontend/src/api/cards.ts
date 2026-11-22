import type { Card, CardStatus } from '../types'
import { api } from './client'

export const listCards = (deckId: number, status: CardStatus) =>
  api<Card[]>(`/decks/${deckId}/cards?status=${status}`)

export const createCard = ({ deckId, front, back }: { deckId: number; front: string; back: string }) =>
  api<Card>(`/decks/${deckId}/cards`, { method: 'POST', body: { front, back } })

export const updateCard = ({ id, front, back }: { id: number; front: string; back: string }) =>
  api<Card>(`/cards/${id}`, { method: 'PATCH', body: { front, back } })

export const deleteCard = (id: number) => api<void>(`/cards/${id}`, { method: 'DELETE' })
