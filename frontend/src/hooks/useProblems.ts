import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProblem, deleteProblem, listProblems, updateProblem, type ProblemFilters } from '../api/problems'

const KEY = ['problems']

export const useProblems = (filters: ProblemFilters) =>
  // keepPreviousData: the table stays put while a new filter loads.
  useQuery({ queryKey: [...KEY, filters], queryFn: () => listProblems(filters), placeholderData: keepPreviousData })

function useProblemMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateProblem = () => useProblemMutation(createProblem)
export const useUpdateProblem = () => useProblemMutation(updateProblem)
export const useDeleteProblem = () => useProblemMutation(deleteProblem)
