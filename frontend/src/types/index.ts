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
