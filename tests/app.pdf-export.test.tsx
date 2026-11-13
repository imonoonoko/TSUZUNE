// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/App'
import { EditorView } from '@codemirror/view'
import type { Result, TsuzuneApi, VaultSnapshot } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'

let api: TsuzuneApi
let requestClose: (() => void) | undefined
const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
const board = { path: 'Board.canvas', content: '{"nodes":[],"edges":[]}', modifiedAt: 10, revision: 'a'.repeat(64) }
beforeEach(() => {
  const snapshot: VaultSnapshot = { rootPath: 'C:\\Vault', rootName: 'Vault', directories: [''], attachments: [],
    notes: [{ path: 'A.md', name: 'A', content: 'Before. Selected text. After.', modifiedAt: 1, size: 28 }] }
  api = {
    exportNotePdf: vi.fn(() => ok({ canceled: true })),
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
    onRequestClose: vi.fn(callback => { requestClose = callback; return () => undefined }), confirmClose: vi.fn(),
    listCanvases: vi.fn(() => ok(['Board.canvas'])), readCanvas: vi.fn(() => ok({ ...board })),
    createCanvas: vi.fn(input => ok({ ...board, path: input.path, content: input.content })),
    saveCanvas: vi.fn(input => ok({ ...board, content: input.content, revision: 'b'.repeat(64) })),
    saveNote: vi.fn(input => ok({ path: input.path, modifiedAt: 2, size: input.content.length })), previewNoteCompose: vi.fn(input => ok({ fingerprint: 'proof', sourcePath: 'A.md', targetPath: input.targetPath, updatedLinkCount: 0, changes: [{ path: 'A.md', kind: 'update', before: input.expectedSourceContent, after: '[[Target]]' }] })), applyNoteCompose: vi.fn(() => ok({ path: 'Target.md', changedPaths: ['A.md', 'Target.md'] })), readVaultImage: vi.fn(() => ok('data:image/png;base64,'))
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('App PDF export integration', () => {
  it('captures unsaved editor text, keeps the workspace inert, and guards closing the app until the dialog closes', async () => {
    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name:'編集', exact:true }))
    const view=EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    await act(async()=>{ view.dispatch({changes:{from:view.state.doc.length,insert:' Draft captured.'}}) })
    const opener=screen.getByRole('button',{name:'PDF書き出し'})
    fireEvent.click(opener)
    const dialog=await screen.findByRole('dialog',{name:'PDF書き出し'})
    expect(opener.closest('[inert]')).not.toBeNull()
    expect(document.querySelector('.pdf-export-root')?.textContent).toContain('Draft captured.')
    await act(async()=>{ view.dispatch({changes:{from:view.state.doc.length,insert:' Later edit.'}}) })
    expect(document.querySelector('.pdf-export-root')?.textContent).not.toContain('Later edit.')
    await act(async()=>{ requestClose?.() })
    expect(api.confirmClose).toHaveBeenCalledWith(false)
    fireEvent.click(within(dialog).getByRole('button',{name:'保存先を選んで書き出す'}))
    await waitFor(()=>expect(api.exportNotePdf).toHaveBeenCalledWith({suggestedName:'A.pdf',pageSize:'A4',landscape:false}))
    await within(dialog).findByText('保存をキャンセルしました。')
    fireEvent.click(within(dialog).getByRole('button',{name:'キャンセル'}))
    expect(document.querySelector('.pdf-export-root')).toBeNull()
    await waitFor(()=>expect(document.activeElement).toBe(opener))
    expect(view.state.doc.toString()).toContain('Later edit.')
  })
})
