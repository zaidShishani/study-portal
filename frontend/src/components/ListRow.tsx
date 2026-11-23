import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, ButtonBase } from '@mui/material'
import { motion } from '../theme/tokens'

type Props = { children: ReactNode; to?: string; onClick?: () => void }

/** 40px list row with a 1px divider; a link when `to` is given, a button when only `onClick` is. */
export default function ListRow({ children, to, onClick }: Props) {
  return (
    <Box
      component={to ? RouterLink : onClick ? ButtonBase : 'div'}
      to={to}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.5,
        width: '100%',
        minHeight: 40,
        px: 2,
        textAlign: 'left',
        color: 'inherit',
        textDecoration: 'none',
        typography: 'body1',
        borderBottom: 1,
        borderColor: 'action.hover', // action.hover is the `line` token
        transition: `background-color ${motion.hover}ms`,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {children}
    </Box>
  )
}
