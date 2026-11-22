import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCheckpoint,
  createRoadmap,
  deleteCheckpoint,
  deleteRoadmap,
  getRoadmap,
  listRoadmaps,
  renameRoadmap,
  reorderCheckpoints,
  updateCheckpoint,
} from '../api/roadmaps'

const KEY = ['roadmaps']

export const useRoadmaps = () => useQuery({ queryKey: KEY, queryFn: listRoadmaps })

// Under ['roadmaps'] so any roadmap or checkpoint mutation refreshes it and the list's progress.
export const useRoadmap = (id: number) => useQuery({ queryKey: [...KEY, id], queryFn: () => getRoadmap(id) })

function useRoadmapMutation<A, R>(mutationFn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateRoadmap = () => useRoadmapMutation(createRoadmap)
export const useRenameRoadmap = () => useRoadmapMutation(renameRoadmap)
export const useDeleteRoadmap = () => useRoadmapMutation(deleteRoadmap)
export const useCreateCheckpoint = () => useRoadmapMutation(createCheckpoint)
export const useUpdateCheckpoint = () => useRoadmapMutation(updateCheckpoint)
export const useDeleteCheckpoint = () => useRoadmapMutation(deleteCheckpoint)
export const useReorderCheckpoints = () => useRoadmapMutation(reorderCheckpoints)
