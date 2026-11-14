// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EditorView } from '@codemirror/view'
import App from '../src/renderer/App'
import { VaultService, VaultError } from '../src/main/vault'
import type { Result, TsuzuneApi } from '../src/shared/types'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/shared/graph-settings'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'

let root: string, vault: VaultService, api: TsuzuneApi
const source = '\uFEFF# A\r\n前文\r\n\r\n- [ ] 同じ項目\r\n  * [ ] 同じ項目\r\n\r\n後文\r\n'
const ok = <T,>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })
async function result<T>(action: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, value: await action() } }
  catch (error) { return { ok: false, error: (error as VaultError).appError } }
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-note-tasks-'))
  vault = new VaultService()
  await vault.setRootPath(root)
  await writeFile(join(root, 'A.md'), source)
  await writeFile(join(root, 'B.md'), '---\ntext: |\n  - [ ] metadata\n---\n- [ ] 別ノート\n\n```md\n- [ ] sample\n```\n')
  await writeFile(join(root, 'ToDo.md'), '- [ ] ルートToDo\n')
  await writeFile(join(root, 'Excluded.md'), '- [ ] 除外\n')
  for (const folder of ['40_情報源', '50_履歴']) {
    await mkdir(join(root, folder), { recursive: true })
    await writeFile(join(root, folder, 'Protected.md'), '- [ ] 保護\n')
  }
  api = {
    getSettings: vi.fn(() => ok({ lastVaultPath: root, lastNotePath: 'A.md', userIgnoreFilters: ['Excluded.md'],
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS, graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS, graphGroups: DEFAULT_GRAPH_GROUPS, graphViewStates: DEFAULT_GRAPH_VIEW_STATES })),
    openLastVault: vi.fn(() => result(() => vault.scan())), getSnapshot: vi.fn(() => result(() => vault.scan())),
    readNote: vi.fn(path => result(() => vault.readNote(path))), saveNote: vi.fn(input => result(() => vault.saveNote(input))),
    getWorkspaces: vi.fn(() => ok({ scope: { rootPath: root, rootRevision: 1 }, state: { version: 1, lastSession: null, named: [] } })),
    saveLastWorkspaceSession: vi.fn(() => ok(null)), setLastNote: vi.fn(() => ok(null)), getMoveRecovery: vi.fn(() => ok({ status: 'clean' })),
    getCalendarPluginStatus: vi.fn(() => ok({ state: 'missing', id: 'calendar', version: '1.5.10', mainSha256: '', manifestSha256: '', reason: null })),
    listObsidianPluginCandidates: vi.fn(() => ok([])),
    getUpdateStatus: vi.fn(() => ok({ phase: 'idle', currentVersion: '0.6.0', availableVersion: null, downloadPercent: null, message: null })),
    onVaultChanged: vi.fn(() => () => undefined), onUpdateStatus: vi.fn(() => () => undefined), onRequestClose: vi.fn(() => () => undefined)
  } as unknown as TsuzuneApi
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
})
afterEach(async () => { cleanup(); vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })
async function openTasks(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'ノート活動', exact: true }))
  return screen.findByRole('region', { name: 'ノートのタスク' })
}

it('aggregates eligible notes and opens the exact nested duplicate row with CRLF offsets', async () => {
  const { container } = render(<App />)
  const panel = await openTasks()
  expect(within(panel).getAllByRole('checkbox')).toHaveLength(4)
  expect(within(panel).queryByText('除外')).toBeNull()
  expect(within(panel).queryByText('保護')).toBeNull()
  fireEvent.click(within(panel).getByRole('button', { name: 'A.md · 5行目' }))
  await waitFor(() => {
    const editor = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)
    expect(editor?.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to)).toBe('* [ ] 同じ項目')
  })
  expect(await readFile(join(root, 'A.md'), 'utf8')).toBe(source)
})

