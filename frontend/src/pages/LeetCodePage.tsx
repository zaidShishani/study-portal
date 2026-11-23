import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Chip,
  IconButton,
  Link,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ConfirmDialog from '../components/ConfirmDialog'
import ProblemDialog from '../components/ProblemDialog'
import { isHttpUrl, type ProblemFilters } from '../api/problems'
import { useCreateProblem, useDeleteProblem, useProblems, useUpdateProblem } from '../hooks/useProblems'
import { DIFFICULTIES, DIFFICULTY_COLOR, PATTERNS, type Difficulty, type Pattern, type Problem, type ProblemInput, type ProblemStatus } from '../types'


const STATUSES: { value: ProblemStatus; label: string }[] = [
  { value: 'due', label: 'Due' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'all', label: 'All' },
]

const stop = (e: MouseEvent) => e.stopPropagation()

export default function LeetCodePage() {
  const navigate = useNavigate()
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

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          LeetCode
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
          New problem
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
        <TextField
          select
          size="small"
          label="Difficulty"
          value={filters.difficulty}
          onChange={(e) => setFilters({ ...filters, difficulty: e.target.value as Difficulty | '' })}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 140 }}
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
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 180 }}
        >
          <option value="">All</option>
          {PATTERNS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </TextField>
        <ToggleButtonGroup
          exclusive
          size="small"
          aria-label="Status"
          value={filters.status}
          onChange={(_, status: ProblemStatus | null) => status && setFilters({ ...filters, status })}
        >
          {STATUSES.map((s) => (
            <ToggleButton key={s.value} value={s.value}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {problems.data?.length === 0 ? (
        <Typography color="text.secondary">No problems match these filters.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Difficulty</TableCell>
                <TableCell>Pattern</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>Reviews</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {problems.data?.map((p) => {
                const due = !p.retired_at && !!p.due_date && p.due_date <= today
                const open = () => navigate(`/leetcode/${p.id}`)
                return (
                  <TableRow
                    key={p.id}
                    hover
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && open()}
                    sx={{ cursor: 'pointer', bgcolor: due ? 'action.selected' : undefined }}
                  >
                    <TableCell>
                      {p.link && isHttpUrl(p.link) ? (
                        <Link href={p.link} target="_blank" rel="noopener noreferrer" onClick={stop}>
                          {p.title}
                        </Link>
                      ) : (
                        p.title
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={p.difficulty} color={DIFFICULTY_COLOR[p.difficulty]} />
                    </TableCell>
                    <TableCell>{p.pattern}</TableCell>
                    <TableCell>{p.stage}</TableCell>
                    <TableCell>
                      {p.retired_at ? 'Retired' : (p.due_date ?? '—')}
                      {due && (
                        <Chip
                          size="small"
                          sx={{ ml: 1 }}
                          label={p.due_date! < today ? 'Overdue' : 'Due'}
                          color={p.due_date! < today ? 'error' : 'warning'}
                        />
                      )}
                    </TableCell>
                    <TableCell>{p.review_count}</TableCell>
                    <TableCell align="right" onClick={stop}>
                      <IconButton aria-label={`Edit ${p.title}`} onClick={() => setEditing({ problem: p })}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        aria-label={`Delete ${p.title}`}
                        onClick={() => {
                          setDeleting(p)
                          setDeleteOpen(true)
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
