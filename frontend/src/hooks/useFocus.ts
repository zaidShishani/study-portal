import { useSearchParams } from 'react-router-dom'

export const PANELS = ['flashcards', 'leetcode', 'roadmaps'] as const
export type PanelName = (typeof PANELS)[number]

// Ids come from the URL: positive integers only, at most 9 digits so they fit the API's int columns.
export const parseId = (v: string | null) => (v && /^[1-9]\d{0,8}$/.test(v) ? Number(v) : undefined)

/** Home URL for a focused panel, e.g. focusUrl({ focus: 'flashcards', deck: 3 }) → "/?focus=flashcards&deck=3". */
export const focusUrl = (params: Record<string, string | number>) =>
  `/?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`

export function useFocus() {
  const [params] = useSearchParams()
  const focus = PANELS.find((p) => p === params.get('focus'))
  const review = params.get('review')
  return {
    focus,
    deck: parseId(params.get('deck')),
    review: review === 'all' ? ('all' as const) : parseId(review),
    problem: parseId(params.get('problem')),
    roadmap: parseId(params.get('roadmap')),
  }
}
