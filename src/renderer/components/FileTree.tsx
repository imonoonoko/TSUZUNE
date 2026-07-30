import { useMemo, useState } from 'react'
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
}

export default function FileTree({
  snapshot,
  selectedNotePath,
  treeSelection,
  searchResults,
  query,
  onSelectNote,
  onSelectEntry
}: FileTreeProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

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
              title={note.path}
            >
              <span aria-hidden="true">◇</span>
              <span className="tree-label">{note.name}</span>
            </button>
          )
        })}
      </>
    )
  }

  if (query.trim()) {
    return (
      <div className="search-results" aria-label="検索結果">
        {searchResults.length === 0 ? (
          <div className="sidebar-empty">
            「{query}」は見つかりませんでした。
          </div>
        ) : (
          searchResults.map((result) => (
            <button
              type="button"
              className="search-result"
              key={result.path}
              onClick={() => onSelectNote(result.path)}
            >
              <strong>{result.name}</strong>
              <span>{result.path}</span>
              <small>{result.excerpt || '本文は空です。'}</small>
            </button>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="file-tree" role="tree" aria-label="Vaultファイル">
      {snapshot.directories.length === 1 && snapshot.notes.length === 0 ? (
        <div className="sidebar-empty">まだノートがありません。</div>
      ) : (
        renderDirectory('', 0)
      )}
    </div>
  )
}
