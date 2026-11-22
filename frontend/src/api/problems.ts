import type { Difficulty, LastResult, Pattern, Problem, ProblemInput, ProblemStatus } from '../types'
import { api } from './client'

// '' = no filter.
export type ProblemFilters = { difficulty: Difficulty | ''; pattern: Pattern | ''; status: ProblemStatus }

export function listProblems({ difficulty, pattern, status }: ProblemFilters) {
  const params = new URLSearchParams({ status })
  if (difficulty) params.set('difficulty', difficulty)
  if (pattern) params.set('pattern', pattern)
  return api<Problem[]>(`/problems?${params}`)
}

export const getProblem = (id: string) => api<Problem>(`/problems/${encodeURIComponent(id)}`)

export const createProblem = (body: ProblemInput) => api<Problem>('/problems', { method: 'POST', body })

export const updateProblem = ({ id, ...body }: ProblemInput & { id: number }) =>
  api<Problem>(`/problems/${id}`, { method: 'PATCH', body })

export const deleteProblem = (id: number) => api<void>(`/problems/${id}`, { method: 'DELETE' })

export type AttemptInput = { result: LastResult; minutes: number | null }

export const attemptProblem = ({ id, ...body }: AttemptInput & { id: number }) =>
  api<Problem>(`/problems/${id}/attempt`, { method: 'POST', body })

export const unretireProblem = (id: number) => api<Problem>(`/problems/${id}/unretire`, { method: 'POST' })

// Only http(s) links are stored or rendered as links; blocks `javascript:` and friends.
export const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s) && URL.canParse(s)
