import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Autocomplete, Box, Button, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { ApiError } from '../api/client'
import { getMe, updateMe } from '../api/me'
import { markTimezoneManual } from '../hooks/useMe'
import { useThemeMode, type ThemeMode } from '../theme/ThemeModeProvider'

const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode()
  const queryClient = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false })
  const [picked, setPicked] = useState<string | null>(null)
  const timezone = picked ?? me?.timezone ?? null
  // Chromium leaves UTC (the server default) out of the list; keep it and the current values selectable.
  const zones = useMemo(
    () => [...new Set([...(me ? [me.timezone] : []), browserTz(), 'UTC', ...Intl.supportedValuesOf('timeZone')])],
    [me],
  )
  const save = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      markTimezoneManual()
      setPicked(null)
      for (const key of ['me', 'calendar', 'dashboard']) queryClient.invalidateQueries({ queryKey: [key] })
    },
  })
  // isPending arrives a render late; the ref blocks a second click immediately.
  const busy = useRef(false)

  function handleSave() {
    if (!timezone || busy.current) return
    busy.current = true
    save.mutate({ timezone }, { onSettled: () => (busy.current = false) })
  }

  const error = save.error
    ? save.error instanceof ApiError && save.error.status === 422
      ? 'Not a valid timezone'
      : 'Could not save timezone'
    : ''

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Box sx={{ display: 'grid', gap: 3, maxWidth: 640 }}>
        <Paper component="section" aria-labelledby="appearance-heading" sx={{ p: 3 }}>
          <Typography id="appearance-heading" variant="h5" component="h2" gutterBottom>
            Appearance
          </Typography>
          <ToggleButtonGroup
            exclusive
            aria-label="Theme"
            value={mode}
            onChange={(_, next: ThemeMode | null) => next && setMode(next)}
          >
            <ToggleButton value="light">Light</ToggleButton>
            <ToggleButton value="dark">Dark</ToggleButton>
            <ToggleButton value="system">System</ToggleButton>
          </ToggleButtonGroup>
        </Paper>
        <Paper component="section" aria-labelledby="timezone-heading" sx={{ p: 3 }}>
          <Typography id="timezone-heading" variant="h5" component="h2" gutterBottom>
            Timezone
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Current: {me?.timezone ?? '…'}
          </Typography>
          <Autocomplete
            options={zones}
            value={timezone}
            onChange={(_, next) => {
              setPicked(next)
              save.reset()
            }}
            renderInput={(params) => (
              <TextField {...params} label="Timezone" error={!!error} helperText={error || ' '} />
            )}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button variant="contained" onClick={handleSave} disabled={!timezone || save.isPending}>
              Save
            </Button>
            <Button
              onClick={() => {
                setPicked(browserTz())
                save.reset()
              }}
            >
              Use browser timezone
            </Button>
          </Box>
        </Paper>
      </Box>
    </>
  )
}
