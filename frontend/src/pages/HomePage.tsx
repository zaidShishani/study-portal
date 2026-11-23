import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Button, Chip, CircularProgress, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Panel from '../components/Panel'
import RoadmapProgress from '../components/RoadmapProgress'
import { useToday } from '../hooks/useDashboard'
import { focusUrl, useFocus, type PanelName } from '../hooks/useFocus'
import { DIFFICULTY_COLOR } from '../types'
import DeckPage from './DeckPage'
import FlashcardsPage from './FlashcardsPage'
import LeetCodePage from './LeetCodePage'
import ProblemPage from './ProblemPage'
import ReviewPage from './ReviewPage'
import RoadmapPage from './RoadmapPage'
import RoadmapsPage from './RoadmapsPage'

const TITLES: Record<PanelName, string> = { flashcards: 'Flashcards', leetcode: 'LeetCode', roadmaps: 'Roadmaps' }
const wrap = { minWidth: 0, overflowWrap: 'anywhere' }

function Empty({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary">{children}</Typography>
}

export default function HomePage() {
  const { focus, deck, review, problem, roadmap } = useFocus()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { data, error, isPending } = useToday()
  const focusBox = useRef<HTMLDivElement>(null)
  const lastFocus = useRef(focus)
  const lastSearch = useRef(search)

  // a11y: entering a view focuses its h1 (or the view box while it loads); leaving focuses the panel heading.
  // Not the back arrow: Space on a focused button would leave the review instead of flipping the card.
  useEffect(() => {
    // Only on navigation, not on first load or refresh.
    if (lastSearch.current === search) return
    lastSearch.current = search
    if (focus) {
      const h1 = focusBox.current?.querySelector('h1')
      if (h1) h1.tabIndex = -1
      ;(h1 ?? focusBox.current)?.focus()
    } else if (lastFocus.current) document.getElementById(`panel-${lastFocus.current}`)?.focus()
    lastFocus.current = focus
  }, [focus, search])

  useEffect(() => {
    if (!focus) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      // Dialogs and menus stop their own Escape; leave text fields alone so Escape there never drops the view.
      if (e.key !== 'Escape' || e.defaultPrevented || t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
        return
      navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, navigate])

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
    }[focus]
    return (
      <Box ref={focusBox} tabIndex={-1} sx={{ outline: 'none', '& h1:focus': { outline: 'none' } }}>
        <Panel title={TITLES[focus]} onBack={() => navigate('/')}>
          {view}
        </Panel>
      </Box>
    )
  }

  const expand = (name: PanelName) => () => navigate(focusUrl({ focus: name }))
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
                {data.decks.map((d) => (
                  <ListItemButton key={d.id} component={Link} to={focusUrl({ focus: 'flashcards', review: d.id })}>
                    <ListItemText sx={wrap} primary={d.title} />
                    <Chip size="small" label={d.due_count} />
                  </ListItemButton>
                ))}
              </List>
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

        <Panel title="Calendar">
          <Empty>Coming soon</Empty>
        </Panel>

        <Panel title="LeetCode" count={data?.problems_due.length} onExpand={expand('leetcode')}>
          {loading}
          {data?.problems_due.length === 0 && <Empty>No problems due.</Empty>}
          {data && (
            <List dense sx={{ mx: -2 }}>
              {data.problems_due.map((p) => (
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
        </Panel>

        <Panel title="Notes">
          <Empty>Coming soon</Empty>
        </Panel>

        <Panel title="Roadmaps" count={data?.roadmaps.length} onExpand={expand('roadmaps')}>
          {loading}
          {data?.roadmaps.length === 0 && <Empty>No roadmaps yet.</Empty>}
          {data && (
            <List dense sx={{ mx: -2 }}>
              {data.roadmaps.map((r) => (
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
        </Panel>
      </Box>
    </Stack>
  )
}
