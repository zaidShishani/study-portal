import type { ReactNode } from 'react'
import { Stack } from '@mui/material'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import type { TreeLevel } from '../api/notes'

// Item ids: `f-<id>` for folders, `p-<id>` for pages.
type Props = {
  tree: TreeLevel
  selected: string | null
  onSelect: (itemId: string | null) => void
  expanded: string[]
  onExpandedChange: (itemIds: string[]) => void
}

const label = (icon: ReactNode, text: string) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
    {icon}
    <span>{text}</span>
  </Stack>
)

function renderLevel(level: TreeLevel): ReactNode[] {
  return [
    ...level.folders.map((node) => (
      <TreeItem key={`f-${node.folder.id}`} itemId={`f-${node.folder.id}`}
        label={label(<FolderOutlinedIcon fontSize="small" />, node.folder.name)}>
        {renderLevel(node)}
      </TreeItem>
    )),
    ...level.pages.map((page) => (
      <TreeItem key={`p-${page.id}`} itemId={`p-${page.id}`}
        label={label(<DescriptionOutlinedIcon fontSize="small" />, page.title)} />
    )),
  ]
}

export default function FolderTree({ tree, selected, onSelect, expanded, onExpandedChange }: Props) {
  return (
    <SimpleTreeView
      aria-label="Notes"
      selectedItems={selected}
      onSelectedItemsChange={(_, id) => onSelect(id)}
      expandedItems={expanded}
      onExpandedItemsChange={(_, ids) => onExpandedChange(ids)}
    >
      {renderLevel(tree)}
    </SimpleTreeView>
  )
}
