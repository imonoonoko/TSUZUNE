// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchRendererRanked } from '../src/core/search'
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

  it('summarizes ranked matching excerpts and separates them from metadata', () => {
    const query = '再利用の導線'
    const searchResults = searchRendererRanked([
      { ...snapshot.notes[0], content: 'X'.repeat(200) + '\n再利用の話。' }
    ], query)

    render(
      <FileTree
        snapshot={snapshot}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={searchResults}
        query={query}
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

    const results = screen.getByLabelText('検索結果')
    expect(within(results).getByRole('status').textContent?.replace(/\s+/gu, ' ')).toBe(
      '検索結果 1件'
    )
    expect(results.querySelector('.search-result-excerpt')?.textContent).toBe(
      '…' + 'X'.repeat(44) + ' 再利用の話。'
    )
    expect(results.querySelector('.search-result-path')?.textContent).toBe('Inbox/Note.md')
  })

  it('uses a fixed four-group order while preserving every result and group-local rank', () => {
    render(
      <FileTree
        snapshot={snapshot}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[
          { path: '40_情報源/Source.md', name: 'Source', excerpt: 'match', modifiedAt: 1, score: 3 },
          {
            path: '30_知識/Knowledge.md',
            name: 'Knowledge',
            excerpt: 'match',
            modifiedAt: 1,
            score: 2,
            category: '知識管理',
            topics: ['原典追跡']
          },
          { path: '01_受信箱/Capture.md', name: 'Capture', excerpt: 'match', modifiedAt: 1, score: 1 },
          { path: 'misc/Other.md', name: 'Other', excerpt: 'match', modifiedAt: 1, score: 0 }
        ]}
        query="match"
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

    const results = screen.getByLabelText('検索結果')
    expect(within(results).getByRole('status').textContent?.replace(/\s+/gu, ' ')).toBe(
      '検索結果 4件'
    )
    expect(within(results).getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      '知識',
      '情報源',
      '受信箱',
      'その他'
    ])
    expect(within(results).getAllByRole('button')).toHaveLength(4)
    expect(within(results).getByText('知識管理')).toBeTruthy()
    expect(within(results).getByText('原典追跡')).toBeTruthy()
    expect(within(results).getAllByRole('button').map((button) => button.textContent).join(' ')).toMatch(
      /Knowledge[\s\S]*Source[\s\S]*Capture[\s\S]*Other/
    )
  })

  it('announces an empty search result count', () => {
    render(
      <FileTree
        snapshot={snapshot}
        selectedNotePath={null}
        treeSelection={null}
        searchResults={[]}
        query="missing"
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

    const results = screen.getByLabelText('検索結果')
    expect(within(results).getByRole('status').textContent?.replace(/\s+/gu, ' ')).toBe(
      '検索結果 0件'
    )
    expect(within(results).getByText('「missing」は見つかりませんでした。')).toBeTruthy()
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

  it('sorts search results and opens a match at its source offset', () => {
    const source = '---\ntitle: needle\n---\n導入\nneedle の本文\n結び'
    const localSnapshot: VaultSnapshot = {
      ...snapshot,
      notes: [
        { ...snapshot.notes[0], path: 'Inbox/Zeta.md', name: 'Zeta', content: source },
        { ...snapshot.notes[0], path: 'Inbox/Alpha.md', name: 'Alpha', content: source }
      ]
    }
    const onOpenMatch = vi.fn()
    render(
      <FileTree
        {...commonProps}
        snapshot={localSnapshot}
        searchResults={searchRendererRanked(localSnapshot.notes, 'needle')}
        query="needle"
        onOpenMatch={onOpenMatch}
        onInlineRename={vi.fn()}
        onDropEntry={vi.fn()}
      />
    )

    fireEvent.change(screen.getByRole('combobox', { name: '検索結果の並び順' }), { target: { value: 'name-asc' } })
    const resultButtons = screen.getAllByRole('button').filter(button => button.classList.contains('search-result'))
    expect(resultButtons.map(button => button.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Alpha'), expect.stringContaining('Zeta')
    ]))
    expect(resultButtons[0].textContent).toContain('Alpha')

    fireEvent.click(screen.getByLabelText('一致箇所を表示'))
    fireEvent.click(screen.getAllByRole('button', { name: 'この一致へ移動' })[0])
    expect(onOpenMatch).toHaveBeenCalledWith('Inbox/Alpha.md', source, source.indexOf('needle', source.indexOf('---', 4)), expect.any(Number))
  })

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
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-tsuzune-vault-file', 'Inbox/Note.md')
    expect(onDropEntry).toHaveBeenCalledWith('Inbox/Note.md', 'Archive')

    fireEvent.dragStart(note, { dataTransfer })
    fireEvent.dragOver(container.querySelector('.file-tree')!, { dataTransfer })
    fireEvent.drop(container.querySelector('.file-tree')!, { dataTransfer })
    expect(onDropEntry).toHaveBeenLastCalledWith('Inbox/Note.md', '')
  })

  it('keeps a plainly selected row when Ctrl adds another row', () => {
    render(<FileTree {...commonProps} onMoveEntries={vi.fn()} onDropEntry={vi.fn()} onInlineRename={vi.fn()} />)
    const note = screen.getByRole('treeitem', { name: 'Inbox/Note.md' })
    const archive = screen.getByRole('treeitem', { name: 'Archive' })
    fireEvent.click(note)
    fireEvent.click(archive, { ctrlKey: true })
    expect(note.getAttribute('aria-selected')).toBe('true')
    expect(archive.getAttribute('aria-selected')).toBe('true')
  })

  it('moves a Ctrl and Shift selection together through the bulk action or a folder drop', () => {
    const onSelectNote = vi.fn()
    const onMoveEntries = vi.fn()
    const onDropEntries = vi.fn()
    const onDropEntry = vi.fn()
    const notes = ['Alpha', 'Beta', 'Gamma'].map(name => ({
      ...snapshot.notes[0], name, path: `Inbox/${name}.md`
    }))
    render(<FileTree
      {...commonProps}
      snapshot={{ ...snapshot, notes }}
      onSelectNote={onSelectNote}
      onMoveEntries={onMoveEntries}
      onDropEntries={onDropEntries}
      onDropEntry={onDropEntry}
      onInlineRename={vi.fn()}
    />)
    const alpha = screen.getByRole('treeitem', { name: 'Inbox/Alpha.md' })
    const beta = screen.getByRole('treeitem', { name: 'Inbox/Beta.md' })
    const gamma = screen.getByRole('treeitem', { name: 'Inbox/Gamma.md' })
    fireEvent.click(alpha, { ctrlKey: true })
    fireEvent.click(beta, { shiftKey: true })
    fireEvent.keyDown(beta, { key: 'ArrowDown', shiftKey: true })

    expect(document.activeElement).toBe(gamma)
    expect([alpha, beta, gamma].map(row => row.getAttribute('aria-selected'))).toEqual(['true', 'true', 'true'])
    expect(onSelectNote).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '選択した3件を移動' }))
    expect(onMoveEntries).toHaveBeenCalledWith(notes.map(note => note.path))

    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }
    const archive = screen.getByRole('treeitem', { name: 'Archive' })
    fireEvent.dragStart(beta, { dataTransfer })
    fireEvent.dragOver(archive, { dataTransfer })
    fireEvent.drop(archive, { dataTransfer })
    expect(dataTransfer.dropEffect).toBe('move')
    expect(onDropEntries).toHaveBeenCalledWith(notes.map(note => note.path), 'Archive')
    expect(onDropEntry).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '選択を解除' }))
    expect(screen.queryByRole('button', { name: '選択した3件を移動' })).toBeNull()
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

