// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'

afterEach(cleanup)
const preview = (content: string) => render(<MarkdownPreview content={content} notePath="Math.md" attachments={[]} onWikiLink={vi.fn()} />)

describe('LaTeX preview', () => {
  it('renders inline and multiline display math with accessible MathML', () => {
    const { container } = preview('本文 $x^2 + y_1$。\n\n$$\n\\frac{1}{2} + \\sum_{n=1}^{3} n\n$$\n\n続き')
    expect(container.querySelectorAll('.katex')).toHaveLength(2)
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1)
    expect(container.querySelectorAll('math')).toHaveLength(2)
    expect(container.querySelector('.katex-display annotation')?.textContent).toBe('\\frac{1}{2} + \\sum_{n=1}^{3} n')
    expect(container.textContent).toContain('続き')
  })

  it('leaves code, escaped dollars and properties unchanged', () => {
    const { container } = preview('---\nformula: $property$\n---\n\\$money\\$ ` $code$ `\n\n```txt\n$literal$\n```\n\n    $indented$\n\n$real$')
    expect(container.querySelectorAll('.katex')).toHaveLength(1)
    expect(container.querySelector('code')?.textContent).toContain('$code$')
    expect(container.textContent).toContain('$money$')
    expect(container.textContent).toContain('$property$')
  })

  it('supports explicitly marked math fences while ordinary LaTeX code remains source', () => {
    const { container } = preview('```math\n\\sqrt{2}\n```\n\n```latex\n$literal$\n```')
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1)
    expect(container.querySelector('pre code')?.textContent).toContain('$literal$')
  })

  it('keeps a malformed formula local and prevents trusted HTML, URL and image commands', () => {
    const { container } = preview('$\\frac{1}{$\n\n$\\href{javascript:alert(1)}{bad}$\n\n$\\includegraphics{https://example.com/pixel.png}$\n\n$\\htmlClass{injected}{x}$\n\n$y$\n\n**本文は続く**')
    expect(container.querySelector('.katex-error')?.textContent).toContain('\\frac{1}{')
    expect(container.querySelector('a, img, .injected, script')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('本文は続く')
    expect([...container.querySelectorAll('annotation')].some(node => node.textContent === 'y')).toBe(true)
  })

  it('preserves Wiki-like math while keeping real Wiki links outside it', () => {
    const { container } = preview('$[[x]]$ と [[Other]]')
    expect(container.querySelector('annotation')?.textContent).toBe('[[x]]')
    expect(container.querySelectorAll('.wiki-link')).toHaveLength(1)
  })

  it('bounds recursive macro expansion without losing the following body', () => {
    const { container } = preview('$\\def\\x{\\x}\\x$\n\n**After recursive math**')
    expect(container.querySelector('.katex-error')).not.toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('After recursive math')
  })

  it('keeps Wiki links and embeds whole when their label or target contains dollars', () => {
    const { container } = render(<MarkdownPreview content={'[[Other|$x$]] ![[Other|$label$]] [[$Price$]]'} notePath="Host.md" attachments={[]} onWikiLink={vi.fn()}
      notes={[{ path: 'Other.md', name: 'Other', content: 'Embedded body', size: 13, modifiedAt: 1 }]} />)
    expect(container.querySelectorAll('.wiki-link')).toHaveLength(2)
    expect(container.querySelector('.note-embed')?.textContent).toContain('Embedded body')
  })

  it('renders formulas inside embedded notes', () => {
    const content = '# Formula\n\n$E=mc^2$'
    const { container } = render(<MarkdownPreview content="![[Formula]]" notePath="Host.md" attachments={[]} onWikiLink={vi.fn()}
      notes={[{ path: 'Formula.md', name: 'Formula', content, size: content.length, modifiedAt: 1 }]} />)
    expect(container.querySelector('.note-embed .katex annotation')?.textContent).toBe('E=mc^2')
  })
})

describe('LaTeX Live Preview', () => {
  it.each([
    ['list', '- Item\n  $$\n  a\n\n  b\n  $$'],
    ['quote', '> $$\n> a\n>\n> b\n> $$']
  ])('keeps math inside a %s whole across blank lines', async (_kind, nested) => {
    const source = '# Math\n\n' + nested + '\n\nAfter'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview notePath="Math.md" />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    await waitFor(() => expect(editor.querySelector('.katex-display annotation')?.textContent).toContain('b'))
    view.dispatch({ selection: { anchor: source.lastIndexOf('b') } })
    expect(editor.querySelector('.katex-display')).toBeNull()
    expect(editor.querySelector('.cm-content')?.textContent).toContain('$$')
    expect(view.state.doc.toString()).toBe(source)
  })

  it('keeps display math with blank lines together and reveals editable source without changing it', async () => {
    const source = '# Math\n\nInline $x_1$\n\n$$\n\\begin{pmatrix}\na & b \\\\\n\nc & d\n\\end{pmatrix}\n$$\n\n**After**'
    const onChange = vi.fn()
    const { container } = render(<MarkdownEditor value={source} onChange={onChange} livePreview notePath="Math.md" />)
    const editor = container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(editor)!
    await waitFor(() => expect(editor.querySelectorAll('.katex')).toHaveLength(2))
    expect(editor.querySelector('.katex-display annotation')?.textContent).toContain('c & d')
    expect(editor.querySelector('strong')?.textContent).toBe('After')
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
    view.dispatch({ selection: { anchor: source.indexOf('c & d') } })
    expect(editor.querySelector('.katex-display')).toBeNull()
    expect(editor.querySelector('.cm-content')?.textContent).toContain('\\begin{pmatrix}')
    view.dispatch({ changes: { from: source.indexOf('c & d'), to: source.indexOf('c & d') + 1, insert: 'z' } })
    expect(view.state.doc.toString()).toContain('z & d')
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(source)
    view.dispatch({ selection: { anchor: 0 } })
    await waitFor(() => expect(editor.querySelector('.katex-display annotation')?.textContent).toContain('c & d'))
  })
})
