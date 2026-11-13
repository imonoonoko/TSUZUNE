// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/App'
import type { Result, TsuzuneApi, VaultSnapshot } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'
import { evaluateBase } from '../src/core/base-evaluator'

vi.mock('../src/renderer/base-worker-client', () => ({ evaluateBaseInWorker: vi.fn(async (...args: Parameters<typeof evaluateBase>) => evaluateBase(...args)) }))

vi.mock('../src/renderer/components/MarkdownEditor', () => ({
  default: ({ value, onChange, readOnly }: { value: string; onChange(value: string): void; readOnly?: boolean }) =>
    <textarea aria-label="Markdown編集欄" value={value} readOnly={readOnly} onChange={readOnly ? undefined : event => onChange(event.target.value)} />
}))

let api: TsuzuneApi
const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
beforeEach(() => {
  const snapshot: VaultSnapshot = { rootPath: 'C:\\Vault', rootName: 'Vault', directories: [''], attachments: [],
    notes: [{ path: 'A.md', name: 'A', content: '# A', modifiedAt: 1, size: 3 }] }
  api = {
    getSettings: vi.fn(() => ok({ lastVaultPath: snapshot.rootPath, lastNotePath: 'A.md', userIgnoreFilters: [],
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS, graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS, graphGroups: DEFAULT_GRAPH_GROUPS, graphViewStates: DEFAULT_GRAPH_VIEW_STATES })),
    openLastVault: vi.fn(() => ok(snapshot)), getSnapshot: vi.fn(() => ok(snapshot)),
    getWorkspaces: vi.fn(() => ok({ scope: { rootPath: snapshot.rootPath, rootRevision: 1 }, state: { version: 1, lastSession: null, named: [] } })),
    saveLastWorkspaceSession: vi.fn(() => ok(null)), setLastNote: vi.fn(() => ok(null)),
    getMoveRecovery: vi.fn(() => ok({ status: 'clean' })),
    getCalendarPluginStatus: vi.fn(() => ok({ state: 'missing', id: 'calendar', version: '1.5.10', mainSha256: '', manifestSha256: '', reason: null })),
    listObsidianPluginCandidates: vi.fn(() => ok([])),
    getUpdateStatus: vi.fn(() => ok({ phase: 'idle', currentVersion: '0.5.0', availableVersion: null, downloadPercent: null, message: null })),
    onVaultChanged: vi.fn(() => () => undefined), onUpdateStatus: vi.fn(() => () => undefined),
    onRequestClose: vi.fn(() => () => undefined), confirmClose: vi.fn(),
    readNote: vi.fn(() => ok(snapshot.notes[0])),
    saveNote: vi.fn(input => ok({ path: input.path, modifiedAt: 2, size: input.content.length })), readVaultImage: vi.fn(() => ok('data:image/png;base64,'))
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('App Importer', () => {
  it('previews then imports without replacing or forcing a save of the current draft, and restores focus', async () => {
    const scope = { rootPath: 'C:\\Vault', rootRevision: 1 }
    const bytes = new TextEncoder().encode('# Imported')
    api.readImportSource = vi.fn(() => ok({ token: 'source', format: 'markdown', sourceName: 'Source', files: [{ path: 'Imported.md', bytes }], warnings: [] }))
    api.previewImport = vi.fn(() => ok({ planId: 'plan', folder: 'Imported', format: 'markdown', sourceName: 'Source', fileCount: 1, noteCount: 1, totalBytes: bytes.length, paths: ['Imported.md'], warnings: [], duplicateFolder: null, conflicts: [] }))
    api.discardImport = vi.fn(() => ok(null))
    api.applyImport = vi.fn(() => ok({ folder: 'Imported', fileCount: 1, noteCount: 1, snapshot: { rootPath: scope.rootPath, rootName: 'Vault', directories: ['', 'Imported'], attachments: [], notes: [{ path: 'A.md', name: 'A', content: '# A', modifiedAt: 1, size: 3 }, { path: 'Imported/Imported.md', name: 'Imported', content: '# Imported', modifiedAt: 2, size: 10 }] } }))
    render(<App />)
    const opener = await screen.findByRole('button', { name: '他アプリから取り込む' })
    const editButton = screen.getByRole('button', { name: '編集', exact: true })
    fireEvent.click(editButton)
    const editor = await screen.findByRole('textbox', { name: 'Markdown編集欄' })
    fireEvent.change(editor, { target: { value: '# My pending draft' } })
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: '他アプリから取り込む' })
    fireEvent.change(within(dialog).getByLabelText('取り込みフォルダー'), { target: { files: [new File(['# Imported'], 'Imported.md')] } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'プレビューを確認' }))
    await within(dialog).findByRole('region', { name: '取り込みプレビュー' })
    expect(api.applyImport).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: '取り込む', exact: true }))
    await within(dialog).findByText(/取り込みました/)
    expect(api.applyImport).toHaveBeenCalledWith({ scope, planId: 'plan' })
    expect(api.saveNote).not.toHaveBeenCalled()
    expect((editor as HTMLTextAreaElement).value).toBe('# My pending draft')
    fireEvent.click(within(dialog).getByRole('button', { name: '閉じる' }))
    await waitFor(() => expect(document.activeElement).toBe(opener))
    expect((screen.getByRole('textbox', { name: 'Markdown編集欄' }) as HTMLTextAreaElement).value).toBe('# My pending draft')
  })
})