describe('FileTree ordering and active note reveal', () => {
  const commonProps = {
    snapshot: {
      ...snapshot,
      directories: ['', 'Archive', 'Inbox', 'Inbox/Child'],
      notes: [
        { path: 'Inbox/Recent.md', name: 'Recent', content: '', modifiedAt: 30, createdAt: 10, size: 0 },
        { path: 'Inbox/Old.md', name: 'Old', content: '', modifiedAt: 10, createdAt: 30, size: 0 },
        { path: 'Inbox/Child/Active.md', name: 'Active', content: '', modifiedAt: 20, createdAt: null, size: 0 }
      ]
    },
    selectedNotePath: null,
    treeSelection: null,
    searchResults: [],
    query: '',
    onSelectNote: vi.fn(),
    onSelectEntry: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onDropEntry: vi.fn(),
    onInlineRename: vi.fn(),
    onTrash: vi.fn(),
    bookmarkedPaths: new Set<string>(),
    onOpenInNewTab: vi.fn(),
    onReveal: vi.fn(),
    onCopyPath: vi.fn(),
    onBookmark: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateDirectory: vi.fn()
  }

  it('sorts notes by the selected field and direction', () => {
    const { rerender } = render(<FileTree {...commonProps} sortOrder="modified-desc" />)
    const paths = () => screen.getAllByRole('treeitem').filter(item => item.getAttribute('aria-label')?.endsWith('.md')).map(item => item.getAttribute('aria-label'))
    expect(paths()).toEqual(['Inbox/Child/Active.md', 'Inbox/Recent.md', 'Inbox/Old.md'])

    rerender(<FileTree {...commonProps} sortOrder="created-desc" />)
    expect(paths()).toEqual(['Inbox/Child/Active.md', 'Inbox/Old.md', 'Inbox/Recent.md'])
  })

  it('follows an active note by expanding ancestors and scrolling without moving focus', async () => {
    const { rerender } = render(<FileTree {...commonProps} selectedNotePath="Inbox/Recent.md" revealActiveNote />)
    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    fireEvent.click(inbox)
    expect(inbox.getAttribute('aria-expanded')).toBe('false')
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    rerender(<FileTree {...commonProps} selectedNotePath="Inbox/Child/Active.md" revealActiveNote />)
    const childFolder = screen.getByRole('treeitem', { name: 'Inbox/Child' })
    expect(screen.getByRole('treeitem', { name: 'Inbox/Child/Active.md' })).toBeTruthy()
    expect(childFolder.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(inbox)
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' }))
    if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  })

  it('opens a bookmarked folder and exposes its bookmark command', async () => {
    const onBookmarkDirectory = vi.fn()
    const { rerender } = render(<FileTree {...commonProps} onBookmarkDirectory={onBookmarkDirectory} />)
    fireEvent.click(screen.getByRole('treeitem', { name: 'Inbox' }))
    rerender(<FileTree {...commonProps} onBookmarkDirectory={onBookmarkDirectory} revealDirectory="Inbox/Child" />)
    const child = screen.getByRole('treeitem', { name: 'Inbox/Child' })
    await waitFor(() => expect(document.activeElement).toBe(child))
    expect(child.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(child)
    expect(child.getAttribute('aria-expanded')).toBe('false')
    rerender(<FileTree {...commonProps} onBookmarkDirectory={onBookmarkDirectory} revealDirectory="Inbox/Child" revealDirectoryRequest={1} />)
    expect(child.getAttribute('aria-expanded')).toBe('true')
    fireEvent.contextMenu(child)
    fireEvent.click(screen.getByRole('menuitem', { name: 'ブックマークへ追加' }))
    expect(onBookmarkDirectory).toHaveBeenCalledWith('Inbox/Child')
    expect(document.activeElement).toBe(child)
  })

  it('renders an unknown update date without breaking the tree', () => {
    const notes = commonProps.snapshot.notes.map(note => ({ ...note, modifiedAt: Infinity }))
    render(<FileTree {...commonProps} snapshot={{ ...commonProps.snapshot, notes }} />)
    expect(screen.getByRole('treeitem', { name: 'Inbox/Recent.md' }).textContent).toContain('—')
  })

  it('keeps manual folder collapse available while follow is enabled', () => {
    render(<FileTree {...commonProps} selectedNotePath="Inbox/Child/Active.md" revealActiveNote />)
    const childFolder = screen.getByRole('treeitem', { name: 'Inbox/Child' })
    fireEvent.click(childFolder)
    expect(childFolder.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('treeitem', { name: 'Inbox/Child/Active.md' })).toBeNull()
  })
})
