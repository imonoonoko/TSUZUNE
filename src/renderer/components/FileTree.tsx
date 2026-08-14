import { useEffect, useMemo, useRef, useState } from 'react'
import { getNoteFreshness } from '../../core/freshness'
import { basenameRelative, dirnameRelative } from '../../core/paths'
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
  onTrash: (path: string) => void
}

interface FileTreeContextMenu {
  selection: TreeSelection
  x: number
  y: number
  trigger: HTMLElement
}

const CONTEXT_MENU_WIDTH = 180
const CONTEXT_MENU_ITEM_HEIGHT = 36

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
  onTrash
}: FileTreeProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [contextMenu, setContextMenu] = useState<FileTreeContextMenu | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)

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
    event: React.MouseEvent<HTMLElement>,
    selection: TreeSelection
  ): void => {
    event.preventDefault()
    onSelectEntry(selection)
    const itemCount = selection.kind === 'note' ? 3 : 2
    setContextMenu({
      selection,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 8)),
      y: Math.max(
        8,
        Math.min(
          event.clientY,
          window.innerHeight - itemCount * CONTEXT_MENU_ITEM_HEIGHT - 18
        )
      ),
      trigger: event.currentTarget
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

  const renderDirectory = (directory: string, depth: number): React.ReactNode => {
    const childDirectories = directoriesByParent.get(directory) ?? []
    const childNotes = notesByDirectory.get(directory) ?? []

    return (
      <>
        {childDirectories.map((child) => {
          const isCollapsed = collapsed.has(child)
          const isSelected =
            treeSelection?.kind === 'directory' && treeSelection.path === child
          return (
            <div key={`directory:${child}`}>
              <button
                type="button"
                className={`tree-row tree-folder ${isSelected ? 'is-selected' : ''}`}
                style={{ paddingInlineStart: `${12 + depth * 16}px` }}
                onClick={() => toggleDirectory(child)}
                onContextMenu={(event) =>
                  openContextMenu(event, { kind: 'directory', path: child })
                }
                aria-expanded={!isCollapsed}
              >
                <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                <span>{basenameRelative(child)}</span>
              </button>
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
          return (
            <button
              type="button"
              key={note.path}
              className={`tree-row tree-note ${
                isSelected || isTreeSelected ? 'is-selected' : ''
              }`}
              style={{ paddingInlineStart: `${31 + depth * 16}px` }}
              onClick={() => {
                onSelectEntry({ kind: 'note', path: note.path })
                onSelectNote(note.path)
              }}
              onContextMenu={(event) =>
                openContextMenu(event, { kind: 'note', path: note.path })
              }
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
      {contextMenu.selection.kind === 'note' && (
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
      )}
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
                  <small>{result.excerpt || '本文は空です。'}</small>
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
      <div className="file-tree" role="tree" aria-label="Vaultファイル">
        {snapshot.directories.length === 1 && snapshot.notes.length === 0 ? (
          <div className="sidebar-empty">まだノートがありません。</div>
        ) : (
          renderDirectory('', 0)
        )}
      </div>
      {contextMenuElement}
    </>
  )
}
