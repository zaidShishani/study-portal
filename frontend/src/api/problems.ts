import type { Difficulty, Pattern, Problem, ProblemInput, ProblemStatus } from '../types'
import { api } from './client'

// '' = no filter.
export type ProblemFilters = { difficulty: Difficulty | ''; pattern: Pattern | ''; status: ProblemStatus }

export function listProblems({ difficulty, pattern, status }: ProblemFilters) {
  const params = new URLSearchParams({ status })
  if (difficulty) params.set('difficulty', difficulty)
  if (pattern) params.set('pattern', pattern)
  return api<Problem[]>(`/problems?${params}`)
}

export const createProblem = (body: ProblemInput) => api<Problem>('/problems', { method: 'POST', body })

export const updateProblem = ({ id, ...body }: ProblemInput & { id: number }) =>
  api<Problem>(`/problems/${id}`, { method: 'PATCH', body })

export const deleteProblem = (id: number) => api<void>(`/problems/${id}`, { method: 'DELETE' })

// Only http(s) links are stored or rendered as links; blocks `javascript:` and friends.
export const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s) && URL.canParse(s)
