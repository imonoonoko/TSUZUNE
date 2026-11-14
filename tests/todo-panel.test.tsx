// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { VaultError, VaultService } from '../src/main/vault'
import type { NoteDocument, Result, TsuzuneApi } from '../src/shared/types'
import TodoPanel from '../src/renderer/components/TodoPanel'

let root: string
let vault: VaultService
async function result<T>(action: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, value: await action() } }
  catch (error) { return { ok: false, error: (error as VaultError).appError } }
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-todo-test-'))
  vault = new VaultService()
  await vault.setRootPath(root)
  window.tsuzune = {
    readNote: (path) => result(() => vault.readNote(path)),
    createNote: (input) => result(() => vault.createNote(input)),
    saveNote: (input) => result(() => vault.saveNote(input)),
    onVaultChanged: () => () => {}
  } as unknown as TsuzuneApi
})
afterEach(async () => { cleanup(); await rm(root, { recursive: true, force: true }) })

it('adds a task to Markdown and shows it when the ToDo screen is reopened', async () => {
  const user = userEvent.setup()
  const first = render(<TodoPanel />)
  const input = await screen.findByRole('textbox', { name: '新しいToDo' })
  await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))
  await user.type(input, '  買い物  ')
  await user.click(screen.getByRole('button', { name: '追加' }))
  expect(await screen.findByRole('checkbox', { name: '買い物' })).toBeTruthy()
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe('# ToDo\n\n- [ ] 買い物\n')
  first.unmount()
  render(<TodoPanel />)
  expect((await screen.findByRole('checkbox', { name: '買い物' }) as HTMLInputElement).checked).toBe(false)
})

it('toggles one duplicate task and deletes it permanently while preserving surrounding Markdown', async () => {
  const source = '\uFEFF# ToDo\r\n\r\nメモは保持\r\n- [ ] 同じ名前\r\n- [ ] 同じ名前\r\n'
  await writeFile(join(root, 'ToDo.md'), source)
  const user = userEvent.setup()
  const view = render(<TodoPanel />)
  const checkboxes = await screen.findAllByRole('checkbox', { name: '同じ名前' })
  await user.click(checkboxes[0])
  await screen.findByText('完了済み (1)')
  await user.click(screen.getByText('完了済み (1)'))
  await waitFor(() => expect((screen.getAllByRole('checkbox', { name: '同じ名前' })[1] as HTMLInputElement).checked).toBe(true))
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(source.replace('- [ ] 同じ名前', '- [x] 同じ名前'))
  await user.click(screen.getAllByRole('button', { name: '同じ名前を削除' })[1])
  await waitFor(() => expect(screen.getAllByRole('checkbox', { name: '同じ名前' })).toHaveLength(1))
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe('\uFEFF# ToDo\r\n\r\nメモは保持\r\n- [ ] 同じ名前\r\n')
  view.unmount()
  render(<TodoPanel />)
  expect(await screen.findAllByRole('checkbox', { name: '同じ名前' })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '同じ名前を削除' }))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: '同じ名前' })).toBeNull())
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe('\uFEFF# ToDo\r\n\r\nメモは保持\r\n')
})

it('refuses a stale save, keeps the draft, and resumes after explicitly reloading the external content', async () => {
  await writeFile(join(root, 'ToDo.md'), '# ToDo\n- [ ] 元の項目\n')
  const user = userEvent.setup()
  render(<TodoPanel />)
  await screen.findByRole('checkbox', { name: '元の項目' })
  await user.type(screen.getByRole('textbox', { name: '新しいToDo' }), '下書き')
  const external = '# ToDo\n- [ ] 元の項目\n- [ ] 外部で追加\n'
  await writeFile(join(root, 'ToDo.md'), external)
  await user.click(screen.getByRole('checkbox', { name: '元の項目' }))
  await screen.findByRole('alert')
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(external)
  expect((screen.getByRole('textbox', { name: '新しいToDo' }) as HTMLInputElement).value).toBe('下書き')
  await user.click(screen.getByRole('button', { name: '再読込' }))
  await screen.findByRole('checkbox', { name: '外部で追加' })
  await user.click(screen.getByRole('button', { name: '追加' }))
  await screen.findByRole('checkbox', { name: '下書き' })
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(external + '- [ ] 下書き\n')
})

it('rejects blank input and displays markup as literal task text', async () => {
  const user = userEvent.setup()
  render(<TodoPanel />)
  const input = screen.getByRole('textbox', { name: '新しいToDo' }) as HTMLInputElement
  await waitFor(() => expect(input.disabled).toBe(false))
  await user.type(input, '   ')
  await user.click(screen.getByRole('button', { name: '追加' }))
  await screen.findByRole('alert')
  expect((await result(() => vault.readNote('ToDo.md'))).ok).toBe(false)
  await user.clear(input)
  await user.type(input, '<img src=x onerror=alert(1)>')
  await user.click(screen.getByRole('button', { name: '追加' }))
  await screen.findByRole('checkbox', { name: '<img src=x onerror=alert(1)>' })
  expect(document.querySelector('.todo-list img')).toBeNull()
})

