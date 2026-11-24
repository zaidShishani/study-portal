import type { ReactNode } from 'react'
import { Button, IconButton, type Theme } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

const PHONE = (t: Theme) => t.breakpoints.down('sm')

type Props = {
  label: string
  onClick: () => void
  disabled?: boolean
  /** Shown instead of the label at phone width. */
  icon?: ReactNode
  variant?: 'text' | 'outlined'
  color?: 'primary' | 'error'
}

/** Secondary header action; an icon button at phone width so the header (and its count) fits. */
export default function HeaderButton({ label, onClick, disabled, icon = <AddIcon fontSize="small" />, variant = 'text', color }: Props) {
  return (
    <>
      <Button size="small" variant={variant} color={color} onClick={onClick} disabled={disabled} sx={(t) => ({ [PHONE(t)]: { display: 'none' } })}>
        {label}
      </Button>
      <IconButton
        size="small"
        aria-label={label}
        color={color}
        onClick={onClick}
        disabled={disabled}
        sx={(t) => ({ display: 'none', [PHONE(t)]: { display: 'inline-flex' } })}
      >
        {icon}
      </IconButton>
    </>
  )
}
