import { Link, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Page not found
      </Typography>
      <Link component={RouterLink} to="/">
        Back to Today
      </Link>
    </>
  )
}
