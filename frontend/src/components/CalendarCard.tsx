import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, ButtonBase, IconButton, Stack, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import dayjs, { type Dayjs } from 'dayjs'
import { useCalendar } from '../hooks/useCalendar'
import { WIDE_QUERY } from '../hooks/useExpandFlip'
import { focusUrl } from '../hooks/useFocus'
import { fonts } from '../theme/tokens'
import type { CalendarData } from '../types'

const ymd = (d: Dayjs | string) => dayjs(d).format('YYYY-MM-DD')
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type Item = { key: string; time: string; title: string; to: string }

// One summary line per kind, so a busy day doesn't push events out of the small card.
const count = (key: string, n: number, noun: string, to: string): Item[] =>
  n ? [{ key, time: '—', title: `${n} ${noun}${n === 1 ? '' : 's'} due`, to }] : []

// Everything on local date `day`. Events count on every day they cover (all-day ends are exclusive).
function itemsOn(data: CalendarData | undefined, day: string): Item[] {
  if (!data) return []
  const events = data.events.filter((e) => {
    const start = ymd(e.start)
    const end = e.end ? ymd(dayjs(e.end).subtract(1, e.all_day ? 'day' : 'ms')) : start
    return day === start || (start < day && day <= end)
  })
  const cards = data.card_due.find((c) => c.date === day)?.count
  return [
    ...events.map((e) => ({
      key: `e-${e.event_id}-${e.start}`,
      // All-day events and overnight events seen on a later day have no start time that day.
      time: e.all_day || ymd(e.start) !== day ? '—' : dayjs(e.start).format('HH:mm'),
      title: e.title,
      to: focusUrl({ focus: 'calendar' }),
    })),
    ...count('cards', cards ?? 0, 'card', focusUrl({ focus: 'flashcards', review: 'all' })),
    ...count('problems', data.problems_due.filter((p) => p.date === day).length, 'problem', focusUrl({ focus: 'leetcode' })),
    ...count('checkpoints', data.checkpoints.filter((c) => c.date === day).length, 'checkpoint', focusUrl({ focus: 'roadmaps' })),
  ]
}

/** Mini month (dot on busy days) beside the selected day's agenda. `today` is the user's date, YYYY-MM-DD. */
export default function CalendarCard({ today }: { today: string }) {
  const [month, setMonth] = useState(() => dayjs(today).startOf('month'))
  const [selected, setSelected] = useState(today)
  const { data, error } = useCalendar({ from: ymd(month), to: ymd(month.endOf('month')) })
  const items = itemsOn(data, selected)
  // Leading blanks up to the 1st's weekday, then the month's days; only the weeks the month needs.
  const days = [...Array<null>(month.day()).fill(null), ...Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1))]

  // Paging keeps the agenda inside the fetched month: today if it's there, else the 1st.
  const page = (step: number) => {
    const m = month.add(step, 'month')
    setMonth(m)
    setSelected(dayjs(today).isSame(m, 'month') ? today : ymd(m))
  }

  return (
    // Side by side on wide screens (never wraps); stacked in the one-column layout.
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minHeight: '100%', [`@media ${WIDE_QUERY}`]: { gridTemplateColumns: '216px minmax(0, 1fr)' } }}>
      <Box sx={{ flexShrink: 0, p: '6px 8px 0 12px' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', height: 20, pl: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {month.format('MMMM YYYY')}
          </Typography>
          <Box>
            <IconButton size="small" aria-label="Previous month" onClick={() => page(-1)} sx={{ p: 0, minHeight: 0 }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Next month" onClick={() => page(1)} sx={{ p: 0, minHeight: 0 }}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 28px)', fontSize: 12 }}>
          {WEEKDAYS.map((w, i) => (
            <Box key={i} aria-hidden sx={{ height: 16, textAlign: 'center', fontSize: 10, color: 'text.secondary' }}>
              {w}
            </Box>
          ))}
          {days.map((d, i) => {
            if (!d) return <span key={i} />
            const day = ymd(d)
            const isToday = day === today
            const busy = itemsOn(data, day).length > 0
            return (
              <ButtonBase
                key={i}
                aria-label={d.format('MMMM D')}
                aria-pressed={day === selected}
                aria-current={isToday ? 'date' : undefined}
                aria-description={busy ? 'Has items' : undefined}
                onClick={() => setSelected(day)}
                sx={{
                  width: 28,
                  height: 26,
                  flexDirection: 'column',
                  borderRadius: 1,
                  fontSize: 12,
                  fontFamily: fonts.mono,
                  color: isToday ? 'background.paper' : 'text.primary',
                  bgcolor: isToday ? 'text.primary' : day === selected ? 'action.selected' : undefined,
                  fontWeight: isToday ? 600 : 400,
                  '&:hover': isToday ? undefined : { bgcolor: 'action.hover' },
                }}
              >
                {d.date()}
                <Box
                  component="span"
                  aria-hidden
                  sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: busy ? (isToday ? 'background.paper' : 'secondary.main') : 'transparent' }}
                />
              </ButtonBase>
            )
          })}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0, borderTop: 1, borderColor: 'action.hover', p: '10px 14px', [`@media ${WIDE_QUERY}`]: { borderTop: 0, borderLeft: 1 } }}>
        <Typography variant="overline" component="h3" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
          {selected === today ? 'Today' : dayjs(selected).format('MMM D')}
        </Typography>
        {error && <Typography color="error">{error.message}</Typography>}
        {data && !items.length && <Typography variant="body2">Nothing scheduled.</Typography>}
        {items.map((item) => (
          <Box
            key={item.key}
            component={Link}
            to={item.to}
            sx={{
              display: 'flex',
              gap: 1.25,
              alignItems: 'baseline',
              py: 0.5,
              fontSize: 12,
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover .title': { textDecoration: 'underline' },
            }}
          >
            <Box component="span" sx={{ width: 38, flexShrink: 0, fontFamily: fonts.mono, color: 'text.secondary' }}>
              {item.time}
            </Box>
            <Box component="span" className="title" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
