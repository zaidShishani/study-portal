export type Me = {
  id: number
  email: string | null
  timezone: string
}

export type Deck = {
  id: number
  title: string
  card_count: number
  due_count: number
  created_at: string
  updated_at: string
}

export type CardStatus = 'active' | 'retired' | 'all'

export type Card = {
  id: number
  deck_id: number
  front: string
  back: string
  stage: number
  due_date: string | null
  review_count: number
  last_reviewed_at: string | null
  retired_at: string | null
  created_at: string
  updated_at: string
}
