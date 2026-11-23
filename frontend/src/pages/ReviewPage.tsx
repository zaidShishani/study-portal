import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Button, LinearProgress, Paper, Snackbar, Stack, Typography } from '@mui/material'
import { ApiError } from '../api/client'
import MarkdownView from '../components/MarkdownView'
import { useReviewCard, useReviewQueue } from '../hooks/useCards'
import { fonts } from '../theme/tokens'

const Kbd = ({ children }: { children: ReactNode }) => (
  <Box
    component="kbd"
    sx={{ ml: 1, px: 0.625, border: 1, borderBottomWidth: 2, borderColor: 'divider', borderRadius: '4px', fontSize: 11, lineHeight: '16px', color: 'text.secondary', bgcolor: 'background.default' }}
  >
    {children}
  </Box>
)

type Props = {
  /** undefined = review every deck. */
  deckId?: number
  /** Shown in the panel label: "Review · <title>". */
  title: string
}

/** Inline review panel: Space flips, 1 = Wrong, 2 = Right. */
export default function ReviewPage({ deckId, title }: Props) {
  const queue = useReviewQueue(deckId)
  const review = useReviewCard()
  // Answered (or skipped) card ids; the queue can refetch after card edits, so position comes from this, not an index.
  const [answered, setAnswered] = useState<number[]>([])
  const [flipped, setFlipped] = useState(false)
  const [message, setMessage] = useState('')
  // Mutation state updates asynchronously; this ref blocks a second answer from a fast double key press.
  const busy = useRef(false)
  const remaining = (queue.data ?? []).filter((c) => !answered.includes(c.id))
  const card = remaining[0]
  const total = answered.length + remaining.length

  function next(id: number) {
    setAnswered((a) => [...a, id])
    setFlipped(false)
  }

  function answer(correct: boolean) {
    if (!card || !flipped || busy.current) return
    busy.current = true
    review.mutate(
      { id: card.id, correct },
      {
        onSuccess: () => next(card.id),
        onError: (err) => {
          setMessage(err.message)
          // 409 = already reviewed elsewhere; move on rather than get stuck on it.
          if (err instanceof ApiError && err.status === 409) next(card.id)
        },
        onSettled: () => {
          busy.current = false
        },
      },
    )
  }

  // Re-bound each render so the handler sees the current card/flipped state.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      // Leave focused controls alone, e.g. Space must activate a focused button.
      const native = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']
      if (e.ctrlKey || e.metaKey || e.altKey || t.isContentEditable || native.includes(t.tagName)) return
      if (e.key === ' ') {
        if (!card) return
        e.preventDefault()
        setFlipped(true)
      } else if (e.key === '1') answer(false)
      else if (e.key === '2') answer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  let body: ReactNode
  if (queue.error) body = <Typography color="error">{queue.error.message}</Typography>
  else if (!queue.data) body = null
  else if (!card)
    body = (
      <Typography variant="subtitle2" component="h3" color="text.secondary">
        {answered.length ? `Done! Reviewed ${answered.length} ${answered.length === 1 ? 'card' : 'cards'}.` : 'Nothing due'}
      </Typography>
    )
  else
    body = (
      <>
        <LinearProgress variant="determinate" value={(answered.length / total) * 100} aria-label="Review progress" sx={{ height: 3 }} />
        <Paper
          sx={{ flex: 1, minHeight: 200, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3, textAlign: 'center' }}
        >
          <Typography variant="body2" color="text.secondary">
            Front
          </Typography>
          <Box sx={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', '& p': { m: 0 } }}>
            <MarkdownView>{card.front}</MarkdownView>
          </Box>
          {flipped && (
            <>
              <Box sx={{ width: 40, height: '1px', bgcolor: 'divider', my: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                Back
              </Typography>
              <Box sx={{ fontSize: 15, '& p': { m: 0 } }}>
                <MarkdownView>{card.back}</MarkdownView>
              </Box>
            </>
          )}
        </Paper>
        {flipped ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Button variant="outlined" sx={{ height: 40 }} disabled={review.isPending} onClick={() => answer(false)}>
              Wrong <Kbd>1</Kbd>
            </Button>
            <Button variant="contained" sx={{ height: 40, '& kbd': { color: 'inherit', bgcolor: 'transparent', opacity: 0.8 } }} disabled={review.isPending} onClick={() => answer(true)}>
              Right <Kbd>2</Kbd>
            </Button>
          </Box>
        ) : (
          <Button variant="outlined" sx={{ height: 40 }} onClick={() => setFlipped(true)}>
            Show answer <Kbd>Space</Kbd>
          </Button>
        )}
      </>
    )

  return (
    <Stack sx={{ height: '100%', gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Typography variant="overline" component="h3" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
          Review · {title}
        </Typography>
        {card && (
          <Typography variant="body2" sx={{ ml: 'auto', flexShrink: 0, fontFamily: fonts.mono, color: 'text.secondary' }}>
            {answered.length + 1} of {total}
          </Typography>
        )}
      </Stack>
      {body}
      <Snackbar open={!!message} message={message} autoHideDuration={6000} onClose={() => setMessage('')} />
    </Stack>
  )
}
