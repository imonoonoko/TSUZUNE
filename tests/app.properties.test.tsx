// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AppUpdateStatus,
  NoteDocument,
  Result,
  TsuzuneApi,
  VaultChangeEvent,
  VaultSnapshot
} from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'
import App from '../src/renderer/App'

const initialContent = '\uFEFF---\r\nkind: state\r\nstatus: active # keep this comment\r\n---\r\n\r\n# 本文\r\nコメント'
const note: NoteDocument = {
  path: 'A.md',
  name: 'A',
  content: initialContent,
  modifiedAt: 100,
  size: new TextEncoder().encode(initialContent).byteLength
}

let currentNote: NoteDocument
let vaultChanged: ((event: VaultChangeEvent) => void) | null
let api: TsuzuneApi

function ok<T>(value: T): Promise<Result<T>> {
  return Promise.resolve({ ok: true, value })
}

beforeEach(() => {
  currentNote = { ...note }
  vaultChanged = null
  const snapshot = (): VaultSnapshot => ({
    rootPath: 'C:\\Vault',
    rootName: 'Vault',
    directories: [''],
    notes: [currentNote]
  })
  api = {
    getSettings: vi.fn(() =>
      ok({
        lastVaultPath: 'C:\\Vault',
        lastNotePath: 'A.md',
        userIgnoreFilters: [],
        graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
        graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
        graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
        graphGroups: DEFAULT_GRAPH_GROUPS,
        graphViewStates: DEFAULT_GRAPH_VIEW_STATES
      })
    ),
    openLastVault: vi.fn(() => ok(snapshot())),
    getSnapshot: vi.fn(() => ok(snapshot())),
    readNote: vi.fn(() => ok({ ...currentNote })),
    saveNote: vi.fn((input) => {
      currentNote = {
        ...currentNote,
        content: input.content,
        modifiedAt: input.expectedModifiedAt + 1,
        size: new TextEncoder().encode(input.content).byteLength
      }
      return ok({ path: input.path, modifiedAt: currentNote.modifiedAt, size: currentNote.size })
    }),
    getMoveRecovery: vi.fn(() => ok({ status: 'clean' as const })),
    getCalendarPluginStatus: vi.fn(() =>
      ok({
        state: 'missing' as const,
        id: 'calendar' as const,
        version: '1.5.10' as const,
        mainSha256: '',
        manifestSha256: '',
        reason: null
      })
    ),
    listObsidianPluginCandidates: vi.fn(() => ok([])),
    setLastNote: vi.fn(() => ok(null)),
    getUpdateStatus: vi.fn(() =>
      ok<AppUpdateStatus>({
        phase: 'idle',
        currentVersion: '0.4.0',
        availableVersion: null,
        downloadPercent: null,
        message: null
      })
    ),
    onVaultChanged: vi.fn((callback) => {
      vaultChanged = callback
      return () => {
        vaultChanged = null
      }
    }),
    onRequestClose: vi.fn(() => () => undefined),
    onUpdateStatus: vi.fn(() => () => undefined)
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App properties integration', () => {
  it('saves and reloads typed list edits through the existing App revision path', async () => {
    const source = initialContent.replace('status: active # keep this comment', 'items: ["42", 2] # keep this comment')
    currentNote = { ...note, content: source, size: new TextEncoder().encode(source).byteLength }
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const edit = await screen.findByRole('button', { name: 'itemsを編集' })
    await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(edit)
    fireEvent.change(screen.getByRole('textbox', { name: 'itemsの値の項目2' }), { target: { value: '-3.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'itemsの変更を確定' }))
    const expected = source.replace('items: ["42", 2] # keep this comment', 'items: # keep this comment\r\n  - "42"\r\n  - -3.50')
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(1), { timeout: 2_000 })
    expect(vi.mocked(api.saveNote).mock.calls[0][0]).toEqual({ path: 'A.md', content: expected, expectedModifiedAt: 100, expectedContent: source, force: false })
    vaultChanged?.({ type: 'change', path: 'A.md' })
    await waitFor(() => expect(api.readNote).toHaveBeenCalledWith('A.md'))
    await waitFor(() => expect((screen.getByRole('button', { name: 'itemsを編集' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'itemsを編集' }))
    expect((screen.getByRole('combobox', { name: 'itemsの値の項目1の型' }) as HTMLSelectElement).value).toBe('text')
    expect((screen.getByRole('combobox', { name: 'itemsの値の項目2の型' }) as HTMLSelectElement).value).toBe('number')
    expect((screen.getByRole('textbox', { name: 'itemsの値の項目2' }) as HTMLTextAreaElement).value).toBe('-3.50')
  })

  it('saves an edited decimal with its exact source revision and reloads it as a number', async () => {
    const source = initialContent.replace('status: active', 'amount: 9007199254740993.25')
    currentNote = { ...note, content: source, size: new TextEncoder().encode(source).byteLength }
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const edit = await screen.findByRole('button', { name: 'amountを編集' })
    await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(edit)
    fireEvent.change(screen.getByRole('textbox', { name: 'amountの値' }), { target: { value: '-0.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'amountの変更を確定' }))
    const expected = source.replace('9007199254740993.25', '-0.50')
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(1), { timeout: 2_000 })
    expect(vi.mocked(api.saveNote).mock.calls[0][0]).toEqual({ path: 'A.md', content: expected, expectedModifiedAt: 100, expectedContent: source, force: false })
    vaultChanged?.({ type: 'change', path: 'A.md' })
    await waitFor(() => expect(api.readNote).toHaveBeenCalledWith('A.md'))
    await waitFor(() => expect((screen.getByRole('button', { name: 'amountを編集' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'amountを編集' }))
    expect((screen.getByRole('textbox', { name: 'amountの値' }) as HTMLTextAreaElement).value).toBe('-0.50')
    fireEvent.click(screen.getByRole('button', { name: 'amountの変更を確定' }))
    expect(api.saveNote).toHaveBeenCalledTimes(1)
  })

  it('adds, edits, and deletes properties through normal revision-checked saves', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'プレビュー' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '編集' }))

    fireEvent.click(await screen.findByRole('button', { name: 'プロパティを追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ名' }), {
      target: { value: 'owner' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: '新しいプロパティ値' }), {
      target: { value: 'Humin' }
    })
    fireEvent.click(screen.getByRole('button', { name: '追加を確定' }))

    const expectedAdded = '\uFEFF---\r\nkind: state\r\nstatus: active # keep this comment\r\nowner: "Humin"\r\n---\r\n\r\n# 本文\r\nコメント'
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(1), { timeout: 2_000 })
    expect(vi.mocked(api.saveNote).mock.calls[0][0]).toEqual({
      path: 'A.md',
      content: expectedAdded,
      expectedModifiedAt: 100,
      expectedContent: initialContent,
      force: false
    })
    vaultChanged?.({ type: 'change', path: 'A.md' })
    await waitFor(() => expect(api.readNote).toHaveBeenCalledWith('A.md'))
    await waitFor(() => expect((screen.getByRole('button', { name: 'ownerを編集' }) as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(screen.getByRole('button', { name: 'ownerを編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'ownerの値' }), {
      target: { value: 'ONOKO' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'ownerの変更を確定' }))
    const expectedEdited = expectedAdded.replace('owner: "Humin"', 'owner: "ONOKO"')
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(2), { timeout: 2_000 })
    expect(vi.mocked(api.saveNote).mock.calls[1][0]).toMatchObject({
      path: 'A.md',
      content: expectedEdited,
      expectedModifiedAt: 101,
      expectedContent: expectedAdded,
      force: false
    })
    vaultChanged?.({ type: 'change', path: 'A.md' })
    await waitFor(() => expect(api.readNote).toHaveBeenCalledTimes(2))
    await waitFor(() => expect((screen.getByRole('button', { name: 'ownerを削除' }) as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(screen.getByRole('button', { name: 'ownerを削除' }))
    const expectedDeleted = initialContent
    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(3), { timeout: 2_000 })
    expect(vi.mocked(api.saveNote).mock.calls[2][0]).toMatchObject({
      path: 'A.md',
      content: expectedDeleted,
      expectedModifiedAt: 102,
      expectedContent: expectedEdited,
      force: false
    })
    vaultChanged?.({ type: 'change', path: 'A.md' })
    await waitFor(() => expect(api.readNote).toHaveBeenCalledTimes(3))
  })

  it('holds local property content after FILE_CHANGED without forced or second autosave', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const statusEdit = await screen.findByRole('button', { name: 'statusを編集' })
    await waitFor(() => expect((statusEdit as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(statusEdit)
    fireEvent.change(screen.getByRole('textbox', { name: 'statusの値' }), {
      target: { value: 'local-only' }
    })
    vi.mocked(api.saveNote).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'FILE_CHANGED',
        message: '外部変更があります。',
        currentContent: initialContent.replace('active', 'external'),
        currentModifiedAt: 200
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'statusの変更を確定' }))

    await waitFor(() => expect(api.saveNote).toHaveBeenCalledTimes(1), { timeout: 2_000 })
    await waitFor(() => expect(screen.getByText('外部変更があります。')).toBeTruthy())
    expect(screen.getByText('local-only')).toBeTruthy()
    expect(document.querySelector('.cm-content')?.textContent).toContain('local-only')
    expect(vi.mocked(api.saveNote).mock.calls[0][0].force).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(api.saveNote).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.saveNote).mock.calls.every(([input]) => input.force === false)).toBe(true)
  })

  it('holds a typed list after FILE_CHANGED and disables further property mutations', async () => {
    const source = initialContent.replace('status: active # keep this comment', 'items: ["local", 2]')
    currentNote = { ...note, content: source, size: new TextEncoder().encode(source).byteLength }
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '編集' }))
    const edit = await screen.findByRole('button', { name: 'itemsを編集' })
    await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(edit)
    fireEvent.change(screen.getByRole('textbox', { name: 'itemsの値の項目2' }), { target: { value: '3' } })
    vi.mocked(api.saveNote).mockResolvedValueOnce({ ok: false, error: { code: 'FILE_CHANGED', message: '外部変更があります。', currentContent: source.replace('local', 'external'), currentModifiedAt: 200 } })
    fireEvent.click(screen.getByRole('button', { name: 'itemsの変更を確定' }))
    await waitFor(() => expect(screen.getByText('外部変更があります。')).toBeTruthy())
    expect(api.saveNote).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.saveNote).mock.calls[0][0]).toMatchObject({ expectedContent: source, force: false })
    expect(document.querySelector('.cm-content')?.textContent).toContain('- 3')
    expect((screen.getByRole('button', { name: 'itemsを編集' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'itemsを削除' }) as HTMLButtonElement).disabled).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(api.saveNote).toHaveBeenCalledTimes(1)
  })
})
