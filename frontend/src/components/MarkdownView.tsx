import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Box } from '@mui/material'

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

export default function MarkdownView({ children }: { children: string }) {
  return (
    <Box
      sx={{
        '& pre': { bgcolor: 'action.hover', p: 1.5, borderRadius: 1, overflowX: 'auto' },
        '& code': { fontFamily: 'monospace', fontSize: '0.875em' },
        '& :not(pre) > code': { bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5 },
        '& table': { borderCollapse: 'collapse' },
        '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.5 },
        '& img': { maxWidth: '100%' },
      }}
    >
      <Markdown
        remarkPlugins={[remarkGfm, htmlAsText]}
        components={{
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
