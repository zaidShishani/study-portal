import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  IconButton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ConfirmDialog from '../components/ConfirmDialog'
import DeckDialog from '../components/DeckDialog'
import RoadmapProgress from '../components/RoadmapProgress'
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
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Roadmaps
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
          New roadmap
        </Button>
      </Stack>

      {roadmaps.data?.length === 0 && (
        <Typography color="text.secondary">No roadmaps yet. Create one to get started.</Typography>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {roadmaps.data?.map((roadmap) => (
          <Card key={roadmap.id} variant="outlined">
            <CardActionArea component={Link} to={focusUrl({ focus: 'roadmaps', roadmap: roadmap.id })}>
              <CardContent>
                <Typography variant="h6" component="h2" noWrap title={roadmap.title} gutterBottom>
                  {roadmap.title}
                </Typography>
                <RoadmapProgress done={roadmap.done_count} total={roadmap.total_count} />
              </CardContent>
            </CardActionArea>
            <CardActions sx={{ justifyContent: 'flex-end' }}>
              <IconButton aria-label={`Rename ${roadmap.title}`} onClick={() => setEditing({ roadmap })}>
                <EditIcon />
              </IconButton>
              <IconButton
                aria-label={`Delete ${roadmap.title}`}
                onClick={() => {
                  setDeleting(roadmap)
                  setDeleteOpen(true)
                }}
              >
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

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
