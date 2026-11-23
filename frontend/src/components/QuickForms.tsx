import { useId, useRef, useState, type FormEvent } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateCard } from '../hooks/useCards'
import { useCreatePage, useFolders } from '../hooks/useNotes'
import type { Deck, NoteFolder } from '../types'
import { dense, noteTitle, textError } from './quick'

const MAX_CARD = 10_000 // backend limits
const MAX_NOTE = 200_000

const label = (text: string) => ({ htmlInput: { 'aria-label': text } })

type OnError = (err: Error) => void

/** Flashcards' right column: Deck, Front, Back, Add → POST /api/decks/{id}/cards. */
export function QuickAddCard({ decks, onError }: { decks: Deck[]; onError: OnError }) {
  const queryClient = useQueryClient()
  const create = useCreateCard()
  const [deckId, setDeckId] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [touched, setTouched] = useState(false)
  // isPending lands a render late; the ref blocks a same-tick double click.
  const busy = useRef(false)
  const deckSelect = useId()
  const deck = decks.find((d) => String(d.id) === deckId) ?? decks[0]
  const errors = { front: textError(front, MAX_CARD), back: textError(back, MAX_CARD) }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!deck || errors.front || errors.back || busy.current) return
    busy.current = true
    create.mutate(
      { deckId: deck.id, front, back },
      {
        onSuccess: () => {
          setFront('')
          setBack('')
          setTouched(false)
          // The calendar card counts cards due per day.
          queryClient.invalidateQueries({ queryKey: ['calendar'] })
        },
        onError,
        onSettled: () => {
          busy.current = false
        },
      },
    )
  }

  return (
    <Stack component="form" noValidate onSubmit={submit} aria-label="Quick add card" sx={{ gap: 1, px: 2, py: 1 }}>
      <Typography variant="overline" component="h3" color="text.secondary" sx={{ lineHeight: 1.5 }}>
        Quick add card
      </Typography>
      <Typography variant="body2" component="label" htmlFor={deckSelect} color="text.secondary" sx={{ mb: -0.5 }}>
        Deck
      </Typography>
      <TextField
        select
        size="small"
        id={deckSelect}
        value={deck ? String(deck.id) : ''}
        onChange={(e) => setDeckId(e.target.value)}
        disabled={!deck}
        slotProps={{ select: { native: true } }}
        sx={dense}
      >
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title}
          </option>
        ))}
      </TextField>
      <TextField
        size="small"
        placeholder="Front"
        value={front}
        onChange={(e) => setFront(e.target.value)}
        error={touched && !!errors.front}
        helperText={touched && errors.front}
        slotProps={label('Front')}
        sx={dense}
      />
      <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
        <TextField
          size="small"
          placeholder="Back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          error={touched && !!errors.back}
          helperText={touched && errors.back}
          slotProps={label('Back')}
          sx={{ ...dense, flex: 1 }}
        />
        <Button type="submit" variant="contained" disabled={!deck || create.isPending}>
          Add
        </Button>
      </Stack>
    </Stack>
  )
}

/** "Parent / Child" labels, sorted, so nested folders with the same name stay distinguishable. */
function folderOptions(folders: NoteFolder[]) {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path = (f: NoteFolder) => {
    const names: string[] = []
    for (let x: NoteFolder | undefined = f; x; x = x.parent_id ? byId.get(x.parent_id) : undefined) names.unshift(x.name)
    return names.join(' / ')
  }
  return folders.map((f) => ({ id: f.id, label: path(f) })).sort((a, b) => a.label.localeCompare(b.label))
}

/** Notes quick capture: text + folder → a new page; Recent refreshes through useCreatePage. */
export function QuickNote({ onError }: { onError: OnError }) {
  const folders = useFolders()
  const create = useCreatePage()
  const [text, setText] = useState('')
  const [folder, setFolder] = useState('')
  const [touched, setTouched] = useState(false)
  const busy = useRef(false)
  const error = textError(text, MAX_NOTE)

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (error || busy.current) return
    busy.current = true
    create.mutate(
      { title: noteTitle(text), content: text, folder_id: folder ? Number(folder) : null },
      {
        onSuccess: () => {
          setText('')
          setTouched(false)
        },
        onError,
        onSettled: () => {
          busy.current = false
        },
      },
    )
  }

  return (
    <Stack
      component="form"
      noValidate
      onSubmit={submit}
      aria-label="Quick note"
      sx={{ gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: 'action.hover', flexShrink: 0 }}
    >
      <TextField
        multiline
        rows={3}
        placeholder="Capture a thought…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={touched && !!error}
        helperText={touched && error}
        slotProps={label('Quick note')}
        sx={{ '& .MuiInputBase-root': { py: 1, px: 1.25, fontSize: 13 } }}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          select
          size="small"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          slotProps={{ select: { native: true }, ...label('Save to folder') }}
          sx={{ ...dense, flex: 1, minWidth: 0 }}
        >
          <option value="">Root</option>
          {folderOptions(folders.data ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </TextField>
        <Button type="submit" variant="contained" disabled={create.isPending}>
          Save
        </Button>
      </Box>
    </Stack>
  )
}
