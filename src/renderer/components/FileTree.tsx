import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { getNoteFreshness } from '../../core/freshness'
import {
  basenameRelative,
  dirnameRelative,
  isPathInsideOrEqual,
  withoutMarkdownExtension
} from '../../core/paths'
import { orderSearchResults, parseRendererSearchQuery, searchResultContextRanges, segmentJapaneseQuery, type SearchResultOrder } from '../../core/search'
import type { AdvancedSearchResult } from '../../core/advanced-search'
import type { VaultSnapshot } from '../../shared/types'

export interface TreeSelection {
  kind: 'note' | 'directory'
  path: string
}
export type FileTreeSortOrder = 'name-asc' | 'name-desc' | 'modified-asc' | 'modified-desc' | 'created-asc' | 'created-desc'

interface FileTreeProps {
  snapshot: VaultSnapshot
  selectedNotePath: string | null
  treeSelection: TreeSelection | null
  searchResults: AdvancedSearchResult[]
  searchPending?: boolean
  searchError?: string | null
  query: string
  selectionDisabled?: boolean
  sortOrder?: FileTreeSortOrder
  onSortOrderChange?: (order: FileTreeSortOrder) => void
  revealActiveNote?: boolean
  onRevealActiveNoteChange?: (enabled: boolean) => void
  revealDirectory?: string | null
  revealDirectoryRequest?: number
  onBookmarkDirectory?: (path: string) => void
  onOpenMatch?: (path: string, source: string, from: number, to: number) => void
  onSelectNote: (path: string) => void
  onSelectEntry: (selection: TreeSelection) => void
  onRename: (selection: TreeSelection) => void
  onMove: (path: string) => void
  onMoveEntries?: (paths: string[]) => void
  onDropEntries?: (paths: string[], destination: string) => void
  onDropEntry: (path: string, destinationDirectory: string) => void
  onInlineRename: (
    selection: TreeSelection,
    name: string
  ) => Promise<string | null>
  onTrash: (path: string) => void
  bookmarkedPaths: ReadonlySet<string>
  onOpenInNewTab: (path: string) => void
  onReveal: (path: string) => void
  onCopyPath: (path: string) => void
  onBookmark: (path: string) => void
  onCreateNote: (directory: string) => void
  onCreateDirectory: (directory: string, name: string) => Promise<string | null>
  createDirectoryParent?: string | null
  onCreateDirectoryRequestHandled?: () => void
}

interface FileTreeContextMenu {
  selection: TreeSelection
  x: number
  y: number
  trigger: HTMLElement
}

interface VisibleTreeItem {
  selection: TreeSelection
  depth: number
  label: string
}

const CONTEXT_MENU_WIDTH = 210
const CONTEXT_MENU_ITEM_HEIGHT = 36
const exactNoteDate = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric'
})
const compactNoteDate = new Intl.DateTimeFormat('ja-JP', {
  year: '2-digit', month: '2-digit', day: '2-digit'
})

