import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { type Dayjs } from 'dayjs'
import { useCalendar } from '../hooks/useCalendar'
import { focusUrl } from '../hooks/useFocus'
import type { CalendarData } from '../types'

const MAX_ITEMS = 6
const ymd = (d: Dayjs | string) => dayjs(d).format('YYYY-MM-DD')
const time = (iso: string) => dayjs(iso).format('h:mm A')

type Item = { key: string; primary: string; secondary: string; to: string }

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
      primary: e.title,
      // An overnight event seen on a later day names its start date.
      secondary: e.all_day
        ? 'All day'
        : `${ymd(e.start) === day ? '' : `${dayjs(e.start).format('MMM D')}, `}${time(e.start)}${e.end ? ` – ${time(e.end)}` : ''}`,
      to: focusUrl({ focus: 'calendar' }),
    })),
    ...(cards
      ? [{ key: 'cards', primary: `${cards} ${cards === 1 ? 'card' : 'cards'} due`, secondary: 'Flashcards', to: focusUrl({ focus: 'flashcards', review: 'all' }) }]
      : []),
    ...data.problems_due
      .filter((p) => p.date === day)
      .map((p) => ({ key: `p-${p.id}`, primary: p.title, secondary: 'Problem due', to: focusUrl({ focus: 'leetcode', problem: p.id }) })),
    ...data.checkpoints
      .filter((c) => c.date === day)
      .map((c) => ({ key: `c-${c.id}`, primary: c.title, secondary: 'Checkpoint target', to: focusUrl({ focus: 'roadmaps', roadmap: c.roadmap_id }) })),
  ]
}

/** Mini month with a dot on busy days, and the selected day's agenda. `today` is the user's date, YYYY-MM-DD. */
export default function CalendarCard({ today }: { today: string }) {
  const [month, setMonth] = useState(() => dayjs(today).startOf('month'))
  const [selected, setSelected] = useState(today)
  const { data, error } = useCalendar({ from: ymd(month), to: ymd(month.endOf('month')) })
  const items = itemsOn(data, selected)
  const label = selected === today ? 'today' : dayjs(selected).format('MMM D')

  return (
    <>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateCalendar
          value={dayjs(selected)}
          onChange={(d) => d && setSelected(ymd(d))}
          // Paging keeps the agenda inside the fetched month: the selection if it's there, else today or the 1st.
          onMonthChange={(m) => {
            setMonth(m.startOf('month'))
            setSelected((sel) =>
              dayjs(sel).isSame(m, 'month') ? sel : dayjs(today).isSame(m, 'month') ? today : ymd(m.startOf('month')),
            )
          }}
          slotProps={{
            day: ({ day, isDayOutsideMonth }) =>
              !isDayOutsideMonth && itemsOn(data, ymd(day)).length
                ? {
                    'aria-description': 'Has items',
                    sx: {
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 3,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: 'secondary.main',
                      },
                    },
                  }
                : {},
          }}
          // Phone width: keep "November 2026" on one line next to the arrows.
          sx={{
            width: '100%',
            maxWidth: 320,
            height: 'auto',
            mx: 'auto',
            '& .MuiPickersCalendarHeader-root': { px: 1 },
            '& .MuiPickersCalendarHeader-label': { whiteSpace: 'nowrap' },
          }}
        />
      </LocalizationProvider>
      {error && <Typography color="error">{error.message}</Typography>}
      <Box component="h3" sx={{ typography: 'subtitle2', color: 'text.secondary', m: 0 }}>
        Agenda for {label}
      </Box>
      {data && !items.length && <Typography color="text.secondary">Nothing scheduled.</Typography>}
      <List dense sx={{ mx: -2 }}>
        {items.slice(0, MAX_ITEMS).map((item) => (
          <ListItemButton key={item.key} component={Link} to={item.to}>
            <ListItemText sx={{ minWidth: 0, overflowWrap: 'anywhere' }} primary={item.primary} secondary={item.secondary} />
          </ListItemButton>
        ))}
      </List>
      {/* Same look as the home panels' "Show all (N)". */}
      {items.length > MAX_ITEMS && (
        <Button size="small" component={Link} to={focusUrl({ focus: 'calendar' })} sx={{ display: 'flex', px: 1, ml: -1, mb: 1 }}>
          Show all ({items.length})
        </Button>
      )}
    </>
  )
}
