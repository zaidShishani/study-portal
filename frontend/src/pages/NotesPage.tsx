import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material'
import { buildTree, type TreeLevel } from '../api/notes'
import ConfirmDialog from '../components/ConfirmDialog'
import FolderTree from '../components/FolderTree'
import MarkdownEditor from '../components/MarkdownEditor'
import NoteDialog, { type FolderOption } from '../components/NoteDialog'
import {
  useAllPages,
  useCreateFolder,
  useCreatePage,
  useDeleteFolder,
  useDeletePage,
  useFolders,
  usePage,
  useUpdateFolder,
  useUpdatePage,
} from '../hooks/useNotes'
import type { NotePage } from '../types'

const MAX_TITLE = 200
const MAX_CONTENT = 200_000

type DialogKind = 'folder' | 'page' | 'rename' | 'move'

function flatten(level: TreeLevel, depth = 0): FolderOption[] {
  return level.folders.flatMap((n) => [{ id: n.folder.id, name: n.folder.name, depth }, ...flatten(n, depth + 1)])
}

export default function NotesPage() {
  const folders = useFolders()
  const folderList = useMemo(() => folders.data ?? [], [folders.data])
  const allPages = useAllPages(folderList.map((f) => f.id))
  const tree = useMemo(() => buildTree(folderList, allPages.pages), [folderList, allPages.pages])
  const createFolder = useCreateFolder()
  const updateFolder = useUpdateFolder()
  const deleteFolder = useDeleteFolder()
  const createPage = useCreatePage()
  const updatePage = useUpdatePage()
  const deletePage = useDeletePage()

  const [selected, setSelected] = useState<string | null>(null)
  const [openPageId, setOpenPageId] = useState<number | null>(null)
  const page = usePage(openPageId)
  const [dirty, setDirty] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const onError = (err: Error) => setMessage(err.message)
  const queryError = folders.error ?? allPages.error ?? page.error
  const snackbar = message || (queryError && queryError !== dismissedError ? queryError.message : '')

  const id = selected ? Number(selected.slice(2)) : null
  const selectedFolder = selected?.startsWith('f-') ? folderList.find((f) => f.id === id) : undefined
  const selectedPage = selected?.startsWith('p-') ? allPages.pages.find((p) => p.id === id) : undefined
  const selectedName = selectedFolder?.name ?? selectedPage?.title ?? ''
  // New items go into the selected folder, or the selected page's folder, else root.
  const targetFolder = selectedFolder?.id ?? selectedPage?.folder_id ?? null
  const folderOptions = useMemo(() => flatten(tree), [tree])

  const canLeavePage = () => !dirty || window.confirm('Discard unsaved changes?')

  function closeSnackbar() {
    setMessage('')
    setDismissedError(queryError)
  }

  function select(itemId: string | null) {
    if (itemId?.startsWith('p-')) {
      const pageId = Number(itemId.slice(2))
      if (pageId !== openPageId && !canLeavePage()) return
      setOpenPageId(pageId)
    }
    setSelected(itemId)
  }

  const expand = (folderId: number | null) =>
    folderId !== null && setExpanded((ids) => (ids.includes(`f-${folderId}`) ? ids : [...ids, `f-${folderId}`]))

  function submitDialog({ name, parentId }: { name: string; parentId: number | null }) {
    let req: Promise<unknown>
    if (dialog === 'folder') {
      req = createFolder.mutateAsync({ name, parent_id: parentId }).then((f) => setSelected(`f-${f.id}`))
    } else if (dialog === 'page') {
      req = createPage.mutateAsync({ title: name, folder_id: parentId }).then((p) => {
        setSelected(`p-${p.id}`)
        setOpenPageId(p.id)
      })
    } else if (dialog === 'rename') {
      req = updateFolder.mutateAsync({ id: id!, name })
    } else if (selectedFolder) {
      req = updateFolder.mutateAsync({ id: selectedFolder.id, parent_id: parentId })
    } else {
      req = updatePage.mutateAsync({ id: id!, folder_id: parentId })
    }
    return req.then(() => {
      if (dialog !== 'rename') expand(parentId)
      setDialog(null)
    }, onError)
  }

  // True if folder `folderId` is `ancestorId` or nested under it.
  function isUnder(folderId: number | null, ancestorId: number) {
    while (folderId !== null) {
      if (folderId === ancestorId) return true
      folderId = folderList.find((f) => f.id === folderId)?.parent_id ?? null
    }
    return false
  }

  function confirmDelete() {
    setDeleteOpen(false)
    if (selectedFolder) {
      const openFolder = allPages.pages.find((p) => p.id === openPageId)?.folder_id ?? null
      if (isUnder(openFolder, selectedFolder.id)) setOpenPageId(null)
      deleteFolder.mutate(selectedFolder.id, { onError })
    } else if (selectedPage) {
      if (selectedPage.id === openPageId) setOpenPageId(null)
      deletePage.mutate(selectedPage.id, { onError })
    }
    setSelected(null)
  }

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Notes
      </Typography>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Button size="small" onClick={() => setDialog('folder')}>New folder</Button>
            <Button size="small" onClick={() => canLeavePage() && setDialog('page')}>New page</Button>
            {/* Pages are renamed via the title field in the editor. */}
            <Button size="small" disabled={!selectedFolder} onClick={() => setDialog('rename')}>Rename</Button>
            <Button size="small" disabled={!selectedName} onClick={() => setDialog('move')}>Move</Button>
            <Button size="small" color="error" disabled={!selectedName} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </Stack>
          {folders.isSuccess && !tree.folders.length && !tree.pages.length && (
            <Typography color="text.secondary" sx={{ p: 1 }}>No notes yet.</Typography>
          )}
          <FolderTree tree={tree} selected={selected} onSelect={select} expanded={expanded} onExpandedChange={setExpanded} />
        </Paper>

        <Box sx={{ minWidth: 0 }}>
          {openPageId === null ? (
            <Typography color="text.secondary">Select or create a page.</Typography>
          ) : page.data?.id === openPageId ? (
            <PageEditor key={openPageId} page={page.data} onDirtyChange={setDirty} onError={onError} />
          ) : null}
        </Box>
      </Box>

      {dialog && (
        <NoteDialog
          title={{ folder: 'New folder', page: 'New page', rename: 'Rename folder', move: `Move "${selectedName}"` }[dialog]}
          initialName={dialog === 'move' ? undefined : dialog === 'rename' ? selectedName : ''}
          folders={dialog === 'rename' ? undefined : folderOptions}
          initialParent={dialog === 'move' ? (selectedFolder?.parent_id ?? selectedPage?.folder_id ?? null) : targetFolder}
          pending={createFolder.isPending || createPage.isPending || updateFolder.isPending || updatePage.isPending}
          onSubmit={submitDialog}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title={selectedFolder ? 'Delete folder?' : 'Delete page?'}
        message={
          selectedFolder
            ? `"${selectedName}" and all its subfolders and pages will be deleted.`
            : `"${selectedName}" will be deleted.`
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
      <Snackbar open={!!snackbar} message={snackbar} autoHideDuration={6000} onClose={closeSnackbar} />
    </>
  )
}

type EditorProps = { page: NotePage; onDirtyChange: (dirty: boolean) => void; onError: (err: Error) => void }

// Keyed by page id, so drafts reset when another page opens.
function PageEditor({ page, onDirtyChange, onError }: EditorProps) {
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content)
  // Last saved values; dirty = draft differs from them.
  const [saved, setSaved] = useState({ title: page.title, content: page.content })
  const updatePage = useUpdatePage()
  // isPending lands a render late; the ref blocks a same-tick double click.
  const busy = useRef(false)
  const trimmed = title.trim()
  const dirty = trimmed !== saved.title || content !== saved.content
  const titleError = !trimmed ? 'Title is required' : trimmed.length > MAX_TITLE ? `Max ${MAX_TITLE} characters` : ''
  const contentError = content.length > MAX_CONTENT ? 'Max 200,000 characters' : ''

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  function save() {
    if (titleError || contentError || busy.current) return
    busy.current = true
    const body = { title: trimmed, content }
    updatePage
      .mutateAsync({ id: page.id, ...body })
      .then(() => setSaved(body), onError)
      .finally(() => {
        busy.current = false
      })
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth
          error={!!titleError} helperText={titleError} />
        <Button variant="contained" onClick={save} disabled={!dirty || updatePage.isPending || !!titleError || !!contentError}
          sx={{ mt: 1 }}>
          Save
        </Button>
      </Stack>
      <Typography variant="body2" color={dirty ? 'warning.main' : 'text.secondary'}>
        {dirty ? 'Unsaved changes' : 'All changes saved'}
      </Typography>
      {contentError && <Typography color="error" variant="body2">{contentError}</Typography>}
      <MarkdownEditor label="Content" value={content} onChange={setContent} minRows={16} />
    </Stack>
  )
}
