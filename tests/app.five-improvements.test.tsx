// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDocument, Result, TsuzuneApi, VaultChangeEvent, VaultSnapshot } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'
import { DEFAULT_HOTKEYS, type HotkeySettings } from '../src/shared/hotkeys'
import { transformProperty } from '../src/core/property-changes'
import App from '../src/renderer/App'

vi.mock('../src/renderer/base-worker-client', async () => {
  const core = await import('../src/core/base-evaluator')
  return { evaluateBaseInWorker: vi.fn((...args: Parameters<typeof core.evaluateBase>) => Promise.resolve(core.evaluateBase(...args))) }
})

const baseContent = 'filters:\n  and:\n    - file.ext == "md"\nviews:\n  - type: table\n    name: Priorities\n    order:\n      - file.name\n      - priority\n    sort:\n      - property: priority\n        direction: ASC\n'
const sourceNote = (path: string, priority: number): NoteDocument => {
  const content = `---\npriority: ${priority}\n---\n# ${path}\n`
  return { path, name: path.slice(0, -3), content, modifiedAt: priority * 100, size: content.length }
}

let notes: NoteDocument[]
let vaultChanged: ((event: VaultChangeEvent) => void) | null
let api: TsuzuneApi
let persistedHotkeys: HotkeySettings
let baseProfile = baseContent

const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
const snapshot = (): VaultSnapshot => ({ rootPath: 'C:\\Vault', rootName: 'Vault', directories: ['', 'views'], notes: [...notes] })

vi.mock('../src/renderer/components/MarkdownEditor', async () => {
  const ReactApi = await import('react')
  return { default: ReactApi.forwardRef(function MockMarkdownEditor({ value, onChange, onCompositionChange, readOnly }: { value: string; onChange: (value: string) => void; onCompositionChange?: (composing: boolean) => void; readOnly?: boolean }, ref: React.ForwardedRef<{ scrollToOffset: (offset: number) => void }>) {
    const input = ReactApi.useRef<HTMLTextAreaElement | null>(null)
    ReactApi.useImperativeHandle(ref, () => ({ scrollToOffset: (offset) => { input.current?.setSelectionRange(offset, offset); input.current?.focus() } }), [])
    return ReactApi.createElement('textarea', { ref: input, 'aria-label': 'Markdown編集欄', value, readOnly, onCompositionStart: () => onCompositionChange?.(true), onCompositionEnd: () => onCompositionChange?.(false), onChange: readOnly ? undefined : (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value) })
  }) }
})

beforeEach(() => {
  notes = [sourceNote('A.md', 1), sourceNote('B.md', 2), sourceNote('C.md', 3)]
  vaultChanged = null
  baseProfile = baseContent
  persistedHotkeys = DEFAULT_HOTKEYS.map((item) => ({ ...item }))
  api = {
    openLastVault: vi.fn(() => ok(snapshot())),
    getSettings: vi.fn(() => ok({ lastVaultPath: 'C:\\Vault', lastNotePath: 'A.md', userIgnoreFilters: [], graphForces: DEFAULT_GRAPH_FORCE_SETTINGS, graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS, graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS, graphGroups: DEFAULT_GRAPH_GROUPS, graphViewStates: DEFAULT_GRAPH_VIEW_STATES, hotkeys: persistedHotkeys })),
    getWorkspaces: vi.fn(() => ok({ scope: { rootPath: 'C:\\Vault', rootRevision: 1 }, state: { version: 1 as const, lastSession: null, named: [] } })),
    saveLastWorkspaceSession: vi.fn(() => ok(null)),
    getSnapshot: vi.fn(() => ok(snapshot())),
    readNote: vi.fn((path) => { const found = notes.find((item) => item.path === path); return found ? ok({ ...found }) : Promise.resolve({ ok: false as const, error: { code: 'NOT_FOUND' as const, message: '見つかりません' } }) }),
    readBase: vi.fn((path) => ok({ path, content: baseProfile, modifiedAt: 1 })),
    listBases: vi.fn(() => ok(['views/priorities.base'])),
    getPropertyTypes: vi.fn(() => ok({})),
    setPropertyTypes: vi.fn(() => ok(null)),
    previewPropertyChanges: vi.fn((input) => ok({ items: input.paths.map((path) => {
      const note = notes.find((item) => item.path === path)!
      const result = transformProperty(note.content, input.operation)
      return result.ok ? { path, expectedRevision: `${note.modifiedAt}:${note.content.length}`, before: result.before, after: result.after, changed: result.markdown !== note.content } : { path, expectedRevision: null, before: null, after: null, changed: false, issue: result.issue }
    }) })),
    applyPropertyChanges: vi.fn((input) => {
      const saved: string[] = []
      for (const target of input.targets) {
        const index = notes.findIndex((item) => item.path === target.path)
        if (index < 0) continue
        const result = transformProperty(notes[index].content, input.operation)
        if (!result.ok) continue
        notes[index] = { ...notes[index], content: result.markdown, modifiedAt: notes[index].modifiedAt + 1, size: result.markdown.length }
        saved.push(target.path)
      }
      return ok({ saved, unchanged: [], failed: [], notAttempted: [] })
    }),
    saveNote: vi.fn((input) => ok({ path: input.path, modifiedAt: input.expectedModifiedAt + 1, size: input.content.length })),
    setHotkeys: vi.fn((value) => { persistedHotkeys = value; return ok(null) }),
    setLastNote: vi.fn(() => ok(null)),
    getUpdateStatus: vi.fn(() => ok({ phase: 'idle' as const, currentVersion: '0.6.0', availableVersion: null, downloadPercent: null, message: null })),
    getMoveRecovery: vi.fn(() => ok({ status: 'clean' as const })),
    getCalendarPluginStatus: vi.fn(() => ok({ state: 'missing' as const, id: 'calendar' as const, version: '1.5.10' as const, mainSha256: '', manifestSha256: '', reason: null })),
    listObsidianPluginCandidates: vi.fn(() => ok([])),
    onVaultChanged: vi.fn((callback) => { vaultChanged = callback; return () => { vaultChanged = null } }),
    onRequestClose: vi.fn(() => () => undefined),
    onUpdateStatus: vi.fn(() => () => undefined)
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})

afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openBase(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Baseを開く' }))
  const dialog = await screen.findByRole('dialog', { name: 'Baseを開く' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'パスを入力して開く' }))
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'views/priorities.base' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '開く', exact: true }))
  await screen.findByRole('tab', { name: 'priorities.base' })
  await screen.findByRole('table')
}

