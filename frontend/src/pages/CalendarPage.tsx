import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Snackbar, Stack, Typography, useTheme } from '@mui/material'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput as FcEvent } from '@fullcalendar/core'
import dayjs from 'dayjs'
import ConfirmDialog from '../components/ConfirmDialog'
import EventDialog from '../components/EventDialog'
import {
  useCalendar,
  useCreateEvent,
  useDeleteEvent,
  useEvent,
  useUpdateEvent,
  type Range,
} from '../hooks/useCalendar'
import { focusUrl } from '../hooks/useFocus'
import type { EventInput } from '../types'

const ymd = (d: Date | string) => dayjs(d).format('YYYY-MM-DD')

export default function CalendarPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range | null>(null)
  const calendar = useCalendar(range)
  // null = closed; { id: null, initial } = create; { id } = edit (fields come from useEvent).
  const [editing, setEditing] = useState<{ id: number | null; initial?: EventInput } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const event = useEvent(editing?.id ?? null)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const loadError = calendar.error ?? event.error
  const snackbar = message || (loadError && loadError !== dismissedError ? loadError.message : '')

  const { palette } = theme
  // Own events are solid monochrome; derived items get a soft tint of their meaning color with plain text.
  const tint = (c: { main: string; light: string }) => ({ backgroundColor: c.light, borderColor: c.light, textColor: palette.text.primary, dot: c.main })
  const colors = {
    event: { backgroundColor: palette.primary.main, borderColor: palette.primary.main, textColor: palette.primary.contrastText, dot: palette.primary.main },
    cards: tint(palette.success),
    problem: tint(palette.warning),
    checkpoint: tint(palette.info),
  }
  const data = calendar.data
  // Derived items are plain all-day entries with a link target; they're never editable.
  const items: FcEvent[] = data
    ? [
        ...data.events.map((e) => ({
          title: e.title,
          // The API sends UTC; all-day occurrences start at local midnight, so the local date is the day.
          start: e.all_day ? ymd(e.start) : e.start,
          end: e.end ? (e.all_day ? ymd(e.end) : e.end) : undefined,
          allDay: e.all_day,
          ...colors.event,
          extendedProps: { eventId: e.event_id },
        })),
        ...data.card_due.map((c) => ({
          title: `${c.count} ${c.count === 1 ? 'card' : 'cards'} due`,
          start: c.date,
          allDay: true,
          ...colors.cards,
          extendedProps: { to: focusUrl({ focus: 'flashcards', review: 'all' }) },
        })),
        ...data.problems_due.map((p) => ({
          title: p.title,
          start: p.date,
          allDay: true,
          ...colors.problem,
          extendedProps: { to: focusUrl({ focus: 'leetcode', problem: p.id }) },
        })),
        ...data.checkpoints.map((c) => ({
          title: c.title,
          start: c.date,
          allDay: true,
          ...colors.checkpoint,
          extendedProps: { to: focusUrl({ focus: 'roadmaps', roadmap: c.roadmap_id }) },
        })),
      ]
    : []

  function closeSnackbar() {
    setMessage('')
    setDismissedError(loadError)
  }

  function save(input: EventInput) {
    const req = editing?.id ? updateEvent.mutateAsync({ id: editing.id, ...input }) : createEvent.mutateAsync(input)
    return req.then(() => setEditing(null), onError)
  }

  function confirmDelete() {
    if (editing?.id) deleteEvent.mutate(editing.id, { onError, onSuccess: () => setEditing(null) })
    setDeleting(false)
  }

  const invalidCount = data?.invalid_event_ids?.length ?? 0
  const dialogInitial = editing?.id ? event.data : editing?.initial

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Calendar
      </Typography>
      <Stack direction="row" component="ul" sx={{ gap: 2, flexWrap: 'wrap', listStyle: 'none', p: 0, m: 0, mb: 2 }} aria-label="Legend">
        {(
          [
            ['event', 'Event'],
            ['cards', 'Cards due'],
            ['problem', 'Problem due'],
            ['checkpoint', 'Checkpoint target'],
          ] as const
        ).map(([key, label]) => (
          <Stack key={key} component="li" direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: colors[key].dot }} />
            <Typography variant="body2">{label}</Typography>
          </Stack>
        ))}
      </Stack>
      {data?.truncated && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This range has too many items; some are not shown.
        </Alert>
      )}
      {invalidCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {invalidCount} event(s) have a recurrence rule that can't be shown.
        </Alert>
      )}
      {/* Toolbar wraps and the title shrinks so a phone-width screen doesn't scroll sideways. */}
      <Box
        sx={{
          '& .fc-header-toolbar': { flexWrap: 'wrap', gap: 1 },
          '& .fc-toolbar-title': { fontSize: { xs: '1.1rem', sm: '1.75em' } },
        }}
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          dayMaxEvents={3}
          // The browser's zone, which useMe keeps in sync with the user's (so /api/calendar dates match).
          timeZone="local"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
          height="auto"
          events={items}
          datesSet={({ start, end }) => {
            // end is exclusive; the API takes inclusive dates.
            const next = { from: ymd(start), to: ymd(dayjs(end).subtract(1, 'day').toDate()) }
            setRange((r) => (r?.from === next.from && r.to === next.to ? r : next))
          }}
          dateClick={({ date, allDay, view }) => {
            // Month cells have no time: default to 09:00-10:00. Week slots give the time (or the all-day row).
            const monthCell = view.type === 'dayGridMonth'
            const start = monthCell ? dayjs(date).hour(9) : dayjs(date)
            const isAllDay = allDay && !monthCell
            setEditing({
              id: null,
              initial: {
                title: '',
                description: null,
                start_at: start.format(),
                end_at: (isAllDay ? start : start.add(1, 'hour')).format(),
                all_day: isAllDay,
                rrule: null,
                remind_minutes_before: null,
              },
            })
          }}
          eventClick={({ event: clicked }) => {
            const { to, eventId } = clicked.extendedProps
            if (to) navigate(to)
            else setEditing({ id: eventId })
          }}
        />
      </Box>

      {editing && dialogInitial && (
        <EventDialog
          initial={dialogInitial}
          pending={createEvent.isPending || updateEvent.isPending}
          onSubmit={save}
          onDelete={editing.id ? () => setDeleting(true) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title="Delete event?"
        message="This event and all its occurrences will be permanently deleted."
        onConfirm={confirmDelete}
        onClose={() => setDeleting(false)}
      />
      <Snackbar open={!!snackbar} message={snackbar} autoHideDuration={6000} onClose={closeSnackbar} />
    </>
  )
}
