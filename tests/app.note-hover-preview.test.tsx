// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compilePathAliases } from '../src/core/path-aliases'
import RelatedNotes from '../src/renderer/components/RelatedNotes'
import FileTree from '../src/renderer/components/FileTree'
import NoteHoverPreview from '../src/renderer/components/NoteHoverPreview'
import type { NoteDocument, VaultSnapshot } from '../src/shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

const target: NoteDocument = { path: 'Target.md', name: 'Target', content: '# Target\n\nTarget body', modifiedAt: 1, size: 21 }
const source: NoteDocument = { path: 'Source.md', name: 'Source', content: 'See [[Target]] here.', modifiedAt: 1, size: 20 }
const notes = [target, source]
const snapshot: VaultSnapshot = { rootPath: 'C:\\Vault', rootName: 'Vault', directories: [''], notes }
const aliases = compilePathAliases({})

function fileTree(onSelectNote: ReturnType<typeof vi.fn>, query = '', searchResults: { path: string; name: string; modifiedAt: number; score: number; excerpt: string }[] = []): React.JSX.Element {
  return <FileTree snapshot={snapshot} selectedNotePath={null} treeSelection={null} searchResults={searchResults} query={query}
    onSelectNote={onSelectNote} onSelectEntry={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onDropEntry={vi.fn()}
    onInlineRename={vi.fn()} onTrash={vi.fn()} bookmarkedPaths={new Set()} onOpenInNewTab={vi.fn()} onReveal={vi.fn()}
    onCopyPath={vi.fn()} onBookmark={vi.fn()} onCreateNote={vi.fn()} onCreateDirectory={vi.fn()} />
}

describe('shared note hover preview entry points', () => {
  it('previews a FileTree note on pointer hover, leaves on pointer exit and never opens it', async () => {
    const onSelectNote = vi.fn()
    const { container } = render(<NoteHoverPreview notes={notes} aliases={aliases} scope="tree">
      {fileTree(onSelectNote)}
    </NoteHoverPreview>)
    const row = container.querySelector('[data-note-preview-path="Target.md"]')!
    fireEvent.pointerOver(row, { pointerType: 'mouse' })
    expect((await screen.findByRole('tooltip', { name: 'ノートプレビュー' })).textContent).toContain('Target body')
    expect(onSelectNote).not.toHaveBeenCalled()
    fireEvent.pointerOut(row, { relatedTarget: document.body })
    await waitFor(() => expect(screen.queryByRole('tooltip', { name: 'ノートプレビュー' })).toBeNull())
    expect(onSelectNote).not.toHaveBeenCalled()
  })

  it('previews a search result and dismisses it with Escape without selecting the result', async () => {
    const onSelectNote = vi.fn()
    const result = { path: target.path, name: target.name, modifiedAt: target.modifiedAt, score: 1, excerpt: 'Target body' }
    const { container } = render(<NoteHoverPreview notes={notes} aliases={aliases} scope="search">
      {fileTree(onSelectNote, 'Target', [result])}
    </NoteHoverPreview>)
    const row = container.querySelector('.search-result[data-note-preview-path="Target.md"]')!
    fireEvent.pointerOver(row, { pointerType: 'mouse' })
    expect((await screen.findByRole('tooltip', { name: 'ノートプレビュー' })).textContent).toContain('Target body')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('tooltip', { name: 'ノートプレビュー' })).toBeNull())
    expect(onSelectNote).not.toHaveBeenCalled()
  })

  it('reads a listed note on demand while the startup snapshot only has metadata', async () => {
    const readNote = vi.fn(async () => ({ ok: true, value: target }))
    vi.stubGlobal('tsuzune', { readNote })
    render(<NoteHoverPreview notes={[{ ...target, content: '' }]} aliases={aliases} contentPending scope="tree">
      {fileTree(vi.fn())}
    </NoteHoverPreview>)
    const row = document.querySelector('[data-note-preview-path="Target.md"]')!
    fireEvent.pointerOver(row, { pointerType: 'mouse' })
    expect((await screen.findByRole('tooltip', { name: 'ノートプレビュー' })).textContent).toContain('Target body')
    expect(readNote).toHaveBeenCalledExactlyOnceWith(target.path)
  })

  it('does not look up content for a row outside the supplied note paths', async () => {
    vi.useFakeTimers()
    const readNote = vi.fn()
    vi.stubGlobal('tsuzune', { readNote })
    const path = '50_履歴/Protected.md'
    render(<NoteHoverPreview notes={notes} aliases={aliases} contentPending scope="search">
      <button data-note-preview-path={path}>Protected</button>
    </NoteHoverPreview>)
    const row = screen.getByRole('button', { name: /Protected/ })
    expect(row.getAttribute('data-note-preview-path')).toBe(path)
    fireEvent.pointerOver(row, { pointerType: 'mouse' })
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(readNote).not.toHaveBeenCalled()
    expect(screen.queryByRole('tooltip', { name: 'ノートプレビュー' })).toBeNull()
  })

  it('previews a backlink source on pointer hover without opening the note', async () => {
    const onOpen = vi.fn()
    render(<NoteHoverPreview notes={notes} aliases={aliases} scope="backlinks">
      <RelatedNotes outgoing={[]} backlinks={[source]} temporal={null} activeTab="backlinks" onOpen={onOpen} onMissing={vi.fn()} />
    </NoteHoverPreview>)
    const row = document.querySelector('[data-note-preview-path="Source.md"]')!
    fireEvent.pointerOver(row, { pointerType: 'mouse' })
    expect((await screen.findByRole('tooltip', { name: 'ノートプレビュー' })).textContent).toContain('See Target here.')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
