// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import NoteHistoryDialog from '../src/renderer/components/NoteHistoryDialog'
import type { NoteHistory } from '../src/shared/note-history'
import type { Result } from '../src/shared/types'

const history: NoteHistory = { scope: { rootPath: 'C:\\fixture', rootRevision: 1 }, path: 'note.md', content: 'current', modifiedAt: 9,
  versions: [{ id: 'newer', savedAt: 2, size: 2 }, { id: 'older', savedAt: 1, size: 1 }] }
afterEach(cleanup)

it('shows an empty per-path summary and explains capture and retention without writing', () => {
  const read = vi.fn(), restore = vi.fn()
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: { getNoteVersion: read } })
  render(<NoteHistoryDialog history={{ ...history, versions: [] }} onClose={vi.fn()} onRestore={restore} />)
  expect(screen.getByText('このパスの過去版: 0件・保存本文の合計 0 B')).toBeTruthy()
  expect(screen.getByText('最古の履歴保存: 日時なし ／ 最新の履歴保存: 日時なし')).toBeTruthy()
  expect(screen.getByText(/保持期間・件数上限なし。自動整理は行いません/)).toBeTruthy()
  expect(screen.getByText(/MCP・同期・外部編集は直接記録しません/)).toBeTruthy()
  expect(screen.getByText(/改名・移動前の履歴は旧パスに残ります/)).toBeTruthy()
  expect(screen.getByText(/現在の本文や管理ファイルは含みません/)).toBeTruthy()
  expect(read).not.toHaveBeenCalled()
  expect(restore).not.toHaveBeenCalled()
})

it('summarizes every stored body byte and the actual date range, including equal timestamps and a new path', async () => {
  const read = vi.fn().mockResolvedValue({ ok: true, value: { content: 'old body' } })
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: { getNoteVersion: read } })
  const first = new Date('2026-10-01T00:00:00Z').getTime(), last = new Date('2026-10-21T03:00:00Z').getTime()
  const bodies = ['\uFEFF日本語\r\n', '# note\n', 'same timestamp\n']
  const sizes = bodies.map(body => new TextEncoder().encode(body).byteLength)
  const versions = sizes.map((size, index) => ({ id: String(index), size, savedAt: index === 1 ? first : last }))
  const { rerender } = render(<NoteHistoryDialog history={{ ...history, content: 'x'.repeat(10000), versions }} onClose={vi.fn()} onRestore={vi.fn()} />)
  expect(screen.getByText(`このパスの過去版: 3件・保存本文の合計 ${sizes.reduce((sum, size) => sum + size, 0)} B`)).toBeTruthy()
  expect(screen.getByText(`最古の履歴保存: ${new Date(first).toLocaleString('ja-JP')} ／ 最新の履歴保存: ${new Date(last).toLocaleString('ja-JP')}`)).toBeTruthy()
  await screen.findByRole('textbox', { name: '選択した版の本文' })
  rerender(<NoteHistoryDialog history={{ ...history, path: '別のパス.md', versions: [] }} onClose={vi.fn()} onRestore={vi.fn()} />)
  expect(screen.getByText('別のパス.md')).toBeTruthy()
  expect(screen.getByText('このパスの過去版: 0件・保存本文の合計 0 B')).toBeTruthy()
  expect(screen.getByText('最古の履歴保存: 日時なし ／ 最新の履歴保存: 日時なし')).toBeTruthy()
})

it('ignores a late version response and keeps keyboard focus inside the dialog', async () => {
  let resolveFirst!: (value: Result<{ content: string }>) => void
  const read = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
    .mockResolvedValue({ ok: true, value: { content: '<img src=x onerror=alert(1)>' } })
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: { getNoteVersion: read } })
  const close = vi.fn(), restore = vi.fn()
  render(<NoteHistoryDialog history={history} onClose={close} onRestore={restore} />)
  const select = screen.getByRole('combobox', { name: '保存前の版' })
  expect(document.activeElement).toBe(select)
  fireEvent.change(select, { target: { value: 'older' } })
  await waitFor(() => expect((screen.getByRole('textbox', { name: '選択した版の本文' }) as HTMLTextAreaElement).value).toContain('<img'))
  await act(async () => { resolveFirst({ ok: true, value: { content: 'wrong late body' } }) })
  expect((screen.getByRole('textbox', { name: '選択した版の本文' }) as HTMLTextAreaElement).value).toContain('<img')
  expect(document.querySelector('img')).toBeNull()
  select.focus()
  fireEvent.keyDown(select, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'この版に復元' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
  expect(document.activeElement).toBe(select)
  fireEvent.keyDown(select, { key: 'Escape' })
  expect(close).toHaveBeenCalledOnce()
  expect(restore).not.toHaveBeenCalled()
})

it('keeps restore disabled after a failed read and allows retry', async () => {
  const read = vi.fn().mockResolvedValueOnce({ ok: false, error: { code: 'FILE_CHANGED', message: '破損した版' } })
    .mockResolvedValue({ ok: true, value: { content: 'recovered' } })
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: { getNoteVersion: read } })
  render(<NoteHistoryDialog history={history} onClose={vi.fn()} onRestore={vi.fn()} />)
  await screen.findByRole('alert')
  expect((screen.getByRole('button', { name: 'この版に復元' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '版を再読込' }))
  await waitFor(() => expect((screen.getByRole('textbox', { name: '選択した版の本文' }) as HTMLTextAreaElement).value).toBe('recovered'))
})

it('moves keyboard focus through restore confirmation and Escape cancellation', async () => {
  const read = vi.fn().mockResolvedValue({ ok: true, value: { content: 'old body' } })
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: { getNoteVersion: read } })
  const restore = vi.fn()
  const close = vi.fn()
  render(<NoteHistoryDialog history={history} onClose={close} onRestore={restore} />)
  await screen.findByRole('textbox', { name: '選択した版の本文' })
  const restoreButton = screen.getByRole('button', { name: 'この版に復元' })
  restoreButton.focus()
  fireEvent.click(restoreButton)
  const cancel = screen.getByRole('button', { name: '復元をやめる' })
  expect(document.activeElement).toBe(cancel)
  fireEvent.keyDown(cancel, { key: 'Escape' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'この版に復元' }))
  expect(restore).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
})
