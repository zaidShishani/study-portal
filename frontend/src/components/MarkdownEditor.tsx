import { useState } from 'react'
import { Box, Tab, Tabs, TextField, Typography } from '@mui/material'
import MarkdownView from './MarkdownView'

type Props = {
  value: string
  onChange: (value: string) => void
  label?: string
  minRows?: number
}

export default function MarkdownEditor({ value, onChange, label, minRows = 6 }: Props) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v: 'edit' | 'preview') => setTab(v)}>
        <Tab label="Edit" value="edit" />
        <Tab label="Preview" value="preview" />
      </Tabs>
      <Box sx={{ pt: 2 }}>
        {tab === 'edit' ? (
          <TextField
            label={label ?? 'Markdown'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            multiline
            minRows={minRows}
            fullWidth
          />
        ) : value.trim() ? (
          <MarkdownView>{value}</MarkdownView>
        ) : (
          <Typography color="text.secondary">Nothing to preview</Typography>
        )}
      </Box>
    </Box>
  )
}
