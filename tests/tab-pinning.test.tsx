// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { NoteDocument, Result, TsuzuneApi, VaultSnapshot } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'
import { migrateWorkspaceSnapshotV1, projectWorkspaceSnapshotV2, type WorkspaceSnapshotV2 } from '../src/shared/workspace-state'
import { splitWorkspacePane } from '../src/shared/pane-layout'
import type { MarkdownEditorHandle } from '../src/renderer/components/MarkdownEditor'
import App from '../src/renderer/App'

vi.mock('../src/renderer/components/MarkdownEditor', async () => {
  const ReactApi = await import('react')
  return { default: ReactApi.forwardRef(function MockEditor({ value, onChange, readOnly, onCompositionChange }: {
    value: string; onChange: (value: string) => void; readOnly?: boolean; onCompositionChange?: (value: boolean) => void
  }, ref: React.ForwardedRef<Pick<MarkdownEditorHandle, 'getWorkspaceState' | 'scrollToOffset'>>) {
    ReactApi.useImperativeHandle(ref, () => ({ getWorkspaceState: () => null, scrollToOffset() {} }), [])
    return <textarea aria-label="Markdown編集欄" data-pane-scroll value={value} readOnly={readOnly}
      onChange={readOnly ? undefined : event => onChange(event.target.value)}
      onCompositionStart={() => onCompositionChange?.(true)} onCompositionEnd={() => onCompositionChange?.(false)} />
  }) }
})

const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
let notes: NoteDocument[]
let savedWorkspace: WorkspaceSnapshotV2
let api: TsuzuneApi
const vault = (): VaultSnapshot => ({ rootPath: 'C:\\PaneFixture', rootName: 'PaneFixture', directories: [''], notes: [...notes] })

beforeEach(() => {
  notes = ['A', 'B', 'C'].map((name, index) => ({ path: `${name}.md`, name, content: `${name}の本文`, modifiedAt: index + 1, size: 10 }))
  savedWorkspace = migrateWorkspaceSnapshotV1({ tabs: [{ kind: 'note', path: 'A.md' }], activeIndex: 0, noteView: 'edit',
    left: { open: true, view: 'files', query: '' }, right: { open: true, view: 'links' } })
  api = {
    openLastVault: vi.fn(() => ok(vault())),
    getSettings: vi.fn(() => ok({ lastVaultPath: vault().rootPath, lastNotePath: 'A.md', userIgnoreFilters: [], graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
      graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS, graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS, graphGroups: DEFAULT_GRAPH_GROUPS, graphViewStates: DEFAULT_GRAPH_VIEW_STATES })),
    getWorkspaces: vi.fn(() => ok({ scope: { rootPath: vault().rootPath, rootRevision: 1 }, state: { version: 2 as const, lastSession: savedWorkspace, named: [] } })),
    saveLastWorkspaceSession: vi.fn(() => ok(null)),
    getSnapshot: vi.fn(() => ok(vault())),
    createNote: vi.fn(() => {
      const note = { path: 'New.md', name: 'New', content: '新規本文', modifiedAt: 4, size: 12 }
      notes.push(note)
      return ok({ path: note.path })
    }),
    readNote: vi.fn(path => ok({ ...notes.find(note => note.path === path)! })),
    saveNote: vi.fn(input => {
      const note = notes.find(note => note.path === input.path)!
      Object.assign(note, { content: input.content, modifiedAt: note.modifiedAt + 1, size: input.content.length })
      return ok({ path: note.path, modifiedAt: note.modifiedAt, size: note.size })
    }),
    getPropertyTypes: vi.fn(() => ok({})),
    setLastNote: vi.fn(() => ok(null)),
    getUpdateStatus: vi.fn(() => ok({ phase: 'idle', currentVersion: '0.6.0', availableVersion: null, downloadPercent: null, message: null })),
    getMoveRecovery: vi.fn(() => ok({ status: 'clean' })),
    getCalendarPluginStatus: vi.fn(() => ok({ state: 'missing', id: 'calendar', version: '1.5.10', mainSha256: '', manifestSha256: '', reason: null })),
    listObsidianPluginCandidates: vi.fn(() => ok([])),
    onVaultChanged: vi.fn(() => () => undefined), onRequestClose: vi.fn(() => () => undefined), onUpdateStatus: vi.fn(() => () => undefined)
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const panes = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-pane-id]')]
const pane = (id: string): HTMLElement => document.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)!
async function ready(): Promise<void> {
  await screen.findAllByRole('button', { name: 'ペイン操作' })
  await waitFor(() => expect(panes()).toHaveLength(savedWorkspace.panes.length))
}
function twoPanes(): void {
  const split = splitWorkspacePane(savedWorkspace, 'pane-1', 'horizontal', 'pane-2')
  savedWorkspace = projectWorkspaceSnapshotV2({ ...split, panes: split.panes.map(item => item.id === 'pane-2'
    ? { ...item, tabs: [{ kind: 'note', path: 'B.md' }] } : item) })
}

it('pins, preserves a reference on ordinary opens, reuses an existing tab, and unpins for replacement', async () => {
  render(<App />); await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Aを固定' }))
  expect(screen.getByRole('tab', { name: 'A（固定）' })).toBeTruthy()
  fireEvent.click(screen.getByRole('treeitem', { name: 'B.md' }))
  await screen.findByRole('tab', { name: 'B', exact: true })
  expect(screen.getByRole('tab', { name: 'A（固定）' })).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'A（固定）' }))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'A（固定）' }).getAttribute('aria-selected')).toBe('true'))
  fireEvent.click(screen.getByRole('treeitem', { name: 'B.md' }))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'B', exact: true }).getAttribute('aria-selected')).toBe('true'))
  expect(document.querySelectorAll('.workspace-tabs [role=tab]')).toHaveLength(2)
  fireEvent.click(screen.getByRole('tab', { name: 'A（固定）' }))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'A（固定）' }).getAttribute('aria-selected')).toBe('true'))
  fireEvent.click(screen.getByRole('button', { name: 'Aの固定を解除' }))
  fireEvent.click(screen.getByRole('treeitem', { name: 'C.md' }))
  await screen.findByRole('tab', { name: 'C', exact: true })
  expect(screen.queryByRole('tab', { name: /^A/ })).toBeNull()
  expect(document.querySelectorAll('.workspace-tabs [role=tab]')).toHaveLength(2)
})

