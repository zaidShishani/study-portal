import { useRef, useState, type FormEvent } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material'
import type { AttemptInput } from '../api/problems'
import { RESULT_LABELS, type LastResult } from '../types'

const MAX_MINUTES = 1440

type Props = {
  pending?: boolean
  onSubmit: (input: AttemptInput) => Promise<unknown>
  onClose: () => void
}

// Rendered only while open, so state resets each time.
export default function AttemptDialog({ pending = false, onSubmit, onClose }: Props) {
  const [result, setResult] = useState<LastResult | ''>('')
  const [minutes, setMinutes] = useState('')
  const [touched, setTouched] = useState(false)
  // isPending arrives a render late; the ref blocks a second submit immediately.
  const busy = useRef(false)

  const errors = {
    result: result ? '' : 'Choose a result',
    minutes:
      minutes.trim() && !(/^\d+$/.test(minutes.trim()) && Number(minutes) <= MAX_MINUTES)
        ? `Whole minutes, 0–${MAX_MINUTES}`
        : '',
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.values(errors).some(Boolean) || pending || busy.current || !result) return
    busy.current = true
    Promise.resolve(onSubmit({ result, minutes: minutes.trim() ? Number(minutes) : null })).finally(() => {
      busy.current = false
    })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Log attempt</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl error={touched && !!errors.result}>
              <FormLabel id="attempt-result">Result</FormLabel>
              <RadioGroup
                aria-labelledby="attempt-result"
                value={result}
                onChange={(e) => setResult(e.target.value as LastResult)}
              >
                {Object.entries(RESULT_LABELS).map(([value, label]) => (
                  <FormControlLabel key={value} value={value} control={<Radio />} label={label} />
                ))}
              </RadioGroup>
              {touched && errors.result && <FormHelperText>{errors.result}</FormHelperText>}
            </FormControl>
            <TextField
              label="Minutes (optional)"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              error={touched && !!errors.minutes}
              helperText={touched && errors.minutes}
            />
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
