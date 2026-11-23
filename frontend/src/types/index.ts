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
export const DIFFICULTY_COLOR = { Easy: 'success', Medium: 'warning', Hard: 'error' } as const

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

export type Roadmap = {
  id: number
  title: string
  description: string | null
  done_count: number
  total_count: number
  created_at: string
  updated_at: string
}

// Fields the client may send on checkpoint create/update; dates are YYYY-MM-DD.
export type CheckpointInput = {
  title: string
  description: string | null
  target_date: string | null
}

export type Checkpoint = CheckpointInput & {
  id: number
  roadmap_id: number
  position: number
  done_at: string | null
}

export type RoadmapDetail = Roadmap & { checkpoints: Checkpoint[] }

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

export type Dashboard = {
  date: string
  decks: { id: number; title: string; due_count: number }[]
  due_card_total: number
  problems_due: { id: number; title: string; difficulty: Difficulty; due_date: string }[]
  events_today: { event_id: number; title: string; start: string; end: string | null; all_day: boolean }[]
  roadmaps: { id: number; title: string; done: number; total: number }[]
}
