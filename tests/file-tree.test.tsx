// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FileTree from '../src/renderer/components/FileTree'
import type { VaultSnapshot } from '../src/shared/types'

const snapshot: VaultSnapshot = {
  rootPath: 'C:\\Vault',
  rootName: 'Vault',
  directories: ['', 'Inbox'],
  notes: [
    {
      path: 'Inbox/Note.md',
      name: 'Note',
      content: '',
      modifiedAt: 1,
      size: 0
    }
  ]
}

afterEach(cleanup)

describe('FileTree context menu', () => {
  it('reuses note actions and limits folder actions', () => {
    const onSelectEntry = vi.fn()
    const onRename = vi.fn()
    const onMove = vi.fn()
    const onTrash = vi.fn()
    const onOpenInNewTab = vi.fn()
    const onReveal = vi.fn()
    const onCopyPath = vi.fn()
    const onBookmark = vi.fn()
    const onCreateNote = vi.fn()
    const onCreateDirectory = vi.fn()
    const { container } = render(
      <FileTree
        snapshot={snapshot}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[]}
        query=""
        onSelectNote={vi.fn()}
        onSelectEntry={onSelectEntry}
        onRename={onRename}
        onMove={onMove}
        onTrash={onTrash}
        bookmarkedPaths={new Set()}
        onOpenInNewTab={onOpenInNewTab}
        onReveal={onReveal}
        onCopyPath={onCopyPath}
        onBookmark={onBookmark}
        onCreateNote={onCreateNote}
        onCreateDirectory={onCreateDirectory}
      />
    )

    const note = container.querySelector<HTMLButtonElement>('button.tree-note')!
    fireEvent.contextMenu(note, { clientX: 80, clientY: 90 })
    expect(onSelectEntry).toHaveBeenLastCalledWith({
      kind: 'note',
      path: 'Inbox/Note.md'
    })
    fireEvent.click(screen.getByRole('menuitem', { name: '移動' }))
    expect(onMove).toHaveBeenCalledWith('Inbox/Note.md')

    fireEvent.contextMenu(note)
    fireEvent.click(screen.getByRole('menuitem', { name: '名前変更' }))
    expect(onRename).toHaveBeenCalledWith({ kind: 'note', path: 'Inbox/Note.md' })

    fireEvent.contextMenu(note)
    fireEvent.click(screen.getByRole('menuitem', { name: 'ごみ箱へ移動' }))
    expect(onTrash).toHaveBeenCalledWith('Inbox/Note.md')

    fireEvent.contextMenu(note)
    fireEvent.click(screen.getByRole('menuitem', { name: '新しいタブで開く' }))
    expect(onOpenInNewTab).toHaveBeenCalledWith('Inbox/Note.md')

    fireEvent.contextMenu(note)
    fireEvent.click(screen.getByRole('menuitem', { name: 'ブックマークへ追加' }))
    expect(onBookmark).toHaveBeenCalledWith('Inbox/Note.md')

    fireEvent.contextMenu(note)
    fireEvent.click(screen.getByRole('menuitem', { name: 'フォルダーで表示' }))
    expect(onReveal).toHaveBeenCalledWith('Inbox/Note.md')

    fireEvent.contextMenu(note)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Vault相対パスをコピー' }))
    expect(onCopyPath).toHaveBeenCalledWith('Inbox/Note.md')

    const folder = container.querySelector<HTMLButtonElement>('button.tree-folder')!
    fireEvent.contextMenu(folder)
    expect(screen.queryByRole('menuitem', { name: '移動' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: '名前変更' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'ごみ箱へ移動' })).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitem', { name: 'ここに新規ノート' }))
    expect(onCreateNote).toHaveBeenCalledWith('Inbox')

    fireEvent.contextMenu(folder)
    fireEvent.click(screen.getByRole('menuitem', { name: 'ここに新規フォルダー' }))
    expect(onCreateDirectory).toHaveBeenCalledWith('Inbox')
  })

  it('closes with Escape and restores focus to the tree item', () => {
    const { container } = render(
      <FileTree
        snapshot={snapshot}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[]}
        query=""
        onSelectNote={vi.fn()}
        onSelectEntry={vi.fn()}
        onRename={vi.fn()}
        onMove={vi.fn()}
        onTrash={vi.fn()}
        bookmarkedPaths={new Set()}
        onOpenInNewTab={vi.fn()}
        onReveal={vi.fn()}
        onCopyPath={vi.fn()}
        onBookmark={vi.fn()}
        onCreateNote={vi.fn()}
        onCreateDirectory={vi.fn()}
      />
    )
    const note = container.querySelector<HTMLButtonElement>('button.tree-note')!

    fireEvent.contextMenu(note)
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(note)
  })

  it('offers the same note actions from search results', () => {
    const onSelectEntry = vi.fn()
    const onMove = vi.fn()
    render(
      <FileTree
        snapshot={snapshot}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[
          {
            path: 'Inbox/Note.md',
            name: 'Note',
            excerpt: 'match',
            modifiedAt: 1,
            score: 1
          }
        ]}
        query="Note"
        onSelectNote={vi.fn()}
        onSelectEntry={onSelectEntry}
        onRename={vi.fn()}
        onMove={onMove}
        onTrash={vi.fn()}
        bookmarkedPaths={new Set()}
        onOpenInNewTab={vi.fn()}
        onReveal={vi.fn()}
        onCopyPath={vi.fn()}
        onBookmark={vi.fn()}
        onCreateNote={vi.fn()}
        onCreateDirectory={vi.fn()}
      />
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: /Note/ }))
    expect(onSelectEntry).toHaveBeenCalledWith({ kind: 'note', path: 'Inbox/Note.md' })
    fireEvent.click(screen.getByRole('menuitem', { name: '移動' }))
    expect(onMove).toHaveBeenCalledWith('Inbox/Note.md')
  })
})
