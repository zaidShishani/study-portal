import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  attemptProblem,
  createProblem,
  deleteProblem,
  getProblem,
  listProblems,
  unretireProblem,
  updateProblem,
  type ProblemFilters,
} from '../api/problems'

const KEY = ['problems']

export const useProblems = (filters: ProblemFilters) =>
  // keepPreviousData: the table stays put while a new filter loads.
  useQuery({ queryKey: [...KEY, filters], queryFn: () => listProblems(filters), placeholderData: keepPreviousData })

// Under KEY, so every mutation's invalidation also refreshes the detail view.
// retry: false so a 404 shows the not-found state at once.
export const useProblem = (id: string) =>
  useQuery({ queryKey: [...KEY, 'detail', id], queryFn: () => getProblem(id), retry: false })

function useProblemMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateProblem = () => useProblemMutation(createProblem)
export const useUpdateProblem = () => useProblemMutation(updateProblem)
export const useDeleteProblem = () => useProblemMutation(deleteProblem)
export const useAttemptProblem = () => useProblemMutation(attemptProblem)
export const useUnretireProblem = () => useProblemMutation(unretireProblem)
