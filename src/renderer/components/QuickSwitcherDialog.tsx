import React, { useEffect, useMemo, useRef, useState } from 'react'
import { searchRendererRanked } from '../../core/search'
import type { NoteDocument } from '../../shared/types'

export interface QuickSwitcherDialogProps {
  notes: NoteDocument[]
  recentPaths: string[]
  onOpen: (path: string) => void
  onOpenInNewTab: (path: string) => void
  onClose: () => void
  onCreate?: (query: string) => void
  deprioritizedPaths?: ReadonlySet<string>
}

interface QuickSwitcherResult {
  path: string
  name: string
}

function optionId(path: string): string {
  return `quick-switcher-option-${encodeURIComponent(path)}`
}

function moveDeprioritizedToEnd<T extends { path: string }>(
  items: T[],
  deprioritizedPaths?: ReadonlySet<string>
): T[] {
  if (!deprioritizedPaths?.size) return items
  return [
    ...items.filter((item) => !deprioritizedPaths.has(item.path)),
    ...items.filter((item) => deprioritizedPaths.has(item.path))
  ]
}

export default function QuickSwitcherDialog({
  notes,
  recentPaths,
  onOpen,
  onOpenInNewTab,
  onClose,
  onCreate,
  deprioritizedPaths
}: QuickSwitcherDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const notesByPath = useMemo(() => {
    const result = new Map<string, NoteDocument>()
    for (const note of notes) {
      if (!result.has(note.path)) result.set(note.path, note)
    }
    return result
  }, [notes])

  const results = useMemo<QuickSwitcherResult[]>(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      const seen = new Set<string>()
      const recentResults = recentPaths
        .filter((path) => {
          if (seen.has(path) || !notesByPath.has(path)) return false
          seen.add(path)
          return true
        })
        .map((path) => {
          const note = notesByPath.get(path)!
          return { path, name: note.name }
        })
      return moveDeprioritizedToEnd(recentResults, deprioritizedPaths).slice(0, 20)
    }

    const seen = new Set<string>()
    const rankedResults = searchRendererRanked(notes, trimmedQuery)
      .flatMap((result) => {
        if (seen.has(result.path) || !notesByPath.has(result.path)) return []
        seen.add(result.path)
        return [result]
      })
    return moveDeprioritizedToEnd(rankedResults, deprioritizedPaths).slice(0, 50)
  }, [deprioritizedPaths, notes, notesByPath, query, recentPaths])

  const activeResult = results[selectedIndex]
  const activeId = activeResult ? optionId(activeResult.path) : undefined

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1))
    }
  }, [results.length, selectedIndex])

  useEffect(() => {
    if (!activeId) return
    const activeOption = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    activeOption?.scrollIntoView?.({ block: 'nearest' })
  }, [activeId])

  const openResult = (result: QuickSwitcherResult, newTab: boolean) => {
    if (newTab) onOpenInNewTab(result.path)
    else onOpen(result.path)
    onClose()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (results.length > 0) setSelectedIndex((index) => Math.min(index + 1, results.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length > 0) setSelectedIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      if (results.length > 0) setSelectedIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      if (results.length > 0) setSelectedIndex(results.length - 1)
      return
    }
    if (event.key === 'Enter' && activeResult) {
      event.preventDefault()
      openResult(activeResult, event.ctrlKey || event.metaKey)
    }
  }

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), button:not(:disabled)'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (focusable.length === 1 || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="modal-backdrop quick-switcher-backdrop"
      data-testid="quick-switcher-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="modal quick-switcher-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-switcher-title"
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="quick-switcher-title" className="quick-switcher-title">
          ノートを開く
        </h2>
        <input
          ref={inputRef}
          className="quick-switcher-input"
          type="search"
          value={query}
          placeholder="タイトル、パス、内容を検索"
          aria-label="ノートを検索"
          role="combobox"
          aria-controls="quick-switcher-list"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
        />
        <div
          ref={listRef}
          className="quick-switcher-list"
          id="quick-switcher-list"
          role="listbox"
          aria-label="ノート候補"
        >
          {results.map((result, index) => {
            const id = optionId(result.path)
            return (
              <div
                key={result.path}
                id={id}
                className={`quick-switcher-option${index === selectedIndex ? ' is-selected' : ''}`}
                role="option"
                aria-selected={index === selectedIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => openResult(result, false)}
              >
                <span className="quick-switcher-option-name">{result.name}</span>
                <span className="quick-switcher-option-path">{result.path}</span>
              </div>
            )
          })}
          {results.length === 0 && query.trim() && (
            <div className="quick-switcher-empty" role="status">
              <p>該当するノートはありません</p>
              {onCreate && (
                <>
                  <button
                    className="quick-switcher-create"
                    type="button"
                    onClick={() => onCreate(query.trim())}
                  >
                    新規ノートを作成
                  </button>
                  <p className="quick-switcher-create-hint">保存先は作成前に確認します。</p>
                </>
              )}
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div className="quick-switcher-empty" role="status">
              最近開いたノートはありません
            </div>
          )}
        </div>
        <footer className="quick-switcher-footer">
          <span>↑↓ 選択</span>
          <span>Enter 開く</span>
          <span>Ctrl+Enter 新しいタブ</span>
          <span>Esc 閉じる</span>
        </footer>
      </section>
    </div>
  )
}
