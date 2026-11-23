import { useId, type ReactNode } from 'react'
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { fonts } from '../theme/tokens'

type Props = {
  title: string
  /** Quiet Mono count next to the title, e.g. "22 due". */
  count?: ReactNode
  /** Header controls right after the title, e.g. roadmap tabs. */
  tabs?: ReactNode
  /** Header buttons (ghost/secondary/primary, size small); the expand button always comes last. */
  actions?: ReactNode
  onExpand?: () => void
  expanded?: boolean
  children: ReactNode
}

/** The one card anatomy: 1px border, radius 8, 48px header, body scrolls. Fills its grid cell. */
export default function Card({ title, count, tabs, actions, onExpand, expanded = false, children }: Props) {
  const titleId = useId()
  return (
    <Paper
      component="section"
      aria-labelledby={titleId}
      sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}
    >
      <Stack direction="row" sx={{ height: 48, flexShrink: 0, alignItems: 'center', gap: 1, px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography id={titleId} variant="subtitle1" component="h2" noWrap sx={{ flexShrink: 0 }}>
          {title}
        </Typography>
        {count !== undefined && (
          <Typography variant="body2" noWrap sx={{ fontFamily: fonts.mono, color: 'text.secondary' }}>
            {count}
          </Typography>
        )}
        {tabs}
        <Stack direction="row" sx={{ ml: 'auto', alignItems: 'center', gap: 1, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
          {actions}
          {onExpand && (
            <IconButton
              size="small"
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
              aria-expanded={expanded}
              onClick={onExpand}
            >
              {expanded ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
            </IconButton>
          )}
        </Stack>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</Box>
    </Paper>
  )
}
