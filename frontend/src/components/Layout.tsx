import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import { fonts } from '../theme/tokens'
import NotificationBell from './NotificationBell'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/settings', label: 'Settings' },
]
const LOGOUT_HINT = 'Available once login is set up'

export default function Layout() {
  const theme = useTheme()
  // noSsr: use the real width on first render; defaultMatches: desktop when matchMedia is missing (jsdom).
  const isWide = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true, defaultMatches: true })
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const closeMenu = () => setMenuAnchor(null)

  return (
    <>
      <AppBar
        position="sticky"
        sx={{ bgcolor: alpha(theme.palette.background.default, 0.8), backdropFilter: 'blur(8px)' }}
      >
        <Toolbar sx={{ width: '100%', maxWidth: 1200, mx: 'auto', gap: 1, px: { xs: 3, md: 4 } }}>
          <Typography
            component={Link}
            to="/"
            sx={{ fontFamily: fonts.heading, fontSize: '1.5rem', letterSpacing: '-0.02em', textDecoration: 'none', mr: 'auto' }}
          >
            Study Portal
          </Typography>
          {isWide ? (
            <>
              <Box component="nav" aria-label="Main" sx={{ display: 'flex', gap: 0.5 }}>
                {NAV.map(({ to, label }) => (
                  <Button
                    key={to}
                    component={NavLink}
                    to={to}
                    end
                    color="inherit"
                    sx={{
                      color: 'text.secondary',
                      // MUI Button drops the underline on hover; keep the active marker.
                      '&.active, &.active:hover': {
                        color: 'text.primary',
                        textDecoration: 'underline',
                        textDecorationColor: theme.palette.secondary.main,
                        textDecorationThickness: 2,
                        textUnderlineOffset: 6,
                      },
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </Box>
              <Tooltip title={LOGOUT_HINT} describeChild>
                {/* A disabled button can't take focus or hover; the wrapper lets the tooltip show for keyboard users. */}
                <span tabIndex={0}>
                  <Button disabled>Logout</Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <>
              <IconButton
                color="inherit"
                aria-label="Open menu"
                aria-haspopup="menu"
                aria-expanded={menuAnchor ? 'true' : undefined}
                onClick={(e) => setMenuAnchor(e.currentTarget)}
              >
                <MenuIcon />
              </IconButton>
              <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
                {NAV.map(({ to, label }) => (
                  <MenuItem
                    key={to}
                    component={NavLink}
                    to={to}
                    end
                    onClick={closeMenu}
                    sx={{ '&.active': { bgcolor: 'action.selected' } }}
                  >
                    {label}
                  </MenuItem>
                ))}
                <MenuItem disabled>
                  <ListItemText primary="Logout" secondary={LOGOUT_HINT} />
                </MenuItem>
              </Menu>
            </>
          )}
          <NotificationBell />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
        <Outlet />
      </Box>
    </>
  )
}
