import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CodeIcon from '@mui/icons-material/Code'
import MapIcon from '@mui/icons-material/Map'
import MenuIcon from '@mui/icons-material/Menu'
import NotesIcon from '@mui/icons-material/Notes'
import StyleIcon from '@mui/icons-material/Style'
import TodayIcon from '@mui/icons-material/Today'

const DRAWER_WIDTH = 220

const NAV = [
  { to: '/', label: 'Today', icon: <TodayIcon /> },
  { to: '/flashcards', label: 'Flashcards', icon: <StyleIcon /> },
  { to: '/leetcode', label: 'LeetCode', icon: <CodeIcon /> },
  { to: '/notes', label: 'Notes', icon: <NotesIcon /> },
  { to: '/roadmaps', label: 'Roadmaps', icon: <MapIcon /> },
  { to: '/calendar', label: 'Calendar', icon: <CalendarMonthIcon /> },
]

export default function Layout() {
  const theme = useTheme()
  // noSsr: use the real width on first render; defaultMatches: desktop when matchMedia is missing (jsdom).
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), {
    noSsr: true,
    defaultMatches: true,
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Study Portal
          </Typography>
          {/* Notification bell goes here. */}
        </Toolbar>
      </AppBar>
      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <nav aria-label="Main">
          <List>
            {NAV.map(({ to, label, icon }) => (
              <ListItemButton
                key={to}
                component={NavLink}
                to={to}
                end={to === '/'}
                onClick={() => setMobileOpen(false)}
                sx={{ '&.active': { bgcolor: 'action.selected' } }}
              >
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            ))}
          </List>
        </nav>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, minWidth: 0 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
