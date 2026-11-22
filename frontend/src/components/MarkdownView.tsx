import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Box } from '@mui/material'

type MdNode = { type: string; children?: MdNode[] }

// Raw HTML is never rendered (no rehype-raw); turn it into plain text so the user sees what they typed.
function htmlAsText() {
  const walk = (node: MdNode) => {
    if (node.type === 'html') node.type = 'text'
    node.children?.forEach(walk)
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
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </Markdown>
    </Box>
  )
}
