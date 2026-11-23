import { Box } from '@mui/material'
import { DIFFICULTY_COLOR, type Difficulty } from '../types'

/** 6px colored dot + plain text; replaces difficulty chips. */
export default function DifficultyDot({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
      <Box
        component="span"
        aria-hidden
        sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: `${DIFFICULTY_COLOR[difficulty]}.main` }}
      />
      {difficulty}
    </Box>
  )
}
