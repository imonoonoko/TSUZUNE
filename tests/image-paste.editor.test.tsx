// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'

afterEach(cleanup)
const file = () => new File(['image'], 'image.png', { type: 'image/png' })
const paste = (view: EditorView, files = [file()]) => {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { files, getData: () => '' } })
  act(() => { view.contentDOM.dispatchEvent(event) })
  return event
}
const editor = (container: HTMLElement) => EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!

describe('image paste editor', () => {
  it.each([false, true])('inserts saved image links in Source/Live Preview (%s) and supports Undo', async livePreview => {
    const onChange = vi.fn(), save = vi.fn(async () => '日本語/Pasted image.png')
    const { container } = render(<MarkdownEditor value="前後" onChange={onChange} onPasteImage={save} livePreview={livePreview} />)
    const view = editor(container)
    act(() => view.dispatch({ selection: { anchor: 1 } }))
    expect(paste(view).defaultPrevented).toBe(true)
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('前![[日本語/Pasted image.png]]後'))
    act(() => { undo(view) })
    expect(view.state.doc.toString()).toBe('前後')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('maps the paste position through typing while storage is pending', async () => {
    let finish!: (path: string) => void
    const save = vi.fn(() => new Promise<string>(resolve => { finish = resolve }))
    const { container } = render(<MarkdownEditor value="前後" onChange={vi.fn()} onPasteImage={save} />)
    const view = editor(container)
    act(() => view.dispatch({ selection: { anchor: 1 } }))
    paste(view)
    act(() => view.dispatch({ changes: { from: 0, insert: '追加' } }))
    await act(async () => finish('image.png'))
    expect(view.state.doc.toString()).toBe('追加前![[image.png]]後')
  })

  it('does not overwrite edits to the selected text while storage is pending', async () => {
    let finish!: (path: string) => void
    const { container } = render(<MarkdownEditor value="前後" onChange={vi.fn()} onPasteImage={() => new Promise(resolve => { finish = resolve })} />)
    const view = editor(container)
    act(() => view.dispatch({ selection: { anchor: 0, head: 1 } }))
    paste(view)
    act(() => view.dispatch({ changes: { from: 0, to: 1, insert: '変更' } }))
    await act(async () => finish('image.png'))
    expect(view.state.doc.toString()).toBe('変更後')
    expect(screen.getByRole('alert').textContent).toContain('挿入を停止')
  })

  it('leaves text paste to CodeMirror and ignores image paste while read-only', () => {
    const save = vi.fn()
    const { container, rerender } = render(<MarkdownEditor value="本文" onChange={vi.fn()} onPasteImage={save} />)
    const view = editor(container)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { files: [], getData: () => 'text' } })
    act(() => { view.contentDOM.dispatchEvent(event) })
    expect(view.state.doc.toString()).toContain('text')
    rerender(<MarkdownEditor value="本文" onChange={vi.fn()} onPasteImage={save} readOnly />)
    paste(view)
    expect(save).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe('本文')
  })

  it('keeps content on storage failure and does not insert into a replacement editor', async () => {
    const { container, rerender } = render(<MarkdownEditor key="A" value="A" onChange={vi.fn()} onPasteImage={async () => { throw Error('保存失敗') }} />)
    paste(editor(container))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('保存失敗'))
    expect(editor(container).state.doc.toString()).toBe('A')
    let finish!: (path: string) => void
    rerender(<MarkdownEditor key="A" value="A" onChange={vi.fn()} onPasteImage={() => new Promise(resolve => { finish = resolve })} />)
    paste(editor(container))
    rerender(<MarkdownEditor key="B" value="B" onChange={vi.fn()} onPasteImage={vi.fn()} />)
    await act(async () => finish('image.png'))
    expect(editor(container).state.doc.toString()).toBe('B')
  })

  it('ignores paste during composition and rejects oversized images before storage', () => {
    const save = vi.fn()
    const { container } = render(<MarkdownEditor value="本文" onChange={vi.fn()} onPasteImage={save} />)
    const view = editor(container)
    fireEvent.compositionStart(view.dom)
    paste(view)
    expect(save).not.toHaveBeenCalled()
    fireEvent.compositionEnd(view.dom)
    // Final composition is released after its microtask; verify oversized data in a separate editor.
    cleanup()
    const next = render(<MarkdownEditor value="本文" onChange={vi.fn()} onPasteImage={save} />)
    const oversized = file()
    Object.defineProperty(oversized, 'size', { value: 21 * 1024 * 1024 })
    paste(editor(next.container), [oversized])
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('20MB')
  })
})
