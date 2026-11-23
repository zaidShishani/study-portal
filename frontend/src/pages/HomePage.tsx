import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Button, Checkbox, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CalendarCard from '../components/CalendarCard'
import Card from '../components/Card'
import DifficultyDot from '../components/DifficultyDot'
import ListRow from '../components/ListRow'
import { useToday } from '../hooks/useDashboard'
import { useDecks } from '../hooks/useDecks'
import { useExpandFlip, WIDE_QUERY } from '../hooks/useExpandFlip'
import { focusUrl, PANELS, useFocus, type PanelName } from '../hooks/useFocus'
import { useCreatePage, useRecentPages } from '../hooks/useNotes'
import { useProblems } from '../hooks/useProblems'
import { useRoadmap, useRoadmaps } from '../hooks/useRoadmaps'
import { fonts } from '../theme/tokens'
import CalendarPage from './CalendarPage'
import DeckPage from './DeckPage'
import FlashcardsPage from './FlashcardsPage'
import LeetCodePage from './LeetCodePage'
import NotesPage from './NotesPage'
import ProblemPage from './ProblemPage'
import ReviewPage from './ReviewPage'
import RoadmapPage from './RoadmapPage'
import RoadmapsPage from './RoadmapsPage'

const WIDE = `@media ${WIDE_QUERY}`
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
const mono = { fontFamily: fonts.mono, fontSize: 12 }
const ellipsis = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

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
    <ListRow key={d.id} to={focusUrl(d.due_count ? { focus: 'flashcards', review: d.id } : { focus: 'flashcards', deck: d.id })}>
      <Box component="span" sx={ellipsis}>
        {d.title}
      </Box>
      <Box component="span" sx={{ ...mono, color: 'text.secondary' }}>
        {`${d.due_count} due`}
      </Box>
    </ListRow>
  ))
}

const DUE_FILTERS = { status: 'due', difficulty: '', pattern: '' } as const

