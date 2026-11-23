import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Divider, IconButton, ListItemText, Menu, MenuItem } from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../hooks/useNotifications'

const MAX_UNREAD = 50 // the API caps the unread list at 50

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function NotificationBell() {
  const { data = [] } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const navigate = useNavigate()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  // isPending arrives a render late; the ref blocks a second click immediately.
  const busy = useRef(false)
  const count = data.length >= MAX_UNREAD ? `${MAX_UNREAD}+` : String(data.length)

  function run(mutate: (opts: { onSettled: () => void }) => void) {
    if (busy.current) return
    busy.current = true
    setAnchor(null)
    mutate({ onSettled: () => (busy.current = false) })
  }

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={`Notifications, ${count} unread`}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <Badge badgeContent={count} color="error" invisible={data.length === 0}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {data.length === 0 && <MenuItem disabled>No reminders</MenuItem>}
        {data.map((n) => (
          <MenuItem
            key={n.id}
            onClick={() => {
              run((opts) => markRead.mutate(n.id, opts))
              navigate('/calendar')
            }}
          >
            <ListItemText primary={n.title} secondary={formatTime(n.occurrence_start)} />
          </MenuItem>
        ))}
        {data.length > 0 && <Divider />}
        {data.length > 0 && (
          <MenuItem onClick={() => run((opts) => markAll.mutate(undefined, opts))}>Mark all read</MenuItem>
        )}
      </Menu>
    </>
  )
}
