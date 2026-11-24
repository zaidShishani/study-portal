import { cleanup, render, screen } from '@testing-library/react'
import { Autocomplete, TextField, ThemeProvider } from '@mui/material'
import { afterEach, expect, test } from 'vitest'
import { createAppTheme } from './theme'

afterEach(cleanup)

const label = (name: string) => document.querySelector(`label[for="${screen.getByLabelText(name).id}"]`)!

function Fields({ mode, zone }: { mode: 'light' | 'dark'; zone: string | null }) {
  return (
    <ThemeProvider theme={createAppTheme(mode)}>
      <TextField label="Title" value="Graphs" onChange={() => {}} />
      <TextField select label="Pattern" value="DP" onChange={() => {}} slotProps={{ select: { native: true } }}>
        <option>DP</option>
      </TextField>
      <Autocomplete options={['Europe/Istanbul']} value={zone} renderInput={(params) => <TextField {...params} label="Timezone" />} />
    </ThemeProvider>
  )
}

// Regression: an outlined field with a value floats its label above the value (Settings timezone).
test.each(['light', 'dark'] as const)('%s: filled fields shrink their labels, also when the value arrives late', (mode) => {
  const { rerender } = render(<Fields mode={mode} zone={null} />)
  expect(label('Timezone').getAttribute('data-shrink')).toBe('false')
  // Settings fills the zone once /api/me loads.
  rerender(<Fields mode={mode} zone="Europe/Istanbul" />)
  for (const name of ['Title', 'Pattern', 'Timezone']) {
    expect(label(name).getAttribute('data-shrink')).toBe('true')
    // Same size class on label and input, so the shrunk label sits on the outline notch.
    expect(label(name).className).toContain('MuiInputLabel-sizeSmall')
  }
})
