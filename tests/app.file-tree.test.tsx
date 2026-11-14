// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../src/renderer/App'
import { bookmarkId, type SaveBookmarkInput, type VaultBookmark } from '../src/shared/bookmarks'
import type { MoveNoteInput, Result, TsuzuneApi, VaultSnapshot } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'

vi.mock('../src/renderer/components/MarkdownEditor', () => ({ default: () => null }))

const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
let moveNote: ReturnType<typeof makeMoveNote>
let saveBookmark: ReturnType<typeof makeSaveBookmark>

function makeMoveNote(snapshot: VaultSnapshot) {
  return vi.fn((input: MoveNoteInput) => {
    const path = `${input.destinationDirectory}/${input.path.split('/').at(-1)}`
    snapshot.notes = snapshot.notes.map(note => note.path === input.path ? { ...note, path } : note)
    return ok({ oldPath: input.path, path })
  })
}

function makeSaveBookmark(snapshot: VaultSnapshot) {
  return vi.fn((input: SaveBookmarkInput) => {
    const bookmark = { ...input, id: bookmarkId(input), ctime: 1 } as VaultBookmark
    snapshot.bookmarks = [bookmark]
    return ok(bookmark)
  })
}

beforeEach(() => {
  const snapshot: VaultSnapshot = {
    rootPath: 'C:/Vault',
    rootName: 'Vault',
    directories: ['', 'Archive', 'Inbox', 'Inbox/Nested'],
    notes: ['Alpha', 'Beta'].map(name => ({ path: `Inbox/${name}.md`, name, content: `# ${name}`, modifiedAt: 1, size: 6 }))
  }
  const getSnapshot = () => ok({ ...snapshot })
  moveNote = makeMoveNote(snapshot)
  saveBookmark = makeSaveBookmark(snapshot)
  const api = {
    getSettings: () => ok({
      lastVaultPath: snapshot.rootPath, lastNotePath: null, userIgnoreFilters: [],
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS, graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS, graphGroups: DEFAULT_GRAPH_GROUPS, graphViewStates: DEFAULT_GRAPH_VIEW_STATES
    }),
    openLastVault: getSnapshot,
    getSnapshot,
    getWorkspaces: () => ok({ scope: { rootPath: 'c:/vault', rootRevision: 1 }, state: { version: 1, lastSession: null, named: [] } }),
    saveLastWorkspaceSession: () => ok(null), setLastNote: () => ok(null),
    getMoveRecovery: () => ok({ status: 'clean' }),
    getCalendarPluginStatus: () => ok({ state: 'missing', id: 'calendar', version: '1.5.10', mainSha256: '', manifestSha256: '', reason: null }),
    listObsidianPluginCandidates: () => ok([]),
    getUpdateStatus: () => ok({ phase: 'idle', currentVersion: '0.6.0', availableVersion: null, downloadPercent: null, message: null }),
    onVaultChanged: () => () => undefined, onUpdateStatus: () => () => undefined, onRequestClose: () => () => undefined,
    readNote: (path: string) => ok(snapshot.notes.find(note => note.path === path)),
    moveNote, saveBookmark
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})

afterEach(cleanup)

it('moves the selected files only after confirming one destination', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('treeitem', { name: 'Inbox/Alpha.md' }), { ctrlKey: true })
  fireEvent.click(screen.getByRole('treeitem', { name: 'Inbox/Beta.md' }), { ctrlKey: true })
  fireEvent.click(screen.getByRole('button', { name: '選択した2件を移動' }))
  const dialog = within(screen.getByRole('dialog', { name: '選択項目を移動' }))
  expect(moveNote).not.toHaveBeenCalled()
  fireEvent.change(dialog.getByRole('combobox', { name: '移動先' }), { target: { value: 'Archive' } })
  fireEvent.click(dialog.getByRole('button', { name: '移動', exact: true }))

  expect(await screen.findByRole('treeitem', { name: 'Archive/Beta.md' })).toBeTruthy()
  expect(screen.getByRole('treeitem', { name: 'Archive/Alpha.md' })).toBeTruthy()
  expect(moveNote.mock.calls).toEqual([
    [{ path: 'Inbox/Alpha.md', destinationDirectory: 'Archive', destinationPath: 'Archive/Alpha.md' }],
    [{ path: 'Inbox/Beta.md', destinationDirectory: 'Archive', destinationPath: 'Archive/Beta.md' }]
  ])
})

it('saves a folder from the context menu and reveals it from the bookmark sidebar', async () => {
  render(<App />)
  fireEvent.contextMenu(await screen.findByRole('treeitem', { name: 'Inbox/Nested' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'ブックマークへ追加' }))
  const dialog = within(screen.getByRole('dialog', { name: 'ブックマークを追加' }))
  fireEvent.change(dialog.getByRole('textbox', { name: 'タイトル' }), { target: { value: 'My folder' } })
  fireEvent.click(dialog.getByRole('button', { name: '保存' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'ブックマークを追加' })).toBeNull())
  expect(saveBookmark).toHaveBeenCalledExactlyOnceWith({ type: 'folder', path: 'Inbox/Nested', title: 'My folder', group: '' })

  const parent = screen.getByRole('treeitem', { name: 'Inbox' })
  fireEvent.click(parent)
  expect(parent.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'ブックマーク', exact: true }))
  const bookmarks = within(screen.getByRole('region', { name: 'ブックマーク一覧' }))
  fireEvent.click(bookmarks.getByRole('button', { name: /My folder/ }))
  const folder = await screen.findByRole('treeitem', { name: 'Inbox/Nested' })
  expect(folder.getAttribute('aria-expanded')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(folder))
})
