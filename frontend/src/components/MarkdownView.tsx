import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ReactNode } from 'react'
import { Box, Typography, type TypographyProps } from '@mui/material'
import { fonts } from '../theme/tokens'

type MdNode = { type: string; value?: string; children?: MdNode[] }

const BLOCK_PARENTS = new Set(['root', 'blockquote', 'listItem'])

// Raw HTML is never rendered (no rehype-raw); turn it into plain text so the user sees what they typed.
function htmlAsText() {
  const walk = (node: MdNode) => {
    node.children?.forEach((child, i, siblings) => {
      if (child.type !== 'html') return walk(child)
      const text = { type: 'text', value: child.value }
      // Block-level HTML gets its own paragraph so separate blocks don't run together.
      siblings[i] = BLOCK_PARENTS.has(node.type) ? { type: 'paragraph', children: [text] } : text
    })
  }
  return walk
}

// Markdown headings sit two levels below the page's h1/h2 so notes never outrank the page structure.
const heading =
  (component: 'h3' | 'h4' | 'h5' | 'h6', variant: TypographyProps['variant']) =>
  ({ children }: { children?: ReactNode }) => (
    <Typography component={component} variant={variant} gutterBottom sx={{ mt: 2 }}>
      {children}
    </Typography>
  )

const HEADINGS = {
  h1: heading('h3', 'h6'),
  h2: heading('h4', 'subtitle1'),
  h3: heading('h5', 'subtitle2'),
  h4: heading('h6', 'subtitle2'),
  h5: heading('h6', 'subtitle2'),
  h6: heading('h6', 'subtitle2'),
}

export default function MarkdownView({ children }: { children: string }) {
  return (
    <Box
      sx={{
        '& pre': { bgcolor: 'action.hover', p: 1.5, borderRadius: 1, overflowX: 'auto' },
        '& code': { fontFamily: fonts.mono, fontSize: '0.875em' },
        '& :not(pre) > code': { bgcolor: 'action.hover', px: 0.5, borderRadius: 1 },
        '& table': { borderCollapse: 'collapse' },
        '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.5 },
        '& img': { maxWidth: '100%' },
      }}
    >
      <Markdown
        remarkPlugins={[remarkGfm, htmlAsText]}
        components={{
          ...HEADINGS,
          a: ({ node: _node, ...props }) =>
            props.href?.startsWith('#') ? (
              <a {...props} />
            ) : (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
        }}
      >
        {children}
      </Markdown>
    </Box>
  )
}
