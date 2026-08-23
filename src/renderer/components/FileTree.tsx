import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { getNoteFreshness } from '../../core/freshness'
import {
  basenameRelative,
  dirnameRelative,
  isPathInsideOrEqual,
  withoutMarkdownExtension
} from '../../core/paths'
import { parseRendererSearchQuery, segmentJapaneseQuery } from '../../core/search'
import type { SearchResult, VaultSnapshot } from '../../shared/types'

export interface TreeSelection {
  kind: 'note' | 'directory'
  path: string
}
interface FileTreeProps {
  snapshot: VaultSnapshot
  selectedNotePath: string | null
  treeSelection: TreeSelection | null
  searchResults: SearchResult[]
  query: string
  onSelectNote: (path: string) => void
  onSelectEntry: (selection: TreeSelection) => void
  onRename: (selection: TreeSelection) => void
  onMove: (path: string) => void
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
  query,
  onSelectNote,
  onSelectEntry,
  onRename,
  onMove,
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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [contextMenu, setContextMenu] = useState<FileTreeContextMenu | null>(null)
  const [draggedEntry, setDraggedEntry] = useState<TreeSelection | null>(null)
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
    onSelectEntry(selection)
    const trigger = event.currentTarget
    const bounds = trigger.getBoundingClientRect()
    const pointerEvent = event as React.MouseEvent<HTMLElement>
    const x = typeof pointerEvent.clientX === 'number' ? pointerEvent.clientX : bounds.left
    const y = typeof pointerEvent.clientY === 'number' ? pointerEvent.clientY : bounds.bottom
    const itemCount = 7
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
  const noteAges = useMemo(() => {
    const now = new Date()
    return new Map(
      snapshot.notes.map((note) => {
        const freshness = getNoteFreshness(note, now)
        const exact = note.modifiedAt
          ? new Date(note.modifiedAt).toLocaleString('ja-JP')
          : '不明'
        const compact = note.modifiedAt
          ? new Date(note.modifiedAt).toLocaleDateString('ja-JP', {
              year: '2-digit',
              month: '2-digit',
              day: '2-digit'
            })
          : '—'
        return [note.path, { freshness, exact, compact }] as const
      })
    )
  }, [snapshot.notes])

  const notesByDirectory = useMemo(() => {
    const result = new Map<string, typeof snapshot.notes>()
    for (const note of snapshot.notes) {
      const directory = dirnameRelative(note.path)
      const list = result.get(directory) ?? []
      list.push(note)
      result.set(directory, list)
    }
    return result
  }, [snapshot.notes])

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
    onSelectEntry({ kind: 'directory', path })
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

  const focusTreeItem = (selection: TreeSelection): void => {
    const key = treeItemKey(selection)
    setTreeFocusKey(key)
    onSelectEntry(selection)
    treeItemRefs.current.get(key)?.focus()
  }

  const handleTreeItemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    item: VisibleTreeItem
  ): void => {
    const itemIndex = visibleTreeItems.findIndex(
      (candidate) => treeItemKey(candidate.selection) === treeItemKey(item.selection)
    )
    const focusAt = (index: number): void => {
      const target = visibleTreeItems[index]
      if (target) {
        focusTreeItem(target.selection)
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
        toggleDirectory(item.selection.path)
        return
      }
      const parent = dirnameRelative(item.selection.path)
      if (parent) {
        focusTreeItem({ kind: 'directory', path: parent })
      }
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      setTreeFocusKey(treeItemKey(item.selection))
      if (item.selection.kind === 'directory') {
        toggleDirectory(item.selection.path)
      } else {
        onSelectEntry(item.selection)
        onSelectNote(item.selection.path)
      }
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

  const canDropInto = (destination: string): boolean =>
    Boolean(
      draggedEntry &&
        dirnameRelative(draggedEntry.path) !== destination &&
        !(
          draggedEntry.kind === 'directory' &&
          isPathInsideOrEqual(destination, draggedEntry.path)
        )
    )

  const dropInto = (event: React.DragEvent, destination: string): void => {
    event.preventDefault()
    event.stopPropagation()
    if (draggedEntry && canDropInto(destination)) {
      onDropEntry(draggedEntry.path, destination)
    }
    setDraggedEntry(null)
    setDropTarget(null)
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
            treeSelection?.kind === 'directory' && treeSelection.path === child
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
                    toggleDirectory(child)
                  }}
                  onDoubleClick={() =>
                    startInlineRename({ kind: 'directory', path: child })
                  }
                  onFocus={() => setTreeFocusKey(treeItemKey(selection))}
                  onKeyDown={(event) => handleTreeItemKeyDown(event, item)}
                  onDragStart={(event) => {
                    const selection = { kind: 'directory', path: child } as const
                    setDraggedEntry(selection)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', child)
                  }}
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
                  onDragEnd={() => {
                    setDraggedEntry(null)
                    setDropTarget(null)
                  }}
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
            treeSelection?.kind === 'note' && treeSelection.path === note.path
          const age = noteAges.get(note.path)
          if (!age) {
            return null
          }
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
              className={`tree-row tree-note ${
                isSelected || isTreeSelected ? 'is-selected' : ''
              }`}
              style={{ paddingInlineStart: `${31 + depth * 16}px` }}
              onClick={(event) => {
                event.currentTarget.focus()
                setTreeFocusKey(treeItemKey(selection))
                onSelectEntry(selection)
                onSelectNote(note.path)
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
              onDragStart={(event) => {
                setDraggedEntry(selection)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', note.path)
              }}
              onDragEnd={() => {
                setDraggedEntry(null)
                setDropTarget(null)
              }}
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
              aria-selected={isSelected || isTreeSelected}
              aria-current={isSelected ? 'page' : undefined}
              title={`${note.path}\n最終更新: ${age.exact}\n${age.freshness.statusLabel}（${age.freshness.relativeLabel}）`}
            >
              <span aria-hidden="true">◇</span>
              <span className="tree-label">{note.name}</span>
              <time
                className={`tree-updated freshness-${age.freshness.level}`}
                dateTime={
                  note.modifiedAt ? new Date(note.modifiedAt).toISOString() : undefined
                }
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
    return (
      <>
        <div className="search-results" aria-label="検索結果">
          {searchResults.length === 0 ? (
            <div className="sidebar-empty">
              「{query}」は見つかりませんでした。
            </div>
          ) : (
            searchResults.map((result) => {
              const age = noteAges.get(result.path)
              return (
                <button
                  type="button"
                  className="search-result"
                  key={result.path}
                  onClick={() => onSelectNote(result.path)}
                  onContextMenu={(event) =>
                    openContextMenu(event, { kind: 'note', path: result.path })
                  }
                >
                  <strong>{result.name}</strong>
                  <span>{result.path}</span>
                  {age ? (
                    <small className={`freshness-${age.freshness.level}`}>
                      最終更新: {age.exact} · {age.freshness.statusLabel}
                    </small>
                  ) : null}
                  <small>{highlightSearchExcerpt(result.excerpt, query)}</small>
                </button>
              )
            })
          )}
        </div>
        {contextMenuElement}
      </>
    )
  }

  return (
    <>
      <div
        className={`file-tree ${dropTarget === '' ? 'is-drop-target' : ''}`}
        role="tree"
        aria-label="Vaultファイル"
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
    </>
  )
}
