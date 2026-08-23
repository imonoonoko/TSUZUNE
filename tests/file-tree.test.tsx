// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FileTree from '../src/renderer/components/FileTree'
import type { VaultSnapshot } from '../src/shared/types'

const snapshot: VaultSnapshot = {
  rootPath: 'C:\\Vault',
  rootName: 'Vault',
  directories: ['', 'Archive', 'Inbox'],
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
  it('reuses note actions and exposes safe folder actions', () => {
    const onSelectEntry = vi.fn()
    const onRename = vi.fn()
    const onMove = vi.fn()
    const onTrash = vi.fn()
    const onOpenInNewTab = vi.fn()
    const onReveal = vi.fn()
    const onCopyPath = vi.fn()
    const onBookmark = vi.fn()
    const onCreateNote = vi.fn()
    const onCreateDirectory = vi.fn().mockResolvedValue(null)
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
        onDropEntry={vi.fn()}
        onInlineRename={vi.fn()}
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

    const folder = screen.getByRole('treeitem', { name: 'Inbox' })
    fireEvent.contextMenu(folder)
    fireEvent.click(screen.getByRole('menuitem', { name: '移動' }))
    expect(onMove).toHaveBeenCalledWith('Inbox')

    fireEvent.contextMenu(folder)
    expect(screen.getByRole('menuitem', { name: '名前変更' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'ごみ箱へ移動' })).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitem', { name: 'ここに新規ノート' }))
    expect(onCreateNote).toHaveBeenCalledWith('Inbox')

    fireEvent.contextMenu(folder)
    fireEvent.click(screen.getByRole('menuitem', { name: 'ここに新規フォルダー' }))
    const directoryInput = screen.getByRole('textbox', {
      name: 'Inboxに作るフォルダー名'
    })
    expect(onCreateDirectory).not.toHaveBeenCalled()
    fireEvent.change(directoryInput, { target: { value: '資料' } })
    fireEvent.keyDown(directoryInput, { key: 'Enter' })
    expect(onCreateDirectory).toHaveBeenCalledWith('Inbox', '資料')
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
        onDropEntry={vi.fn()}
        onInlineRename={vi.fn()}
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
        onDropEntry={vi.fn()}
        onInlineRename={vi.fn()}
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

  it('highlights only positive terms and phrases in search excerpts', () => {
    const { container } = render(
      <FileTree
        snapshot={snapshot}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[
          {
            path: 'Inbox/Note.md',
            name: 'Note',
            excerpt: 'Project Alpha and draft material',
            modifiedAt: 1,
            score: 1
          }
        ]}
        query={'"Project Alpha" -draft tag:project path:Inbox file:Note'}
        onSelectNote={vi.fn()}
        onSelectEntry={vi.fn()}
        onRename={vi.fn()}
        onMove={vi.fn()}
        onDropEntry={vi.fn()}
        onInlineRename={vi.fn()}
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

    expect(
      [...container.querySelectorAll('mark.search-match')].map((node) => node.textContent)
    ).toEqual(['Project Alpha'])
  })
})

describe('FileTree keyboard tree semantics', () => {
  it('uses a single roving treeitem and moves to the next visible item', () => {
    const onSelectEntry = vi.fn()
    const onSelectNote = vi.fn()

    render(
      <FileTree
        snapshot={{
          ...snapshot,
          directories: ['', 'Archive', 'Inbox', 'Inbox/Child'],
          notes: [
            {
              path: 'Archive/Alpha.md',
              name: 'Alpha',
              content: '',
              modifiedAt: 1,
              size: 0
            },
            {
              path: 'Inbox/Beta.md',
              name: 'Beta',
              content: '',
              modifiedAt: 1,
              size: 0
            }
          ]
        }}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[]}
        query=""
        onSelectNote={onSelectNote}
        onSelectEntry={onSelectEntry}
        onRename={vi.fn()}
        onMove={vi.fn()}
        onDropEntry={vi.fn()}
        onInlineRename={vi.fn()}
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

    const archive = screen.getByRole('treeitem', { name: 'Archive' })
    expect(screen.getAllByRole('treeitem')).toHaveLength(5)
    expect(screen.getAllByRole('treeitem').filter((item) => item.tabIndex === 0)).toHaveLength(1)
    expect(archive.getAttribute('aria-level')).toBe('1')

    archive.focus()
    fireEvent.keyDown(archive, { key: 'ArrowDown' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Archive/Alpha.md' }))
    expect(onSelectEntry).toHaveBeenLastCalledWith({ kind: 'note', path: 'Archive/Alpha.md' })

    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(archive)
    fireEvent.keyDown(archive, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox/Beta.md' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(onSelectNote).toHaveBeenCalledWith('Inbox/Beta.md')
  })

  it('collapses folders, supports typeahead, and ignores composing input', () => {
    render(
      <FileTree
        snapshot={{
          ...snapshot,
          directories: ['', 'Archive', 'Inbox', 'Inbox/Child'],
          notes: [
            {
              path: 'Archive/Alpha.md',
              name: 'Alpha',
              content: '',
              modifiedAt: 1,
              size: 0
            },
            {
              path: 'Inbox/Beta.md',
              name: 'Beta',
              content: '',
              modifiedAt: 1,
              size: 0
            }
          ]
        }}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[]}
        query=""
        onSelectNote={vi.fn()}
        onSelectEntry={vi.fn()}
        onRename={vi.fn()}
        onMove={vi.fn()}
        onDropEntry={vi.fn()}
        onInlineRename={vi.fn()}
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

    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    inbox.focus()
    fireEvent.keyDown(inbox, { key: 'ArrowLeft' })
    expect(inbox.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('treeitem', { name: 'Inbox/Beta.md' })).toBeNull()

    fireEvent.keyDown(inbox, { key: 'ArrowRight' })
    expect(inbox.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(inbox, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox/Child' }))

    fireEvent.keyDown(document.activeElement!, { key: 'b' })
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox/Beta.md' }))

    const archive = screen.getByRole('treeitem', { name: 'Archive' })
    archive.focus()
    fireEvent.keyDown(archive, { key: 'b', isComposing: true })
    expect(document.activeElement).toBe(archive)
  })

  it('keeps keyboard commands available after clicking a tree item', () => {
    render(
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
        onDropEntry={vi.fn()}
        onInlineRename={vi.fn()}
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

    const note = screen.getByRole('treeitem', { name: 'Inbox/Note.md' })
    fireEvent.click(note)
    expect(document.activeElement).toBe(note)

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox' }))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(note)

    fireEvent.keyDown(document.activeElement!, {
      key: 'F10',
      shiftKey: true
    })
    expect(screen.getByRole('menu', { name: 'Inbox/Note.mdの操作' })).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(note)

    fireEvent.keyDown(document.activeElement!, { key: 'F2' })
    expect(screen.getByRole('textbox', { name: 'Noteの名前' })).not.toBeNull()
  })
})

describe('FileTree direct manipulation', () => {
  const commonProps = {
    snapshot,
    selectedNotePath: null,
    treeSelection: null,
    searchResults: [],
    query: '',
    onSelectNote: vi.fn(),
    onSelectEntry: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onTrash: vi.fn(),
    bookmarkedPaths: new Set<string>(),
    onOpenInNewTab: vi.fn(),
    onReveal: vi.fn(),
    onCopyPath: vi.fn(),
    onBookmark: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateDirectory: vi.fn()
  }

  it('moves a dragged entry into the dropped folder through the shared move path', () => {
    const onDropEntry = vi.fn()
    const { container } = render(
      <FileTree
        {...commonProps}
        onDropEntry={onDropEntry}
        onInlineRename={vi.fn()}
      />
    )
    const note = container.querySelector<HTMLButtonElement>('button.tree-note')!
    const archive = screen.getByRole('treeitem', { name: 'Archive' })
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn()
    }

    fireEvent.dragStart(note, { dataTransfer })
    fireEvent.dragOver(archive, { dataTransfer })
    fireEvent.drop(archive, { dataTransfer })

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'Inbox/Note.md')
    expect(onDropEntry).toHaveBeenCalledWith('Inbox/Note.md', 'Archive')

    fireEvent.dragStart(note, { dataTransfer })
    fireEvent.dragOver(container.querySelector('.file-tree')!, { dataTransfer })
    fireEvent.drop(container.querySelector('.file-tree')!, { dataTransfer })
    expect(onDropEntry).toHaveBeenLastCalledWith('Inbox/Note.md', '')
  })

  it('renames notes and folders inline with Enter and cancels with Escape', async () => {
    const onInlineRename = vi.fn().mockResolvedValue(null)
    const { container } = render(
      <FileTree
        {...commonProps}
        onDropEntry={vi.fn()}
        onInlineRename={onInlineRename}
      />
    )

    fireEvent.doubleClick(container.querySelector<HTMLButtonElement>('button.tree-note')!)
    const noteInput = screen.getByRole('textbox', { name: 'Noteの名前' })
    fireEvent.change(noteInput, { target: { value: 'Renamed' } })
    fireEvent.keyDown(noteInput, { key: 'Enter' })
    expect(onInlineRename).toHaveBeenCalledWith(
      { kind: 'note', path: 'Inbox/Note.md' },
      'Renamed'
    )
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())

    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    fireEvent.keyDown(inbox, { key: 'F2' })
    const folderInput = screen.getByRole('textbox', { name: 'Inboxの名前' })
    fireEvent.change(folderInput, { target: { value: 'Cancelled' } })
    fireEvent.keyDown(folderInput, { key: 'Escape' })
    expect(onInlineRename).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'Inbox' }), { key: 'F2' })
    const confirmedFolderInput = screen.getByRole('textbox', { name: 'Inboxの名前' })
    fireEvent.change(confirmedFolderInput, { target: { value: 'Sorted' } })
    fireEvent.keyDown(confirmedFolderInput, { key: 'Enter' })
    await waitFor(() =>
      expect(onInlineRename).toHaveBeenLastCalledWith(
        { kind: 'directory', path: 'Inbox' },
        'Sorted'
      )
    )
  })
})
