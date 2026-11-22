import { useRef, useState, type FormEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'

const MAX = 200

type Props = {
  initialTitle?: string
  // Also used for roadmaps, which share the same title-only create/rename form.
  noun?: string
  pending?: boolean
  onSubmit: (title: string) => Promise<unknown>
  onClose: () => void
}

// Rendered only while open, so state resets from initialTitle each time.
export default function DeckDialog({ initialTitle = '', noun = 'deck', pending = false, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [touched, setTouched] = useState(false)
  const trimmed = title.trim()
  // isPending lands a render late; the ref blocks a same-tick double click.
  const busy = useRef(false)
  const error = !trimmed ? 'Title is required' : trimmed.length > MAX ? `Max ${MAX} characters` : ''

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (error || busy.current) return
    busy.current = true
    Promise.resolve(onSubmit(trimmed)).finally(() => {
      busy.current = false
    })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{initialTitle ? 'Rename' : 'New'} {noun}</DialogTitle>
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
          <Button type="submit" variant="contained" disabled={pending}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
