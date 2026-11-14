// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'

afterEach(cleanup)
const props = { notePath: 'Note.md', attachments: [], onWikiLink: vi.fn() }

describe('Callout preview', () => {
  it('keeps a lazy blockquote continuation in the same Live Preview callout', async () => {
    const source = '# Title\n\n> [!note] Heading\nLazy body\n\nAfter'
    const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview notePath="Note.md" />)
    await waitFor(() => expect(container.querySelector('.callout-content')?.textContent).toContain('Lazy body'))
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    act(() => view.dispatch({ selection: { anchor: source.indexOf('Lazy body') } }))
    expect(container.querySelector('.callout')).toBeNull()
    expect(view.state.doc.toString()).toBe(source)
  })

  it('renders a title and rich body without leaking the marker or nesting block content in a paragraph', () => {
    const { container } = render(<MarkdownPreview {...props} content={'> [!WARNING] **注意** と [[Next]]\n> 本文\n>\n> - 項目\n> - $x_1$'} />)
    const callout = container.querySelector('aside.callout[data-callout="warning"]')!
    expect(callout).not.toBeNull()
    expect(callout.querySelector('.callout-title strong')?.textContent).toBe('注意')
    expect(callout.querySelector('.callout-title a')?.textContent).toBe('Next')
    expect(callout.querySelector('.callout-content p')?.textContent).toBe('本文')
    expect(callout.querySelectorAll('li')).toHaveLength(2)
    expect(callout.querySelector('.katex')).not.toBeNull()
    expect(callout.textContent).not.toContain('[!')
    expect(container.querySelector('p aside, p details')).toBeNull()
  })

  it.each([
    ['summary', 'abstract'], ['tldr', 'abstract'], ['hint', 'tip'], ['important', 'tip'],
    ['check', 'success'], ['done', 'success'], ['help', 'question'], ['faq', 'question'],
    ['caution', 'warning'], ['attention', 'warning'], ['fail', 'failure'], ['missing', 'failure'],
    ['error', 'danger'], ['cite', 'quote'], ['CUSTOM', 'note']
  ])('uses the supported appearance for %s and derives the default title', (type, expected) => {
    const { container } = render(<MarkdownPreview {...props} content={`> [!${type}]\n> Body`} />)
    expect(container.querySelector('.callout')?.getAttribute('data-callout')).toBe(expected)
    expect(container.querySelector('.callout-title')?.textContent).toContain(type[0].toUpperCase() + type.slice(1).toLowerCase())
  })

  it('supports initial fold states, nested callouts and inline titles that end at a hard line break', () => {
    const { container } = render(<MarkdownPreview {...props} content={'> [!note]- **Outer**  \n> Body\n>\n> > [!tip]+ Inner\n> > Nested\n\n> [!info] Static'} />)
    const outer = container.querySelector<HTMLDetailsElement>('details[data-callout="note"]')!
    const inner = container.querySelector<HTMLDetailsElement>('details[data-callout="tip"]')!
    expect(outer.open).toBe(false)
    expect(inner.open).toBe(true)
    expect(outer.querySelector(':scope > summary')?.textContent).toContain('Outer')
    expect(outer.querySelector(':scope > summary')?.textContent).not.toContain('Body')
    expect(inner.textContent).toContain('Nested')
    expect(container.querySelector('aside[data-callout="info"]')?.textContent).toContain('Static')
    fireEvent.click(outer.querySelector('summary')!)
    expect(outer.open).toBe(true)
  })

  it('leaves ordinary quotes, escaped markers, inline code and fenced examples alone', () => {
    const { container } = render(<MarkdownPreview {...props} content={'> Ordinary\n> [!note] later\n\n> \\[!tip] literal\n\n> `[!warning]` code\n\n```md\n> [!note] example\n```'} />)
    expect(container.querySelector('.callout')).toBeNull()
    expect(container.querySelectorAll('blockquote')).toHaveLength(3)
    expect(container.querySelector('pre code')?.textContent).toContain('[!note] example')
  })

  it('renders a callout inside an embedded note and retains source-relative navigation', () => {
    const onNavigate = vi.fn()
    const { container } = render(<MarkdownPreview {...props} content={'![[folder/Source]]'} onNavigate={onNavigate} notes={[
      { path: 'folder/Source.md', name: 'Source', content: '> [!note] [Next](Next.md)\n> Body', modifiedAt: 1, size: 40 },
      { path: 'folder/Next.md', name: 'Next', content: '', modifiedAt: 1, size: 0 }
    ]} />)
    const link = container.querySelector('.note-embed .callout-title a')!
    expect(link).not.toBeNull()
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved', path: 'folder/Next.md' }))
  })

  it('toggles a Live Preview callout without revealing source and still permits body editing and undo', async () => {
    const source = '# Title\n\n> [!tip]- **Tip**\n> Body\n\nAfter'
    const onChange = vi.fn()
    const { container } = render(<MarkdownEditor value={source} onChange={onChange} livePreview notePath="Note.md" />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!
    const details = await waitFor(() => {
      const node = container.querySelector<HTMLDetailsElement>('details.callout')
      expect(node).not.toBeNull()
      return node!
    })
    const selection = view.state.selection.main.anchor
    fireEvent.pointerDown(details.querySelector('summary strong')!)
    fireEvent.click(details.querySelector('summary strong')!)
    expect(details.open).toBe(true)
    expect(container.querySelector('details.callout')).toBe(details)
    expect(view.state.selection.main.anchor).toBe(selection)
    await act(async () => view.dispatch({}))
    expect(details.open).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerDown(details.querySelector('.callout-content p')!)
    expect(container.querySelector('details.callout')).toBeNull()
    expect(view.state.doc.toString()).toBe(source)
    expect(onChange).not.toHaveBeenCalled()
    act(() => view.dispatch({ changes: { from: source.indexOf('Body'), to: source.indexOf('Body') + 4, insert: 'Edited' } }))
    expect(onChange).toHaveBeenLastCalledWith(source.replace('Body', 'Edited'))
    act(() => { expect(undo(view)).toBe(true); view.dispatch({ selection: { anchor: 0 } }) })
    await waitFor(() => expect(container.querySelector('details.callout')?.textContent).toContain('Body'))
    expect(view.state.doc.toString()).toBe(source)
  })
})
