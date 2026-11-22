import type { Deck } from '../types'
import { api } from './client'

export const listDecks = () => api<Deck[]>('/decks')

export const getDeck = (id: number) => api<Deck>(`/decks/${id}`)

export const createDeck = (title: string) => api<Deck>('/decks', { method: 'POST', body: { title } })

export const renameDeck = ({ id, title }: { id: number; title: string }) =>
  api<Deck>(`/decks/${id}`, { method: 'PATCH', body: { title } })

export const deleteDeck = (id: number) => api<void>(`/decks/${id}`, { method: 'DELETE' })
