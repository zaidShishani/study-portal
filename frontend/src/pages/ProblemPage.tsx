import { useRef, useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { Box, Button, Chip, Link, Snackbar, Stack, Typography } from '@mui/material'
import AttemptDialog from '../components/AttemptDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import MarkdownView from '../components/MarkdownView'
import ProblemDialog from '../components/ProblemDialog'
import { ApiError } from '../api/client'
import { isHttpUrl, type AttemptInput } from '../api/problems'
import {
  useAttemptProblem,
  useDeleteProblem,
  useProblem,
  useUnretireProblem,
  useUpdateProblem,
} from '../hooks/useProblems'
import { DIFFICULTY_COLOR, RESULT_LABELS, type ProblemInput } from '../types'

export default function ProblemPage() {
  const { problemId = '' } = useParams()
  const navigate = useNavigate()
  const query = useProblem(problemId)
  const updateProblem = useUpdateProblem()
  const deleteProblem = useDeleteProblem()
  const attemptProblem = useAttemptProblem()
  const unretireProblem = useUnretireProblem()
  // isPending lands a render late; the ref blocks a same-tick double click.
  const unretiring = useRef(false)
  const [editing, setEditing] = useState(false)
  const [attempting, setAttempting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [message, setMessage] = useState('')
  const onError = (err: Error) => setMessage(err.message)
  const p = query.data

  // 422 = non-numeric id in the URL.
  if (query.error instanceof ApiError && [404, 422].includes(query.error.status)) {
    return (
      <>
        <Typography variant="h4" component="h1" gutterBottom>
          Problem not found
        </Typography>
        <Link component={RouterLink} to="/leetcode">
          Back to LeetCode
        </Link>
      </>
    )
  }

  if (!p) {
    return (
      <Snackbar open={!!query.error} message={query.error?.message} autoHideDuration={6000} />
    )
  }

  const save = (input: ProblemInput) =>
    updateProblem.mutateAsync({ id: p.id, ...input }).then(() => setEditing(false), onError)

  const logAttempt = (input: AttemptInput) =>
    attemptProblem.mutateAsync({ id: p.id, ...input }).then(() => setAttempting(false), onError)

  function confirmDelete() {
    setDeleteOpen(false)
    deleteProblem.mutate(p!.id, { onSuccess: () => navigate('/leetcode'), onError })
  }

  const details: [string, ReactNode][] = [
    ['Pattern', p.pattern],
    ['Stage', p.stage],
    ['Next due', p.retired_at ? 'Retired' : (p.due_date ?? '—')],
    ['Reviews', p.review_count],
    ['Last result', p.last_result ? RESULT_LABELS[p.last_result] : '—'],
    ['Solved', p.solved_date ?? '—'],
    ['Minutes', p.minutes ?? '—'],
  ]

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 3 }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {p.link && isHttpUrl(p.link) ? (
              <Link href={p.link} target="_blank" rel="noopener noreferrer">
                {p.title}
              </Link>
            ) : (
              p.title
            )}
          </Typography>
          <Chip label={p.difficulty} color={DIFFICULTY_COLOR[p.difficulty]} />
        </Stack>
        <Stack direction="row" spacing={1}>
          {p.retired_at ? (
            <Button
              variant="contained"
              disabled={unretireProblem.isPending}
              onClick={() => {
                if (unretiring.current) return
                unretiring.current = true
                unretireProblem.mutate(p.id, {
                  onError,
                  onSettled: () => {
                    unretiring.current = false
                  },
                })
              }}
            >
              Un-retire
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setAttempting(true)}>
              Log attempt
            </Button>
          )}
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button color="error" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </Stack>
      </Stack>

      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1, m: 0, mb: 3 }}>
        {details.map(([label, value]) => (
          <Box key={label} sx={{ display: 'contents' }}>
            <Typography component="dt" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" sx={{ m: 0 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {p.key_insight && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" component="h2">
            Key insight
          </Typography>
          <MarkdownView>{p.key_insight}</MarkdownView>
        </Box>
      )}
      {p.notes && (
        <Box>
          <Typography variant="h6" component="h2">
            Notes
          </Typography>
          <MarkdownView>{p.notes}</MarkdownView>
        </Box>
      )}

      {editing && (
        <ProblemDialog problem={p} pending={updateProblem.isPending} onSubmit={save} onClose={() => setEditing(false)} />
      )}
      {attempting && (
        <AttemptDialog pending={attemptProblem.isPending} onSubmit={logAttempt} onClose={() => setAttempting(false)} />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete problem?"
        message={`"${p.title}" will be deleted.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
      <Snackbar open={!!message} message={message} autoHideDuration={6000} onClose={() => setMessage('')} />
    </>
  )
}
