import { expect, test } from 'vitest'
import { NO_RECURRENCE, buildRRule, parseRRule, recurrenceError, type RecurrenceState } from './recurrence'

const s = (patch: Partial<RecurrenceState>): RecurrenceState => ({ ...NO_RECURRENCE, ...patch })

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
