import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Box, Button, Chip, CircularProgress, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CalendarCard from '../components/CalendarCard'
import Panel from '../components/Panel'
import RoadmapProgress from '../components/RoadmapProgress'
import { useToday } from '../hooks/useDashboard'
import { useCreatePage, useRecentPages } from '../hooks/useNotes'
import { focusUrl, useFocus, type PanelName } from '../hooks/useFocus'
import { DIFFICULTY_COLOR } from '../types'
import CalendarPage from './CalendarPage'
import DeckPage from './DeckPage'
import FlashcardsPage from './FlashcardsPage'
import LeetCodePage from './LeetCodePage'
import NotesPage from './NotesPage'
import ProblemPage from './ProblemPage'
import ReviewPage from './ReviewPage'
import RoadmapPage from './RoadmapPage'
import RoadmapsPage from './RoadmapsPage'

const TITLES: Record<PanelName, string> = {
  flashcards: 'Flashcards',
  leetcode: 'LeetCode',
  roadmaps: 'Roadmaps',
  calendar: 'Calendar',
  notes: 'Notes',
}
const wrap = { minWidth: 0, overflowWrap: 'anywhere' }
// Rows per home panel; the rest are one click away in the focus view.
const MAX_ROWS = 5

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })
const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]] as const

/** "3h ago", "yesterday", "now". */
function timeAgo(iso: string, now = Date.now()) {
  const s = (new Date(iso).getTime() - now) / 1000
  const [unit, size] = UNITS.find(([, size]) => Math.abs(s) >= size) ?? ['second', 1]
  return unit === 'second' ? relative.format(0, 'second') : relative.format(Math.trunc(s / size), unit)
}

