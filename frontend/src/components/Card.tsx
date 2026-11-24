import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

// The header element views render their buttons into; undefined = not inside a Card (render in place).
const HeaderSlot = createContext<HTMLElement | null | undefined>(undefined)

/** A view's primary buttons, shown in the enclosing Card's header (before its own actions and the expand button). */
export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlot)
  if (slot === undefined) return children
  return slot && createPortal(children, slot)
}

/** The one card anatomy: 1px border, radius 8, 48px header, body scrolls. Fills its grid cell. */
export default function Card({ title, count, tabs, actions, onExpand, expanded = false, children }: Props) {
  const titleId = useId()
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return (
    <Paper
      component="section"
      aria-labelledby={titleId}
      sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}
    >
      <Stack direction="row" sx={{ height: 48, flexShrink: 0, alignItems: 'center', gap: 1, px: 2, borderBottom: 1, borderColor: 'divider' }}>
        {/* Focus target when a view opens (tabIndex set there); no ring for that programmatic focus. */}
        <Typography id={titleId} variant="subtitle1" component="h2" noWrap sx={{ flexShrink: 0, outline: 'none' }}>
          {title}
        </Typography>
        {count !== undefined && (
          // Expanded headers carry the view's buttons; on phones the count gives way so they fit.
          <Typography
            variant="body2"
            noWrap
            sx={{ flexShrink: 0, fontFamily: fonts.mono, color: 'text.secondary', display: expanded ? { xs: 'none', sm: 'block' } : undefined }}
          >
            {count}
          </Typography>
        )}
        {tabs}
        <Stack direction="row" sx={{ ml: 'auto', alignItems: 'center', gap: 1, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
          <Stack ref={setSlot} direction="row" sx={{ alignItems: 'center', gap: 1, '&:empty': { display: 'none' } }} />
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
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <HeaderSlot.Provider value={slot}>{children}</HeaderSlot.Provider>
      </Box>
    </Paper>
  )
}