function treeItemKey(selection: TreeSelection): string {
  return `${selection.kind}:${selection.path}`
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightSearchExcerpt(excerpt: string, query: string): ReactNode {
  if (!excerpt) return '本文は空です。'

  const uniqueTerms = new Map<string, string>()
  parseRendererSearchQuery(query)
    .filter((clause) => clause.kind === 'term' && !clause.negated && clause.value !== '-')
    .flatMap((clause) =>
      /\s/.test(clause.value) ? [clause.value] : segmentJapaneseQuery(clause.value)
    )
    .forEach((term) => {
      const normalizedTerm = term.toLocaleLowerCase()
      if (normalizedTerm && !uniqueTerms.has(normalizedTerm)) {
        uniqueTerms.set(normalizedTerm, term)
      }
    })

  const terms = [...uniqueTerms.values()].sort((left, right) => right.length - left.length)
  if (terms.length === 0) return excerpt

  const normalizedTerms = new Set(terms.map((term) => term.toLocaleLowerCase()))
  const pattern = new RegExp(`(${terms.map(escapeRegularExpression).join('|')})`, 'giu')
  return excerpt.split(pattern).map((part, index) =>
    normalizedTerms.has(part.toLocaleLowerCase()) ? (
      <mark className="search-match" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export default function FileTree({
  snapshot,
  selectedNotePath,
  treeSelection,
  searchResults,
  searchPending,
  searchError,
  query,
  selectionDisabled = false,
  sortOrder,
  onSortOrderChange,
  revealActiveNote,
  onRevealActiveNoteChange,
  revealDirectory = null,
  revealDirectoryRequest,
  onBookmarkDirectory,
  onOpenMatch,
  onSelectNote,
  onSelectEntry,
  onRename,
  onMove,
  onMoveEntries,
  onDropEntries,
  onDropEntry,
  onInlineRename,
  onTrash,
  bookmarkedPaths,
  onOpenInNewTab,
  onReveal,
  onCopyPath,
  onBookmark,
  onCreateNote,
  onCreateDirectory,
  createDirectoryParent = null,
  onCreateDirectoryRequestHandled
}: FileTreeProps): React.JSX.Element {
  const [searchOrder, setSearchOrder] = useState<SearchResultOrder>('relevance')
  const [showAllMatches, setShowAllMatches] = useState(false)
  const [showSearchContext, setShowSearchContext] = useState(false)
  const [contextLimits, setContextLimits] = useState<Record<string, number>>({})
  const [localSortOrder, setLocalSortOrder] = useState<FileTreeSortOrder>('name-asc')
  const [localRevealActiveNote, setLocalRevealActiveNote] = useState(false)
  const currentRevealActiveNote = revealActiveNote ?? localRevealActiveNote
  const currentSortOrder = sortOrder ?? localSortOrder
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [contextMenu, setContextMenu] = useState<FileTreeContextMenu | null>(null)
  const [selectedEntries, setSelectedEntries] = useState<string[] | null>(null)
  const selectionAnchor = useRef<string | null>(null)
  const draggedPaths = useRef<string[]>([])
  const canSelectMultiple = Boolean(onMoveEntries || onDropEntries)

  useEffect(() => {
    setSelectedEntries(current => {
      if (!current?.length) return current
      const paths = new Set([...snapshot.directories, ...snapshot.notes.map(note => note.path)])
      const next = current.filter(path => paths.has(path))
      return next.length === current.length ? current : next
    })
  }, [snapshot])
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [inlineRename, setInlineRename] = useState<{
    selection: TreeSelection
    value: string
    error: string | null
  } | null>(null)
  const [inlineCreateDirectory, setInlineCreateDirectory] = useState<{
    parent: string
    value: string
    error: string | null
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const treeItemRefs = useRef(new Map<string, HTMLButtonElement>())
  const typeaheadRef = useRef<{ value: string; resetTimer: number | null }>({
    value: '',
    resetTimer: null
  })
  const [treeFocusKey, setTreeFocusKey] = useState<string | null>(null)
  const inlineRenameSubmittingRef = useRef(false)
  const inlineCreateSubmittingRef = useRef(false)

  const searching = Boolean(query.trim())
  const folderToReveal = revealDirectory && snapshot.directories.includes(revealDirectory) ? revealDirectory : null
  const noteToReveal = currentRevealActiveNote && selectedNotePath && snapshot.notes.some(note => note.path === selectedNotePath) ? selectedNotePath : null

  useEffect(() => {
    if (searching || !folderToReveal) return
    setCollapsed(current => new Set([...current].filter(path => !isPathInsideOrEqual(folderToReveal, path))))
    const key = treeItemKey({ kind: 'directory', path: folderToReveal })
    setTreeFocusKey(key)
    const frame = requestAnimationFrame(() => {
      const row = treeItemRefs.current.get(key)
      row?.scrollIntoView?.({ block: 'nearest' })
      row?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [folderToReveal, revealDirectoryRequest, searching, snapshot.rootPath])

  useEffect(() => {
    if (searching || !noteToReveal) return
    setCollapsed(current => {
      const next = new Set([...current].filter(path => !isPathInsideOrEqual(noteToReveal, path)))
      return next.size === current.size ? current : next
    })
    const key = treeItemKey({ kind: 'note', path: noteToReveal })
    const frame = requestAnimationFrame(() => treeItemRefs.current.get(key)?.scrollIntoView?.({ block: 'nearest' }))
    return () => cancelAnimationFrame(frame)
  }, [noteToReveal, searching, snapshot.rootPath])

  useEffect(
    () => () => {
      if (typeaheadRef.current.resetTimer !== null) {
        window.clearTimeout(typeaheadRef.current.resetTimer)
      }
    },
    []
  )

  useEffect(() => {
    if (!contextMenu) {
      return
    }
    contextMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()

    const handlePointerDown = (event: PointerEvent): void => {
      if (!contextMenuRef.current?.contains(event.target as Node)) {
        setContextMenu(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setContextMenu(null)
        contextMenu.trigger.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  const openContextMenu = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    selection: TreeSelection
  ): void => {
    event.preventDefault()
    if (canSelectMultiple && !selectedEntries?.includes(selection.path)) {
      setSelectedEntries([selection.path])
      selectionAnchor.current = selection.path
    }
    onSelectEntry(selection)
    const trigger = event.currentTarget
    const bounds = trigger.getBoundingClientRect()
    const pointerEvent = event as React.MouseEvent<HTMLElement>
    const x = typeof pointerEvent.clientX === 'number' ? pointerEvent.clientX : bounds.left
    const y = typeof pointerEvent.clientY === 'number' ? pointerEvent.clientY : bounds.bottom
    const itemCount = selection.kind === 'directory' && onBookmarkDirectory ? 8 : 7
    setContextMenu({
      selection,
      x: Math.max(8, Math.min(x, window.innerWidth - CONTEXT_MENU_WIDTH - 8)),
      y: Math.max(
        8,
        Math.min(
          y,
          window.innerHeight - itemCount * CONTEXT_MENU_ITEM_HEIGHT - 18
        )
      ),
      trigger
    })
  }
  const getNoteAge = useMemo(() => {
    const now = new Date()
    const ages = new Map<string, {
      freshness: ReturnType<typeof getNoteFreshness>
      exact: string
      compact: string
      dateTime?: string
    }>()
    return (note: VaultSnapshot['notes'][number]) => {
      const cached = ages.get(note.path)
      if (cached) return cached
      const date = new Date(note.modifiedAt)
      const hasDate = note.modifiedAt > 0 && Number.isFinite(date.getTime())
      const age = {
        freshness: getNoteFreshness(note, now),
        exact: hasDate ? exactNoteDate.format(date) : '不明',
        compact: hasDate ? compactNoteDate.format(date) : '—',
        dateTime: hasDate ? date.toISOString() : undefined
      }
      ages.set(note.path, age)
      return age
    }
  }, [snapshot.notes])

  const notesByPath = useMemo(() => new Map(snapshot.notes.map(note => [note.path, note])), [snapshot.notes])

  const contextsByPath = useMemo(() => {
    if (!showAllMatches) return new Map<string, ReturnType<typeof searchResultContextRanges>>()
    return new Map(searchResults.flatMap(result => {
      const note = notesByPath.get(result.path)
      return note?.content ? [[result.path, searchResultContextRanges(note, query, showSearchContext ? 1 : 0, result.sourceMatches ?? (result.sourceMatch ? [result.sourceMatch] : undefined))] as const] : []
    }))
  }, [notesByPath, query, searchResults, showAllMatches, showSearchContext])

  const notesByDirectory = useMemo(() => {
    const result = new Map<string, typeof snapshot.notes>()
    for (const note of snapshot.notes) {
      const directory = dirnameRelative(note.path)
      const list = result.get(directory) ?? []
      list.push(note)
      result.set(directory, list)
    }
    const descending = currentSortOrder.endsWith('desc')
    const field = currentSortOrder.startsWith('created') ? 'createdAt' : currentSortOrder.startsWith('modified') ? 'modifiedAt' : null
    for (const list of result.values()) list.sort((left, right) => {
      if (field) {
        const a = field === 'createdAt' ? left.createdAt : left.modifiedAt
        const b = field === 'createdAt' ? right.createdAt : right.modifiedAt
        const aValid = typeof a === 'number' && Number.isFinite(a)
        const bValid = typeof b === 'number' && Number.isFinite(b)
        if (aValid !== bValid) return aValid ? -1 : 1
        if (aValid && bValid && a !== b) return (a < b ? -1 : 1) * (descending ? -1 : 1)
      } else {
        const byName = left.name.localeCompare(right.name, 'ja') * (descending ? -1 : 1)
        if (byName) return byName
      }
      return left.path.localeCompare(right.path, 'ja')
    })
    return result
  }, [snapshot.notes, currentSortOrder])

  const directoriesByParent = useMemo(() => {
    const result = new Map<string, string[]>()
    for (const directory of snapshot.directories) {
      if (!directory) {
        continue
      }
      const parent = dirnameRelative(directory)
      const list = result.get(parent) ?? []
      list.push(directory)
      result.set(parent, list)
    }
    for (const list of result.values()) {
      list.sort((left, right) => left.localeCompare(right, 'ja'))
    }
    return result
  }, [snapshot.directories])

  const visibleTreeItems = useMemo(() => {
    const items: VisibleTreeItem[] = []
    const appendDirectory = (directory: string, depth: number): void => {
      for (const child of directoriesByParent.get(directory) ?? []) {
        items.push({
          selection: { kind: 'directory', path: child },
          depth,
          label: basenameRelative(child)
        })
        if (!collapsed.has(child)) {
          appendDirectory(child, depth + 1)
        }
      }
      for (const note of notesByDirectory.get(directory) ?? []) {
        items.push({
          selection: { kind: 'note', path: note.path },
          depth,
          label: note.name
        })
      }
    }
    appendDirectory('', 0)
    return items
  }, [collapsed, directoriesByParent, notesByDirectory])

  const selectedTreeFocusKey = treeSelection ? treeItemKey(treeSelection) : null
  const activeNoteFocusKey = selectedNotePath
    ? treeItemKey({ kind: 'note', path: selectedNotePath })
    : null
  const fallbackTreeFocusKey = [selectedTreeFocusKey, activeNoteFocusKey].find((key) =>
    visibleTreeItems.some((item) => treeItemKey(item.selection) === key)
  ) ?? (visibleTreeItems[0] ? treeItemKey(visibleTreeItems[0].selection) : null)
  const rovingTreeFocusKey = visibleTreeItems.some(
    (item) => treeItemKey(item.selection) === treeFocusKey
  )
    ? treeFocusKey
    : fallbackTreeFocusKey

  const toggleDirectory = (path: string): void => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const selectTreeEntries = (selection: TreeSelection, modifiers: {
    shiftKey: boolean
    ctrlKey: boolean
    metaKey: boolean
  }): boolean => {
    if (selectionDisabled) return true
    onSelectEntry(selection)
    if (!canSelectMultiple) return false
    const path = selection.path
    const toggle = modifiers.ctrlKey || modifiers.metaKey
    if (modifiers.shiftKey) {
      const anchor = selectionAnchor.current ?? treeFocusKey
      const from = visibleTreeItems.findIndex(item => item.selection.path === anchor || treeItemKey(item.selection) === anchor)
      const to = visibleTreeItems.findIndex(item => item.selection.path === path)
      if (from >= 0 && to >= 0) {
        selectionAnchor.current = visibleTreeItems[from].selection.path
        setSelectedEntries(visibleTreeItems.slice(Math.min(from, to), Math.max(from, to) + 1).map(item => item.selection.path))
        return true
      }
    }
    selectionAnchor.current = path
    setSelectedEntries(current => {
      if (!toggle) return [path]
      return current?.includes(path) ? current.filter(item => item !== path) : [...(current ?? []), path]
    })
    return toggle || modifiers.shiftKey
  }

  const focusTreeItem = (selection: TreeSelection, modifiers?: React.KeyboardEvent): void => {
    const key = treeItemKey(selection)
    setTreeFocusKey(key)
    if (modifiers?.shiftKey && canSelectMultiple) selectTreeEntries(selection, modifiers)
    else {
      if (canSelectMultiple) {
        selectionAnchor.current = selection.path
        setSelectedEntries([selection.path])
      }
      onSelectEntry(selection)
    }
    treeItemRefs.current.get(key)?.focus()
  }

  const handleTreeItemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    item: VisibleTreeItem
  ): void => {
    if (selectionDisabled) return
    const itemIndex = visibleTreeItems.findIndex(
      (candidate) => treeItemKey(candidate.selection) === treeItemKey(item.selection)
    )
    const focusAt = (index: number): void => {
      const target = visibleTreeItems[index]
      if (target) {
        focusTreeItem(target.selection, event)
      }
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusAt(Math.min(itemIndex + 1, visibleTreeItems.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusAt(Math.max(itemIndex - 1, 0))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusAt(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusAt(visibleTreeItems.length - 1)
      return
    }
    if (event.key === 'ArrowRight' && item.selection.kind === 'directory') {
      event.preventDefault()
      if (collapsed.has(item.selection.path)) {
        setTreeFocusKey(treeItemKey(item.selection))
        onSelectEntry(item.selection)
        toggleDirectory(item.selection.path)
        return
      }
      const child = visibleTreeItems[itemIndex + 1]
      if (child && dirnameRelative(child.selection.path) === item.selection.path) {
        focusTreeItem(child.selection)
      }
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (item.selection.kind === 'directory' && !collapsed.has(item.selection.path)) {
        setTreeFocusKey(treeItemKey(item.selection))
        onSelectEntry(item.selection)
        toggleDirectory(item.selection.path)
        return
      }
      const parent = dirnameRelative(item.selection.path)
      if (parent) {
        focusTreeItem({ kind: 'directory', path: parent })
      }
      return
    }
    if (event.key === 'Enter' || (event.key === ' ' && canSelectMultiple)) {
      event.preventDefault()
      setTreeFocusKey(treeItemKey(item.selection))
      if (selectTreeEntries(item.selection, event)) return
      if (item.selection.kind === 'directory') toggleDirectory(item.selection.path)
      else onSelectNote(item.selection.path)
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      startInlineRename(item.selection)
      return
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      openContextMenu(event, item.selection)
      return
    }
    if (
      event.key.length !== 1 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing ||
      event.key === 'Process'
    ) {
      return
    }

    event.preventDefault()
    if (typeaheadRef.current.resetTimer !== null) {
      window.clearTimeout(typeaheadRef.current.resetTimer)
    }
    typeaheadRef.current.value += event.key
    typeaheadRef.current.resetTimer = window.setTimeout(() => {
      typeaheadRef.current.value = ''
      typeaheadRef.current.resetTimer = null
    }, 700)
    const prefix = typeaheadRef.current.value.toLocaleLowerCase()
    const candidates = [
      ...visibleTreeItems.slice(itemIndex + 1),
      ...visibleTreeItems.slice(0, itemIndex + 1)
    ]
    const match = candidates.find((candidate) =>
      candidate.label.toLocaleLowerCase().startsWith(prefix)
    )
    if (match) {
      focusTreeItem(match.selection)
    }
  }

  const startInlineRename = (selection: TreeSelection): void => {
    setInlineRename({
      selection,
      value:
        selection.kind === 'note'
          ? withoutMarkdownExtension(basenameRelative(selection.path))
          : basenameRelative(selection.path),
      error: null
    })
  }

  const submitInlineRename = async (): Promise<void> => {
    if (!inlineRename || inlineRenameSubmittingRef.current) {
      return
    }
    const currentName =
      inlineRename.selection.kind === 'note'
        ? withoutMarkdownExtension(basenameRelative(inlineRename.selection.path))
        : basenameRelative(inlineRename.selection.path)
    const nextName = inlineRename.value.trim()
    if (!nextName) {
      setInlineRename((current) =>
        current ? { ...current, error: '新しい名前を入力してください。' } : null
      )
      return
    }
    if (nextName === currentName) {
      setInlineRename(null)
      return
    }
    inlineRenameSubmittingRef.current = true
    try {
      const error = await onInlineRename(inlineRename.selection, nextName)
      if (error) {
        setInlineRename((current) => (current ? { ...current, error } : null))
      } else {
        setInlineRename(null)
      }
    } finally {
      inlineRenameSubmittingRef.current = false
    }
  }

  const startInlineCreateDirectory = (parent: string): void => {
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(parent)
      return next
    })
    setInlineCreateDirectory({ parent, value: '新しいフォルダ', error: null })
  }

  useEffect(() => {
    if (createDirectoryParent === null) {
      return
    }
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(createDirectoryParent)
      return next
    })
    setInlineCreateDirectory({
      parent: createDirectoryParent,
      value: '新しいフォルダ',
      error: null
    })
    onCreateDirectoryRequestHandled?.()
  }, [createDirectoryParent, onCreateDirectoryRequestHandled])

  const submitInlineCreateDirectory = async (): Promise<void> => {
    if (!inlineCreateDirectory || inlineCreateSubmittingRef.current) {
      return
    }
    const name = inlineCreateDirectory.value.trim()
    if (!name) {
      setInlineCreateDirectory((current) =>
        current ? { ...current, error: 'フォルダー名を入力してください。' } : null
      )
      return
    }
    inlineCreateSubmittingRef.current = true
    try {
      const error = await onCreateDirectory(inlineCreateDirectory.parent, name)
      if (error) {
        setInlineCreateDirectory((current) =>
          current ? { ...current, error } : null
        )
      } else {
        setInlineCreateDirectory(null)
      }
    } finally {
      inlineCreateSubmittingRef.current = false
    }
  }

  const inlineCreateDirectoryInput = (parent: string, depth: number): React.ReactNode =>
    inlineCreateDirectory?.parent === parent ? (
      <div
        className="tree-row tree-folder"
        style={{ paddingInlineStart: `${12 + depth * 16}px` }}
      >
        <span aria-hidden="true">▸</span>
        <input
          autoFocus
          className="tree-inline-rename"
          aria-label={`${parent ? basenameRelative(parent) : 'Vault'}に作るフォルダー名`}
          aria-invalid={Boolean(inlineCreateDirectory.error)}
          title={inlineCreateDirectory.error ?? undefined}
          value={inlineCreateDirectory.value}
          onChange={(event) =>
            setInlineCreateDirectory((current) =>
              current ? { ...current, value: event.target.value, error: null } : null
            )
          }
          onBlur={() => void submitInlineCreateDirectory()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void submitInlineCreateDirectory()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setInlineCreateDirectory(null)
            }
          }}
        />
      </div>
    ) : null

  const startEntryDrag = (event: React.DragEvent, selection: TreeSelection): void => {
    const paths = onDropEntries && selectedEntries?.includes(selection.path) ? selectedEntries : [selection.path]
    draggedPaths.current = paths
    event.dataTransfer.effectAllowed = selection.kind === 'note' ? 'copyMove' : 'move'
    event.dataTransfer.setData('text/plain', paths.join('\n'))
    if (paths.length === 1 && selection.kind === 'note') {
      event.dataTransfer.setData('application/x-tsuzune-vault-file', selection.path)
    }
  }

  const endEntryDrag = (): void => {
    draggedPaths.current = []
    setDropTarget(null)
  }

  const canDropInto = (destination: string): boolean => {
    const paths = draggedPaths.current
    return paths.some(path => dirnameRelative(path) !== destination) &&
      paths.every(path => !snapshot.directories.includes(path) || !isPathInsideOrEqual(destination, path))
  }

  const dropInto = (event: React.DragEvent, destination: string): void => {
    event.preventDefault()
    event.stopPropagation()
    if (canDropInto(destination)) {
      const paths = draggedPaths.current
      if (paths.length > 1 && onDropEntries) onDropEntries(paths, destination)
      else onDropEntry(paths[0], destination)
    }
    endEntryDrag()
  }

  const inlineRenameInput = (selection: TreeSelection): React.ReactNode => {
    if (inlineRename?.selection.path !== selection.path) {
      return null
    }
    const currentName =
      selection.kind === 'note'
        ? withoutMarkdownExtension(basenameRelative(selection.path))
        : basenameRelative(selection.path)
    return (
      <input
        autoFocus
        className="tree-inline-rename"
        aria-label={`${currentName}の名前`}
        aria-invalid={Boolean(inlineRename.error)}
        title={inlineRename.error ?? undefined}
        value={inlineRename.value}
        onChange={(event) =>
          setInlineRename((current) =>
            current ? { ...current, value: event.target.value, error: null } : null
          )
        }
        onBlur={() => void submitInlineRename()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void submitInlineRename()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setInlineRename(null)
          }
        }}
      />
    )
  }

  const renderDirectory = (directory: string, depth: number): React.ReactNode => {
    const childDirectories = directoriesByParent.get(directory) ?? []
    const childNotes = notesByDirectory.get(directory) ?? []

    return (
      <>
        {inlineCreateDirectoryInput(directory, depth)}
        {childDirectories.map((child) => {
          const isCollapsed = collapsed.has(child)
          const isSelected =
            selectedEntries?.includes(child) ?? (treeSelection?.kind === 'directory' && treeSelection.path === child)
          const selection = { kind: 'directory', path: child } as const
          const item: VisibleTreeItem = {
            selection,
            depth,
            label: basenameRelative(child)
          }
          return (
            <div key={`directory:${child}`}>
              {inlineRename?.selection.path === child ? (
                <div
                  className="tree-row tree-folder"
                  style={{ paddingInlineStart: `${12 + depth * 16}px` }}
                >
                  <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                  {inlineRenameInput({ kind: 'directory', path: child })}
                </div>
              ) : (
                <button
                  type="button"
                  role="treeitem"
                  draggable
                  className={`tree-row tree-folder ${isSelected ? 'is-selected' : ''} ${dropTarget === child ? 'is-drop-target' : ''}`}
                  style={{ paddingInlineStart: `${12 + depth * 16}px` }}
                  onClick={(event) => {
                    event.currentTarget.focus()
                    if (!selectTreeEntries(selection, event)) toggleDirectory(child)
                  }}
                  onDoubleClick={() =>
                    startInlineRename({ kind: 'directory', path: child })
                  }
                  onFocus={() => setTreeFocusKey(treeItemKey(selection))}
                  onKeyDown={(event) => handleTreeItemKeyDown(event, item)}
                  onDragStart={(event) => startEntryDrag(event, selection)}
                  onDragOver={(event) => {
                    event.stopPropagation()
                    if (canDropInto(child)) {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDropTarget(child)
                    }
                  }}
                  onDragLeave={(event) => {
                    event.stopPropagation()
                    setDropTarget(null)
                  }}
                  onDrop={(event) => dropInto(event, child)}
                  onDragEnd={endEntryDrag}
                  onContextMenu={(event) =>
                    openContextMenu(event, selection)
                  }
                  ref={(element) => {
                    const key = treeItemKey(selection)
                    if (element) {
                      treeItemRefs.current.set(key, element)
                    } else {
                      treeItemRefs.current.delete(key)
                    }
                  }}
                  tabIndex={treeItemKey(selection) === rovingTreeFocusKey ? 0 : -1}
                  aria-label={child}
                  aria-level={depth + 1}
                  aria-selected={isSelected}
                  aria-expanded={!isCollapsed}
                >
                  <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                  <span>{basenameRelative(child)}</span>
                </button>
              )}
              {!isCollapsed && renderDirectory(child, depth + 1)}
            </div>
          )
        })}
        {childNotes.map((note) => {
          const isSelected = selectedNotePath === note.path
          const isTreeSelected =
            selectedEntries?.includes(note.path) ?? (isSelected || (treeSelection?.kind === 'note' && treeSelection.path === note.path))
          const age = getNoteAge(note)
          const selection = { kind: 'note', path: note.path } as const
          if (inlineRename?.selection.path === note.path) {
            return (
              <div
                key={note.path}
                className="tree-row tree-note"
                style={{ paddingInlineStart: `${31 + depth * 16}px` }}
              >
                <span aria-hidden="true">◇</span>
                {inlineRenameInput(selection)}
              </div>
            )
          }
          return (
            <button
              type="button"
              role="treeitem"
              draggable
              key={note.path}
              data-note-preview-path={note.path}
              className={`tree-row tree-note ${
                isTreeSelected ? 'is-selected' : ''
              }`}
              style={{ paddingInlineStart: `${31 + depth * 16}px` }}
              onClick={(event) => {
                event.currentTarget.focus()
                setTreeFocusKey(treeItemKey(selection))
                if (!selectTreeEntries(selection, event)) onSelectNote(note.path)
              }}
              onDoubleClick={() => startInlineRename(selection)}
              onFocus={() => setTreeFocusKey(treeItemKey(selection))}
              onKeyDown={(event) =>
                handleTreeItemKeyDown(event, {
                  selection,
                  depth,
                  label: note.name
                })
              }
              onDragStart={(event) => startEntryDrag(event, selection)}
              onDragEnd={endEntryDrag}
              onContextMenu={(event) =>
                openContextMenu(event, selection)
              }
              ref={(element) => {
                const key = treeItemKey(selection)
                if (element) {
                  treeItemRefs.current.set(key, element)
                } else {
                  treeItemRefs.current.delete(key)
                }
              }}
              tabIndex={treeItemKey(selection) === rovingTreeFocusKey ? 0 : -1}
              aria-label={note.path}
              aria-level={depth + 1}
              aria-selected={isTreeSelected}
              aria-current={isSelected ? 'page' : undefined}
              title={`${note.path}\n最終更新: ${age.exact}\n${age.freshness.statusLabel}（${age.freshness.relativeLabel}）`}
            >
              <span aria-hidden="true">◇</span>
              <span className="tree-label">{note.name}</span>
              <time
                className={`tree-updated freshness-${age.freshness.level}`}
                dateTime={age.dateTime}
                aria-label={`${note.name}の最終更新: ${age.exact}。${age.freshness.statusLabel}、${age.freshness.relativeLabel}`}
              >
                {age.compact}
              </time>
            </button>
          )
        })}
      </>
    )
  }

  const contextMenuElement = contextMenu ? (
    <div
      ref={contextMenuRef}
      className="file-tree-context-menu"
      role="menu"
      aria-label={`${contextMenu.selection.path}の操作`}
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {contextMenu.selection.kind === 'note' ? (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setContextMenu(null)
              onOpenInNewTab(contextMenu.selection.path)
            }}
          >
            新しいタブで開く
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setContextMenu(null)
              onBookmark(contextMenu.selection.path)
            }}
          >
            {bookmarkedPaths.has(contextMenu.selection.path)
              ? 'ブックマークを編集'
              : 'ブックマークへ追加'}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setContextMenu(null)
              onCreateNote(contextMenu.selection.path)
            }}
          >
            ここに新規ノート
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setContextMenu(null)
              startInlineCreateDirectory(contextMenu.selection.path)
            }}
          >
            ここに新規フォルダー
          </button>
          {onBookmarkDirectory && <button type="button" role="menuitem" onClick={() => {
            contextMenu.trigger.focus()
            setContextMenu(null)
            onBookmarkDirectory(contextMenu.selection.path)
          }}>
            {bookmarkedPaths.has(contextMenu.selection.path) ? 'ブックマークを編集' : 'ブックマークへ追加'}
          </button>}
        </>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setContextMenu(null)
          onReveal(contextMenu.selection.path)
        }}
      >
        フォルダーで表示
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setContextMenu(null)
          onCopyPath(contextMenu.selection.path)
        }}
      >
        Vault相対パスをコピー
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setContextMenu(null)
          onRename(contextMenu.selection)
        }}
      >
        名前変更
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setContextMenu(null)
          onMove(contextMenu.selection.path)
        }}
      >
        移動
      </button>
      <button
        type="button"
        role="menuitem"
        className="is-danger"
        onClick={() => {
          setContextMenu(null)
          onTrash(contextMenu.selection.path)
        }}
      >
        ごみ箱へ移動
      </button>
    </div>
  ) : null

  if (query.trim()) {
    const searchGroups = [
      { key: 'knowledge', label: '知識', matches: (path: string) => path.startsWith('30_知識/') },
      {
        key: 'sources',
        label: '情報源',
        matches: (path: string) => path.startsWith('40_情報源/')
      },
      {
        key: 'inbox',
        label: '受信箱',
        matches: (path: string) => path.startsWith('01_受信箱/')
      },
      {
        key: 'other',
        label: 'その他',
        matches: (path: string) =>
          !path.startsWith('30_知識/') &&
          !path.startsWith('40_情報源/') &&
          !path.startsWith('01_受信箱/')
      }
    ]
    const groupedSearchResults = searchOrder === 'relevance'
      ? searchGroups
          .map((group) => ({ ...group, results: searchResults.filter((result) => group.matches(result.path)) }))
          .filter((group) => group.results.length > 0)
      : [{ key: 'all', label: 'すべての検索結果', results: orderSearchResults(searchResults, searchOrder) }]

    return (
      <>
        <div className="search-results" aria-label="検索結果">
          <div className="search-result-options">
            <label>並び順
              <select aria-label="検索結果の並び順" value={searchOrder} onChange={event => {
                const order = event.target.value as SearchResultOrder
                setSearchOrder(order)
              }}>
                <option value="relevance">関連度順</option>
                <option value="name-asc">名前（昇順）</option>
                <option value="name-desc">名前（降順）</option>
                <option value="modified-desc">更新日（新しい順）</option>
                <option value="modified-asc">更新日（古い順）</option>
              </select>
            </label>
            <label><input type="checkbox" checked={showAllMatches} onChange={event => setShowAllMatches(event.target.checked)} />一致箇所を表示</label>
            {showAllMatches && <label><input type="checkbox" checked={showSearchContext} onChange={event => setShowSearchContext(event.target.checked)} />前後の行も表示</label>}
          </div>
          <header className="search-results-summary">
            {searchError ? <span role="alert">{searchError}</span> : <span role="status">
              {searchPending ? '検索中…' : <>
                <span>検索結果</span>{' '}
                <strong>{searchResults.length}件</strong>
              </>}
            </span>}
          </header>
          {searchError || searchPending ? null : searchResults.length === 0 ? (
            <div className="sidebar-empty">
              「{query}」は見つかりませんでした。
            </div>
          ) : (
            groupedSearchResults.map((group) => (
              <section className="search-result-group" key={group.key} aria-label={group.label}>
                {searchOrder === 'relevance' && <h2 className="search-result-group-heading">{group.label}</h2>}
                {group.results.map((result) => {
                  const note = notesByPath.get(result.path)
                  const age = note ? getNoteAge(note) : undefined
                  const allContexts = contextsByPath.get(result.path) ?? []
                  const contextLimit = contextLimits[result.path] ?? 20
                  const contexts = allContexts.slice(0, contextLimit)
                  return (
                    <div key={result.path}>
                    <button
                      type="button"
                      className="search-result"
                      data-note-preview-path={note?.path}
                      onClick={() => onSelectNote(result.path)}
                      onContextMenu={(event) =>
                        openContextMenu(event, { kind: 'note', path: result.path })
                      }
                    >
                      <strong>{result.name}</strong>
                      {result.category || result.topics?.length ? (
                        <span className="search-result-metadata">
                          {result.category ? (
                            <small className="search-result-category">{result.category}</small>
                          ) : null}
                          {result.topics?.map((topic) => (
                            <small className="search-result-topic" key={topic}>{topic}</small>
                          ))}
                        </span>
                      ) : null}
                      <small className="search-result-excerpt">
                        {result.sourceMatch ? result.excerpt : highlightSearchExcerpt(result.excerpt, query)}
                      </small>
                      <span className="search-result-path">{result.path}</span>
                      {age ? (
                        <small className={`search-result-freshness freshness-${age.freshness.level}`}>
                          最終更新: {age.exact} · {age.freshness.statusLabel}
                        </small>
                      ) : null}
                    </button>
                    {contexts.map(context => <div className="search-result-context" key={context.matchStart}>
                      <pre>{context.text}</pre>
                      {onOpenMatch && note && <button type="button" onClick={() =>
                        onOpenMatch(result.path, note.content, context.matchStart, context.matchEnd)
                      }>この一致へ移動</button>}
                    </div>)}
                    {allContexts.length > contexts.length && <button type="button" onClick={() => setContextLimits(current => ({ ...current, [result.path]: contextLimit + 20 }))}>さらに20件の一致を表示</button>}
                    </div>
                  )
                })}
              </section>
            ))
          )}
        </div>
        {contextMenuElement}
      </>
    )
  }

  return (
    <div className="file-tree-shell">
      <div className="file-tree-options">
        <label>
          並び順
          <select aria-label="ファイルツリーの並び順" value={currentSortOrder} onChange={event => {
            const order = event.target.value as FileTreeSortOrder
            if (onSortOrderChange) onSortOrderChange(order)
            else setLocalSortOrder(order)
          }}>
            <option value="name-asc">名前（昇順）</option>
            <option value="name-desc">名前（降順）</option>
            <option value="modified-desc">更新日（新しい順）</option>
            <option value="modified-asc">更新日（古い順）</option>
            <option value="created-desc">作成日（新しい順）</option>
            <option value="created-asc">作成日（古い順）</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={currentRevealActiveNote} onChange={event => {
            const enabled = event.target.checked
            if (onRevealActiveNoteChange) onRevealActiveNoteChange(enabled)
            else setLocalRevealActiveNote(enabled)
          }} />
          アクティブノートを追従
        </label>
      </div>
      {selectedEntries && selectedEntries.length > 1 && onMoveEntries && (
        <div className="file-tree-options">
          <span>{selectedEntries.length}件を選択（Ctrl・Shiftで追加）</span>
          <button type="button" aria-label={`選択した${selectedEntries.length}件を移動`} onClick={() => onMoveEntries(selectedEntries)}>まとめて移動</button>
          <button type="button" onClick={() => { setSelectedEntries(null); selectionAnchor.current = null }}>選択を解除</button>
        </div>
      )}
      <div
        className={`file-tree ${dropTarget === '' ? 'is-drop-target' : ''}`}
        role="tree"
        aria-label="Vaultファイル"
        aria-multiselectable={canSelectMultiple || undefined}
        onDragOver={(event) => {
          if (canDropInto('')) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTarget('')
          }
        }}
        onDrop={(event) => dropInto(event, '')}
      >
        {snapshot.directories.length === 1 &&
        snapshot.notes.length === 0 &&
        (snapshot.attachments?.length ?? 0) === 0 &&
        !inlineCreateDirectory ? (
          <div className="sidebar-empty">まだノートがありません。</div>
        ) : (
          renderDirectory('', 0)
        )}
      </div>
      {contextMenuElement}
    </div>
  )
}
