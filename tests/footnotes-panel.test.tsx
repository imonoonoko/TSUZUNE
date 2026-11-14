// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import FootnotesPanel from '../src/renderer/components/FootnotesPanel'

beforeEach(() => { HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') }) })
afterEach(cleanup)
const source = '本文[^a] と再参照[^a]\n\n[^a]: 定義\n    継続\n\n[^unused]: 未参照\n'
const props = { source, documentKey: 'vault:note:pane:edit', onSelect: vi.fn(), onApply: vi.fn(() => null) }

it('lists definitions and actual references and navigates exact source ranges', () => {
  const onSelect = vi.fn()
  render(<FootnotesPanel {...props} onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('button', { name: '脚注 a の定義へ移動' }))
  expect(onSelect).toHaveBeenLastCalledWith(source, source.indexOf('[^a]:'), source.indexOf('\n\n[^unused]'))
  fireEvent.click(screen.getByRole('button', { name: '脚注 a の参照 2へ移動' }))
  const start = source.indexOf('[^a]', source.indexOf('[^a]') + 1)
  expect(onSelect).toHaveBeenLastCalledWith(source, start, start + 4)
  expect(screen.getByText('参照なし')).toBeTruthy()
})

it('preserves invalid or stale draft and cancels without changing source', () => {
  const onApply = vi.fn(() => '識別子を変更できません。')
  const { rerender } = render(<FootnotesPanel {...props} onApply={onApply} />)
  fireEvent.click(screen.getByRole('button', { name: '脚注 a を編集' }))
  const dialog = screen.getByRole('dialog', { name: '脚注を編集' })
  const input = within(dialog).getByRole('textbox', { name: '脚注の定義（Markdown）' }) as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: '[^b]: 入力を保持' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '脚注を適用' }))
  expect(screen.getByRole('alert').textContent).toContain('識別子')
  expect(input.value).toBe('[^b]: 入力を保持')
  rerender(<FootnotesPanel {...props} source={source + '変更'} documentKey="other" onApply={onApply} />)
  fireEvent.click(screen.getByRole('button', { name: '脚注を適用' }))
  expect(onApply).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('alert').textContent).toContain('変更')
  expect(input.value).toBe('[^b]: 入力を保持')
  fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('applies the captured definition and restores focus, respecting unavailable editing', () => {
  const onApply = vi.fn(() => null)
  const onEditingChange = vi.fn()
  const { rerender } = render(<FootnotesPanel {...props} onApply={onApply} onEditingChange={onEditingChange} />)
  const opener = screen.getByRole('button', { name: '脚注 a を編集' })
  fireEvent.click(opener)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '[^a]: 更新' } })
  fireEvent.click(screen.getByRole('button', { name: '脚注を適用' }))
  expect(onApply).toHaveBeenCalledWith(source, source.indexOf('[^a]:'), '[^a]: 更新')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(onEditingChange).toHaveBeenCalledWith(true)
  expect(onEditingChange).toHaveBeenLastCalledWith(false)
  rerender(<FootnotesPanel {...props} disabledReason="編集表示で編集できます。" />)
  expect((screen.getByRole('button', { name: '脚注 a を編集' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '脚注 a の定義へ移動' })).toBeTruthy()
})

it('returns keyboard focus through autosave without overriding a later user focus choice', async () => {
  const onApply = vi.fn(() => {
    rerender(<FootnotesPanel {...props} onApply={onApply} disabledReason="保存中です。" />)
    return null
  })
  const { rerender } = render(<FootnotesPanel {...props} onApply={onApply} />)
  const opener = screen.getByRole('button', { name: '脚注 a を編集' })
  const definition = screen.getByRole('button', { name: '脚注 a の定義へ移動' })
  fireEvent.click(opener)
  fireEvent.click(screen.getByRole('button', { name: '脚注を適用' }))
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement).toBe(definition)
  rerender(<FootnotesPanel {...props} onApply={onApply} />)
  await waitFor(() => expect(document.activeElement).toBe(opener))
  rerender(<FootnotesPanel {...props} onApply={onApply} disabledReason="遅延した自動保存中です。" />)
  await waitFor(() => expect(document.activeElement).toBe(definition))
  rerender(<FootnotesPanel {...props} onApply={onApply} />)
  await waitFor(() => expect(document.activeElement).toBe(opener))

  fireEvent.click(opener)
  fireEvent.click(screen.getByRole('button', { name: '脚注を適用' }))
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  const elsewhere = screen.getByRole('button', { name: '脚注 unused の定義へ移動' })
  elsewhere.focus()
  rerender(<FootnotesPanel {...props} onApply={onApply} />)
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement).toBe(elsewhere)
})
