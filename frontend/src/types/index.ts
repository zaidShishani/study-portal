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

// Enum values exactly as the API (docs/ARCHITECTURE.md → Enums).
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const PATTERNS = [
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Stack',
  'Linked List',
  'Tree',
  'Trie',
  'Heap',
  'Graph',
  'BFS',
  'DFS',
  'Backtracking',
  'DP',
  'Greedy',
  'Intervals',
  'Union Find',
  'Bit Manipulation',
  'Math',
] as const
export type Pattern = (typeof PATTERNS)[number]

export type NoteFolder = {
  id: number
  parent_id: number | null
  name: string
}

export type NotePageItem = {
  id: number
  title: string
  folder_id: number | null
  updated_at: string
}

export type NotePage = NotePageItem & {
  content: string
  created_at: string
}

export type ProblemStatus = 'due' | 'active' | 'retired' | 'all'

export type LastResult = 'solved' | 'solved_with_hint' | 'failed'

export const RESULT_LABELS: Record<LastResult, string> = {
  solved: 'Solved',
  solved_with_hint: 'Solved with hint',
  failed: 'Failed',
}

// Fields the client may send on create/update; the rest are server-owned.
export type ProblemInput = {
  title: string
  link: string | null
  difficulty: Difficulty
  pattern: Pattern
  key_insight: string | null
  notes: string | null
  minutes: number | null
}

export type Problem = ProblemInput & {
  id: number
  last_result: LastResult | null
  solved_date: string | null
  review_count: number
  stage: number
  due_date: string | null
  retired_at: string | null
  created_at: string
  updated_at: string
}
