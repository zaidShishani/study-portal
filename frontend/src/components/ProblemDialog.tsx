import { useRef, useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  Stack,
  TextField,
} from '@mui/material'
import MarkdownEditor from './MarkdownEditor'
import { isHttpUrl } from '../api/problems'
import { DIFFICULTIES, PATTERNS, type Difficulty, type Pattern, type Problem, type ProblemInput } from '../types'

const MAX_TITLE = 255
const MAX_LINK = 2048
const MAX_MINUTES = 1440
const MAX_TEXT = 10_000

type Props = {
  problem?: Problem
  pending?: boolean
  onSubmit: (input: ProblemInput) => Promise<unknown>
  onClose: () => void
}

// Rendered only while open, so state resets from `problem` each time.
export default function ProblemDialog({ problem, pending = false, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(problem?.title ?? '')
  const [link, setLink] = useState(problem?.link ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>(problem?.difficulty ?? '')
  const [pattern, setPattern] = useState<Pattern | ''>(problem?.pattern ?? '')
  const [minutes, setMinutes] = useState(problem?.minutes?.toString() ?? '')
  const [keyInsight, setKeyInsight] = useState(problem?.key_insight ?? '')
  const [notes, setNotes] = useState(problem?.notes ?? '')
  const [touched, setTouched] = useState(false)
  // isPending arrives a render late; the ref blocks a second submit immediately.
  const busy = useRef(false)

  const trimmedTitle = title.trim()
  const trimmedLink = link.trim()
  const errors = {
    title: !trimmedTitle ? 'Title is required' : trimmedTitle.length > MAX_TITLE ? `Max ${MAX_TITLE} characters` : '',
    link:
      trimmedLink && (!isHttpUrl(trimmedLink) || trimmedLink.length > MAX_LINK) ? 'Enter an http(s) URL' : '',
    difficulty: difficulty ? '' : 'Difficulty is required',
    pattern: pattern ? '' : 'Pattern is required',
    minutes:
      minutes.trim() && !(/^\d+$/.test(minutes.trim()) && Number(minutes) <= MAX_MINUTES)
        ? `Whole minutes, 0–${MAX_MINUTES}`
        : '',
    keyInsight: keyInsight.length > MAX_TEXT ? 'Max 10,000 characters' : '',
    notes: notes.length > MAX_TEXT ? 'Max 10,000 characters' : '',
  }
  const show = (field: keyof typeof errors) => ({ error: touched && !!errors[field], helperText: touched && errors[field] })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.values(errors).some(Boolean) || pending || busy.current || !difficulty || !pattern) return
    busy.current = true
    const input: ProblemInput = {
      title: trimmedTitle,
      link: trimmedLink || null,
      difficulty,
      pattern,
      minutes: minutes.trim() ? Number(minutes) : null,
      key_insight: keyInsight || null,
      notes: notes || null,
    }
    Promise.resolve(onSubmit(input)).finally(() => {
      busy.current = false
    })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{problem ? 'Edit problem' : 'New problem'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField autoFocus label="Title" value={title} onChange={(e) => setTitle(e.target.value)} {...show('title')} />
            <TextField label="Link" value={link} onChange={(e) => setLink(e.target.value)} {...show('link')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label="Difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                {...show('difficulty')}
              >
                <option value="" disabled />
                {DIFFICULTIES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value as Pattern)}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                {...show('pattern')}
              >
                <option value="" disabled />
                {PATTERNS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Minutes"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                {...show('minutes')}
              />
            </Stack>
            <Box>
              <MarkdownEditor label="Key insight" value={keyInsight} onChange={setKeyInsight} minRows={2} />
              {touched && errors.keyInsight && <FormHelperText error>{errors.keyInsight}</FormHelperText>}
            </Box>
            <Box>
              <MarkdownEditor label="Notes" value={notes} onChange={setNotes} />
              {touched && errors.notes && <FormHelperText error>{errors.notes}</FormHelperText>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={pending}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