it.each(['SAVE_FAILED', 'FILE_CHANGED'] as const)('keeps pinned tabs and draft when saving fails: %s', async code => {
  vi.mocked(api.saveNote).mockResolvedValue({ ok: false, error: { code, message: '保存失敗', currentContent: '外部本文', currentModifiedAt: 90 } })
  render(<App />); await ready()
  fireEvent.change(screen.getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: '消してはいけない本文' } })
  fireEvent.click(screen.getByRole('button', { name: 'Aを固定' }))
  fireEvent.click(screen.getByRole('treeitem', { name: 'B.md' }))
  await waitFor(() => expect(api.saveNote).toHaveBeenCalled())
  expect(screen.getByRole('tab', { name: 'A（固定）' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByRole('tab', { name: 'B', exact: true })).toBeNull()
  expect((screen.getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('消してはいけない本文')
})

it('persists pinning, restores it, and permits explicit close', async () => {
  savedWorkspace.panes[0].tabs[0] = { kind: 'note', path: 'A.md', pinned: true }
  render(<App />); await ready()
  expect(screen.getByRole('tab', { name: 'A（固定）' })).toBeTruthy()
  fireEvent.click(screen.getByRole('treeitem', { name: 'B.md' }))
  await screen.findByRole('tab', { name: 'B', exact: true })
  await waitFor(() => expect(api.saveLastWorkspaceSession).toHaveBeenCalled(), { timeout: 2000 })
  const saved = vi.mocked(api.saveLastWorkspaceSession).mock.calls.at(-1)![1] as WorkspaceSnapshotV2
  expect(saved.panes[0].tabs[0]).toEqual({ kind: 'note', path: 'A.md', pinned: true })
  fireEvent.click(screen.getByRole('button', { name: 'Aを閉じる' }))
  await waitFor(() => expect(screen.queryByRole('tab', { name: 'A（固定）' })).toBeNull())
})

it('toggles a pin in an inactive pane without losing the current draft', async () => {
  twoPanes()
  render(<App />); await ready()
  fireEvent.change(within(pane('pane-2')).getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: 'Bの保持する下書き' } })
  fireEvent.click(within(pane('pane-1')).getByRole('button', { name: 'Aを固定' }))
  expect(within(pane('pane-1')).getByRole('tab', { name: 'A（固定）' })).toBeTruthy()
  expect((within(pane('pane-2')).getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('Bの保持する下書き')
})

it('opens a link in its source pane without replacing the pinned note or activating the duplicate in another pane', async () => {
  notes[0].content = 'Bを開く [[B]]'
  twoPanes()
  savedWorkspace.panes[0] = { ...savedWorkspace.panes[0], noteView: 'preview', tabs: [{ kind: 'note', path: 'A.md', pinned: true }] }
  render(<App />); await ready()
  await act(async () => fireEvent.click(within(pane('pane-1')).getByRole('link', { name: 'B' })))
  const originalPane = within(pane('pane-1'))
  expect(originalPane.getByRole('tab', { name: 'A（固定）' })).toBeTruthy()
  expect(originalPane.getByRole('tab', { name: 'B' }).getAttribute('aria-selected')).toBe('true')
  expect(within(pane('pane-2')).getAllByRole('tab')).toHaveLength(1)
})

it('does not replace a pinned reference when the workspace already has 200 tabs', async () => {
  twoPanes()
  savedWorkspace.panes[0].tabs = [{ kind: 'note', path: 'A.md', pinned: true },
    ...Array.from({ length: 198 }, () => ({ kind: 'note' as const, path: 'C.md' }))]
  savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, activePaneId: 'pane-1' })
  render(<App />); await ready()
  fireEvent.click(screen.getByRole('treeitem', { name: 'B.md' }))
  await screen.findByText(/200個まで/)
  fireEvent.click(screen.getByRole('button', { name: '新規ノート' }))
  await screen.findByText('ノートを作成しました。表示するにはタブを閉じてください。')
  expect(api.createNote).toHaveBeenCalledOnce()
  expect(screen.getByRole('treeitem', { name: 'New.md' })).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'A（固定）' }).getAttribute('aria-selected')).toBe('true')
  expect(document.querySelectorAll('.workspace-tabs [role=tab]')).toHaveLength(200)
  expect((within(pane('pane-1')).getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('Aの本文')
})

it('offers pinning for the first note before any workspace has been saved', async () => {
  vi.mocked(api.getWorkspaces).mockImplementation(() => ok({ scope: { rootPath: vault().rootPath, rootRevision: 1 },
    state: { version: 2, lastSession: null, named: [] } }))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Aを固定' }))
  fireEvent.click(screen.getByRole('treeitem', { name: 'B.md' }))
  await screen.findByRole('tab', { name: 'B', exact: true })
  expect(screen.getByRole('tab', { name: 'A（固定）' })).toBeTruthy()
})