function Empty({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary">{children}</Typography>
}

export default function HomePage() {
  const { focus, deck, review, problem, roadmap, page } = useFocus()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { data, error, isPending } = useToday()
  const recent = useRecentPages()
  const createPage = useCreatePage()
  // isPending lands a render late; the ref blocks a same-tick double click.
  const creating = useRef(false)
  // The notes view reports unsaved edits so leaving it (back arrow, Escape) can ask first.
  const notesDirty = useRef(false)
  const focusBox = useRef<HTMLDivElement>(null)
  const lastFocus = useRef(focus)
  const lastSearch = useRef(search)

  // a11y: entering a view focuses its h1; leaving focuses the panel heading. Views whose h1 waits for data
  // (problem, review) hold focus on the view box until it appears. Not the back arrow: Space on a focused
  // button would leave the review instead of flipping the card.
  useEffect(() => {
    // Only on navigation, not on first load or refresh.
    if (lastSearch.current === search) return
    lastSearch.current = search
    const prev = lastFocus.current
    lastFocus.current = focus
    const box = focusBox.current
    if (!focus || !box) {
      if (prev) document.getElementById(`panel-${prev}`)?.focus()
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

  if (focus) {
    const view = {
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
      notes: <NotesPage initialPageId={page} onDirtyChange={(d) => {
            notesDirty.current = d
          }} />,
    }[focus]
    return (
      <Box ref={focusBox} tabIndex={-1} sx={{ outline: 'none', '& h1:focus': { outline: 'none' } }}>
        <Panel title={TITLES[focus]} onBack={leave}>
          {view}
        </Panel>
      </Box>
    )
  }

  const expand = (name: PanelName) => () => navigate(focusUrl({ focus: name }))
  const showAll = (name: PanelName, total: number, label = `Show all (${total})`) =>
    total > MAX_ROWS && (
      // px = -ml, so the label lines up with the list text above.
      <Button size="small" onClick={expand(name)} sx={{ display: 'flex', px: 1, ml: -1, mb: 1 }}>
        {label}
      </Button>
    )
  const loading = isPending && <CircularProgress aria-label="Loading" size={24} />
  const due = data?.due_card_total ?? 0

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Today
        </Typography>
        {data && (
          <Typography color="text.secondary">
            {/* T00:00 parses as local midnight, so the weekday is the server's date, not shifted by UTC. */}
            {new Date(`${data.date}T00:00`).toLocaleDateString([], { dateStyle: 'full' })}
          </Typography>
        )}
        {error && <Typography color="error">{error.message}</Typography>}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
          gridTemplateAreas: {
            xs: '"flashcards" "calendar" "leetcode" "notes" "roadmaps"',
            md: '"flashcards calendar" "leetcode notes" "roadmaps notes"',
          },
        }}
      >
        <Panel title="Flashcards" count={data?.due_card_total} onExpand={expand('flashcards')}>
          {loading}
          {data && (
            <>
              <Typography color={due ? undefined : 'text.secondary'}>
                {due ? `${due} ${due === 1 ? 'card' : 'cards'} due` : 'No cards due.'}
              </Typography>
              <List dense sx={{ mx: -2 }}>
                {data.decks.slice(0, MAX_ROWS).map((d) => (
                  <ListItemButton key={d.id} component={Link} to={focusUrl({ focus: 'flashcards', review: d.id })}>
                    <ListItemText sx={wrap} primary={d.title} />
                    <Chip size="small" label={d.due_count} />
                  </ListItemButton>
                ))}
              </List>
              {showAll('flashcards', data.decks.length)}
              <Button
                variant="contained"
                component={Link}
                to={focusUrl({ focus: 'flashcards', review: 'all' })}
                disabled={due === 0}
              >
                Start review
              </Button>
            </>
          )}
        </Panel>

        <Panel title="Calendar" onExpand={expand('calendar')}>
          {loading}
          {data && <CalendarCard today={data.date} />}
        </Panel>

        <Panel title="LeetCode" count={data?.problems_due.length} onExpand={expand('leetcode')}>
          {loading}
          {data?.problems_due.length === 0 && <Empty>No problems due.</Empty>}
          {data && (
            <List dense sx={{ mx: -2 }}>
              {data.problems_due.slice(0, MAX_ROWS).map((p) => (
                <ListItemButton key={p.id} component={Link} to={focusUrl({ focus: 'leetcode', problem: p.id })}>
                  <ListItemText sx={wrap} primary={p.title} />
                  <Stack direction="row" spacing={1}>
                    {p.due_date < data.date && <Chip size="small" label="Overdue" color="error" variant="outlined" />}
                    <Chip size="small" label={p.difficulty} color={DIFFICULTY_COLOR[p.difficulty]} />
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          )}
          {data && showAll('leetcode', data.problems_due.length)}
        </Panel>

        <Panel title="Notes" onExpand={expand('notes')}>
          {recent.isPending && <CircularProgress aria-label="Loading" size={24} />}
          {recent.error && <Typography color="error">{recent.error.message}</Typography>}
          {recent.data?.length === 0 && <Empty>No pages yet.</Empty>}
          {recent.data && (
            <List dense sx={{ mx: -2 }}>
              {recent.data.slice(0, MAX_ROWS).map((p) => (
                <ListItemButton key={p.id} component={Link} to={focusUrl({ focus: 'notes', page: p.id })}>
                  <ListItemText sx={wrap} primary={p.title} secondary={`${p.folder_name ?? 'Root'} · ${timeAgo(p.updated_at)}`} />
                </ListItemButton>
              ))}
            </List>
          )}
          {/* The API returns one row past the cap, so the total pages count is unknown here. */}
          {recent.data && showAll('notes', recent.data.length, 'Show all')}
          {createPage.error && <Typography color="error">{createPage.error.message}</Typography>}
          <Button
            variant="contained"
            disabled={createPage.isPending}
            onClick={() => {
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
            }}
          >
            New page
          </Button>
        </Panel>

        <Panel title="Roadmaps" count={data?.roadmaps.length} onExpand={expand('roadmaps')}>
          {loading}
          {data?.roadmaps.length === 0 && <Empty>No roadmaps yet.</Empty>}
          {data && (
            <List dense sx={{ mx: -2 }}>
              {data.roadmaps.slice(0, MAX_ROWS).map((r) => (
                <ListItemButton
                  key={r.id}
                  component={Link}
                  to={focusUrl({ focus: 'roadmaps', roadmap: r.id })}
                  sx={{ display: 'block' }}
                >
                  <ListItemText sx={wrap} primary={r.title} />
                  {r.total ? (
                    <RoadmapProgress done={r.done} total={r.total} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No checkpoints
                    </Typography>
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
          {data && showAll('roadmaps', data.roadmaps.length)}
        </Panel>
      </Box>
    </Stack>
  )
}