function LeetCode({ today }: { today?: string }) {
  const { data, error, isPending } = useProblems(DUE_FILTERS)
  if (isPending) return <Loading />
  if (error) return <Note error>{error.message}</Note>
  if (!data.length) return <Note>No problems due.</Note>
  return data.map((p) => {
    const due = !p.due_date || !today ? '' : p.due_date < today ? 'Overdue' : p.due_date === today ? 'Today' : shortDate(p.due_date)
    return (
      <ListRow key={p.id} to={focusUrl({ focus: 'leetcode', problem: p.id })}>
        <Box component="span" sx={ellipsis}>
          {p.title}
        </Box>
        <Box component="span" sx={{ width: 76, typography: 'body2', color: 'text.secondary' }}>
          <DifficultyDot difficulty={p.difficulty} />
        </Box>
        <Box component="span" sx={{ width: 120, typography: 'body2', color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
          {p.pattern}
        </Box>
        <Box component="span" sx={{ width: 64, typography: 'body2', color: due === 'Overdue' || due === 'Today' ? 'secondary.dark' : 'text.secondary' }}>
          {due}
        </Box>
      </ListRow>
    )
  })
}

function Checkpoints({ roadmapId, today }: { roadmapId: number; today?: string }) {
  const { data, error, isPending } = useRoadmap(roadmapId)
  if (isPending) return <Loading />
  if (error) return <Note error>{error.message}</Note>
  if (!data.checkpoints.length) return <Note>No checkpoints yet.</Note>
  return data.checkpoints.map((c) => {
    const overdue = !c.done_at && !!c.target_date && !!today && c.target_date < today
    return (
      <ListRow key={c.id} to={focusUrl({ focus: 'roadmaps', roadmap: roadmapId })}>
        {/* Read-only here: ticking from home comes with the inline actions (#77). */}
        <Checkbox
          checked={!!c.done_at}
          disabled
          size="small"
          slotProps={{ input: { 'aria-label': c.title } }}
          sx={{ p: 0, '&.Mui-disabled': { color: c.done_at ? 'text.primary' : 'text.secondary' } }}
        />
        <Box component="span" sx={{ ...ellipsis, color: c.done_at ? 'text.secondary' : 'text.primary' }}>
          {c.title}
        </Box>
        <Box component="span" sx={{ typography: 'body2', color: overdue ? 'secondary.dark' : 'text.secondary' }}>
          {c.done_at ? 'Done' : c.target_date ? shortDate(c.target_date) : ''}
        </Box>
      </ListRow>
    )
  })
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
          <Box sx={{ minWidth: 0, py: 0.75 }}>
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
  // isPending lands a render late; the ref blocks a same-tick double click.
  const creating = useRef(false)
  // The notes view reports unsaved edits so leaving it (collapse, Escape) can ask first.
  const notesDirty = useRef(false)
  const focusBox = useRef<HTMLDivElement>(null)
  const cards = useRef<Record<string, HTMLElement | null>>({})
  const slots = useRef<Record<string, HTMLElement | null>>({})
  const lastFocus = useRef(focus)
  const lastSearch = useRef(search)
  useExpandFlip(focus, cards, slots)

  // a11y: entering a view focuses its h1; leaving focuses the card's expand button. Views whose h1 waits for
  // data (problem, review) hold focus on the view box until it appears.
  useEffect(() => {
    // Only on navigation, not on first load or refresh.
    if (lastSearch.current === search) return
    lastSearch.current = search
    const prev = lastFocus.current
    lastFocus.current = focus
    const box = focusBox.current
    if (!focus || !box) {
      if (prev) cards.current[prev]?.querySelector<HTMLElement>('button[aria-expanded]')?.focus()
      return
    }
    const focusH1 = () => {
      const h1 = box.querySelector('h1')
      if (h1) {
        h1.tabIndex = -1
        h1.focus()
      }
      return h1
    }
    if (focusH1()) return
    box.focus()
    const observer = new MutationObserver(() => {
      // Give up if the user moved focus meanwhile.
      if (document.activeElement !== box || focusH1()) observer.disconnect()
    })
    observer.observe(box, { childList: true, subtree: true })
    return () => observer.disconnect()
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
      flashcards:
        review !== undefined ? (
          <ReviewPage deckId={review === 'all' ? undefined : review} />
        ) : deck ? (
          <DeckPage deckId={deck} />
        ) : (
          <FlashcardsPage />
        ),
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
        <Button size="small" variant="contained" component={Link} to={focusUrl({ focus: 'flashcards', review: 'all' })} disabled={!due}>
          Start review
        </Button>
      ),
      body: <Flashcards />,
    },
    leetcode: {
      count: problems.data && `${problems.data.length} due`,
      body: <LeetCode today={date} />,
    },
    roadmaps: {
      tabs: (
        <Stack direction="row" sx={{ gap: 0.5, ml: 1, minWidth: 0, overflowX: 'auto' }}>
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
      ),
      actions: selected && (
        <>
          <Typography variant="body2" sx={{ ...mono, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {selected.done_count} / {selected.total_count}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={selected.total_count ? (selected.done_count / selected.total_count) * 100 : 0}
            aria-label={`${selected.title} progress`}
            sx={{ width: { xs: 64, sm: 120 }, height: 4 }}
          />
        </>
      ),
      body: roadmaps.isPending ? (
        <Loading />
      ) : roadmaps.error ? (
        <Note error>{roadmaps.error.message}</Note>
      ) : selected ? (
        <Checkpoints roadmapId={selected.id} today={date} />
      ) : (
        <Note>No roadmaps yet.</Note>
      ),
    },
    calendar: {
      body: date ? <CalendarCard today={date} /> : today.error ? <Note error>{today.error.message}</Note> : <Loading />,
    },
    notes: {
      actions: (
        <Button size="small" onClick={newPage} disabled={createPage.isPending}>
          New page
        </Button>
      ),
      body: (
        <>
          {createPage.error && <Note error>{createPage.error.message}</Note>}
          <Recent />
        </>
      ),
    },
  }

  return (
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
              height: expanded ? 'auto' : 280,
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
              tabs={tabs}
              actions={expanded ? undefined : actions}
              expanded={expanded}
              onExpand={expanded ? leave : () => navigate(focusUrl({ focus: name }))}
            >
              {expanded ? (
                <Box ref={focusBox} tabIndex={-1} sx={{ p: 3, outline: 'none', '& h1:focus': { outline: 'none' } }}>
                  {view(name)}
                </Box>
              ) : (
                body
              )}
            </Card>
          </Box>
        )
      })}
    </Box>
  )
}
