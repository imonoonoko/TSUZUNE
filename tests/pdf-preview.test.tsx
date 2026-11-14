// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import AttachmentPreview from '../src/renderer/components/AttachmentPreview'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'

vi.mock('../src/renderer/components/PdfReader', () => ({ default: ({ path, page }: { path: string; page?: number }) => <div>PDF viewer {path} page {page ?? 1}</div> }))
afterEach(cleanup)
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true } })
const attachments = [{ path: 'assets/paper.pdf', name: 'paper.pdf', size: 1, createdAt: 1, modifiedAt: 1 }]
it('opens Markdown and Wiki PDF page links internally and returns focus on close', async () => {
  const onWikiLink = vi.fn()
  render(<MarkdownPreview content={'[引用](/assets/paper.pdf#page=2) [[assets/paper.pdf#page=3|原文]] ![[assets/paper.pdf]]'}
    notePath="notes/note.md" attachments={attachments} onWikiLink={onWikiLink} />)
  const opener = screen.getByRole('link', { name: '引用' }); opener.focus(); fireEvent.click(opener)
  expect(await screen.findByText('PDF viewer assets/paper.pdf page 2')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
  fireEvent.click(screen.getByRole('link', { name: '原文' }))
  expect(await screen.findByText('PDF viewer assets/paper.pdf page 3')).toBeTruthy()
  expect(onWikiLink).not.toHaveBeenCalled()
})
it('does not create a Markdown note from missing or invalid PDF links', () => {
  const onWikiLink = vi.fn()
  render(<MarkdownPreview content={'[[missing.pdf|不明]] [[assets/paper.pdf#page=0|不正]]'} notePath="n.md" attachments={attachments} onWikiLink={onWikiLink} />)
  expect(screen.queryAllByRole('link')).toHaveLength(0)
  expect(onWikiLink).not.toHaveBeenCalled()
})
it('preserves note heading navigation when a heading ends with .pdf', () => {
  const onNavigate = vi.fn()
  render(<MarkdownPreview content={'[[Research#paper.pdf|見出し]] [Markdown見出し](Research.md#paper.pdf)'} notePath="Home.md" attachments={attachments}
    notes={[{ path: 'Research.md', name: 'Research', content: '# paper.pdf', size: 11, modifiedAt: 1 }]} onNavigate={onNavigate} onWikiLink={vi.fn()} />)
  fireEvent.click(screen.getByRole('link', { name: '見出し' }))
  fireEvent.click(screen.getByRole('link', { name: 'Markdown見出し' }))
  expect(onNavigate).toHaveBeenCalledTimes(2)
  expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ path: 'Research.md', status: 'resolved' }))
})
it('uses the internal reader for a PDF attachment', async () => {
  render(<AttachmentPreview attachment={attachments[0]} onOpenExternally={vi.fn()} />)
  expect(await screen.findByText('PDF viewer assets/paper.pdf page 1')).toBeTruthy()
})
it('opens a PDF page from Live Preview without passing it through note creation or editing source', async () => {
  const source = '# Note\n\n[[assets/paper.pdf#page=3|引用]]'
  const onNavigate = vi.fn(), onChange = vi.fn()
  const { container } = render(<MarkdownEditor value={source} onChange={onChange} livePreview notePath="Note.md" attachments={attachments} onNavigate={onNavigate} />)
  const link = await waitFor(() => {
    const result = container.querySelector<HTMLAnchorElement>('a[data-pdf-link]')
    expect(result).toBeTruthy()
    return result!
  })
  fireEvent.click(link, { ctrlKey: true, detail: 1 })
  expect(await screen.findByText('PDF viewer assets/paper.pdf page 3')).toBeTruthy()
  expect(onNavigate).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})
