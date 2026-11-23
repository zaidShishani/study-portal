import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import dayjs from 'dayjs'
import type { EventInput } from '../types'
import EventDialog from './EventDialog'

afterEach(cleanup)

const START = dayjs('2026-11-23T09:00:00') // local wall time
const initial: EventInput = {
  title: '',
  description: null,
  start_at: START.format(),
  end_at: START.add(1, 'hour').format(),
  all_day: false,
  rrule: null,
  remind_minutes_before: null,
}

function choose(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }))
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }))
}

test('submits a weekly event with offset times, reminder and RRULE', () => {
  const onSubmit = vi.fn(() => Promise.resolve())
  render(<EventDialog initial={initial} onSubmit={onSubmit} onClose={() => {}} />)
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Gym  ' } })
  choose('Reminder', '15 minutes before')
  choose('Repeats', 'Weekly')
  fireEvent.click(screen.getByLabelText('Mon'))
  fireEvent.click(screen.getByLabelText('Wed'))
  fireEvent.click(screen.getByLabelText('After a number of occurrences'))
  fireEvent.change(screen.getByLabelText('Occurrences'), { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(onSubmit).toHaveBeenCalledTimes(1)
  const body = (onSubmit.mock.calls[0] as unknown as [EventInput])[0]
  expect(body).toEqual({
    title: 'Gym',
    description: null,
    start_at: START.format('YYYY-MM-DDTHH:mm:ssZ'),
    end_at: START.add(1, 'hour').format('YYYY-MM-DDTHH:mm:ssZ'),
    all_day: false,
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;COUNT=6',
    remind_minutes_before: 15,
  })
  expect(body.start_at).toMatch(/T09:00:00[+-]\d\d:\d\d$/)
})

test('all-day event sends local midnight to the midnight after the last day', () => {
  const onSubmit = vi.fn(() => Promise.resolve())
  render(<EventDialog initial={{ ...initial, title: 'Trip' }} onSubmit={onSubmit} onClose={() => {}} />)
  fireEvent.click(screen.getByLabelText('All day'))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  const body = (onSubmit.mock.calls[0] as unknown as [EventInput])[0]
  expect(body.all_day).toBe(true)
  expect(body.start_at).toBe(START.startOf('day').format('YYYY-MM-DDTHH:mm:ssZ'))
  expect(body.end_at).toBe(START.startOf('day').add(1, 'day').format('YYYY-MM-DDTHH:mm:ssZ'))
})

test('double submit sends once while the first is pending', async () => {
  let release = () => {}
  const onSubmit = vi.fn(() => new Promise<void>((r) => (release = r)))
  render(<EventDialog initial={{ ...initial, title: 'Gym' }} onSubmit={onSubmit} onClose={() => {}} />)
  const save = screen.getByRole('button', { name: 'Save' })
  fireEvent.click(save)
  fireEvent.click(save)
  expect(onSubmit).toHaveBeenCalledTimes(1)
  release()
  await Promise.resolve()
})

test('blocks invalid input', () => {
  const onSubmit = vi.fn(() => Promise.resolve())
  render(<EventDialog initial={initial} onSubmit={onSubmit} onClose={() => {}} />)
  choose('Reminder', 'Custom')
  fireEvent.change(screen.getByLabelText('Minutes before'), { target: { value: '10081' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByText('Title is required')).toBeTruthy()
  expect(screen.getByText('Enter 0-10080 minutes')).toBeTruthy()
})

test('edit shows an unknown rule read-only, keeps it on save, and can replace it', async () => {
  const onSubmit = vi.fn(() => Promise.resolve())
  const onDelete = vi.fn()
  const rule = 'FREQ=WEEKLY;WKST=SU'
  render(
    <EventDialog
      initial={{ ...initial, title: 'Gym', rrule: rule, remind_minutes_before: 90 }}
      onSubmit={onSubmit}
      onDelete={onDelete}
      onClose={() => {}}
    />,
  )
  expect(screen.getByText(rule)).toBeTruthy()
  expect(screen.getByLabelText('Minutes before')).toHaveProperty('value', '90')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect((onSubmit.mock.calls[0] as unknown as [EventInput])[0].rrule).toBe(rule)
  await act(() => Promise.resolve()) // let the double-submit guard reset

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(onDelete).toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Replace rule' }))
  choose('Repeats', 'Daily')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect((onSubmit.mock.calls[1] as unknown as [EventInput])[0].rrule).toBe('FREQ=DAILY;INTERVAL=1')
})
