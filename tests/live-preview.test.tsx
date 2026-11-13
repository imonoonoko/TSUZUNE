// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'

import NoteHoverPreview from '../src/renderer/components/NoteHoverPreview'
import { compilePathAliases } from '../src/core/path-aliases'

afterEach(cleanup)

describe('Live Preview', () => {
  it('shows a linked-note preview only on Ctrl-hover in the Markdown source editor', async () => {
    const source = 'Intro\n\nRead [[Target]]'
    const target = { path: 'Target.md', name: 'Target', content: '# Target\n\nPreview body', modifiedAt: 1, size: 22 }
    const onChange = vi.fn()
    const onNavigate = vi.fn()
    const { container } = render(<NoteHoverPreview notes={[target]} aliases={compilePathAliases({})} scope="source-editor">
      <MarkdownEditor value={source} onChange={onChange} notePath="Current.md" notes={[target]} onNavigate={onNavigate} />
    </NoteHoverPreview>)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    const offset = source.indexOf('Target')
    const line = [...editor.querySelectorAll<HTMLElement>('.cm-line')].find(element => element.textContent?.includes('Target'))!
    vi.spyOn(view, 'posAtCoords').mockReturnValue(offset)
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({ top: 10, bottom: 24, left: 20, right: 25, height: 14, width: 5, x: 20, y: 10, toJSON: () => ({}) })
    fireEvent.pointerOver(line, { pointerType: 'mouse', ctrlKey: true, clientX: 22, clientY: 16 })
    expect((await screen.findByRole('tooltip', { name: 'ノートプレビュー' })).textContent).toContain('Preview body')
    expect(onNavigate).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows a linked-note preview only on Ctrl-hover and closes it when Ctrl is released without navigating or changing source', async () => {
    const source = 'Intro\n\nRead [[Target]]'
    const target = { path: 'Target.md', name: 'Target', content: '# Target\n\nPreview body', modifiedAt: 1, size: 22 }
    const onChange = vi.fn()
    const onNavigate = vi.fn()
    const { container } = render(<NoteHoverPreview notes={[target]} aliases={compilePathAliases({})} scope="live-preview">
      <MarkdownEditor value={source} onChange={onChange} livePreview notePath="Current.md" notes={[target]} onNavigate={onNavigate} />
    </NoteHoverPreview>)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    const link = await waitFor(() => {
      const candidate = editor.querySelector<HTMLAnchorElement>('.ts-live-preview-block a[href="#/wiki/Target"]')
      expect(candidate).toBeTruthy()
      return candidate!
    })
    fireEvent.pointerOver(link, { pointerType: 'mouse' })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
    expect(screen.queryByRole('tooltip', { name: 'ノートプレビュー' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'リンク先プレビュー' })).toBeNull()
    fireEvent.keyDown(document, { key: 'Control', ctrlKey: true })
    expect((await screen.findByRole('tooltip', { name: 'ノートプレビュー' })).textContent).toContain('Preview body')
    expect(onNavigate).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyUp(document, { key: 'Control', ctrlKey: false })
    await waitFor(() => expect(screen.queryByRole('tooltip', { name: 'ノートプレビュー' })).toBeNull())
    expect(onNavigate).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
  })


  it('resolves reference links defined in another block without changing the document', async () => {
    const source = '# Heading\n\n[Target][ref]\n\n[ref]: Target.md'
    const onChange = vi.fn()
    const onNavigate = vi.fn()
    const { container } = render(<MarkdownEditor value={source} onChange={onChange} livePreview
      notePath="Current.md" notes={[{ path: 'Target.md', name: 'Target', content: '', modifiedAt: 1, size: 0 }]}
      onNavigate={onNavigate} />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    const link = await waitFor(() => {
      const candidate = editor.querySelector<HTMLAnchorElement>('.ts-live-preview-block a[href="Target.md"]')
      expect(candidate?.textContent).toBe('Target')
      return candidate!
    })
    fireEvent.click(link, { ctrlKey: true })
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved', path: 'Target.md' }))
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps cross-block footnote references and definitions editable as source', async () => {
    const source = '# Heading\n\nText[^note]\n\n[^note]: Footnote body\n    continued text\n\n**Other**'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview notePath="Current.md" />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    await waitFor(() => expect(editor.querySelector('strong')?.textContent).toBe('Other'))
    expect(editor.querySelector('.cm-content')?.textContent).toContain('Text[^note]')
    expect(editor.querySelector('.cm-content')?.textContent).toContain('[^note]: Footnote body')
    expect(editor.querySelector('.cm-content')?.textContent).toContain('continued text')
    expect(editor.querySelector('[data-footnotes]')).toBeNull()
    expect(view.state.doc.toString()).toBe(source)
  })

  it.each([
    ['first duplicate definition', '# H\n\n[ref]: First.md\n\n[ref]: Second.md\n[Target][ref]'],
    ['multiline definition', '# H\n\n[Target][ref]\n\n[ref]:\n  First.md\n  "Reference title"']
  ])('preserves %s across preview blocks', async (_name, source) => {
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview
      notePath="Current.md" notes={[{ path: 'First.md', name: 'First', content: '', modifiedAt: 1, size: 0 }]} />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    await waitFor(() => expect(editor.querySelector<HTMLAnchorElement>('.ts-live-preview-block a[href="First.md"]')?.textContent).toBe('Target'))
    expect(editor.querySelector('.ts-live-preview-block a[href="Second.md"]')).toBeNull()
    expect(EditorView.findFromDOM(editor)!.state.doc.toString()).toBe(source)
  })

  it('renders Markdown blocks without changing source and reveals the selected block', async () => {
    const source = '# 見出し\n\n**太字** と [リンク](https://example.com)\n\n> 引用\n\n- 項目\n- [ ] 作業\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst n = 1\n```\n\n![画像](https://example.com/a.png)'
    const onChange = vi.fn()
    const { container } = render(<MarkdownEditor value={source} onChange={onChange} livePreview notePath="Notes/A.md" />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    view.dispatch({ selection: { anchor: source.indexOf('\n\n') + 1 } })
    await waitFor(() => expect(editor.querySelector('h1')).toBeTruthy())
    await waitFor(() => expect(editor.querySelector('.ts-live-preview-block img[alt="画像"]')).toBeTruthy())
    expect(editor.querySelector('strong')?.textContent).toBe('太字')
    expect(editor.querySelector('blockquote')?.textContent).toContain('引用')
    expect(editor.querySelector('li')?.textContent).toContain('項目')
    expect(editor.querySelector('table')?.textContent).toContain('1')
    expect(editor.querySelector('pre code')?.textContent).toContain('const n = 1')
    expect(editor.querySelector('.ts-live-preview-block img[alt="画像"]')).toBeTruthy()
    const task = editor.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(task.disabled).toBe(true)
    fireEvent.click(task)
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
    view.dispatch({ selection: { anchor: source.indexOf('**太字**') + 2 } })
    expect(editor.querySelector('strong')).toBeNull()
    expect(editor.querySelector('.cm-content')?.textContent).toContain('**太字**')
    view.dispatch({ selection: { anchor: source.indexOf('| 1 | 2 |') + 2 } })
    expect(editor.querySelector('table')).toBeNull()
    expect(editor.querySelector('.cm-content')?.textContent).toContain('| --- | --- |')
    view.dispatch({ selection: { anchor: 0, head: source.length } })
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(source)
    expect(view.state.doc.toString()).toBe(source)

    const insertion = source.indexOf('太字')
    view.dispatch({ changes: { from: insertion, to: insertion + 2, insert: '変更' } })
    expect(view.state.doc.toString()).toContain('**変更**')
    expect(onChange).toHaveBeenLastCalledWith(view.state.doc.toString())
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(source)
    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toContain('**変更**')
  })

  it('holds decorations steady during IME composition and restores them afterward', async () => {
    const source = '# A\n\n**B**'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview notePath="A.md" />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    view.dispatch({ selection: { anchor: source.indexOf('B') } })
    expect(editor.querySelector('strong')).toBeNull()
    fireEvent.compositionStart(editor)
    const offset = source.indexOf('B')
    view.dispatch({ changes: { from: offset, to: offset + 1, insert: 'C' }, selection: { anchor: 0 } })
    expect(editor.querySelector('strong')).toBeNull()
    fireEvent.compositionEnd(editor)
    await waitFor(() => expect(editor.querySelector('strong')?.textContent).toBe('C'))
    expect(view.state.doc.toString()).toBe('# A\n\n**C**')
  })

  it('routes Ctrl-click and keyboard link activation through safe note navigation', async () => {
    const source = '冒頭\n\n[[Other]]'
    const onNavigate = vi.fn()
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview
      notePath="Current.md" notes={[
        { path: 'Current.md', name: 'Current.md', content: source, modifiedAt: 1, size: source.length },
        { path: 'Other.md', name: 'Other.md', content: '# Other', modifiedAt: 1, size: 7 }
      ]} onNavigate={onNavigate} />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const link = await waitFor(() => {
      const candidate = editor.querySelector<HTMLAnchorElement>('.ts-live-preview-block .wiki-link')
      expect(candidate).toBeTruthy()
      return candidate!
    })
    expect(link).toBeTruthy()
    fireEvent.click(link, { ctrlKey: true })
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved', path: 'Other.md' }))
    onNavigate.mockClear()
    link.focus()
    fireEvent.keyDown(link, { key: 'Enter' })
    fireEvent.click(link, { detail: 0 })
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved', path: 'Other.md' }))
  })
})