it('ignores task-shaped frontmatter and fenced examples, and preserves them when editing real tasks', async () => {
  const source = '\uFEFF---\n- [ ] metadata\n---\n# ToDo\n```md\n- [ ] example\n```\n- [ ] 本物\n'
  await writeFile(join(root, 'ToDo.md'), source)
  const user = userEvent.setup()
  render(<TodoPanel />)
  await screen.findByRole('checkbox', { name: '本物' })
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '本物を削除' }))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: '本物' })).toBeNull())
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(source.replace('- [ ] 本物\n', ''))
})

it('edits a first-line task without removing the file BOM', async () => {
  await writeFile(join(root, 'ToDo.md'), '\uFEFF- [ ] 先頭の項目\r\nメモ\r\n')
  const user = userEvent.setup()
  render(<TodoPanel />)
  await user.click(await screen.findByRole('button', { name: '先頭の項目を削除' }))
  await waitFor(async () => expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe('\uFEFFメモ\r\n'))
})

it('keeps completed tasks collapsed, restores them, and opens existing Wiki and Markdown note references', async () => {
  const source = '# ToDo\n- [ ] [[Reference|参照]] と [文書](Reference.md)\n- [x] 完了した項目\n- [ ] [[Missing]]\n'
  await writeFile(join(root, 'ToDo.md'), source)
  const onOpen = vi.fn()
  const user = userEvent.setup()
  render(<TodoPanel notes={[{ path: 'Reference.md', name: 'Reference', content: '# Reference', modifiedAt: 1 } as NoteDocument]} onOpenNote={onOpen} />)
  await screen.findByRole('checkbox', { name: '[[Reference|参照]] と [文書](Reference.md)' })
  expect(document.querySelector('.todo-completed')?.hasAttribute('open')).toBe(false)
  expect(screen.queryByRole('button', { name: 'Missingを開く' })).toBeNull()
  await user.click(screen.getByRole('button', { name: '参照を開く' }))
  expect(onOpen).toHaveBeenLastCalledWith('Reference.md')
  await user.click(screen.getByRole('button', { name: 'Reference.mdを開く' }))
  expect(onOpen).toHaveBeenLastCalledWith('Reference.md')
  await user.click(screen.getByRole('button', { name: 'ToDoノートを開く' }))
  expect(onOpen).toHaveBeenLastCalledWith('ToDo.md')
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(source)
  await user.click(screen.getByText('完了済み (1)'))
  await user.click(screen.getByRole('checkbox', { name: '完了した項目' }))
  await waitFor(() => expect((screen.getByRole('checkbox', { name: '完了した項目' }) as HTMLInputElement).checked).toBe(false))
  expect(await readFile(join(root, 'ToDo.md'), 'utf8')).toBe(source.replace('- [x]', '- [ ]'))
})

it('does not create a note on open, retains drafts when the editor cannot save, and avoids writes after unmount', async () => {
  const user = userEvent.setup()
  let proceed!: (value: boolean) => void
  const beforeSave = vi.fn(() => new Promise<boolean>(resolve => { proceed = resolve }))
  const afterSave = vi.fn()
  const create = vi.spyOn(window.tsuzune, 'createNote')
  const view = render(<TodoPanel beforeSave={beforeSave} afterSave={afterSave} />)
  const input = screen.getByRole('textbox', { name: '新しいToDo' }) as HTMLInputElement
  await waitFor(() => expect(input.disabled).toBe(false))
  expect(create).not.toHaveBeenCalled()
  await user.type(input, '下書き')
  await user.click(screen.getByRole('button', { name: '追加' }))
  proceed(false)
  await screen.findByRole('alert')
  expect(input.value).toBe('下書き')
  expect(create).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '追加' }))
  view.unmount()
  proceed(true)
  await waitFor(() => expect(afterSave).toHaveBeenCalledOnce())
  expect(create).not.toHaveBeenCalled()
})

it('rereads ToDo after the Vault snapshot changes and reports the verified note after saving', async () => {
  await writeFile(join(root, 'ToDo.md'), '# ToDo\n- [ ] 初期項目\n')
  const snapshot = await vault.readNote('ToDo.md')
  const onSaved = vi.fn()
  const user = userEvent.setup()
  const view = render(<TodoPanel notes={[snapshot]} onSaved={onSaved} />)
  await screen.findByRole('checkbox', { name: '初期項目' })

  await writeFile(join(root, 'ToDo.md'), '# ToDo\n- [ ] 集約側で変更\n')
  view.rerender(<TodoPanel notes={[await vault.readNote('ToDo.md')]} onSaved={onSaved} />)
  await user.click(await screen.findByRole('checkbox', { name: '集約側で変更' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(onSaved).toHaveBeenCalledWith(await vault.readNote('ToDo.md'))
  expect(onSaved.mock.calls[0][0].content).toBe('# ToDo\n- [x] 集約側で変更\n')
})
