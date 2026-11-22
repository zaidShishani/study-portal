import { useRef, useState, type FormEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material'

const MAX = 200

export type FolderOption = { id: number; name: string; depth: number }

type Props = {
  title: string
  // undefined hides the name field (move).
  initialName?: string
  // undefined hides the parent picker (rename).
  folders?: FolderOption[]
  initialParent?: number | null
  pending?: boolean
  onSubmit: (value: { name: string; parentId: number | null }) => Promise<unknown>
  onClose: () => void
}

// Create (name + parent), rename (name) or move (parent). Rendered only while open, so state resets each time.
export default function NoteDialog({ title, initialName, folders, initialParent = null, pending = false, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initialName ?? '')
  const [parent, setParent] = useState(initialParent === null ? 'root' : String(initialParent))
  const [touched, setTouched] = useState(false)
  // isPending lands a render late; the ref blocks a same-tick double click.
  const busy = useRef(false)
  const trimmed = name.trim()
  const error = initialName === undefined ? '' : !trimmed ? 'Name is required' : trimmed.length > MAX ? `Max ${MAX} characters` : ''

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (error || busy.current) return
    busy.current = true
    Promise.resolve(onSubmit({ name: trimmed, parentId: parent === 'root' ? null : Number(parent) })).finally(() => {
      busy.current = false
    })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {initialName !== undefined && (
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={touched && !!error}
              helperText={touched && error}
            />
          )}
          {folders && (
            <TextField select fullWidth margin="dense" label="Parent folder" value={parent}
              onChange={(e) => setParent(e.target.value)}>
              <MenuItem value="root">(Root)</MenuItem>
              {folders.map((f) => (
                <MenuItem key={f.id} value={String(f.id)} sx={{ pl: 2 + f.depth * 2 }}>
                  {f.name}
                </MenuItem>
              ))}
            </TextField>
          )}
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
