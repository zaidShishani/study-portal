import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Button, IconButton, Snackbar, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolderOutlined'
import { HeaderActions } from '../components/Card'
import HeaderButton from '../components/HeaderButton'
import CardDialog from '../components/CardDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import DeckDialog from '../components/DeckDialog'
import { useCreateCard } from '../hooks/useCards'
import { useCreateDeck, useDecks, useDeleteDeck, useRenameDeck } from '../hooks/useDecks'
import { WIDE_QUERY } from '../hooks/useExpandFlip'
import { focusUrl } from '../hooks/useFocus'
import { fonts } from '../theme/tokens'
import type { Deck } from '../types'
import DeckPage from './DeckPage'
import ReviewPage from './ReviewPage'

type Props = {
  /** Deck shown in the middle pane (and reviewed on the right); defaults to the first deck. */
  deckId?: number
  /** Review every deck's due cards instead of the selected deck's. */
  reviewAll?: boolean
}

/** Expanded flashcards: deck list | selected deck's cards | inline review. */
export default function FlashcardsPage({ deckId, reviewAll = false }: Props) {
  const navigate = useNavigate()
  const decks = useDecks()
  const createDeck = useCreateDeck()
  const renameDeck = useRenameDeck()
  const deleteDeck = useDeleteDeck()
  const createCard = useCreateCard()
  // null = closed; { deck: undefined } = create; { deck } = rename.
  const [editing, setEditing] = useState<{ deck?: Deck } | null>(null)
  const [newCard, setNewCard] = useState(false)
  const [deleting, setDeleting] = useState<Deck | null>(null)
  // Separate flag keeps the deck title visible during the close animation.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const snackbar = message || (decks.error && decks.error !== dismissedError ? decks.error.message : '')
  const selectedId = deckId ?? decks.data?.[0]?.id
  const selected = decks.data?.find((d) => d.id === selectedId)
  const due = decks.data?.reduce((n, d) => n + d.due_count, 0) ?? 0

  function closeSnackbar() {
    setMessage('')
    setDismissedError(decks.error)
  }

  function save(title: string) {
    const req = editing?.deck ? renameDeck.mutateAsync({ id: editing.deck.id, title }) : createDeck.mutateAsync(title)
    return req.then(() => setEditing(null), onError)
  }

  function saveCard(values: { front: string; back: string }) {
    return createCard.mutateAsync({ deckId: selectedId!, ...values }).then(() => setNewCard(false), onError)
  }

  function confirmDelete() {
    const id = deleting?.id
    // The URL's deck is gone: fall back to the first deck.
    if (id) deleteDeck.mutate(id, { onError, onSuccess: () => id === deckId && navigate(focusUrl({ focus: 'flashcards' })) })
    setDeleteOpen(false)
  }

  return (
    <>
      <HeaderActions>
        <HeaderButton label="New deck" icon={<CreateNewFolderIcon fontSize="small" />} onClick={() => setEditing({})} />
        <HeaderButton label="New card" variant="outlined" disabled={!selected} onClick={() => setNewCard(true)} />
        <Button size="small" variant="contained" component={Link} to={focusUrl({ focus: 'flashcards', review: 'all' })} disabled={!due}>
          Review all
        </Button>
      </HeaderActions>

      <Box
        sx={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          [`@media ${WIDE_QUERY}`]: { gridTemplateColumns: '240px minmax(0, 1fr) 440px' },
          '& > *': { minHeight: 0, overflow: 'auto' },
        }}
      >
        <Box component="nav" aria-label="Decks" sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>
          {decks.data?.length === 0 && <Typography color="text.secondary" sx={{ p: 1 }}>No decks yet.</Typography>}
          {decks.data?.map((d) => (
            <Box
              key={d.id}
              component={Link}
              to={focusUrl({ focus: 'flashcards', deck: d.id })}
              aria-current={d.id === selectedId ? 'page' : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                height: 36,
                px: 1.25,
                borderRadius: 1,
                color: 'text.primary',
                textDecoration: 'none',
                typography: 'body1',
                '&:hover': { bgcolor: 'action.hover' },
                '&[aria-current]': { bgcolor: 'action.selected', fontWeight: 500 },
              }}
            >
              <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.title}
              </Box>
              <Box component="span" sx={{ fontFamily: fonts.mono, fontSize: 12, color: 'text.secondary' }}>
                {d.due_count}
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {selectedId !== undefined && (
            <DeckPage
              deckId={selectedId}
              actions={
                selected && (
                  <>
                    <IconButton size="small" aria-label={`Rename ${selected.title}`} onClick={() => setEditing({ deck: selected })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Delete ${selected.title}`}
                      onClick={() => {
                        setDeleting(selected)
                        setDeleteOpen(true)
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )
              }
            />
          )}
        </Box>

        <Box sx={{ borderLeft: 1, borderColor: 'divider', p: '20px 24px' }}>
          {decks.data && (reviewAll || selected) && (
            <ReviewPage
              key={reviewAll ? 'all' : selectedId}
              deckId={reviewAll ? undefined : selectedId}
              title={reviewAll || !selected ? 'All decks' : selected.title}
            />
          )}
        </Box>
      </Box>

      {editing && (
        <DeckDialog
          initialTitle={editing.deck?.title}
          pending={createDeck.isPending || renameDeck.isPending}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
      {newCard && <CardDialog pending={createCard.isPending} onSubmit={saveCard} onClose={() => setNewCard(false)} />}
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
