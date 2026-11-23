import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Snackbar, Stack, TextField, Typography } from '@mui/material'
import { HeaderActions } from '../components/Card'
import { WIDE_QUERY } from '../hooks/useExpandFlip'
import { buildTree, type TreeLevel } from '../api/notes'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorBoundary from '../components/ErrorBoundary'
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

type Props = {
  /** Open (and reveal in the tree) this page on mount. */
  initialPageId?: number
  /** Called when the open page gains or loses unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void
}

export default function NotesPage({ initialPageId, onDirtyChange }: Props) {
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

  const [selected, setSelected] = useState<string | null>(initialPageId ? `p-${initialPageId}` : null)
  const [openPageId, setOpenPageId] = useState<number | null>(initialPageId ?? null)
  const page = usePage(openPageId)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
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

  // Expand the initial page's folder chain once the page shows up in the tree.
  const revealed = useRef(false)
  useEffect(() => {
    const initial = allPages.pages.find((p) => p.id === initialPageId)
    if (revealed.current || !initial) return
    revealed.current = true
    const ids: string[] = []
    for (let f = initial.folder_id; f !== null; f = folderList.find((x) => x.id === f)?.parent_id ?? null) ids.push(`f-${f}`)
    setExpanded((cur) => [...new Set([...cur, ...ids])])
  }, [allPages.pages, folderList, initialPageId])

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

  const openFolder = allPages.pages.find((p) => p.id === openPageId)?.folder_id ?? null
  const deletesOpenPage = selectedFolder ? isUnder(openFolder, selectedFolder.id) : selectedPage?.id === openPageId

  function confirmDelete() {
    setDeleteOpen(false)
    if (deletesOpenPage) setOpenPageId(null)
    if (selectedFolder) deleteFolder.mutate(selectedFolder.id, { onError })
    else if (selectedPage) deletePage.mutate(selectedPage, { onError })
    setSelected(null)
  }

  return (
    <>
      <HeaderActions>
        <Button size="small" onClick={() => setDialog('folder')}>
          New folder
        </Button>
        <Button size="small" variant="contained" onClick={() => canLeavePage() && setDialog('page')}>
          New page
        </Button>
      </HeaderActions>
      <Box
        sx={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          [`@media ${WIDE_QUERY}`]: { gridTemplateColumns: '280px minmax(0, 1fr)' },
          '& > *': { minHeight: 0, overflow: 'auto' },
        }}
      >
        <Box sx={{ borderRight: 1, borderColor: 'divider', p: 1 }}>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
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
          <ErrorBoundary message="Couldn't show the notes tree. Reload the page.">
            <FolderTree tree={tree} selected={selected} onSelect={select} expanded={expanded} onExpandedChange={setExpanded} />
          </ErrorBoundary>
        </Box>

        <Box sx={{ minWidth: 0, p: 3 }}>
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
          folders={
            dialog === 'rename'
              ? undefined
              : dialog === 'move' && selectedFolder
                ? // A folder can't move into itself or a descendant; the API 400 stays as backstop.
                  folderOptions.filter((o) => !isUnder(o.id, selectedFolder.id))
                : folderOptions
          }
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
          (selectedFolder
            ? `"${selectedName}" and all its subfolders and pages will be deleted.`
            : `"${selectedName}" will be deleted.`) +
          (deletesOpenPage && dirty ? ' Unsaved changes to the open page will be lost.' : '')
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
        <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth
          error={!!titleError} helperText={titleError} />
        <Button variant="contained" onClick={save} disabled={!dirty || updatePage.isPending || !!titleError || !!contentError}>
          Save
        </Button>
      </Stack>
      <Typography variant="body2" color={dirty ? 'text.primary' : 'text.secondary'}>
        {dirty ? 'Unsaved changes' : 'All changes saved'}
      </Typography>
      {contentError && <Typography color="error" variant="body2">{contentError}</Typography>}
      <MarkdownEditor label="Content" value={content} onChange={setContent} minRows={16} />
    </Stack>
  )
}
