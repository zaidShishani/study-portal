import { useRef, useState, type FormEvent } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { type Dayjs } from 'dayjs'
import RecurrenceBuilder from './RecurrenceBuilder'
import { buildRRule, parseRRule, recurrenceError } from './recurrence'
import type { EventInput } from '../types'

const MAX_TITLE = 200
const MAX_TEXT = 10_000
const MAX_REMIND = 10_080 // one week, the backend's limit
const PRESETS: Record<string, string> = { '0': 'At start time', '5': '5 minutes before', '15': '15 minutes before', '30': '30 minutes before', '60': '1 hour before', '1440': '1 day before' }

// Local wall time with its UTC offset, e.g. 2026-11-22T09:00:00+02:00.
const iso = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm:ssZ')

type Props = {
  initial: EventInput
  pending?: boolean
  onSubmit: (input: EventInput) => Promise<unknown>
  onDelete?: () => void // present = editing an existing event
  onClose: () => void
}

// Rendered only while open, so state resets from `initial` each time.
export default function EventDialog({ initial, pending = false, onSubmit, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description ?? '')
  const [allDay, setAllDay] = useState(initial.all_day)
  const [start, setStart] = useState<Dayjs | null>(dayjs(initial.start_at))
  // All-day ends are exclusive (midnight after the last day); the picker shows the last day itself.
  const [end, setEnd] = useState<Dayjs | null>(() => {
    if (!initial.end_at) return dayjs(initial.start_at)
    const e = dayjs(initial.end_at)
    return initial.all_day && e.isAfter(initial.start_at) ? e.subtract(1, 'day') : e
  })
  const remind = initial.remind_minutes_before
  const [remindChoice, setRemindChoice] = useState(remind === null ? 'none' : String(remind) in PRESETS ? String(remind) : 'custom')
  const [customRemind, setCustomRemind] = useState(remind === null ? '30' : String(remind))
  const [recurrence, setRecurrence] = useState(() => parseRRule(initial.rrule))
  const [touched, setTouched] = useState(false)
  // isPending lands a render late; the ref blocks a same-tick double click.
  const busy = useRef(false)

  const trimmed = title.trim()
  const customMinutes = Number(customRemind)
  const unit = allDay ? 'day' : 'minute'
  const errors = {
    title: !trimmed ? 'Title is required' : trimmed.length > MAX_TITLE ? `Max ${MAX_TITLE} characters` : '',
    description: description.length > MAX_TEXT ? 'Max 10,000 characters' : '',
    start: start?.isValid() ? '' : 'Enter a valid start',
    end: !end?.isValid() ? 'Enter a valid end' : start?.isValid() && end.isBefore(start, unit) ? 'End must not be before start' : '',
    remind:
      remindChoice === 'custom' && !(customRemind !== '' && Number.isInteger(customMinutes) && customMinutes >= 0 && customMinutes <= MAX_REMIND)
        ? `Enter 0-${MAX_REMIND} minutes`
        : '',
    recurrence: recurrence ? recurrenceError(recurrence) : '',
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.values(errors).some(Boolean) || busy.current || !start || !end) return
    busy.current = true
    const input: EventInput = {
      title: trimmed,
      description: description || null,
      start_at: iso(allDay ? start.startOf('day') : start),
      end_at: iso(allDay ? end.startOf('day').add(1, 'day') : end),
      all_day: allDay,
      rrule: recurrence ? buildRRule(recurrence) : initial.rrule,
      remind_minutes_before: remindChoice === 'none' ? null : remindChoice === 'custom' ? customMinutes : Number(remindChoice),
    }
    Promise.resolve(onSubmit(input)).finally(() => {
      busy.current = false
    })
  }

  const Picker = allDay ? DatePicker : DateTimePicker
  const pickerField = (error: string) => ({
    textField: { error: touched && !!error, helperText: touched && error },
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{onDelete ? 'Edit event' : 'New event'}</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                minRows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={touched && !!errors.description}
                helperText={touched && errors.description}
              />
              <FormControlLabel
                control={<Switch checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />}
                label="All day"
              />
              <Picker label="Start" value={start} onChange={setStart} slotProps={pickerField(errors.start)} />
              <Picker label="End" value={end} onChange={setEnd} slotProps={pickerField(errors.end)} />
              <TextField select label="Reminder" value={remindChoice} onChange={(e) => setRemindChoice(e.target.value)}>
                <MenuItem value="none">None</MenuItem>
                {Object.entries(PRESETS).map(([minutes, label]) => (
                  <MenuItem key={minutes} value={minutes}>
                    {label}
                  </MenuItem>
                ))}
                <MenuItem value="custom">Custom</MenuItem>
              </TextField>
              {remindChoice === 'custom' && (
                <TextField
                  label="Minutes before"
                  type="number"
                  value={customRemind}
                  onChange={(e) => setCustomRemind(e.target.value)}
                  slotProps={{ htmlInput: { min: 0, max: MAX_REMIND } }}
                  error={touched && !!errors.remind}
                  helperText={touched && errors.remind}
                />
              )}
              <RecurrenceBuilder value={recurrence} rawRule={initial.rrule} onChange={setRecurrence} />
            </Stack>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          {onDelete && (
            <Button color="error" onClick={onDelete} sx={{ mr: 'auto' }}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={pending}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
