import { Component, type ReactNode } from 'react'
import { Typography } from '@mui/material'

type Props = { message: string; children: ReactNode }

// Keeps a render error in one panel from blanking the whole page.
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <Typography color="error" role="alert">{this.props.message}</Typography> : this.props.children
  }
}
