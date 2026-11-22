import { useRef, useState, type FormEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import type { DateValidationError } from '@mui/x-date-pickers/models'
import dayjs, { type Dayjs } from 'dayjs'
import type { CheckpointInput } from '../types'

const MAX_TITLE = 200
const MAX_TEXT = 10_000

type Props = {
  initial?: CheckpointInput
  pending?: boolean
  onSubmit: (input: CheckpointInput) => Promise<unknown>
  onClose: () => void
}

// Rendered only while open, so state resets from `initial` each time.
export default function CheckpointDialog({ initial, pending = false, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState<Dayjs | null>(initial?.target_date ? dayjs(initial.target_date) : null)
  // MUI reports invalid dates (e.g. Feb 30) via onError, but a partly typed one ("01/DD/YYYY") reaches
  // onChange as null with no error; only the field's hidden input text tells it apart from empty.
  const [dateError, setDateError] = useState<DateValidationError | null>(null)
  const [partialDate, setPartialDate] = useState(false)
  const dateInput = useRef<HTMLInputElement>(null)
  const [touched, setTouched] = useState(false)
  // isPending lands a render late; the ref blocks a same-tick double click.
  const busy = useRef(false)

  const trimmed = title.trim()
  const errors = {
    title: !trimmed ? 'Title is required' : trimmed.length > MAX_TITLE ? `Max ${MAX_TITLE} characters` : '',
    description: description.length > MAX_TEXT ? 'Max 10,000 characters' : '',
    date: dateError || partialDate ? 'Enter a valid date' : '',
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    const partial = !date && !!dateInput.current?.value
    setPartialDate(partial)
    if (Object.values(errors).some(Boolean) || partial || busy.current) return
    busy.current = true
    const input: CheckpointInput = {
      title: trimmed,
      description: description || null,
      target_date: date ? date.format('YYYY-MM-DD') : null,
    }
    Promise.resolve(onSubmit(input)).finally(() => {
      busy.current = false
    })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{initial ? 'Edit checkpoint' : 'New checkpoint'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={touched && !!errors.title}
              helperText={touched && errors.title}
            />
            <TextField
              label="Description"
              multiline
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={touched && !!errors.description}
              helperText={touched && errors.description}
            />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Target date"
                value={date}
                onChange={(value) => {
                  setDate(value)
                  setPartialDate(false)
                }}
                onError={setDateError}
                slotProps={{
                  field: { clearable: true },
                  // undefined (not false) keeps MUI's own red outline for a partly filled field on blur.
                  textField: {
                    inputRef: dateInput,
                    error: touched && errors.date ? true : undefined,
                    helperText: touched && errors.date,
                  },
                }}
              />
            </LocalizationProvider>
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