function orderedPaths(table: HTMLElement): string[] {
  return [...table.querySelectorAll('tbody tr')].map((row) => within(row as HTMLElement).getByRole('button', { name: /を開く$/ }).getAttribute('aria-label')!.replace(/を開く$/, ''))
}

describe('App five improvements', () => {
  it('previews and applies a Bases cell edit, refreshes its snapshot, and re-sorts rows', async () => {
    render(<App />)
    await openBase()
    const table = screen.getByRole('table')
    expect(orderedPaths(table)).toEqual(['A.md', 'B.md', 'C.md'])
    fireEvent.click(screen.getByRole('button', { name: 'A.mdのpriorityを編集' }))
    const dialog = await screen.findByRole('dialog', { name: 'Property変更' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '設定値' }), { target: { value: '9' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '変更をプレビュー' }))
    await within(dialog).findByText('変更後: 9')
    fireEvent.click(within(dialog).getByRole('button', { name: '変更を保存' }))
    await waitFor(() => expect(orderedPaths(screen.getByRole('table'))).toEqual(['B.md', 'C.md', 'A.md']))
    expect(vi.mocked(api.previewPropertyChanges)).toHaveBeenCalledWith(expect.objectContaining({ paths: ['A.md'], operation: { kind: 'set', property: 'priority', value: { type: 'number', value: '9' } } }))
    expect(vi.mocked(api.applyPropertyChanges).mock.calls[0][0].targets).toEqual([{ path: 'A.md', expectedRevision: expect.stringMatching(/^100:/) }])
    expect(notes[0].content).toContain('priority: 9')
  })

  it('persists a custom note-open key, stops the former default, ignores composing/repeat, and restores defaults', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '設定' }))
    const dialog = await screen.findByRole('dialog', { name: '設定' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'ショートカット' }))
    const openKey = await within(dialog).findByRole('button', { name: 'ノートを開くのキー' })
    fireEvent.click(openKey)
    fireEvent.keyDown(openKey, { key: 'q', ctrlKey: true })
    await waitFor(() => expect(api.setHotkeys).toHaveBeenCalled())
    expect(persistedHotkeys.find((item) => item.command === 'open-note' && item.ctrl)).toMatchObject({ key: 'q', ctrl: true })
    fireEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }))
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })
    expect(screen.queryByRole('dialog', { name: 'ノートを開く' })).toBeNull()
    fireEvent.keyDown(window, { key: 'q', ctrlKey: true, isComposing: true })
    fireEvent.keyDown(window, { key: 'q', ctrlKey: true, repeat: true })
    expect(screen.queryByRole('dialog', { name: 'ノートを開く' })).toBeNull()
    fireEvent.keyDown(window, { key: 'q', ctrlKey: true })
    expect(await screen.findByRole('dialog', { name: 'ノートを開く' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    const settings = await screen.findByRole('dialog', { name: '設定' })
    fireEvent.click(within(settings).getByRole('button', { name: 'ショートカット' }))
    fireEvent.click(within(settings).getByRole('button', { name: '既定に戻す' }))
    await waitFor(() => expect(persistedHotkeys).toEqual(DEFAULT_HOTKEYS))
  })

  it('shows a selected bulk preview issue and never calls apply for that invalid selection', async () => {
    vi.mocked(api.previewPropertyChanges).mockImplementationOnce((input) => ok({ items: input.paths.map((path) => ({ path, expectedRevision: null, before: null, after: null, changed: false, issue: { code: 'UNSAFE', message: '変換できません' } })) }))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'プロパティ一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'priorityのサンプルを表示' }))
    fireEvent.click(screen.getByRole('button', { name: 'priorityを管理' }))
    const dialog = await screen.findByRole('dialog', { name: 'Property変更' })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'A.mdを対象にする' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '変更をプレビュー' }))
    await within(dialog).findByText('変換できません')
    expect((within(dialog).getByRole('button', { name: '変更を保存' }) as HTMLButtonElement).disabled).toBe(true)
    expect(api.applyPropertyChanges).not.toHaveBeenCalled()
  })

  it('navigates a relative Japanese and space path fragment and retains focus on its H2 after rendering', async () => {
    vi.mocked(api.getWorkspaces).mockReturnValue(ok({
      scope: { rootPath: 'C:\\Vault', rootRevision: 1 },
      state: { version: 1, lastSession: {
        tabs: [{ kind: 'note', path: 'A.md' }], activeIndex: 0, noteView: 'preview',
        left: { open: true, view: 'files', query: '' }, right: { open: true, view: 'outline' }
      }, named: [] }
    }))
    notes[0] = { ...notes[0], content: '[移動](./資料/日本語%20ノート.md#対象-見出し)' }
    const destination: NoteDocument = {
      path: '資料/日本語 ノート.md',
      name: '日本語 ノート',
      content: '# 行き先\n\n## 対象 見出し\n\n本文',
      modifiedAt: 400,
      size: 40
    }
    notes.push(destination)

    render(<App />)
    const originTab = await screen.findByRole('tab', { name: 'A' })
    await waitFor(() => expect(originTab.getAttribute('aria-selected')).toBe('true'))
    const link = within(screen.getByRole('article', { name: 'Markdownプレビュー' }))
      .getByRole('link', { name: '移動' })
    fireEvent.click(link.closest('.note-link-preview-anchor')!.querySelector('a')!)

    await screen.findByRole('tab', { name: '日本語 ノート' })
    await screen.findByRole('heading', { name: '対象 見出し', level: 2 })
    await waitFor(() => expect(document.activeElement).toMatchObject({ tagName: 'H2', textContent: '対象 見出し' }))
  })

  it('keeps an unsaved same-note fragment navigation blocked when saving fails', async () => {
    vi.mocked(api.getWorkspaces).mockReturnValue(ok({
      scope: { rootPath: 'C:\\Vault', rootRevision: 1 },
      state: { version: 1, lastSession: {
        tabs: [{ kind: 'note', path: 'A.md' }], activeIndex: 0, noteView: 'preview',
        left: { open: true, view: 'files', query: '' }, right: { open: true, view: 'outline' }
      }, named: [] }
    }))
    notes[0] = { ...notes[0], content: '# A\n\n[移動](#target-section)\n\n## Target Section\n' }
    vi.mocked(api.saveNote).mockResolvedValue({
      ok: false,
      error: { code: 'SAVE_FAILED', message: '保存できません。' }
    })

    render(<App />)
    const tab = await screen.findByRole('tab', { name: 'A' })
    await waitFor(() => expect(tab.getAttribute('aria-selected')).toBe('true'))
    fireEvent.click(await screen.findByRole('button', { name: '編集', exact: true }))
    const editor = await screen.findByRole('textbox', { name: 'Markdown編集欄' })
    const draft = '# A\n\n[移動](#target-section)\n\n## Target Section\n\n編集中の追記'
    fireEvent.change(editor, { target: { value: draft } })
    fireEvent.click(screen.getByRole('button', { name: 'プレビュー' }))

    const link = await screen.findByRole('link', { name: '移動' })
    fireEvent.click(link.closest('.note-link-preview-anchor')!.querySelector('a')!)

    await screen.findByText('保存できません。')
    expect(api.saveNote).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.saveNote).mock.calls[0][0].content).toBe(draft)
    expect(notes[0].content).not.toBe(draft)
    expect(tab.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).not.toMatchObject({ tagName: 'H2', textContent: 'Target Section' })

    fireEvent.click(screen.getByRole('button', { name: '編集', exact: true }))
    expect((await screen.findByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe(draft)
  })
})
