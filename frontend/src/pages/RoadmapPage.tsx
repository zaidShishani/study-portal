import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Checkbox, IconButton, Snackbar, Stack, Typography } from '@mui/material'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import dayjs from 'dayjs'
import { ApiError } from '../api/client'
import { HeaderActions } from '../components/Card'
import CheckpointDialog from '../components/CheckpointDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import ListRow from '../components/ListRow'
import RoadmapProgress from '../components/RoadmapProgress'
import { focusUrl } from '../hooks/useFocus'
import {
  useCreateCheckpoint,
  useDeleteCheckpoint,
  useReorderCheckpoints,
  useRoadmap,
  useUpdateCheckpoint,
} from '../hooks/useRoadmaps'
import type { Checkpoint, CheckpointInput } from '../types'

/** "Nov 20" from YYYY-MM-DD (T00:00 parses as local midnight, so the day doesn't shift). */
const shortDate = (ymd: string) => new Date(`${ymd}T00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })

export default function RoadmapPage({ roadmapId }: { roadmapId: number }) {
  const roadmap = useRoadmap(roadmapId)
  const createCheckpoint = useCreateCheckpoint()
  const updateCheckpoint = useUpdateCheckpoint()
  // Separate instance so a pending toggle doesn't disable the edit dialog and vice versa.
  const toggleDone = useUpdateCheckpoint()
  const deleteCheckpoint = useDeleteCheckpoint()
  const reorder = useReorderCheckpoints()
  // isPending lands a render late; the refs block a same-tick double click.
  const toggling = useRef(false)
  const reordering = useRef(false)
  // null = closed; { checkpoint: undefined } = create; { checkpoint } = edit.
  const [editing, setEditing] = useState<{ checkpoint?: Checkpoint } | null>(null)
  const [deleting, setDeleting] = useState<Checkpoint | null>(null)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const snackbar = message || (roadmap.error && roadmap.error !== dismissedError ? roadmap.error.message : '')
  // YYYY-MM-DD strings compare correctly as text.
  const today = dayjs().format('YYYY-MM-DD')

  if (roadmap.error instanceof ApiError && roadmap.error.status === 404) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" component="h3" gutterBottom>
          Roadmap not found
        </Typography>
        <Button size="small" component={Link} to={focusUrl({ focus: 'roadmaps' })}>
          Back to roadmaps
        </Button>
      </Box>
    )
  }

  function closeSnackbar() {
    setMessage('')
    setDismissedError(roadmap.error)
  }

  function save(input: CheckpointInput) {
    const req = editing?.checkpoint
      ? updateCheckpoint.mutateAsync({ id: editing.checkpoint.id, ...input })
      : createCheckpoint.mutateAsync({ roadmapId, ...input })
    return req.then(() => setEditing(null), onError)
  }

  function toggle(checkpoint: Checkpoint) {
    if (toggling.current) return
    toggling.current = true
    toggleDone.mutate(
      { id: checkpoint.id, done: !checkpoint.done_at },
      {
        onError,
        onSettled: () => {
          toggling.current = false
        },
      },
    )
  }

  function move(index: number, delta: -1 | 1) {
    if (reordering.current || !roadmap.data) return
    reordering.current = true
    const ids = roadmap.data.checkpoints.map((c) => c.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    reorder.mutate(
      { roadmapId, ids },
      {
        onError,
        onSettled: () => {
          reordering.current = false
        },
      },
    )
  }

  function confirmDelete() {
    if (deleting) deleteCheckpoint.mutate(deleting.id, { onError })
    setDeleting(null)
  }

  const checkpoints = roadmap.data?.checkpoints ?? []

  return (
    <>
      <HeaderActions>
        <Button size="small" variant="contained" onClick={() => setEditing({})}>
          New checkpoint
        </Button>
      </HeaderActions>

      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, minHeight: 44, px: 2, borderBottom: 1, borderColor: 'action.hover' }}>
        <Typography variant="subtitle2" component="h3" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {roadmap.data?.title}
        </Typography>
        {roadmap.data && <RoadmapProgress title={roadmap.data.title} done={roadmap.data.done_count} total={roadmap.data.total_count} />}
      </Stack>

      {roadmap.data && checkpoints.length === 0 && (
        <Typography color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          No checkpoints yet.
        </Typography>
      )}

      <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {checkpoints.map((c, i) => {
          const overdue = !c.done_at && !!c.target_date && c.target_date < today
          return (
            <Box component="li" key={c.id}>
              <ListRow>
                <Checkbox
                  size="small"
                  checked={!!c.done_at}
                  disabled={toggleDone.isPending}
                  onChange={() => toggle(c)}
                  slotProps={{ input: { 'aria-label': `Done: ${c.title}` } }}
                  sx={{ p: 0.5, ml: -0.5 }}
                />
                <Box sx={{ flex: 1, minWidth: 0, py: 1 }}>
                  <Box sx={{ overflowWrap: 'anywhere', color: c.done_at ? 'text.secondary' : 'text.primary' }}>{c.title}</Box>
                  {c.description && (
                    // Plain text, not markdown; pre-wrap keeps the user's newlines.
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {c.description}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ flexShrink: 0, color: overdue ? 'secondary.dark' : 'text.secondary' }}>
                  {c.done_at ? 'Done' : c.target_date ? `${overdue ? 'Overdue · ' : ''}${shortDate(c.target_date)}` : ''}
                </Typography>
                <Stack direction="row" sx={{ flexShrink: 0 }}>
                  <IconButton size="small" aria-label={`Move up: ${c.title}`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Move down: ${c.title}`}
                    disabled={i === checkpoints.length - 1 || reorder.isPending}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" aria-label={`Edit: ${c.title}`} onClick={() => setEditing({ checkpoint: c })}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" aria-label={`Delete: ${c.title}`} onClick={() => setDeleting(c)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </ListRow>
            </Box>
          )
        })}
      </Box>

      {editing && (
        <CheckpointDialog
          initial={editing.checkpoint}
          pending={createCheckpoint.isPending || updateCheckpoint.isPending}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete checkpoint?"
        message="This checkpoint will be permanently deleted."
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
      <Snackbar open={!!snackbar} message={snackbar} autoHideDuration={6000} onClose={closeSnackbar} />
    </>
  )
}
