import { useRef, useState, type FormEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormHelperText, Stack } from '@mui/material'
import MarkdownEditor from './MarkdownEditor'

const MAX = 10_000

type Props = {
  initial?: { front: string; back: string }
  pending?: boolean
  onSubmit: (values: { front: string; back: string }) => Promise<unknown>
  onClose: () => void
}

const validate = (value: string) => (!value.trim() ? 'Required' : value.length > MAX ? `Max ${MAX} characters` : '')

// Rendered only while open, so state resets from `initial` each time.
export default function CardDialog({ initial, pending = false, onSubmit, onClose }: Props) {
  const [front, setFront] = useState(initial?.front ?? '')
  const [back, setBack] = useState(initial?.back ?? '')
  const [touched, setTouched] = useState(false)
  const errors = { front: validate(front), back: validate(back) }
  // isPending lands a render late; the ref blocks a same-tick double click.
  const busy = useRef(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    // Markdown is sent as typed; whitespace can be meaningful.
    if (errors.front || errors.back || busy.current) return
    busy.current = true
    Promise.resolve(onSubmit({ front, back })).finally(() => {
      busy.current = false
    })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{initial ? 'Edit card' : 'New card'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <div>
              <MarkdownEditor label="Front" value={front} onChange={setFront} minRows={3} />
              {touched && errors.front && <FormHelperText error>Front: {errors.front}</FormHelperText>}
            </div>
            <div>
              <MarkdownEditor label="Back" value={back} onChange={setBack} minRows={3} />
              {touched && errors.back && <FormHelperText error>Back: {errors.back}</FormHelperText>}
            </div>
          </Stack>
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