it('toggles only one checkbox and allows reversal after save and reload', async () => {
  render(<App />)
  const panel = await openTasks()
  fireEvent.click(within(panel).getAllByRole('checkbox', { name: '同じ項目' })[1])
  await waitFor(async () => expect(await readFile(join(root, 'A.md'), 'utf8')).toBe(source.replace('* [ ]', '* [x]')))
  await within(panel).findByText('完了済み (1)')
  await waitFor(() => expect(panel.getAttribute('aria-busy')).toBe('false'))
  fireEvent.click(within(panel).getByText('完了済み (1)'))
  fireEvent.click(within(panel).getAllByRole('checkbox', { name: '同じ項目' })[1])
  await waitFor(async () => expect(await readFile(join(root, 'A.md'), 'utf8')).toBe(source))
  await waitFor(() => expect(panel.getAttribute('aria-busy')).toBe('false'))
  fireEvent.click(within(panel).getByRole('button', { name: '再読込' }))
  await waitFor(() => expect(panel.getAttribute('aria-busy')).toBe('false'))
  await waitFor(() => expect(within(panel).getAllByRole('checkbox', { name: '同じ項目' }).every(input => !(input as HTMLInputElement).checked)).toBe(true))
})

it('keeps the root ToDo and note task panels in sync when either toggles a task', async () => {
  render(<App />)
  const tasks = await openTasks()
  const todo = screen.getByRole('region', { name: 'ToDo', exact: true })
  fireEvent.click(await within(todo).findByRole('checkbox', { name: 'ルートToDo' }))
  fireEvent.click(await within(tasks).findByText('完了済み (1)'))
  const completed = within(tasks).getByRole('checkbox', { name: 'ルートToDo' }) as HTMLInputElement
  await waitFor(() => expect(completed.disabled).toBe(false))
  expect(completed.checked).toBe(true)
  fireEvent.click(completed)
  await waitFor(() => {
    expect((within(todo).getByRole('checkbox', { name: 'ルートToDo' }) as HTMLInputElement).checked).toBe(false)
  })
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe('- [ ] ルートToDo\n')
})

it('preserves an unsaved editor draft and rejects a row based on the earlier snapshot', async () => {
  const { container } = render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '編集', exact: true }))
  const editor = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
  await act(async () => editor.dispatch({ changes: { from: editor.state.doc.length, insert: 'draft' } }))
  const panel = await openTasks()
  fireEvent.click(within(panel).getAllByRole('checkbox', { name: '同じ項目' })[0])
  await within(panel).findByRole('alert')
  expect(await readFile(join(root, 'A.md'), 'utf8')).toContain('draft')
  expect(await readFile(join(root, 'A.md'), 'utf8')).not.toContain('[x]')
})

it('rejects stale changes to root ToDo from either panel and refreshes both from disk', async () => {
  render(<App />)
  const tasks = await openTasks()
  const todo = screen.getByRole('region', { name: 'ToDo', exact: true })
  const todoCheckbox = await within(todo).findByRole('checkbox', { name: 'ルートToDo' })
  const external = '- [ ] ルートToDo\n- [ ] 外部で追加\n'
  await writeFile(join(root, 'ToDo.md'), external)
  fireEvent.click(todoCheckbox)
  await within(todo).findByRole('alert')
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(external)

  fireEvent.click(within(tasks).getByRole('checkbox', { name: 'ルートToDo' }))
  await within(tasks).findByRole('alert')
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(external)

  fireEvent.click(within(tasks).getByRole('button', { name: '再読込' }))
  await within(tasks).findByRole('checkbox', { name: '外部で追加' })
  await within(todo).findByRole('checkbox', { name: '外部で追加' })
  expect(within(todo).queryByRole('alert')).toBeNull()
})

it('refuses stale navigation and writes after external changes, then reloads safely', async () => {
  render(<App />)
  const panel = await openTasks()
  const external = 'External\n' + source
  await writeFile(join(root, 'A.md'), external)
  fireEvent.click(within(panel).getByRole('button', { name: 'A.md · 5行目' }))
  await within(panel).findByRole('alert')
  expect(screen.queryByRole('region', { name: 'ノートのタスク' })).not.toBeNull()
  fireEvent.click(within(panel).getByRole('button', { name: '再読込' }))
  await within(panel).findByRole('button', { name: 'A.md · 6行目' })
  await rm(join(root, 'A.md'))
  fireEvent.click(within(panel).getAllByRole('checkbox', { name: '同じ項目' })[0])
  await within(panel).findByRole('alert')
  await expect(readFile(join(root, 'A.md'))).rejects.toThrow()
})
