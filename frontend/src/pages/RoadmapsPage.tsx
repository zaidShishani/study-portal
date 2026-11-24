import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, IconButton, Snackbar, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import { HeaderActions } from '../components/Card'
import ListRow from '../components/ListRow'
import RoadmapProgress from '../components/RoadmapProgress'
import ConfirmDialog from '../components/ConfirmDialog'
import DeckDialog from '../components/DeckDialog'
import { useCreateRoadmap, useDeleteRoadmap, useRenameRoadmap, useRoadmaps } from '../hooks/useRoadmaps'
import { focusUrl } from '../hooks/useFocus'
import type { Roadmap } from '../types'

export default function RoadmapsPage() {
  const roadmaps = useRoadmaps()
  const createRoadmap = useCreateRoadmap()
  const renameRoadmap = useRenameRoadmap()
  const deleteRoadmap = useDeleteRoadmap()
  // null = closed; { roadmap: undefined } = create; { roadmap } = rename.
  const [editing, setEditing] = useState<{ roadmap?: Roadmap } | null>(null)
  const [deleting, setDeleting] = useState<Roadmap | null>(null)
  // Separate flag keeps the title visible during the close animation.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const snackbar = message || (roadmaps.error && roadmaps.error !== dismissedError ? roadmaps.error.message : '')

  function closeSnackbar() {
    setMessage('')
    setDismissedError(roadmaps.error)
  }

  function save(title: string) {
    const req = editing?.roadmap
      ? renameRoadmap.mutateAsync({ id: editing.roadmap.id, title })
      : createRoadmap.mutateAsync(title)
    return req.then(() => setEditing(null), onError)
  }

  function confirmDelete() {
    if (deleting) deleteRoadmap.mutate(deleting.id, { onError })
    setDeleteOpen(false)
  }

  return (
    <>
      <HeaderActions>
        <Button size="small" variant="contained" onClick={() => setEditing({})}>
          New roadmap
        </Button>
      </HeaderActions>

      {roadmaps.data?.length === 0 && (
        <Typography color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          No roadmaps yet.
        </Typography>
      )}

      {roadmaps.data?.map((roadmap) => (
        <ListRow key={roadmap.id}>
          <Box
            component={Link}
            to={focusUrl({ focus: 'roadmaps', roadmap: roadmap.id })}
            sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
          >
            {roadmap.title}
          </Box>
          <RoadmapProgress title={roadmap.title} done={roadmap.done_count} total={roadmap.total_count} />
          <IconButton size="small" aria-label={`Rename ${roadmap.title}`} onClick={() => setEditing({ roadmap })}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label={`Delete ${roadmap.title}`}
            onClick={() => {
              setDeleting(roadmap)
              setDeleteOpen(true)
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </ListRow>
      ))}

      {editing && (
        <DeckDialog
          noun="roadmap"
          initialTitle={editing.roadmap?.title}
          pending={createRoadmap.isPending || renameRoadmap.isPending}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete roadmap?"
        message={`"${deleting?.title ?? ''}" and all its checkpoints will be deleted.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
      <Snackbar open={!!snackbar} message={snackbar} autoHideDuration={6000} onClose={closeSnackbar} />
    </>
  )
}
