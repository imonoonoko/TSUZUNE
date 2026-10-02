// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDocument, Result, TsuzuneApi, VaultSnapshot } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'
import { migrateWorkspaceSnapshotV1, projectWorkspaceSnapshotV2, type WorkspaceSnapshotV2 } from '../src/shared/workspace-state'
import { splitWorkspacePane } from '../src/shared/pane-layout'
import App from '../src/renderer/App'

vi.mock('../src/renderer/components/MarkdownEditor', async () => {
  const ReactApi = await import('react')
  return { default: ReactApi.forwardRef(function MockEditor({ value, onChange, readOnly, onCompositionChange }: {
    value: string; onChange: (value: string) => void; readOnly?: boolean; onCompositionChange?: (value: boolean) => void
  }, ref: React.ForwardedRef<{ scrollToOffset: (offset: number) => void }>) {
    ReactApi.useImperativeHandle(ref, () => ({ scrollToOffset() {} }), [])
    return <textarea aria-label="Markdown編集欄" value={value} readOnly={readOnly}
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

function paneAction(name: string): HTMLElement {
  const existing = screen.queryByRole('menuitem', { name })
  if (existing) return existing
  fireEvent.click(within(document.querySelector<HTMLElement>('.workspace-pane.is-active')!).getByRole('button', { name: 'ペイン操作' }))
  return screen.getByRole('menuitem', { name })
}

const panes = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-pane-id]')]
const pane = (id: string): HTMLElement => document.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)!
async function ready(): Promise<void> {
  await screen.findAllByRole('button', { name: 'ペイン操作' })
  await waitFor(() => expect(panes()).toHaveLength(savedWorkspace.panes.length))
}
function twoPanes(sameNote = false): void {
  const split = splitWorkspacePane(savedWorkspace, 'pane-1', 'horizontal', 'pane-2')
  savedWorkspace = projectWorkspaceSnapshotV2({ ...split, panes: split.panes.map(item => item.id === 'pane-2' && !sameNote
    ? { ...item, tabs: [{ kind: 'note', path: 'B.md' }] } : item) })
}

describe('App pane integration', () => {
  it('keeps history out of an inactive property inventory', async () => {
    twoPanes()
    notes.push({ path: '50_履歴/History.md', name: 'History', content: '---\nhistory_only: old\n---\n', modifiedAt: 1, size: 29 })
    notes[0].content = '---\nvisible_property: current\n---\n'
    savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, panes: savedWorkspace.panes.map(item => item.id === 'pane-1'
      ? { ...item, tabs: [{ kind: 'global-properties' }], activeIndex: 0 } : item) })
    render(<App />)
    await ready()
    const inactive = within(pane('pane-1'))
    expect(inactive.getByText('visible_property')).toBeTruthy()
    expect(inactive.queryByText('history_only')).toBeNull()
    expect(pane('pane-2').classList.contains('is-active')).toBe(true)
  })

  it('focuses inactive tabs without switching panes and closes only the requested inactive tab', async () => {
    twoPanes()
    savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, panes: savedWorkspace.panes.map(item => item.id === 'pane-1'
      ? { ...item, tabs: [{ kind: 'note', path: 'A.md' }, { kind: 'note', path: 'C.md' }] } : item) })
    render(<App />)
    await ready()
    const tabs = within(pane('pane-1'))
    fireEvent.focus(tabs.getByRole('tab', { name: 'A' }))
    fireEvent.keyDown(tabs.getByRole('tab', { name: 'A' }), { key: 'End' })
    expect(document.activeElement).toBe(tabs.getByRole('tab', { name: 'C' }))
    expect(pane('pane-2').classList.contains('is-active')).toBe(true)
    const close = tabs.getByRole('button', { name: 'Aを閉じる' })
    fireEvent.pointerDown(close)
    fireEvent.focus(close)
    fireEvent.click(close)
    await waitFor(() => expect(tabs.queryByRole('tab', { name: 'A' })).toBeNull())
    expect(pane('pane-2').classList.contains('is-active')).toBe(true)
    expect(within(pane('pane-2')).getByRole('tab', { name: 'B' })).toBeTruthy()
    fireEvent.keyDown(tabs.getByRole('tab', { name: 'C' }), { key: 'Enter' })
    await waitFor(() => expect(pane('pane-1').classList.contains('is-active')).toBe(true))
    await waitFor(() => expect(document.activeElement).toBe(within(pane('pane-1')).getByRole('tab', { name: 'C' })))
  })
  it('retains an inactive tab and both drafts when the active save fails during closing', async () => {
    twoPanes()
    vi.mocked(api.saveNote).mockResolvedValue({ ok: false, error: { code: 'SAVE_FAILED', message: '保存できません。' } })
    render(<App />)
    await ready()
    fireEvent.change(within(pane('pane-2')).getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: '未保存のB' } })
    fireEvent.click(within(pane('pane-1')).getByRole('button', { name: 'Aを閉じる' }))
    await screen.findByText('保存できません。')
    expect(within(pane('pane-1')).getByRole('tab', { name: 'A' })).toBeTruthy()
    expect(pane('pane-2').classList.contains('is-active')).toBe(true)
    expect((within(pane('pane-2')).getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('未保存のB')
  })
  it('keeps the toolbar hidden and allows operations from an inactive pane menu', async () => {
    twoPanes()
    render(<App />)
    await ready()
    expect(screen.queryByRole('menuitem')).toBeNull()
    expect(document.querySelector('.pane-actions')).toBeNull()
    const path = document.querySelector<HTMLDetailsElement>('.note-path-details')!
    expect(path.open).toBe(false)
    fireEvent.click(path.querySelector('summary')!)
    expect(path.open).toBe(true)
    fireEvent.click(within(pane('pane-1')).getByRole('button', { name: 'ペイン操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'ペインを閉じる' }))
    await waitFor(() => expect(panes()).toHaveLength(1))
    expect(pane('pane-2')).toBeTruthy()
  })
  it('finishes an inactive autosave without a second write when its pane regains focus during the save', async () => {
    twoPanes()
    savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, activePaneId: 'pane-1' })
    let finishSave!: (value: Result<{ path: string; modifiedAt: number; size: number }>) => void
    vi.mocked(api.saveNote).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve }))
    render(<App />)
    await ready()
    fireEvent.change(within(pane('pane-1')).getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: 'Aの保存した下書き' } })
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-2').classList.contains('is-active')).toBe(true))
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(1), { timeout: 2000 })
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-1').classList.contains('is-active')).toBe(true))
    await act(async () => { finishSave({ ok: true, value: { path: 'A.md', modifiedAt: 11, size: 25 } }) })
    fireEvent.click(paneAction('ペインを閉じる'))
    await waitFor(() => expect(panes()).toHaveLength(1))
    expect(api.saveNote).toHaveBeenCalledTimes(1)
  })

  it('keeps a pending autosave result scoped to its note when another pane becomes active', async () => {
    twoPanes()
    savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, activePaneId: 'pane-1' })
    let finishSave!: (value: Result<{ path: string; modifiedAt: number; size: number }>) => void
    vi.mocked(api.saveNote).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve }))
    render(<App />)
    await ready()
    fireEvent.change(within(pane('pane-1')).getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: 'Aの保存中下書き' } })
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(1), { timeout: 2000 })
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-2').classList.contains('is-active')).toBe(true))
    await act(async () => { finishSave({ ok: true, value: { path: 'A.md', modifiedAt: 10, size: 20 } }) })
    fireEvent.change(within(pane('pane-2')).getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: 'Bの別の下書き' } })
    fireEvent.click(paneAction('ペインを閉じる'))
    await waitFor(() => expect(vi.mocked(api.saveNote).mock.calls.some(([input]) => input.path === 'B.md')).toBe(true))
    const savedB = vi.mocked(api.saveNote).mock.calls.find(([input]) => input.path === 'B.md')![0]
    expect(savedB.expectedContent).toBe('Bの本文')
    expect(savedB.expectedModifiedAt).toBe(2)
  })

  it('restores conflict resolution controls for an inactive draft whose save detects an external change', async () => {
    twoPanes()
    savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, activePaneId: 'pane-1' })
    vi.mocked(api.saveNote).mockResolvedValue({ ok: false, error: { code: 'FILE_CHANGED', message: '外部変更があります。', currentContent: 'Aの外部版', currentModifiedAt: 50 } })
    render(<App />)
    await ready()
    fireEvent.change(within(pane('pane-1')).getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: 'Aの保持した下書き' } })
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-2').classList.contains('is-active')).toBe(true))
    await waitFor(() => expect(api.saveNote).toHaveBeenCalled(), { timeout: 2000 })
    await screen.findByText(/外部変更があります。/)
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-1').classList.contains('is-active')).toBe(true))
    expect(screen.getByRole('button', { name: '外部版を読み込む' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '編集中の内容を保持' })).toBeTruthy()
    expect((within(pane('pane-1')).getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('Aの保持した下書き')
  })

  it('splits the real workspace to eight panes, focuses another pane and persists the complete V2 layout', async () => {
    render(<App />)
    await ready()
    for (let count = 2; count <= 8; count++) {
      fireEvent.click(paneAction(count % 2 ? '上下に分割' : '左右に分割'))
      await waitFor(() => expect(panes()).toHaveLength(count))
      await waitFor(() => expect((paneAction('ペインを閉じる') as HTMLButtonElement).disabled).toBe(false))
    }
    expect((paneAction('左右に分割') as HTMLButtonElement).disabled).toBe(true)
    expect((paneAction('上下に分割') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByRole('textbox', { name: 'Markdown編集欄' })).toHaveLength(1)
    fireEvent.focus(within(pane('pane-1')).getByRole('textbox', { name: 'Markdown編集欄' }))
    await waitFor(() => expect(pane('pane-1').classList.contains('is-active')).toBe(true))
    await waitFor(() => expect(api.saveLastWorkspaceSession).toHaveBeenCalled(), { timeout: 2000 })
    const restored = vi.mocked(api.saveLastWorkspaceSession).mock.calls.at(-1)![1] as WorkspaceSnapshotV2
    expect(restored.panes).toHaveLength(8)
    expect(restored.activePaneId).toBe('pane-1')
    expect(restored.panes.flatMap(item => item.tabs)).toHaveLength(8)
  })

  it('moves the active tab into another pane and retains the source pane tabs', async () => {
    twoPanes()
    savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, activePaneId: 'pane-1', panes: savedWorkspace.panes.map(item => item.id === 'pane-1'
      ? { ...item, tabs: [{ kind: 'note', path: 'A.md' }, { kind: 'note', path: 'C.md' }] } : item) })
    render(<App />)
    await ready()
    fireEvent.click(paneAction('タブをペイン 2へ移す'))
    await waitFor(() => expect(pane('pane-2').classList.contains('is-active')).toBe(true))
    expect(within(pane('pane-1')).getByRole('tab', { name: 'C', exact: true })).toBeTruthy()
    await waitFor(() => expect(api.saveLastWorkspaceSession).toHaveBeenCalled(), { timeout: 2000 })
    const saved = vi.mocked(api.saveLastWorkspaceSession).mock.calls.at(-1)![1] as WorkspaceSnapshotV2
    expect(saved.panes[0].tabs).toEqual([{ kind: 'note', path: 'C.md' }])
    expect(saved.panes[1].tabs).toEqual([{ kind: 'note', path: 'B.md' }, { kind: 'note', path: 'A.md' }])
    expect(saved.tabs).toEqual(saved.panes[1].tabs)
  })

  it('blocks pane closing, splitting and tab movement when the active draft cannot be saved', async () => {
    twoPanes()
    vi.mocked(api.saveNote).mockResolvedValue({ ok: false, error: { code: 'SAVE_FAILED', message: '保存できません。' } })
    render(<App />)
    await ready()
    fireEvent.change(within(pane('pane-2')).getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: 'Bの未保存下書き' } })
    for (const name of ['ペインを閉じる', '左右に分割']) {
      fireEvent.click(paneAction(name))
      await screen.findByText('保存できません。')
      await waitFor(() => expect((paneAction(name) as HTMLButtonElement).disabled).toBe(false))
      expect(panes()).toHaveLength(2)
    }
    fireEvent.click(paneAction('タブをペイン 1へ移す'))
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(3))
    expect(panes()).toHaveLength(2)
    expect(pane('pane-2').classList.contains('is-active')).toBe(true)
    expect((within(pane('pane-2')).getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('Bの未保存下書き')
    expect(notes[1].content).toBe('Bの本文')
  })

  it('shares the same-note draft across panes with a single editor and restores it when focus returns', async () => {
    twoPanes(true)
    render(<App />)
    await ready()
    expect(screen.getAllByRole('textbox', { name: 'Markdown編集欄' })).toHaveLength(1)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Markdown編集欄' }))
    await waitFor(() => expect(pane('pane-1').classList.contains('is-active')).toBe(true))
    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown編集欄' }), { target: { value: '同じノートの共有下書き' } })
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-2').classList.contains('is-active')).toBe(true))
    expect(within(pane('pane-2')).getByText('同じノートの共有下書き')).toBeTruthy()
    expect(screen.getAllByRole('textbox', { name: 'Markdown編集欄' })).toHaveLength(1)
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-1').classList.contains('is-active')).toBe(true))
    expect((screen.getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('同じノートの共有下書き')
  })

  it('restores V2 sidebar widths and persists keyboard changes with both pane states', async () => {
    twoPanes()
    savedWorkspace = { ...savedWorkspace, left: { ...savedWorkspace.left, width: 120 }, right: { ...savedWorkspace.right, width: 640 } }
    render(<App />)
    await ready()
    const left = screen.getByRole('separator', { name: '左サイドバーの幅を調整' })
    const right = screen.getByRole('separator', { name: '右サイドバーの幅を調整' })
    expect(left.getAttribute('aria-valuenow')).toBe('120')
    expect(right.getAttribute('aria-valuenow')).toBe('640')
    fireEvent.keyDown(left, { key: 'ArrowRight' })
    fireEvent.keyDown(right, { key: 'ArrowRight' })
    await waitFor(() => expect(api.saveLastWorkspaceSession).toHaveBeenCalled(), { timeout: 2000 })
    const saved = vi.mocked(api.saveLastWorkspaceSession).mock.calls.at(-1)![1] as WorkspaceSnapshotV2
    expect(saved.left.width).toBe(136)
    expect(saved.right.width).toBe(624)
    expect(saved.panes).toHaveLength(2)
  })

  it('restores and checkpoints each actual preview scroll position across pane activation', async () => {
    twoPanes()
    savedWorkspace = projectWorkspaceSnapshotV2({ ...savedWorkspace, panes: savedWorkspace.panes.map((item, index) => ({ ...item,
      noteView: 'preview', scroll: { top: index ? 130 : 70, left: index ? 5 : 3 } })) })
    render(<App />)
    await ready()
    expect(within(pane('pane-1')).getByRole('article').scrollTop).toBe(70)
    const activePreview = within(pane('pane-2')).getByRole('article')
    expect(activePreview.scrollTop).toBe(130)
    activePreview.scrollTop = 222
    activePreview.scrollLeft = 9
    fireEvent.scroll(activePreview)
    expect(activePreview.scrollTop).toBe(222)
    fireEvent.click(paneAction('次のペイン'))
    await waitFor(() => expect(pane('pane-1').classList.contains('is-active')).toBe(true))
    expect(within(pane('pane-1')).getByRole('article').scrollTop).toBe(70)
    expect(within(pane('pane-2')).getByRole('article').scrollTop).toBe(222)
    await waitFor(() => expect(api.saveLastWorkspaceSession).toHaveBeenCalled(), { timeout: 2000 })
    const saved = vi.mocked(api.saveLastWorkspaceSession).mock.calls.at(-1)![1] as WorkspaceSnapshotV2
    expect(saved.panes[1].scroll).toEqual({ top: 222, left: 9 })
  })
})
