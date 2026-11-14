// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
let requestClose: (() => void) | undefined
const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
const board = { path: 'Board.canvas', content: '{"nodes":[],"edges":[]}', modifiedAt: 10, revision: 'a'.repeat(64) }
beforeEach(() => {
  const snapshot: VaultSnapshot = { rootPath: 'C:\\Vault', rootName: 'Vault', directories: [''], attachments: [],
    notes: [{ path: 'A.md', name: 'A', content: '# A', modifiedAt: 1, size: 3 }] }
  api = {
    getSettings: vi.fn(() => ok({ lastVaultPath: snapshot.rootPath, lastNotePath: 'A.md', userIgnoreFilters: [],
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS, graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS, graphGroups: DEFAULT_GRAPH_GROUPS, graphViewStates: DEFAULT_GRAPH_VIEW_STATES })),
    openLastVault: vi.fn(() => ok(snapshot)), getSnapshot: vi.fn(() => ok(snapshot)),
    getWorkspaces: vi.fn(() => ok({ scope: { rootPath: 'c:/vault', rootRevision: 1 }, state: { version: 1, lastSession: null, named: [] } })),
    saveLastWorkspaceSession: vi.fn(() => ok(null)), setLastNote: vi.fn(() => ok(null)),
    getMoveRecovery: vi.fn(() => ok({ status: 'clean' })),
    getCalendarPluginStatus: vi.fn(() => ok({ state: 'missing', id: 'calendar', version: '1.5.10', mainSha256: '', manifestSha256: '', reason: null })),
    listObsidianPluginCandidates: vi.fn(() => ok([])),
    getUpdateStatus: vi.fn(() => ok({ phase: 'idle', currentVersion: '0.5.0', availableVersion: null, downloadPercent: null, message: null })),
    onVaultChanged: vi.fn(() => () => undefined), onUpdateStatus: vi.fn(() => () => undefined),
    onRequestClose: vi.fn(callback => { requestClose = callback; return () => undefined }), confirmClose: vi.fn(),
    listCanvases: vi.fn(() => ok(['Board.canvas'])), listBases: vi.fn(() => ok([])), readCanvas: vi.fn(() => ok({ ...board })),
    createCanvas: vi.fn(input => ok({ ...board, path: input.path, content: input.content })),
    saveCanvas: vi.fn(input => ok({ ...board, content: input.content, revision: 'b'.repeat(64) })),
    readNote: vi.fn(() => ok(snapshot.notes[0])),
    saveNote: vi.fn(input => ok({ path: input.path, modifiedAt: 2, size: input.content.length })), readVaultImage: vi.fn(() => ok('data:image/png;base64,'))
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openBoard() {
  fireEvent.click(await screen.findByRole('button', { name: 'Canvasを開く' }))
  const dialog = await screen.findByRole('dialog', { name: 'Canvas' })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Canvasのパス' }), { target: { value: 'Board.canvas' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '開く', exact: true }))
  return screen.findByRole('region', { name: 'Canvasエディター' })
}

describe('App Canvas', () => {
  it('opens a Canvas and saves the draft before tab close', async () => {
    render(<App />)
    const editor = await openBoard()
    fireEvent.click(within(editor).getByRole('button', { name: 'テキストカードを追加' }))
    fireEvent.click(screen.getByRole('button', { name: 'Board.canvasを閉じる' }))
    await waitFor(() => expect(api.saveCanvas).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Board.canvas' })).toBeNull())
    const input = vi.mocked(api.saveCanvas).mock.calls[0][0]
    expect(input.expectedRevision).toBe(board.revision)
    expect(JSON.parse(input.content).nodes).toHaveLength(1)
  })

  it('makes the background inert while the Canvas picker is open', async () => {
    render(<App />)
    const opener = await screen.findByRole('button', { name: 'Canvasを開く' })
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Canvas' })
    expect(opener.closest('[inert]')).not.toBeNull()
    expect(dialog.closest('[inert]')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }))
    expect(opener.closest('[inert]')).toBeNull()
  })

  it('restores a Canvas tab from the saved workspace even though it is absent from Markdown notes', async () => {
    vi.mocked(api.getWorkspaces).mockImplementation(() => ok({
      scope: { rootPath: 'c:/vault', rootRevision: 1 },
      state: { version: 1, named: [], lastSession: {
        tabs: [{ kind: 'canvas', path: 'Board.canvas' }], activeIndex: 0, noteView: 'edit',
        left: { open: true, view: 'files', query: '' }, right: { open: false, view: 'links' }
      } }
    }))
    render(<App />)
    expect(await screen.findByRole('region', { name: 'Canvasエディター' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Board.canvas' })).toBeTruthy()
    expect(api.readCanvas).toHaveBeenCalledWith('Board.canvas', 'C:\\Vault')
  })

  it('keeps a conflicted Canvas open and refuses application close', async () => {
    vi.mocked(api.saveCanvas).mockResolvedValue({ ok: false, error: { code: 'FILE_CHANGED', message: '外部変更があります' } })
    render(<App />)
    const editor = await openBoard()
    fireEvent.click(within(editor).getByRole('button', { name: 'テキストカードを追加' }))
    fireEvent.click(screen.getByRole('button', { name: 'Board.canvasを閉じる' }))
    await waitFor(() => expect(api.saveCanvas).toHaveBeenCalled())
    expect(screen.getByRole('tab', { name: 'Board.canvas' })).toBeTruthy()
    expect(await screen.findByText('外部変更があります')).toBeTruthy()
    await act(async () => { requestClose?.() })
    await waitFor(() => expect(api.confirmClose).toHaveBeenLastCalledWith(false))
    expect(screen.getByRole('region', { name: 'Canvasエディター' })).toBeTruthy()
  })
})
