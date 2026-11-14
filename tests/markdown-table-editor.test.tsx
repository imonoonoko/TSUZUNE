// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'
Object.assign(globalThis, { React })

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
})
afterEach(cleanup)

describe('Markdown table editor', () => {
  it('edits a cell through the toolbar and applies one undoable source transaction', () => {
    const source = '前文\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n後文'
    const onChange = vi.fn()
    const { container } = render(<MarkdownEditor value={source} onChange={onChange} notePath="Table.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    act(() => view.dispatch({ selection: { anchor: source.indexOf('| 1') } }))
    fireEvent.click(screen.getByRole('button', { name: '表を編集', exact: true }))
    fireEvent.change(screen.getByRole('textbox', { name: '1行 1列' }), { target: { value: '**変更**' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(view.state.doc.toString()).toBe(source.replace('| 1 |', '| **変更** |'))
    expect(onChange).toHaveBeenLastCalledWith(view.state.doc.toString())
    act(() => { expect(undo(view)).toBe(true) })
    expect(view.state.doc.toString()).toBe(source)
    act(() => { expect(redo(view)).toBe(true) })
    expect(view.state.doc.toString()).toContain('**変更**')
  })

  it('adds, moves and removes rows and columns while keeping column alignment with its cells', () => {
    const source = '| A | B |\n| :--- | ---: |\n| 1 | 2 |\n| 3 | 4 |'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} notePath="Table.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    fireEvent.click(screen.getByRole('button', { name: '表を編集', exact: true }))
    fireEvent.focus(screen.getByRole('textbox', { name: '1行 1列' }))
    fireEvent.click(screen.getByRole('button', { name: '行を下へ' }))
    fireEvent.click(screen.getByRole('button', { name: '列を右へ' }))
    fireEvent.click(screen.getByRole('button', { name: '下に行を追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '3行 1列' }), { target: { value: '追加' } })
    fireEvent.focus(screen.getByRole('textbox', { name: '3行 1列' }))
    fireEvent.click(screen.getByRole('button', { name: '右に列を追加' }))
    fireEvent.change(screen.getByRole('textbox', { name: '見出し 2列' }), { target: { value: 'C' } })
    fireEvent.focus(screen.getByRole('textbox', { name: '1行 3列' }))
    fireEvent.click(screen.getByRole('button', { name: '行を削除' }))
    fireEvent.click(screen.getByRole('button', { name: '列を削除' }))
    fireEvent.change(screen.getByRole('combobox', { name: '列の配置' }), { target: { value: 'center' } })
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(view.state.doc.toString()).toBe('| B | C |\n| ---: | :---: |\n| 2 |  |\n| 追加 |  |')
  })

  it('opens a single-column table from Live Preview without revealing its source', async () => {
    const source = '前文\n\n| A |\n| - |\n| 1 |\n\n後文'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview notePath="Table.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    await waitFor(() => expect(container.querySelector('.ts-table-edit')).not.toBeNull())
    const button = container.querySelector('.ts-table-edit')!
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(view.state.selection.main.head).toBe(0)
    fireEvent.change(screen.getByRole('textbox', { name: '1行 1列' }), { target: { value: '変更' } })
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(view.state.doc.toString()).toBe('前文\n\n| A |\n| --- |\n| 変更 |\n\n後文')
  })

  it('inserts a new table after a selected fenced block without replacing text and keeps Undo separate', () => {
    const source = '前文\n\n```md\nコード\n```\n\n後文'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} notePath="Table.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    act(() => view.dispatch({ changes: { from: 0, insert: '追記' }, selection: { anchor: 12, head: 15 }, userEvent: 'input.type' }))
    fireEvent.click(screen.getByRole('button', { name: '表を挿入' }))
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(view.state.doc.toString()).toBe('追記前文\n\n```md\nコード\n```\n\n| 列1 | 列2 |\n| --- | --- |\n|  |  |\n\n後文')
    act(() => { expect(undo(view)).toBe(true) })
    expect(view.state.doc.toString()).toBe('追記' + source)
    act(() => { expect(undo(view)).toBe(true) })
    expect(view.state.doc.toString()).toBe(source)
  })

  it('keeps source bytes unchanged on no-op apply, cancellation and composition keys', () => {
    const source = '|A|B|\n|-|-|\n|1|2|'
    const onChange = vi.fn()
    const { container } = render(<MarkdownEditor value={source} onChange={onChange} notePath="Table.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    const open = () => fireEvent.click(screen.getByRole('button', { name: '表を編集', exact: true }))
    open()
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(view.state.doc.toString()).toBe(source)
    open()
    const cell = screen.getByRole('textbox', { name: '1行 1列' })
    fireEvent.change(cell, { target: { value: '未確定' } })
    fireEvent.keyDown(cell, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(cell, { key: 'Escape', isComposing: true })
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fireEvent.keyDown(cell, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    open()
    fireEvent.change(screen.getByRole('textbox', { name: '1行 1列' }), { target: { value: 'キャンセル' } })
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル', exact: true }))
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects stale text and closes the dialog on a note switch', () => {
    const source = '| A |\n| --- |\n| 1 |'
    const { container, rerender } = render(<MarkdownEditor value={source} onChange={vi.fn()} notePath="Table.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    fireEvent.click(screen.getByRole('button', { name: '表を編集', exact: true }))
    fireEvent.change(screen.getByRole('textbox', { name: '1行 1列' }), { target: { value: '古い編集' } })
    act(() => view.dispatch({ changes: { from: source.length, insert: '\n\n外部更新' } }))
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(screen.getByRole('alert').textContent).toContain('本文が変わりました')
    expect(view.state.doc.toString()).toBe(source + '\n\n外部更新')
    rerender(<MarkdownEditor value="別のノート" onChange={vi.fn()} notePath="Other.md" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(view.state.doc.toString()).toBe('別のノート')
  })

  it('respects read-only transitions and forbids opening while composing', async () => {
    const source = '| A |\n| --- |'
    const onChange = vi.fn()
    const { container, rerender } = render(<MarkdownEditor value={source} onChange={onChange} notePath="Table.md" />)
    const editor = container.querySelector('.cm-editor')!
    fireEvent.compositionStart(editor)
    fireEvent.click(screen.getByRole('button', { name: '表を編集', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '表を挿入' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.compositionEnd(editor)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByRole('button', { name: '表を編集', exact: true }))
    rerender(<MarkdownEditor value={source} onChange={onChange} notePath="Table.md" readOnly />)
    expect((screen.getByRole('button', { name: '表を適用' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('textbox', { name: '見出し 1列' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('preserves the header and final column while allowing deletion of the final body row', () => {
    const source = '| A |\n| --- |\n| 1 |'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} notePath="Table.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    fireEvent.click(screen.getByRole('button', { name: '表を編集', exact: true }))
    for (const name of ['行を削除', '行を上へ', '行を下へ', '列を削除', '列を左へ', '列を右へ']) {
      expect((screen.getByRole('button', { name, exact: true }) as HTMLButtonElement).disabled).toBe(true)
    }
    fireEvent.focus(screen.getByRole('textbox', { name: '1行 1列' }))
    fireEvent.click(screen.getByRole('button', { name: '行を削除' }))
    expect((screen.getByRole('button', { name: '行を削除' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '表を適用' }))
    expect(view.state.doc.toString()).toBe('| A |\n| --- |')
  })
})
