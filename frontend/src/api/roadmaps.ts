import type { Checkpoint, CheckpointInput, Roadmap, RoadmapDetail } from '../types'
import { api } from './client'

export const listRoadmaps = () => api<Roadmap[]>('/roadmaps')

export const getRoadmap = (id: number) => api<RoadmapDetail>(`/roadmaps/${id}`)

export const createRoadmap = (title: string) => api<RoadmapDetail>('/roadmaps', { method: 'POST', body: { title } })

export const renameRoadmap = ({ id, title }: { id: number; title: string }) =>
  api<RoadmapDetail>(`/roadmaps/${id}`, { method: 'PATCH', body: { title } })

export const deleteRoadmap = (id: number) => api<void>(`/roadmaps/${id}`, { method: 'DELETE' })

export const createCheckpoint = ({ roadmapId, ...body }: CheckpointInput & { roadmapId: number }) =>
  api<Checkpoint>(`/roadmaps/${roadmapId}/checkpoints`, { method: 'POST', body })

export const updateCheckpoint = ({ id, ...body }: Partial<CheckpointInput> & { id: number; done?: boolean }) =>
  api<Checkpoint>(`/checkpoints/${id}`, { method: 'PATCH', body })

export const deleteCheckpoint = (id: number) => api<void>(`/checkpoints/${id}`, { method: 'DELETE' })

export const reorderCheckpoints = ({ roadmapId, ids }: { roadmapId: number; ids: number[] }) =>
  api<Checkpoint[]>(`/roadmaps/${roadmapId}/checkpoints/order`, { method: 'PUT', body: { ids } })
