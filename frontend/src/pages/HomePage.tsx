import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CircularProgress,
  IconButton,
  LinearProgress,
  NativeSelect,
  Snackbar,
  Stack,
  TextField,
  Typography,
  type Theme,
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import AddIcon from '@mui/icons-material/Add'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import CalendarCard from '../components/CalendarCard'
import Card from '../components/Card'
import DeckDialog from '../components/DeckDialog'
import DifficultyDot from '../components/DifficultyDot'
import EventDialog from '../components/EventDialog'
import ListRow from '../components/ListRow'
import ProblemDialog from '../components/ProblemDialog'
import { QuickAddCard, QuickNote } from '../components/QuickForms'
import { dense, textError } from '../components/quick'
import { useCreateEvent } from '../hooks/useCalendar'
import { useToday } from '../hooks/useDashboard'
import { useCreateDeck, useDecks } from '../hooks/useDecks'
import { useExpandFlip, WIDE_QUERY } from '../hooks/useExpandFlip'
import { focusUrl, PANELS, useFocus, type PanelName } from '../hooks/useFocus'
import { useCreatePage, useRecentPages } from '../hooks/useNotes'
import { useAttemptProblem, useCreateProblem, useProblems } from '../hooks/useProblems'
import { useCreateCheckpoint, useRoadmap, useRoadmaps, useUpdateCheckpoint } from '../hooks/useRoadmaps'
import type { LastResult } from '../types'
import { fonts } from '../theme/tokens'
import CalendarPage from './CalendarPage'
import FlashcardsPage from './FlashcardsPage'
import LeetCodePage from './LeetCodePage'
import NotesPage from './NotesPage'
import ProblemPage from './ProblemPage'
import RoadmapPage from './RoadmapPage'
import RoadmapsPage from './RoadmapsPage'

const WIDE = `@media ${WIDE_QUERY}`
const PHONE = (t: Theme) => t.breakpoints.down('sm')

/** Ghost header action; an icon button at phone width so the header (and its count) fits. */
function Ghost({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <>
      <Button size="small" onClick={onClick} disabled={disabled} sx={(t) => ({ [PHONE(t)]: { display: 'none' } })}>
        {label}
      </Button>
      <IconButton
        size="small"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        sx={(t) => ({ display: 'none', [PHONE(t)]: { display: 'inline-flex' } })}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </>
  )
}
const TITLES: Record<PanelName, string> = {
  flashcards: 'Flashcards',
  leetcode: 'LeetCode',
  roadmaps: 'Roadmaps',
  calendar: 'Calendar',
  notes: 'Notes',
}
// Grid cells (row-start / col-start / row-end / col-end) on wide screens; `order` is the one-column order below.
const CELLS: Record<PanelName, { area: string; order: number }> = {
  flashcards: { area: '1 / 1 / 2 / 9', order: 1 },
  leetcode: { area: '2 / 1 / 3 / 9', order: 3 },
  roadmaps: { area: '3 / 1 / 4 / 9', order: 5 },
  calendar: { area: '1 / 9 / 2 / 13', order: 2 },
  notes: { area: '2 / 9 / 4 / 13', order: 4 },
}
const FULL = '1 / 1 / -1 / -1'
const MAX_TITLE = 200
const mono = { fontFamily: fonts.mono, fontSize: 12 }
const ellipsis = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
// Rows with their own controls can't be one big link (no buttons inside <a>): the title link's ::after covers
// the row instead, and the controls sit above it.
const rowLink = { ...ellipsis, color: 'inherit', textDecoration: 'none', '&::after': { content: '""', position: 'absolute', inset: 0 } }
const above = { position: 'relative', zIndex: 1 } as const
type OnError = (err: Error) => void

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })
const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]] as const

/** "3h ago", "yesterday", "now". */
function timeAgo(iso: string, now = Date.now()) {
  const s = (new Date(iso).getTime() - now) / 1000
  const [unit, size] = UNITS.find(([, size]) => Math.abs(s) >= size) ?? ['second', 1]
  return unit === 'second' ? relative.format(0, 'second') : relative.format(Math.trunc(s / size), unit)
}

