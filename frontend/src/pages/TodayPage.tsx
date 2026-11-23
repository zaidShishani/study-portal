import type { ReactNode } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { Link } from 'react-router-dom'
import RoadmapProgress from '../components/RoadmapProgress'
import { useToday } from '../hooks/useDashboard'
import { DIFFICULTY_COLOR } from '../types'

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function Section({ title, empty, children }: { title: string; empty: string | false; children: ReactNode }) {
  return (
    <Card variant="outlined" component="section" aria-label={title}>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {title}
        </Typography>
        {empty ? <Typography color="text.secondary">{empty}</Typography> : children}
      </CardContent>
    </Card>
  )
}

export default function TodayPage() {
  const { data, error, isPending } = useToday()
  const title = (
    <Typography variant="h4" component="h1">
      Today
    </Typography>
  )
  if (isPending || error)
    return (
      <Stack spacing={2}>
        {title}
        {error ? <Typography color="error">{error.message}</Typography> : <CircularProgress aria-label="Loading" />}
      </Stack>
    )

  const due = data.due_card_total
  return (
    <Stack spacing={2}>
      <Box>
        {title}
        <Typography color="text.secondary">
          {/* T00:00 parses as local midnight, so the weekday is the server's date, not shifted by UTC. */}
          {new Date(`${data.date}T00:00`).toLocaleDateString([], { dateStyle: 'full' })}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
        <Section title="Flashcards" empty={false}>
          <Typography color={due ? undefined : 'text.secondary'}>
            {due ? `${due} ${due === 1 ? 'card' : 'cards'} due` : 'No cards due.'}
          </Typography>
          <List dense>
            {data.decks.map((d) => (
              <ListItemButton key={d.id} component={Link} to={`/flashcards/${d.id}/review`}>
                <ListItemText sx={{ minWidth: 0, overflowWrap: 'anywhere' }} primary={d.title} />
                <Chip size="small" label={d.due_count} />
              </ListItemButton>
            ))}
          </List>
          <Button variant="contained" component={Link} to="/flashcards/review" disabled={due === 0}>
            Start review
          </Button>
        </Section>

        <Section title="LeetCode" empty={data.problems_due.length === 0 && 'No problems due.'}>
          <List dense>
            {data.problems_due.map((p) => (
              <ListItemButton key={p.id} component={Link} to={`/leetcode/${p.id}`}>
                <ListItemText sx={{ minWidth: 0, overflowWrap: 'anywhere' }} primary={p.title} />
                <Stack direction="row" spacing={1}>
                  {p.due_date < data.date && <Chip size="small" label="Overdue" color="error" variant="outlined" />}
                  <Chip size="small" label={p.difficulty} color={DIFFICULTY_COLOR[p.difficulty]} />
                </Stack>
              </ListItemButton>
            ))}
          </List>
        </Section>

        <Section title="Today's events" empty={data.events_today.length === 0 && 'Nothing scheduled today.'}>
          <List dense>
            {data.events_today.map((e) => (
              <ListItemButton key={`${e.event_id}-${e.start}`} component={Link} to="/calendar">
                <ListItemText
                  sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
                  primary={e.title}
                  secondary={e.all_day ? 'All day' : e.end ? `${time(e.start)} – ${time(e.end)}` : time(e.start)}
                />
              </ListItemButton>
            ))}
          </List>
        </Section>

        <Section title="Roadmaps" empty={data.roadmaps.length === 0 && 'No roadmaps yet.'}>
          <List dense>
            {data.roadmaps.map((r) => (
              <ListItemButton key={r.id} component={Link} to={`/roadmaps/${r.id}`} sx={{ display: 'block' }}>
                <ListItemText sx={{ minWidth: 0, overflowWrap: 'anywhere' }} primary={r.title} />
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
        </Section>
      </Box>
    </Stack>
  )
}
