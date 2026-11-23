import type { ReactNode } from 'react'
import { Chip, IconButton, Paper, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'

type Props = {
  title: string
  count?: number
  /** Grid card: shows an "Expand <title>" button. */
  onExpand?: () => void
  /** Focused (full) view: shows a back arrow instead of the header; the child page brings its own h1. */
  onBack?: () => void
  /** Position in the one-column phone layout. */
  order?: number
  children: ReactNode
}

/** A home card. Its lowercased title is the heading id (`panel-<name>`). */
export default function Panel({ title, count, onExpand, onBack, order, children }: Props) {
  const name = title.toLowerCase()
  return (
    <Paper
      component="section"
      aria-labelledby={onBack ? undefined : `panel-${name}`}
      aria-label={onBack ? title : undefined}
      sx={{ p: 3, minWidth: 0, order }}
    >
      {onBack ? (
        <IconButton aria-label="Back to home" onClick={onBack} sx={{ ml: -1, mt: -1, mb: 1 }}>
          <ArrowBackIcon />
        </IconButton>
      ) : (
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography id={`panel-${name}`} variant="h5" component="h2" tabIndex={-1} sx={{ mr: 'auto', '&:focus': { outline: 'none' } }}>
            {title}
          </Typography>
          {count !== undefined && <Chip size="small" label={count} />}
          {onExpand && (
            <IconButton aria-label={`Expand ${title}`} onClick={onExpand} size="small" sx={{ mr: -0.5 }}>
              <OpenInFullIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      )}
      {children}
    </Paper>
  )
}
