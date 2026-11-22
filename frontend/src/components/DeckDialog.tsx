import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'

const MAX = 200

type Props = {
  initialTitle?: string
  onSubmit: (title: string) => void
  onClose: () => void
}

// Rendered only while open, so state resets from initialTitle each time.
export default function DeckDialog({ initialTitle = '', onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [touched, setTouched] = useState(false)
  const trimmed = title.trim()
  const error = !trimmed ? 'Title is required' : trimmed.length > MAX ? `Max ${MAX} characters` : ''

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!error) onSubmit(trimmed)
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{initialTitle ? 'Rename deck' : 'New deck'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={touched && !!error}
            helperText={touched && error}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
