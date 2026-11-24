import { ToggleButton, ToggleButtonGroup } from '@mui/material'

type Props<T extends string> = {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

/** Text toggle (e.g. Active / Retired / All): ghost buttons, the selected one outlined in the text color. */
export default function TextToggle<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      aria-label={label}
      value={value}
      onChange={(_, v: T | null) => v && onChange(v)}
      sx={{
        gap: 0.25,
        '&& .MuiToggleButtonGroup-grouped': {
          m: 0,
          height: 28,
          px: 1.25,
          border: 1,
          borderColor: 'transparent',
          borderRadius: 1,
          typography: 'body2',
          fontWeight: 500,
          color: 'text.secondary',
        },
        '&& .Mui-selected': { borderColor: 'text.primary', bgcolor: 'transparent', color: 'text.primary' },
      }}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} value={o.value}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
