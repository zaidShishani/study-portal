import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, IconButton, Snackbar, Stack, TextField, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { HeaderActions } from '../components/Card'
import ConfirmDialog from '../components/ConfirmDialog'
import DifficultyDot from '../components/DifficultyDot'
import ListRow from '../components/ListRow'
import ProblemDialog from '../components/ProblemDialog'
import TextToggle from '../components/TextToggle'
import { focusUrl } from '../hooks/useFocus'
import { isHttpUrl, type ProblemFilters } from '../api/problems'
import { useCreateProblem, useDeleteProblem, useProblems, useUpdateProblem } from '../hooks/useProblems'
import { DIFFICULTIES, PATTERNS, type Difficulty, type Pattern, type Problem, type ProblemInput } from '../types'

const STATUSES = [
  { value: 'due', label: 'Due' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'all', label: 'All' },
] as const

/** "Nov 20" from YYYY-MM-DD (T00:00 parses as local midnight, so the day doesn't shift). */
const shortDate = (ymd: string) => new Date(`${ymd}T00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })

export default function LeetCodePage() {
  const [filters, setFilters] = useState<ProblemFilters>({ difficulty: '', pattern: '', status: 'active' })
  const problems = useProblems(filters)
  const createProblem = useCreateProblem()
  const updateProblem = useUpdateProblem()
  const deleteProblem = useDeleteProblem()
  // null = closed; { problem: undefined } = create; { problem } = edit.
  const [editing, setEditing] = useState<{ problem?: Problem } | null>(null)
  const [deleting, setDeleting] = useState<Problem | null>(null)
  // Separate flag keeps the title visible during the close animation.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const snackbar = message || (problems.error && problems.error !== dismissedError ? problems.error.message : '')
  // Browser timezone is synced to the user's by useMe, so local "today" matches the server's.
  // shortcut: fixed at mount, so due marks go stale past midnight until the page remounts.
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))

  function closeSnackbar() {
    setMessage('')
    setDismissedError(problems.error)
  }

  function save(input: ProblemInput) {
    const request = editing?.problem
      ? updateProblem.mutateAsync({ id: editing.problem.id, ...input })
      : createProblem.mutateAsync(input)
    return request.then(() => setEditing(null), onError)
  }

  function confirmDelete() {
    if (deleting) deleteProblem.mutate(deleting.id, { onError })
    setDeleteOpen(false)
  }

  const select = { select: { native: true }, inputLabel: { shrink: true } } as const

  return (
    <>
      <HeaderActions>
        <Button size="small" variant="contained" onClick={() => setEditing({})}>
          New problem
        </Button>
      </HeaderActions>

      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap', px: 2, py: 1.5, borderBottom: 1, borderColor: 'action.hover' }}>
        <TextField
          select
          size="small"
          label="Difficulty"
          value={filters.difficulty}
          onChange={(e) => setFilters({ ...filters, difficulty: e.target.value as Difficulty | '' })}
          slotProps={select}
          sx={{ width: 140 }}
        >
          <option value="">All</option>
          {DIFFICULTIES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Pattern"
          value={filters.pattern}
          onChange={(e) => setFilters({ ...filters, pattern: e.target.value as Pattern | '' })}
          slotProps={select}
          sx={{ width: 180 }}
        >
          <option value="">All</option>
          {PATTERNS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </TextField>
        <Box sx={{ ml: { sm: 'auto' } }}>
          <TextToggle label="Status" value={filters.status} options={STATUSES} onChange={(status) => setFilters({ ...filters, status })} />
        </Box>
      </Stack>

      {problems.data?.length === 0 && (
        <Typography color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          No problems match these filters.
        </Typography>
      )}
      <Box component="ul" aria-label="Problems" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {problems.data?.map((p) => {
          const due = p.retired_at ? 'Retired' : !p.due_date ? '' : p.due_date < today ? 'Overdue' : p.due_date === today ? 'Today' : shortDate(p.due_date)
          return (
            <Box component="li" key={p.id}>
              <ListRow>
                <Box
                  component={RouterLink}
                  to={focusUrl({ focus: 'leetcode', problem: p.id })}
                  sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
                >
                  {p.title}
                </Box>
                {p.link && isHttpUrl(p.link) && (
                  <IconButton size="small" component="a" href={p.link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.title} on LeetCode`}>
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
                <Box component="span" sx={{ width: 76, flexShrink: 0, typography: 'body2', color: 'text.secondary' }}>
                  <DifficultyDot difficulty={p.difficulty} />
                </Box>
                <Box component="span" sx={{ width: 140, flexShrink: 0, typography: 'body2', color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
                  {p.pattern}
                </Box>
                <Box component="span" sx={{ width: 64, flexShrink: 0, typography: 'body2', color: due === 'Overdue' || due === 'Today' ? 'secondary.dark' : 'text.secondary' }}>
                  {due}
                </Box>
                <IconButton size="small" aria-label={`Edit ${p.title}`} onClick={() => setEditing({ problem: p })}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Delete ${p.title}`}
                  onClick={() => {
                    setDeleting(p)
                    setDeleteOpen(true)
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListRow>
            </Box>
          )
        })}
      </Box>

      {editing && (
        <ProblemDialog
          problem={editing.problem}
          pending={createProblem.isPending || updateProblem.isPending}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete problem?"
        message={`"${deleting?.title ?? ''}" will be deleted.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
      <Snackbar open={!!snackbar} message={snackbar} autoHideDuration={6000} onClose={closeSnackbar} />
    </>
  )
}
