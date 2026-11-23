import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Checkbox, IconButton, Paper, Snackbar, Stack, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import dayjs from 'dayjs'
import { ApiError } from '../api/client'
import CheckpointDialog from '../components/CheckpointDialog'
import ConfirmDialog from '../components/ConfirmDialog'
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
      <>
        <Typography variant="h4" component="h1" gutterBottom>
          Roadmap not found
        </Typography>
        <Button component={Link} to={focusUrl({ focus: 'roadmaps' })}>
          Back to roadmaps
        </Button>
      </>
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
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {roadmap.data?.title}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
          New checkpoint
        </Button>
      </Stack>

      {roadmap.data && (
        <Box sx={{ mb: 3, maxWidth: 400 }}>
          <RoadmapProgress done={roadmap.data.done_count} total={roadmap.data.total_count} />
        </Box>
      )}

      {roadmap.data && checkpoints.length === 0 && <Typography color="text.secondary">No checkpoints yet.</Typography>}

      <Stack spacing={1.5} component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {checkpoints.map((c, i) => {
          const overdue = !c.done_at && !!c.target_date && c.target_date < today
          return (
            <Paper
              key={c.id}
              component="li"
              variant="outlined"
              sx={{
                p: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'flex-start',
                borderColor: overdue ? 'secondary.main' : undefined,
              }}
            >
              <Checkbox
                checked={!!c.done_at}
                disabled={toggleDone.isPending}
                onChange={() => toggle(c)}
                slotProps={{ input: { 'aria-label': `Done: ${c.title}` } }}
              />
              {/* Text keeps >=180px; on narrow screens the buttons wrap to their own line. */}
              <Box sx={{ flex: '1 1 180px', minWidth: 0, pt: 1 }}>
                <Typography
                  sx={{ overflowWrap: 'anywhere', textDecoration: c.done_at ? 'line-through' : undefined }}
                >
                  {c.title}
                </Typography>
                {c.description && (
                  // Plain text, not markdown; pre-wrap keeps the user's newlines.
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {c.description}
                  </Typography>
                )}
                {c.target_date && (
                  <Typography variant="body2" color={overdue ? 'error' : 'text.secondary'} sx={{ mt: 0.5 }}>
                    {overdue ? `Overdue · target ${c.target_date}` : `Target ${c.target_date}`}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', ml: 'auto' }}>
                <IconButton
                  aria-label={`Move up: ${c.title}`}
                  disabled={i === 0 || reorder.isPending}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUpwardIcon />
                </IconButton>
                <IconButton
                  aria-label={`Move down: ${c.title}`}
                  disabled={i === checkpoints.length - 1 || reorder.isPending}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDownwardIcon />
                </IconButton>
                <IconButton aria-label={`Edit: ${c.title}`} onClick={() => setEditing({ checkpoint: c })}>
                  <EditIcon />
                </IconButton>
                <IconButton aria-label={`Delete: ${c.title}`} onClick={() => setDeleting(c)}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Paper>
          )
        })}
      </Stack>

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
