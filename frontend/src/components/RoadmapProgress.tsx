import { LinearProgress, Stack, Typography } from '@mui/material'
import { fonts } from '../theme/tokens'

/** Mono "done / total" + 4px amber bar (hidden on phones). */
export default function RoadmapProgress({ title, done, total }: { title: string; done: number; total: number }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
      <Typography variant="body2" sx={{ fontFamily: fonts.mono, color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {done} / {total}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={total ? Math.round((done / total) * 100) : 0}
        aria-label={`${title} progress`}
        sx={{ width: 120, height: 4, display: { xs: 'none', sm: 'block' } }}
      />
    </Stack>
  )
}
