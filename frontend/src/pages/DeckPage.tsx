import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { ApiError } from '../api/client'
import CardDialog from '../components/CardDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import MarkdownView from '../components/MarkdownView'
import { useCards, useCreateCard, useDeleteCard, useUnretireCard, useUpdateCard } from '../hooks/useCards'
import { useDeck } from '../hooks/useDecks'
import type { Card, CardStatus } from '../types'

// Crude markdown strip for button labels, so screen readers can tell cards apart.
const excerpt = (md: string) => md.replace(/[#*_`>~[\]()!|-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)

export default function DeckPage() {
  const deckId = Number(useParams().deckId)
  const [status, setStatus] = useState<CardStatus>('active')
  const deck = useDeck(deckId)
  const cards = useCards(deckId, status)
  const createCard = useCreateCard()
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const unretireCard = useUnretireCard()
  // null = closed; { card: undefined } = create; { card } = edit.
  const [editing, setEditing] = useState<{ card?: Card } | null>(null)
  const [deleting, setDeleting] = useState<Card | null>(null)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const loadError = deck.error ?? cards.error
  const snackbar = message || (loadError && loadError !== dismissedError ? loadError.message : '')

  // 422 = a non-numeric id in the URL; treat it like an unknown deck.
  if (deck.error instanceof ApiError && (deck.error.status === 404 || deck.error.status === 422)) {
    return (
      <>
        <Typography variant="h4" component="h1" gutterBottom>
          Deck not found
        </Typography>
        <Button component={Link} to="/flashcards">
          Back to flashcards
        </Button>
      </>
    )
  }

  function closeSnackbar() {
    setMessage('')
    setDismissedError(loadError)
  }

  function save(values: { front: string; back: string }) {
    const opts = { onSuccess: () => setEditing(null), onError }
    if (editing?.card) updateCard.mutate({ id: editing.card.id, ...values }, opts)
    else createCard.mutate({ deckId, ...values }, opts)
  }

  function confirmDelete() {
    if (deleting) deleteCard.mutate(deleting.id, { onError })
    setDeleting(null)
  }

  const due = deck.data?.due_count ?? 0

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {deck.data?.title}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" component={Link} to={`/flashcards/${deckId}/review`} disabled={due === 0}>
            Start review ({due} due)
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
            New card
          </Button>
        </Stack>
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={status}
        onChange={(_, v: CardStatus | null) => v && setStatus(v)}
        aria-label="Card filter"
        sx={{ mb: 2 }}
      >
        <ToggleButton value="active">Active</ToggleButton>
        <ToggleButton value="retired">Retired</ToggleButton>
        <ToggleButton value="all">All</ToggleButton>
      </ToggleButtonGroup>

      {cards.data?.length === 0 && <Typography color="text.secondary">No cards here.</Typography>}

      <Stack spacing={1.5}>
        {cards.data?.map((card) => (
          <Paper key={card.id} variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Clamp long fronts to a short preview. */}
              <Box sx={{ maxHeight: '6em', overflow: 'hidden', '& > div > :first-of-type': { mt: 0 } }}>
                <MarkdownView>{card.front}</MarkdownView>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Stage {card.stage} · {card.retired_at ? 'Retired' : `Due ${card.due_date}`}
              </Typography>
            </Box>
            {card.retired_at && (
              <Button
                size="small"
                aria-label={`Un-retire card: ${excerpt(card.front)}`}
                onClick={() => unretireCard.mutate(card.id, { onError })}
                disabled={unretireCard.isPending}
              >
                Un-retire
              </Button>
            )}
            <IconButton aria-label={`Edit card: ${excerpt(card.front)}`} onClick={() => setEditing({ card })}>
              <EditIcon />
            </IconButton>
            <IconButton aria-label={`Delete card: ${excerpt(card.front)}`} onClick={() => setDeleting(card)}>
              <DeleteIcon />
            </IconButton>
          </Paper>
        ))}
      </Stack>

      {editing && (
        <CardDialog
          initial={editing.card}
          pending={createCard.isPending || updateCard.isPending}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete card?"
        message="This card will be permanently deleted."
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
      <Snackbar open={!!snackbar} message={snackbar} autoHideDuration={6000} onClose={closeSnackbar} />
    </>
  )
}
