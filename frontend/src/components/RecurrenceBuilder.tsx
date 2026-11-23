import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import { NO_RECURRENCE, WEEKDAYS, recurrenceError, type RecurrenceState } from './recurrence'

const FREQ_LABELS = { NONE: 'Does not repeat', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' }
const UNITS = { NONE: '', DAILY: 'day(s)', WEEKLY: 'week(s)', MONTHLY: 'month(s)', YEARLY: 'year(s)' }
const DAY_LABELS = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' }

// '' (empty field) -> NaN, which fails validation instead of silently becoming 0.
const toNumber = (s: string) => (s === '' ? NaN : Number(s))
const fromNumber = (n: number) => (Number.isNaN(n) ? '' : n)

type Props = {
  // null = a stored rule the builder can't represent; it is shown read-only until replaced.
  value: RecurrenceState | null
  rawRule: string | null
  start?: string // the event's local start date, to check the end date against
  onChange: (value: RecurrenceState) => void
}

// Needs a LocalizationProvider (AdapterDayjs) above it.
export default function RecurrenceBuilder({ value, rawRule, start, onChange }: Props) {
  if (!value) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2">Repeats (custom rule):</Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
          {rawRule}
        </Typography>
        <Button size="small" onClick={() => onChange(NO_RECURRENCE)}>
          Replace rule
        </Button>
      </Stack>
    )
  }

  const set = (patch: Partial<RecurrenceState>) => onChange({ ...value, ...patch })
  const error = recurrenceError(value, start)

  return (
    <Stack spacing={2}>
      <TextField select label="Repeats" value={value.freq} onChange={(e) => set({ freq: e.target.value as RecurrenceState['freq'] })}>
        {Object.entries(FREQ_LABELS).map(([freq, label]) => (
          <MenuItem key={freq} value={freq}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      {value.freq !== 'NONE' && (
        <>
          <TextField
            label="Every"
            type="number"
            value={fromNumber(value.interval)}
            onChange={(e) => set({ interval: toNumber(e.target.value) })}
            slotProps={{ htmlInput: { min: 1, max: 366 }, input: { endAdornment: UNITS[value.freq] } }}
          />
          {value.freq === 'WEEKLY' && (
            <FormControl component="fieldset">
              <FormLabel component="legend">On (none = start day)</FormLabel>
              <FormGroup row>
                {WEEKDAYS.map((d) => (
                  <FormControlLabel
                    key={d}
                    label={DAY_LABELS[d]}
                    control={
                      <Checkbox
                        checked={value.byDay.includes(d)}
                        onChange={(e) =>
                          set({ byDay: e.target.checked ? [...value.byDay, d] : value.byDay.filter((x) => x !== d) })
                        }
                      />
                    }
                  />
                ))}
              </FormGroup>
            </FormControl>
          )}
          <FormControl component="fieldset">
            <FormLabel component="legend">Ends</FormLabel>
            <RadioGroup value={value.end} onChange={(e) => set({ end: e.target.value as RecurrenceState['end'] })}>
              <FormControlLabel value="never" control={<Radio />} label="Never" />
              <FormControlLabel value="until" control={<Radio />} label="On date" />
              <FormControlLabel value="count" control={<Radio />} label="After a number of occurrences" />
            </RadioGroup>
          </FormControl>
          {value.end === 'until' && (
            <DatePicker
              label="End date"
              value={value.until ? dayjs(value.until) : null}
              onChange={(d) => set({ until: d?.isValid() ? d.format('YYYY-MM-DD') : '' })}
            />
          )}
          {value.end === 'count' && (
            <TextField
              label="Occurrences"
              type="number"
              value={fromNumber(value.count)}
              onChange={(e) => set({ count: toNumber(e.target.value) })}
              slotProps={{ htmlInput: { min: 1, max: 1000 } }}
            />
          )}
          {error && <FormHelperText error>{error}</FormHelperText>}
        </>
      )}
    </Stack>
  )
}
