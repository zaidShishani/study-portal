import { Box, LinearProgress, Typography } from '@mui/material'

export default function RoadmapProgress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const label = `${done}/${total} · ${pct}%`
  return (
    <Box>
      <LinearProgress variant="determinate" value={pct} aria-label={`Progress ${label}`} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </Box>
  )
}