/** "Nov 20" from YYYY-MM-DD (T00:00 parses as local midnight, so the day doesn't shift). */
const shortDate = (ymd: string) => new Date(`${ymd}T00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })

function Note({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <Typography color={error ? 'error' : 'text.secondary'} sx={{ px: 2, py: 1.5 }}>
      {children}
    </Typography>
  )
}

const Loading = () => <CircularProgress aria-label="Loading" size={20} sx={{ m: 2 }} />

function Flashcards() {
  const { data, error, isPending } = useDecks()
  if (isPending) return <Loading />
  if (error) return <Note error>{error.message}</Note>
  if (!data.length) return <Note>No decks yet.</Note>
  return data.map((d) => (
    <ListRow key={d.id}>
      <Box component={Link} to={focusUrl({ focus: 'flashcards', deck: d.id })} sx={rowLink}>
        {d.title}
      </Box>
      <Box component="span" sx={{ ...mono, color: 'text.secondary' }}>
        {`${d.due_count} due`}
      </Box>
      {d.due_count ? (
        <Button
          size="small"
          variant="outlined"
          component={Link}
          to={focusUrl({ focus: 'flashcards', review: d.id })}
          aria-label={`Review ${d.title}`}
          sx={above}
        >
          Review
        </Button>
      ) : (
        // A plain disabled button (not a link), so a click doesn't fall through to the row link.
        <Button size="small" variant="outlined" disabled aria-label={`Review ${d.title}`} sx={above}>
          Review
        </Button>
      )}
    </ListRow>
  ))
}

const RESULTS: [LastResult, string][] = [
  ['solved', 'Solved'],
  ['solved_with_hint', 'Hint'],
  ['failed', 'Failed'],
]

const DUE_FILTERS = { status: 'due', difficulty: '', pattern: '' } as const

function LeetCode({ today, onError }: { today?: string; onError: OnError }) {
  const { data, error, isPending } = useProblems(DUE_FILTERS)
  const queryClient = useQueryClient()
  const attempt = useAttemptProblem()
  // Per row: another click on the same row is dropped until its attempt (and the list refetch) settles.
  const busy = useRef(new Set<number>())
  function log(id: number, result: LastResult) {
    if (busy.current.has(id)) return
    busy.current.add(id)
    attempt.mutate(
      { id, result, minutes: null },
      {
        // The calendar card lists problems by due date.
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
        onError,
        onSettled: () => {
          busy.current.delete(id)
        },
      },
    )
  }
  if (isPending) return <Loading />
  if (error) return <Note error>{error.message}</Note>
  if (!data.length) return <Note>No problems due.</Note>
  return data.map((p) => {
    const due = !p.due_date || !today ? '' : p.due_date < today ? 'Overdue' : p.due_date === today ? 'Today' : shortDate(p.due_date)
    return (
      <ListRow key={p.id}>
        <Box component={Link} to={focusUrl({ focus: 'leetcode', problem: p.id })} sx={rowLink}>
          {p.title}
        </Box>
        <Box component="span" sx={{ width: 76, typography: 'body2', color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
          <DifficultyDot difficulty={p.difficulty} />
        </Box>
        <Box component="span" sx={{ width: 120, typography: 'body2', color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
          {p.pattern}
        </Box>
        <Box component="span" sx={{ width: 64, typography: 'body2', display: { xs: 'none', sm: 'block' }, color: due === 'Overdue' || due === 'Today' ? 'secondary.dark' : 'text.secondary' }}>
          {due}
        </Box>
        <ButtonGroup
          size="small"
          role="group"
          aria-label={`Log attempt: ${p.title}`}
          disabled={attempt.isPending && attempt.variables?.id === p.id}
          sx={{ ...above, '& .MuiButton-root': { minHeight: 26, px: 1.125, fontSize: 11, color: 'text.secondary', borderColor: 'divider' } }}
        >
          {RESULTS.map(([result, label]) => (
            <Button key={result} onClick={() => log(p.id, result)}>
              {label}
            </Button>
          ))}
        </ButtonGroup>
      </ListRow>
    )
  })
}

// Keyed by roadmap, so the add input resets when switching tabs.
function Checkpoints({ roadmapId, today, onError }: { roadmapId: number; today?: string; onError: OnError }) {
  const { data, error, isPending } = useRoadmap(roadmapId)
  const toggleDone = useUpdateCheckpoint()
  const create = useCreateCheckpoint()
  const toggling = useRef(false)
  const adding = useRef(false)
  const [title, setTitle] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = title.trim()
  const titleError = touched ? textError(trimmed, MAX_TITLE) : ''

  function toggle(id: number, done: boolean) {
    if (toggling.current) return
    toggling.current = true
    toggleDone.mutate(
      { id, done },
      {
        onError,
        onSettled: () => {
          toggling.current = false
        },
      },
    )
  }

  function add(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (textError(trimmed, MAX_TITLE) || adding.current) return
    adding.current = true
    create.mutate(
      { roadmapId, title: trimmed, description: null, target_date: null },
      {
        onSuccess: () => {
          setTitle('')
          setTouched(false)
        },
        onError,
        onSettled: () => {
          adding.current = false
        },
      },
    )
  }

  if (isPending) return <Loading />
  if (error) return <Note error>{error.message}</Note>
  return (
    <>
      {!data.checkpoints.length && <Note>No checkpoints yet.</Note>}
      {data.checkpoints.map((c) => {
        const overdue = !c.done_at && !!c.target_date && !!today && c.target_date < today
        return (
          <ListRow key={c.id}>
            <Checkbox
              checked={!!c.done_at}
              onChange={() => toggle(c.id, !c.done_at)}
              disabled={toggleDone.isPending}
              size="small"
              slotProps={{ input: { 'aria-label': c.title } }}
              sx={{ ...above, p: 0, color: 'text.secondary', '&.Mui-checked': { color: 'text.primary' } }}
            />
            <Box
              component={Link}
              to={focusUrl({ focus: 'roadmaps', roadmap: roadmapId })}
              sx={{ ...rowLink, color: c.done_at ? 'text.secondary' : 'text.primary' }}
            >
              {c.title}
            </Box>
            <Box component="span" sx={{ typography: 'body2', color: overdue ? 'secondary.dark' : 'text.secondary' }}>
              {c.done_at ? 'Done' : c.target_date ? shortDate(c.target_date) : ''}
            </Box>
          </ListRow>
        )
      })}
      <Box component="form" noValidate onSubmit={add} sx={{ px: 2, py: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Add a checkpoint"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={!!titleError}
          helperText={titleError}
          slotProps={{ htmlInput: { 'aria-label': 'Add a checkpoint' } }}
          sx={{ ...dense, '& .MuiOutlinedInput-notchedOutline': { borderStyle: 'dashed' } }}
        />
      </Box>
    </>
  )
}

function Recent() {
  const { data, error, isPending } = useRecentPages()
  if (isPending) return <Loading />
  if (error) return <Note error>{error.message}</Note>
  return (
    <>
      <Typography variant="overline" component="h3" sx={{ display: 'block', color: 'text.secondary', px: 2, pt: 1.25 }}>
        Recent
      </Typography>
      {!data.length && <Note>No pages yet.</Note>}
      {data.map((p) => (
        <ListRow key={p.id} to={focusUrl({ focus: 'notes', page: p.id })}>
          {/* 47 + the 1px divider = a 48px row. */}
          <Box sx={{ minWidth: 0, height: 47, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Box>
            <Typography variant="body2" color="text.secondary" noWrap>
              {`${p.folder_name ?? 'Root'} · ${timeAgo(p.updated_at)}`}
            </Typography>
          </Box>
        </ListRow>
      ))}
    </>
  )
}

export default function HomePage() {
  const { focus, deck, review, problem, roadmap, page } = useFocus()
  const { search } = useLocation()
  const navigate = useNavigate()
  const today = useToday()
  const date = today.data?.date
  const decks = useDecks()
  const problems = useProblems(DUE_FILTERS)
  const roadmaps = useRoadmaps()
  const [roadmapTab, setRoadmapTab] = useState<number>()
  const createPage = useCreatePage()
  const createDeck = useCreateDeck()
  const createProblem = useCreateProblem()
  const createEvent = useCreateEvent()
  const [dialog, setDialog] = useState<'deck' | 'problem' | 'event' | null>(null)
  const [message, setMessage] = useState('')
  const onError = (err: Error) => setMessage(err.message)
  // The dialogs await this; on failure they stay open and the snackbar says why.
  const submit = (req: Promise<unknown>) => req.then(() => setDialog(null), onError)
  // isPending lands a render late; the ref blocks a same-tick double click.
  const creating = useRef(false)
  // The notes view reports unsaved edits so leaving it (collapse, Escape) can ask first.
  const notesDirty = useRef(false)
  const cards = useRef<Record<string, HTMLElement | null>>({})
  const slots = useRef<Record<string, HTMLElement | null>>({})
  const lastFocus = useRef(focus)
  const lastSearch = useRef(search)
  useExpandFlip(focus, cards, slots)

  // a11y: entering a view focuses the card title; leaving focuses the card's expand button. Moving inside a view
  // (e.g. picking a deck) leaves focus alone unless the clicked control went away.
  useEffect(() => {
    // Only on navigation, not on first load or refresh.
    if (lastSearch.current === search) return
    lastSearch.current = search
    const prev = lastFocus.current
    lastFocus.current = focus
    if (!focus) {
      if (prev) cards.current[prev]?.querySelector<HTMLElement>('button[aria-expanded]')?.focus()
      return
    }
    const card = cards.current[focus]
    if (prev === focus && card?.contains(document.activeElement)) return
    const title = card?.querySelector('h2')
    if (!title) return
    title.tabIndex = -1
    title.focus()
  }, [focus, search])

  const leave = useCallback(() => {
    if (notesDirty.current && !window.confirm('Discard unsaved changes?')) return
    notesDirty.current = false
    navigate('/')
  }, [navigate])

  useEffect(() => {
    if (!focus) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      // Dialogs and menus stop their own Escape; leave text fields alone so Escape there never drops the view.
      if (e.key !== 'Escape' || e.defaultPrevented || t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
        return
      leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, leave])

  const view = (name: PanelName) =>
    ({
      flashcards: <FlashcardsPage deckId={deck ?? (review === 'all' ? undefined : review)} reviewAll={review === 'all'} />,
      leetcode: problem ? <ProblemPage problemId={problem} /> : <LeetCodePage />,
      roadmaps: roadmap ? <RoadmapPage roadmapId={roadmap} /> : <RoadmapsPage />,
      calendar: <CalendarPage />,
      notes: (
        <NotesPage
          initialPageId={page}
          onDirtyChange={(d) => {
            notesDirty.current = d
          }}
        />
      ),
    })[name]

  const due = decks.data?.reduce((n, d) => n + d.due_count, 0)
  const selected = roadmaps.data?.find((r) => r.id === roadmapTab) ?? roadmaps.data?.[0]
  const newPage = () => {
    if (creating.current) return
    creating.current = true
    createPage.mutate(
      { title: 'Untitled', folder_id: null },
      {
        onSuccess: (p) => navigate(focusUrl({ focus: 'notes', page: p.id })),
        onSettled: () => {
          creating.current = false
        },
      },
    )
  }

  const panels: Record<PanelName, { count?: string; tabs?: ReactNode; actions?: ReactNode; body: ReactNode }> = {
    flashcards: {
      count: due === undefined ? undefined : `${due} due`,
      actions: (
        <>
          <Ghost label="New deck" onClick={() => setDialog('deck')} />
          <Button size="small" variant="contained" component={Link} to={focusUrl({ focus: 'flashcards', review: 'all' })} disabled={!due}>
            Review all
          </Button>
        </>
      ),
      body: (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 320px' }, height: { sm: '100%' } }}>
          {/* One column: the card grows with the form, so the deck list is bounded and scrolls. */}
          <Box sx={{ minHeight: 0, maxHeight: 240, overflow: 'auto', [WIDE]: { maxHeight: 'none' } }}>
            <Flashcards />
          </Box>
          <Box sx={{ minHeight: 0, overflow: { sm: 'auto' }, borderStyle: 'solid', borderColor: 'divider', borderWidth: { xs: '1px 0 0', sm: '0 0 0 1px' } }}>
            <QuickAddCard decks={decks.data ?? []} onError={onError} />
          </Box>
        </Box>
      ),
    },
    leetcode: {
      count: problems.data && `${problems.data.length} due`,
      actions: (
        <Ghost label="New problem" onClick={() => setDialog('problem')} />
      ),
      body: <LeetCode today={date} onError={onError} />,
    },
    roadmaps: {
      tabs: roadmaps.data && roadmaps.data.length > 0 && (
        <>
        {/* Phone width: a compact select instead of a tab strip that can't fit the 48px header. */}
        <NativeSelect
          value={selected?.id}
          onChange={(e) => setRoadmapTab(Number(e.target.value))}
          inputProps={{ 'aria-label': 'Roadmap' }}
          disableUnderline
          sx={(t) => ({ display: 'none', minWidth: 0, ml: 1, fontSize: 13, [PHONE(t)]: { display: 'inline-flex' } })}
        >
          {roadmaps.data.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </NativeSelect>
        <Stack direction="row" sx={(t) => ({ gap: 0.5, ml: 1, minWidth: 0, overflowX: 'auto', [PHONE(t)]: { display: 'none' } })}>
          {roadmaps.data?.map((r) => (
            <Button
              key={r.id}
              size="small"
              variant={r.id === selected?.id ? 'outlined' : 'text'}
              aria-pressed={r.id === selected?.id}
              onClick={() => setRoadmapTab(r.id)}
              sx={{ flexShrink: 0, ...(r.id === selected?.id ? { borderColor: 'text.primary' } : { color: 'text.secondary' }) }}
            >
              {r.title}
            </Button>
          ))}
        </Stack>
        </>
      ),
      actions: selected && (
        <>
          <Typography variant="body2" sx={(t) => ({ ...mono, color: 'text.secondary', whiteSpace: 'nowrap', [PHONE(t)]: { display: 'none' } })}>
            {selected.done_count} / {selected.total_count}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={selected.total_count ? (selected.done_count / selected.total_count) * 100 : 0}
            aria-label={`${selected.title} progress`}
            sx={{ width: 120, height: 4, display: { xs: 'none', sm: 'block' } }}
          />
        </>
      ),
      body: roadmaps.isPending ? (
        <Loading />
      ) : roadmaps.error ? (
        <Note error>{roadmaps.error.message}</Note>
      ) : selected ? (
        <Checkpoints key={selected.id} roadmapId={selected.id} today={date} onError={onError} />
      ) : (
        <Note>No roadmaps yet.</Note>
      ),
    },
    calendar: {
      actions: (
        <Ghost label="New event" onClick={() => setDialog('event')} disabled={!date} />
      ),
      body: date ? <CalendarCard today={date} /> : today.error ? <Note error>{today.error.message}</Note> : <Loading />,
    },
    notes: {
      actions: (
        <Button size="small" onClick={newPage} disabled={createPage.isPending}>
          New page
        </Button>
      ),
      body: (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <QuickNote onError={onError} />
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {createPage.error && <Note error>{createPage.error.message}</Note>}
            <Recent />
          </Box>
        </Box>
      ),
    },
  }

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 2,
          p: 3,
          [WIDE]: {
            flex: 1,
            minHeight: 0,
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
            p: '20px 32px 24px',
          },
        }}
      >
        {/* Empty grid items at each cell and over the whole area: the expand animation measures its ends here. */}
        {[...PANELS, 'full' as const].map((name) => (
          <Box
            key={`slot-${name}`}
            aria-hidden
            ref={(el: HTMLElement | null) => {
              slots.current[name] = el
            }}
            sx={{ display: 'none', [WIDE]: { display: 'block', gridArea: name === 'full' ? FULL : CELLS[name].area, pointerEvents: 'none' } }}
          />
        ))}
        {PANELS.map((name) => {
          const expanded = focus === name
          const { count, tabs, actions, body } = panels[name]
          return (
            <Box
              key={name}
              ref={(el: HTMLElement | null) => {
                cards.current[name] = el
              }}
              sx={{
                order: CELLS[name].order,
                minWidth: 0,
                // One column: cards get a fixed 280px (lists scroll); the calendar (month over agenda) and flashcards (list over
                // quick add) stack, so they grow.
                height: expanded || name === 'calendar' || name === 'flashcards' ? 'auto' : 280,
                // Another panel is expanded: gone in one column; hidden (still holding its cell) in the grid.
                display: focus && !expanded ? 'none' : 'block',
                [WIDE]: {
                  gridArea: expanded ? FULL : CELLS[name].area,
                  minHeight: 0,
                  height: 'auto',
                  ...(focus && !expanded && { display: 'block', visibility: 'hidden', opacity: 0 }),
                },
              }}
            >
              <Card
                title={TITLES[name]}
                count={count}
                tabs={expanded ? undefined : tabs}
                actions={expanded ? undefined : actions}
                expanded={expanded}
                onExpand={expanded ? leave : () => navigate(focusUrl({ focus: name }))}
              >
                {expanded ? view(name) : body}
              </Card>
            </Box>
          )
        })}
      </Box>
      {dialog === 'deck' && (
        <DeckDialog pending={createDeck.isPending} onSubmit={(title) => submit(createDeck.mutateAsync(title))} onClose={() => setDialog(null)} />
      )}
      {dialog === 'problem' && (
        <ProblemDialog
          pending={createProblem.isPending}
          onSubmit={(input) => submit(createProblem.mutateAsync(input))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'event' && date && (
        <EventDialog
          // Like a month cell on the calendar page: today 09:00-10:00.
          initial={{
            title: '',
            description: null,
            start_at: dayjs(date).hour(9).format(),
            end_at: dayjs(date).hour(10).format(),
            all_day: false,
            rrule: null,
            remind_minutes_before: null,
          }}
          pending={createEvent.isPending}
          onSubmit={(input) => submit(createEvent.mutateAsync(input))}
          onClose={() => setDialog(null)}
        />
      )}
      <Snackbar open={!!message} message={message} autoHideDuration={6000} onClose={() => setMessage('')} />
    </>
  )
}
