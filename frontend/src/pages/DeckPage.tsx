import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, IconButton, Snackbar, Stack, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import dayjs from 'dayjs'
import { ApiError } from '../api/client'
import CardDialog from '../components/CardDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import ListRow from '../components/ListRow'
import TextToggle from '../components/TextToggle'
import { useCards, useDeleteCard, useUnretireCard, useUpdateCard } from '../hooks/useCards'
import { useDeck } from '../hooks/useDecks'
import { focusUrl } from '../hooks/useFocus'
import type { Card, CardStatus } from '../types'

// Crude markdown strip for one-line previews and button labels, so screen readers can tell cards apart.
const plain = (md: string) => md.replace(/[#*_`>~[\]()!|-]/g, '').replace(/\s+/g, ' ').trim()
const excerpt = (md: string) => plain(md).slice(0, 40)
const line = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'all', label: 'All' },
] as const

/** "Due today", "In 3 days", "Overdue", "Retired"; today/overdue are amber. */
function due(card: Card, today: string): [string, boolean] {
  if (card.retired_at) return ['Retired', false]
  if (!card.due_date) return ['', false]
  if (card.due_date < today) return ['Overdue', true]
  if (card.due_date === today) return ['Due today', true]
  const days = dayjs(card.due_date).diff(today, 'day')
  return [`In ${days} ${days === 1 ? 'day' : 'days'}`, false]
}

type Props = {
  deckId: number
  /** Deck-level buttons (rename, delete) next to the title. */
  actions?: ReactNode
}

/** The selected deck's cards: title row with the status toggle, then two-line rows (front / back, due on the right). */
export default function DeckPage({ deckId, actions }: Props) {
  const [status, setStatus] = useState<CardStatus>('active')
  const deck = useDeck(deckId)
  const cards = useCards(deckId, status)
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const unretireCard = useUnretireCard()
  // isPending lands a render late; the ref blocks a same-tick double click.
  const unretiring = useRef(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [deleting, setDeleting] = useState<Card | null>(null)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const loadError = deck.error ?? cards.error
  const snackbar = message || (loadError && loadError !== dismissedError ? loadError.message : '')
  // YYYY-MM-DD strings compare correctly as text; the browser zone is synced to the user's by useMe.
  const today = dayjs().format('YYYY-MM-DD')

  if (deck.error instanceof ApiError && deck.error.status === 404) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" component="h3" gutterBottom>
          Deck not found
        </Typography>
        <Button size="small" component={Link} to={focusUrl({ focus: 'flashcards' })}>
          Back to flashcards
        </Button>
      </Box>
    )
  }

  function closeSnackbar() {
    setMessage('')
    setDismissedError(loadError)
  }

  function save(values: { front: string; back: string }) {
    return updateCard.mutateAsync({ id: editing!.id, ...values }).then(() => setEditing(null), onError)
  }

  function confirmDelete() {
    if (deleting) deleteCard.mutate(deleting.id, { onError })
    setDeleting(null)
  }

  const count = deck.data?.card_count

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minHeight: 44, px: 2, borderBottom: 1, borderColor: 'action.hover' }}>
        <Typography variant="subtitle2" component="h3" sx={{ ...line, minWidth: 0 }}>
          {deck.data?.title}
        </Typography>
        {count !== undefined && (
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
            {count} {count === 1 ? 'card' : 'cards'}
          </Typography>
        )}
        {actions}
        <Box sx={{ ml: 'auto' }}>
          <TextToggle label="Card filter" value={status} options={STATUSES} onChange={setStatus} />
        </Box>
      </Stack>

      {cards.data?.length === 0 && (
        <Typography color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          No cards here.
        </Typography>
      )}

      {/* Row buttons show on hover / keyboard focus where hovering exists; always on touch. */}
      <Box sx={{ '@media (hover: hover)': { '& .row-actions': { opacity: 0 }, '& > :hover .row-actions, & .row-actions:focus-within': { opacity: 1 } } }}>
        {cards.data?.map((card) => {
          const [label, soon] = due(card, today)
          return (
            <ListRow key={card.id}>
              <Box sx={{ flex: 1, minWidth: 0, py: 1 }}>
                <Box sx={line}>{plain(card.front)}</Box>
                <Typography variant="body2" color="text.secondary" sx={line}>
                  {plain(card.back)}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ width: 96, flexShrink: 0, textAlign: 'right', color: soon ? 'secondary.dark' : 'text.secondary' }}>
                {label}
              </Typography>
              <Stack direction="row" className="row-actions" sx={{ alignItems: 'center', flexShrink: 0 }}>
                {card.retired_at && (
                  <Button
                    size="small"
                    aria-label={`Un-retire card: ${excerpt(card.front)}`}
                    onClick={() => {
                      if (unretiring.current) return
                      unretiring.current = true
                      unretireCard.mutate(card.id, {
                        onError,
                        onSettled: () => {
                          unretiring.current = false
                        },
                      })
                    }}
                    disabled={unretireCard.isPending}
                  >
                    Un-retire
                  </Button>
                )}
                <IconButton size="small" aria-label={`Edit card: ${excerpt(card.front)}`} onClick={() => setEditing(card)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label={`Delete card: ${excerpt(card.front)}`} onClick={() => setDeleting(card)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </ListRow>
          )
        })}
      </Box>

      {editing && (
        <CardDialog initial={editing} pending={updateCard.isPending} onSubmit={save} onClose={() => setEditing(null)} />
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
