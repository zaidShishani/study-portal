import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NO_RECURRENCE, buildRRule, parseRRule, recurrenceError, untilFromDate, type RecurrenceState } from './recurrence'

const s = (patch: Partial<RecurrenceState>): RecurrenceState => ({ ...NO_RECURRENCE, ...patch })

// UNTIL depends on the local zone; Node re-reads TZ when it changes. Default to UTC.
beforeEach(() => {
  vi.stubEnv('TZ', 'UTC')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test.each([
  ['UTC', '20261231T235959Z'],
  ['America/Los_Angeles', '20270101T075959Z'], // west of UTC: the local end of day is the next UTC day
  ['Asia/Tokyo', '20261231T145959Z'],
])('UNTIL is the end of the local day in %s', (tz, until) => {
  vi.stubEnv('TZ', tz)
  expect(untilFromDate('2026-12-31')).toBe(until)
  const rule = `FREQ=DAILY;INTERVAL=1;UNTIL=${until}`
  expect(buildRRule(s({ freq: 'DAILY', end: 'until', until: '2026-12-31' }))).toBe(rule)
  expect(parseRRule(rule)?.until).toBe('2026-12-31')
})

test('an UNTIL that is not the end of a local day is shown read-only', () => {
  vi.stubEnv('TZ', 'America/Los_Angeles')
  expect(parseRRule('FREQ=DAILY;UNTIL=20261231T235959Z')).toBeNull()
})

test('UNTIL across a DST change uses that day’s offset', () => {
  vi.stubEnv('TZ', 'America/Los_Angeles')
  expect(untilFromDate('2026-07-04')).toBe('20260705T065959Z') // PDT, UTC-7
})

test.each([
  [s({ freq: 'DAILY' }), 'FREQ=DAILY;INTERVAL=1'],
  [s({ freq: 'DAILY', interval: 366 }), 'FREQ=DAILY;INTERVAL=366'],
  [s({ freq: 'WEEKLY' }), 'FREQ=WEEKLY;INTERVAL=1'],
  [s({ freq: 'WEEKLY', interval: 2, byDay: ['MO', 'WE'] }), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE'],
  [s({ freq: 'WEEKLY', byDay: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] }), 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR,SA,SU'],
  [s({ freq: 'MONTHLY', end: 'until', until: '2027-01-31' }), 'FREQ=MONTHLY;INTERVAL=1;UNTIL=20270131T235959Z'],
  [s({ freq: 'YEARLY', interval: 3, end: 'count', count: 1000 }), 'FREQ=YEARLY;INTERVAL=3;COUNT=1000'],
  [s({ freq: 'DAILY', end: 'count', count: 1 }), 'FREQ=DAILY;INTERVAL=1;COUNT=1'],
])('builds and round-trips %j', (state, rule) => {
  expect(buildRRule(state)).toBe(rule)
  expect(rule).not.toMatch(/\s/)
  expect(buildRRule(parseRRule(rule)!)).toBe(rule)
})

test('none builds null and parses from empty', () => {
  expect(buildRRule(NO_RECURRENCE)).toBeNull()
  expect(parseRRule(null)).toEqual(NO_RECURRENCE)
  expect(parseRRule('')).toEqual(NO_RECURRENCE)
})

test('BYDAY is dropped for non-weekly and days are emitted in week order', () => {
  expect(buildRRule(s({ freq: 'MONTHLY', byDay: ['MO'] }))).toBe('FREQ=MONTHLY;INTERVAL=1')
  expect(parseRRule('FREQ=WEEKLY;BYDAY=FR,MO')?.byDay).toEqual(['FR', 'MO'])
  expect(buildRRule(parseRRule('FREQ=WEEKLY;BYDAY=FR,MO')!)).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR')
})

test('parses an existing rule into state', () => {
  expect(parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T235959Z')).toEqual({
    freq: 'WEEKLY',
    interval: 2,
    byDay: ['MO', 'WE'],
    end: 'until',
    until: '2026-12-31',
    count: 10,
  })
  expect(parseRRule('FREQ=DAILY')).toEqual(s({ freq: 'DAILY' }))
})

test.each([
  'RRULE:FREQ=DAILY',
  'FREQ=daily',
  'FREQ=HOURLY',
  'FREQ=DAILY;WKST=MO',
  'FREQ=DAILY;BYMONTHDAY=1',
  'FREQ=MONTHLY;BYDAY=MO',
  'FREQ=WEEKLY;BYDAY=1MO',
  'FREQ=DAILY;INTERVAL=0',
  'FREQ=DAILY;INTERVAL=367',
  'FREQ=DAILY;COUNT=0',
  'FREQ=DAILY;COUNT=1001',
  'FREQ=DAILY;UNTIL=20261231T120000Z',
  'FREQ=DAILY;UNTIL=20261231',
  'FREQ=DAILY;COUNT=3;UNTIL=20261231T235959Z',
  'FREQ=DAILY;FREQ=WEEKLY',
  'FREQ=DAILY; INTERVAL=2',
  'garbage',
])('unknown rule %s parses to null (shown read-only)', (rule) => {
  expect(parseRRule(rule)).toBeNull()
})

test('validation errors', () => {
  expect(recurrenceError(s({ freq: 'DAILY', interval: 0 }))).toMatch(/Interval/)
  expect(recurrenceError(s({ freq: 'DAILY', interval: NaN }))).toMatch(/Interval/)
  expect(recurrenceError(s({ freq: 'DAILY', interval: 1.5 }))).toMatch(/Interval/)
  expect(recurrenceError(s({ freq: 'DAILY', end: 'until', until: '' }))).toMatch(/end date/)
  expect(recurrenceError(s({ freq: 'DAILY', end: 'count', count: 1001 }))).toMatch(/Occurrences/)
  expect(recurrenceError(s({ freq: 'NONE', interval: 0 }))).toBe('')
})
