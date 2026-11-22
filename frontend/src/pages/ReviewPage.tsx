import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Divider, Paper, Snackbar, Stack, Typography } from '@mui/material'
import { ApiError } from '../api/client'
import MarkdownView from '../components/MarkdownView'
import { useReviewCard, useReviewQueue } from '../hooks/useCards'

export default function ReviewPage() {
  const param = useParams().deckId
  const deckId = param === undefined ? undefined : Number(param)
  const backTo = deckId === undefined ? '/flashcards' : `/flashcards/${deckId}`
  const queue = useReviewQueue(deckId)
  const review = useReviewCard()
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [message, setMessage] = useState('')
  // Mutation state updates asynchronously; this ref blocks a second answer from a fast double key press.
  const busy = useRef(false)
  const cards = queue.data ?? []
  const card = cards[index]

  function next() {
    setIndex((i) => i + 1)
    setFlipped(false)
  }

  function answer(correct: boolean) {
    if (!card || !flipped || busy.current) return
    busy.current = true
    review.mutate(
      { id: card.id, correct },
      {
        onSuccess: next,
        onError: (err) => {
          setMessage(err.message)
          // 409 = already reviewed elsewhere; move on rather than get stuck on it.
          if (err instanceof ApiError && err.status === 409) next()
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
        e.preventDefault()
        setFlipped(true)
      } else if (e.key === '1') answer(false)
      else if (e.key === '2') answer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const back = (
    <Button component={Link} to={backTo}>
      Back to {deckId === undefined ? 'flashcards' : 'deck'}
    </Button>
  )

  if (queue.error)
    return (
      <>
        <Typography color="error" gutterBottom>
          {queue.error.message}
        </Typography>
        {back}
      </>
    )
  if (!queue.data) return null
  if (cards.length === 0)
    return (
      <>
        <Typography variant="h4" component="h1" gutterBottom>
          Nothing due
        </Typography>
        {back}
      </>
    )
  if (!card)
    return (
      <>
        <Typography variant="h4" component="h1" gutterBottom>
          Done! Reviewed {cards.length} {cards.length === 1 ? 'card' : 'cards'}.
        </Typography>
        {back}
      </>
    )

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Review
        </Typography>
        <Typography color="text.secondary">
          {index + 1} of {cards.length}
        </Typography>
      </Stack>
      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <MarkdownView>{card.front}</MarkdownView>
        {flipped && (
          <>
            <Divider sx={{ my: 2 }} />
            <MarkdownView>{card.back}</MarkdownView>
          </>
        )}
      </Paper>
      {flipped ? (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="error" disabled={review.isPending} onClick={() => answer(false)}>
            Wrong (1)
          </Button>
          <Button variant="contained" color="success" disabled={review.isPending} onClick={() => answer(true)}>
            Right (2)
          </Button>
        </Stack>
      ) : (
        <Button variant="contained" onClick={() => setFlipped(true)}>
          Show answer (Space)
        </Button>
      )}
      <Snackbar open={!!message} message={message} autoHideDuration={6000} onClose={() => setMessage('')} />
    </>
  )
}
