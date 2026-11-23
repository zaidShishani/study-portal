import type { ReactNode } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { motion } from '../theme/tokens'

/** 40px list row with a 1px divider; a button when `onClick` is given. */
export default function ListRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <Box
      component={onClick ? ButtonBase : 'div'}
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
