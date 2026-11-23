import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  IconButton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ConfirmDialog from '../components/ConfirmDialog'
import DeckDialog from '../components/DeckDialog'
import { useCreateDeck, useDecks, useDeleteDeck, useRenameDeck } from '../hooks/useDecks'
import { focusUrl } from '../hooks/useFocus'
import type { Deck } from '../types'

export default function FlashcardsPage() {
  const decks = useDecks()
  const createDeck = useCreateDeck()
  const renameDeck = useRenameDeck()
  const deleteDeck = useDeleteDeck()
  // null = closed; { deck: undefined } = create; { deck } = rename.
  const [editing, setEditing] = useState<{ deck?: Deck } | null>(null)
  const [deleting, setDeleting] = useState<Deck | null>(null)
  // Separate flag keeps the deck title visible during the close animation.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const snackbar = message || (decks.error && decks.error !== dismissedError ? decks.error.message : '')

  function closeSnackbar() {
    setMessage('')
    setDismissedError(decks.error)
  }

  function save(title: string) {
    const req = editing?.deck ? renameDeck.mutateAsync({ id: editing.deck.id, title }) : createDeck.mutateAsync(title)
    return req.then(() => setEditing(null), onError)
  }

  function confirmDelete() {
    if (deleting) deleteDeck.mutate(deleting.id, { onError })
    setDeleteOpen(false)
  }

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Flashcards
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
          New deck
        </Button>
      </Stack>

      {decks.data?.length === 0 && <Typography color="text.secondary">No decks yet. Create one to get started.</Typography>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {decks.data?.map((deck) => (
          <Card key={deck.id} variant="outlined">
            <CardActionArea component={Link} to={focusUrl({ focus: 'flashcards', deck: deck.id })}>
              <CardContent>
                <Typography variant="h6" component="h2" noWrap title={deck.title}>
                  {deck.title}
                </Typography>
                <Typography color="text.secondary">
                  {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'} · {deck.due_count} due
                </Typography>
              </CardContent>
            </CardActionArea>
            <CardActions sx={{ justifyContent: 'flex-end' }}>
              <IconButton aria-label={`Rename ${deck.title}`} onClick={() => setEditing({ deck })}>
                <EditIcon />
              </IconButton>
              <IconButton aria-label={`Delete ${deck.title}`} onClick={() => {
                  setDeleting(deck)
                  setDeleteOpen(true)
                }}>
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      {editing && <DeckDialog
          initialTitle={editing.deck?.title}
          pending={createDeck.isPending || renameDeck.isPending}
          onSubmit={save} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete deck?"
        message={`"${deleting?.title ?? ''}" and all its cards will be deleted.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
      <Snackbar open={!!snackbar} message={snackbar} autoHideDuration={6000} onClose={closeSnackbar} />
    </>
  )
}
