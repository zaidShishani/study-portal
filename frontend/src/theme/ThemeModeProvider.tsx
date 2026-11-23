import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material'
import { createAppTheme } from './theme'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme-mode'
const MODES: readonly string[] = ['light', 'dark', 'system']

type ThemeModeContext = { mode: ThemeMode; resolvedMode: 'light' | 'dark'; setMode: (mode: ThemeMode) => void }

const Context = createContext<ThemeModeContext | null>(null)

// Storage can throw (private mode, blocked site data); fall back to following the system.
function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved && MODES.includes(saved) ? (saved as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState(readMode)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true })
  const resolvedMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode])

  const value = useMemo<ThemeModeContext>(
    () => ({
      mode,
      resolvedMode,
      setMode: (next) => {
        setModeState(next)
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // Not persisted; the choice still applies for this session.
        }
      },
    }),
    [mode, resolvedMode],
  )

  return (
    <Context.Provider value={value}>
      <ThemeProvider theme={theme}>
        {/* enableColorScheme sets color-scheme on <html> so native scrollbars/controls match. */}
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </Context.Provider>
  )
}

// eslint-disable-next-line react/only-export-components -- the hook belongs with its provider
export function useThemeMode() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useThemeMode must be used inside ThemeModeProvider')
  return ctx
}
