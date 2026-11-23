import type { ReactNode } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { Link } from 'react-router-dom'
import { motion } from '../theme/tokens'

const sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 1.5,
  width: '100%',
  minHeight: 40,
  px: 2,
  textAlign: 'left',
  typography: 'body1',
  borderBottom: 1,
  borderColor: 'action.hover', // action.hover is the `line` token
  transition: `background-color ${motion.hover}ms`,
  '&:hover': { bgcolor: 'action.hover' },
} as const

/** 40px list row with a 1px divider; a link when `to` is given, a button when `onClick` is. */
export default function ListRow({ children, onClick, to }: { children: ReactNode; onClick?: () => void; to?: string }) {
  if (to)
    return (
      <ButtonBase component={Link} to={to} sx={sx}>
        {children}
      </ButtonBase>
    )
  return (
    <Box component={onClick ? ButtonBase : 'div'} onClick={onClick} sx={sx}>
      {children}
    </Box>
  )
}
