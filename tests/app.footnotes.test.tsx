// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../src/renderer/App'
import type { NoteDocument, Result, TsuzuneApi, VaultSnapshot } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'

const editorCalls = vi.hoisted(() => ({ edit: vi.fn(), select: vi.fn() }))
vi.mock('../src/renderer/components/MarkdownEditor', async () => {
  const ReactApi = await import('react')
  return { default: ReactApi.forwardRef(function MockEditor({ value, onChange, readOnly, onCompositionChange }: {
    value: string; onChange: (value: string) => void; readOnly?: boolean; onCompositionChange?: (value: boolean) => void
  }, ref) {
    const input = ReactApi.useRef<HTMLTextAreaElement>(null)
    ReactApi.useImperativeHandle(ref, () => ({
      scrollToOffset: (offset: number) => input.current?.setSelectionRange(offset, offset),
      selectSourceRange: (source: string, from: number, to: number) => {
        editorCalls.select(source, from, to)
        if (source !== value) return false
        input.current?.setSelectionRange(from, to)
        input.current?.focus()
        return true
      },
      editFootnote: (source: string, from: number, replacement: string) => {
        editorCalls.edit(source, from, replacement)
        if (readOnly || source !== value) return '本文が変更されています。'
        const end = source.indexOf('\n\n', from)
        const next = source.slice(0, from) + replacement + source.slice(end < 0 ? source.length : end)
        onChange(next)
        return null
      }
    }), [value, readOnly, onChange])
    return <textarea ref={input} aria-label="Markdown編集欄" value={value} readOnly={readOnly}
      onChange={event => onChange(event.target.value)}
      onCompositionStart={() => onCompositionChange?.(true)} onCompositionEnd={() => onCompositionChange?.(false)} />
  }) }
})

const source = '# A\n\n本文[^one]、もう一度[^one]。\n\n[^one]: 元の定義\n\n後文\n'
let notes: NoteDocument[]
let api: TsuzuneApi
const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  editorCalls.edit.mockReset(); editorCalls.select.mockReset()
  notes = [{ path: 'A.md', name: 'A', content: source, modifiedAt: 1, size: source.length }]
  const snapshot = (): VaultSnapshot => ({ rootPath: 'C:\\Vault', rootName: 'Vault', directories: [''], notes: [...notes] })
  api = {
    openLastVault: vi.fn(() => ok(snapshot())), getSnapshot: vi.fn(() => ok(snapshot())),
    getSettings: vi.fn(() => ok({ lastVaultPath: 'C:\\Vault', lastNotePath: 'A.md', userIgnoreFilters: [],
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS, graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS, graphGroups: DEFAULT_GRAPH_GROUPS, graphViewStates: DEFAULT_GRAPH_VIEW_STATES })),
    getWorkspaces: vi.fn(() => ok({ scope: { rootPath: 'C:\\Vault', rootRevision: 1 }, state: { version: 1, lastSession: null, named: [] } })),
    saveLastWorkspaceSession: vi.fn(() => ok(null)), setLastNote: vi.fn(() => ok(null)),
    readNote: vi.fn(path => ok({ ...notes.find(note => note.path === path)! })),
    saveNote: vi.fn(input => ok({ path: input.path, modifiedAt: input.expectedModifiedAt + 1, size: input.content.length })),
    getMoveRecovery: vi.fn(() => ok({ status: 'clean' })),
    getCalendarPluginStatus: vi.fn(() => ok({ state: 'missing', id: 'calendar', version: '1.5.10', mainSha256: '', manifestSha256: '', reason: null })),
    listObsidianPluginCandidates: vi.fn(() => ok([])),
    getUpdateStatus: vi.fn(() => ok({ phase: 'idle', currentVersion: '0.6.0', availableVersion: null, downloadPercent: null, message: null })),
    onVaultChanged: vi.fn(() => () => undefined), onUpdateStatus: vi.fn(() => () => undefined), onRequestClose: vi.fn(() => () => undefined)
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openFootnotes(): Promise<void> {
  fireEvent.click(await screen.findByRole('tab', { name: /^脚注 \d+件$/ }))
}

it('lists definitions and reference positions from the current unsaved editor source', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '編集', exact: true }))
  const editor = await screen.findByRole('textbox', { name: 'Markdown編集欄' })
  const draft = source + '\n新しい本文[^two]\n\n[^two]: 未保存の脚注\n'
  fireEvent.change(editor, { target: { value: draft } })
  await openFootnotes()
  expect(screen.getByRole('tab', { name: '脚注 2件' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '脚注 two を編集' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '脚注 one の参照 2へ移動' }))
  expect(editorCalls.select).toHaveBeenLastCalledWith(draft, draft.indexOf('[^one]', draft.indexOf('[^one]') + 1), expect.any(Number))
  expect(notes[0].content).toBe(source)
})

it('disables editing in Preview and selects its definition after switching to Edit without a save', async () => {
  render(<App />)
  await openFootnotes()
  expect((screen.getByRole('button', { name: '脚注 one を編集' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '脚注 one の定義へ移動' }))
  const editor = await screen.findByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement
  await waitFor(() => expect(editorCalls.select).toHaveBeenCalledWith(source, source.indexOf('[^one]:'), expect.any(Number)))
  expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toContain('[^one]: 元の定義')
  expect(document.activeElement).toBe(editor)
  expect(editorCalls.edit).not.toHaveBeenCalled()
  expect(api.saveNote).not.toHaveBeenCalled()
})

it('cancels without changes, then applies the definition through the editor with the current source', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '編集', exact: true }))
  await openFootnotes()
  fireEvent.click(screen.getByRole('button', { name: '脚注 one を編集' }))
  let dialog = await screen.findByRole('dialog', { name: '脚注を編集' })
  fireEvent.change(within(dialog).getByRole('textbox', { name: '脚注の定義（Markdown）' }), { target: { value: '[^one]: キャンセルする入力' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }))
  expect(editorCalls.edit).not.toHaveBeenCalled()
  expect((screen.getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe(source)
  fireEvent.click(screen.getByRole('button', { name: '脚注 one を編集' }))
  dialog = await screen.findByRole('dialog', { name: '脚注を編集' })
  const replacement = '[^one]: 更新した定義'
  fireEvent.change(within(dialog).getByRole('textbox', { name: '脚注の定義（Markdown）' }), { target: { value: replacement } })
  fireEvent.click(within(dialog).getByRole('button', { name: '脚注を適用' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '脚注を編集' })).toBeNull())
  expect(editorCalls.edit).toHaveBeenCalledExactlyOnceWith(source, source.indexOf('[^one]:'), replacement)
  const updated = source.replace('[^one]: 元の定義', replacement)
  expect((screen.getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe(updated)
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  await waitFor(() => expect(api.saveNote).toHaveBeenCalledWith(expect.objectContaining({ path: 'A.md', content: updated })))
})

it('keeps IME composition from opening a competing footnote edit', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '編集', exact: true }))
  await openFootnotes()
  const editor = screen.getByRole('textbox', { name: 'Markdown編集欄' })
  fireEvent.compositionStart(editor)
  const edit = screen.getByRole('button', { name: '脚注 one を編集' }) as HTMLButtonElement
  expect(edit.disabled).toBe(true)
  fireEvent.click(edit)
  expect(screen.queryByRole('dialog', { name: '脚注を編集' })).toBeNull()
  fireEvent.compositionEnd(editor)
  expect(edit.disabled).toBe(false)
  fireEvent.click(edit)
  expect(await screen.findByRole('dialog', { name: '脚注を編集' })).toBeTruthy()
  expect(editorCalls.edit).not.toHaveBeenCalled()
})
