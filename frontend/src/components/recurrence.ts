// RRULE <-> builder state, limited to the subset the backend accepts (see app/services/rrule.py).

export const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type Freq = (typeof FREQS)[number]
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export type RecurrenceState = {
  freq: Freq | 'NONE'
  interval: number
  byDay: Weekday[] // WEEKLY only; empty = the start date's weekday
  end: 'never' | 'until' | 'count'
  until: string // YYYY-MM-DD
  count: number
}

export const NO_RECURRENCE: RecurrenceState = { freq: 'NONE', interval: 1, byDay: [], end: 'never', until: '', count: 10 }

const isInt = (n: number, max: number) => Number.isInteger(n) && n >= 1 && n <= max

// '' when the state can be saved.
export function recurrenceError(s: RecurrenceState): string {
  if (s.freq === 'NONE') return ''
  if (!isInt(s.interval, 366)) return 'Interval must be 1-366'
  if (s.end === 'until' && !/^\d{4}-\d{2}-\d{2}$/.test(s.until)) return 'Enter an end date'
  if (s.end === 'count' && !isInt(s.count, 1000)) return 'Occurrences must be 1-1000'
  return ''
}

export function buildRRule(s: RecurrenceState): string | null {
  if (s.freq === 'NONE') return null
  const parts = [`FREQ=${s.freq}`, `INTERVAL=${s.interval}`]
  if (s.freq === 'WEEKLY' && s.byDay.length) parts.push(`BYDAY=${WEEKDAYS.filter((d) => s.byDay.includes(d)).join(',')}`)
  // Whole end day, in UTC (the backend requires the Z form).
  if (s.end === 'until') parts.push(`UNTIL=${s.until.replaceAll('-', '')}T235959Z`)
  if (s.end === 'count') parts.push(`COUNT=${s.count}`)
  return parts.join(';')
}

// The builder state for a stored rule, or null when the rule uses anything the builder can't show.
export function parseRRule(rule: string | null): RecurrenceState | null {
  if (!rule) return NO_RECURRENCE
  const params = new Map<string, string>()
  for (const part of rule.split(';')) {
    const [key, value, extra] = part.split('=')
    if (!value || extra !== undefined || params.has(key)) return null
    params.set(key, value)
  }
  const { FREQ, INTERVAL = '1', BYDAY, UNTIL, COUNT, ...rest } = Object.fromEntries(params)
  if (Object.keys(rest).length || (UNTIL && COUNT)) return null
  if (!FREQS.includes(FREQ as Freq) || !/^\d+$/.test(INTERVAL)) return null
  const byDay = BYDAY ? BYDAY.split(',') : []
  if (byDay.length && (FREQ !== 'WEEKLY' || !byDay.every((d) => WEEKDAYS.includes(d as Weekday)))) return null
  const until = UNTIL?.match(/^(\d{4})(\d{2})(\d{2})T235959Z$/)
  if (UNTIL && !until) return null
  if (COUNT && !/^\d+$/.test(COUNT)) return null
  const state: RecurrenceState = {
    ...NO_RECURRENCE,
    freq: FREQ as Freq,
    interval: Number(INTERVAL),
    byDay: byDay as Weekday[],
    ...(until && { end: 'until', until: `${until[1]}-${until[2]}-${until[3]}` }),
    ...(COUNT && { end: 'count', count: Number(COUNT) }),
  }
  return recurrenceError(state) ? null : state
}
