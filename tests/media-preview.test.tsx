// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'
import AttachmentPreview from '../src/renderer/components/AttachmentPreview'

const attachments = ['assets/音声 One.wav', 'assets/movie.webm'].map(path => ({ path, name: path, size: 10, createdAt: 1, modifiedAt: 1 }))
const vaultPath = 'C:/Example Vault'
const embedContext = { vaultPath, notes: [], attachments }
const getVaultMediaUrl = vi.fn(async (path: string, _expectedVaultPath?: string) => ({ ok: true, value: `tsuzune-media://vault/mock?${encodeURIComponent(path)}` }))
const openVaultFile = vi.fn(async () => ({ ok: true, value: null }))
beforeEach(() => {
  vi.stubGlobal('tsuzune', { getVaultMediaUrl, openVaultFile })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(async () => { cleanup(); await act(async () => {}); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('plays Wiki and Markdown embeds with native controls and without autoplay', async () => {
  const { container } = render(<MarkdownPreview content={'![[音声 One.wav]]\n\n![動画](../assets/movie.webm)'} notePath="notes/n.md" attachments={attachments} embedContext={embedContext} onWikiLink={vi.fn()} />)
  await waitFor(() => expect(container.querySelectorAll('audio[src],video[src]')).toHaveLength(2))
  expect(getVaultMediaUrl.mock.calls).toEqual([['assets/音声 One.wav', vaultPath], ['assets/movie.webm', vaultPath]])
  for (const player of container.querySelectorAll<HTMLMediaElement>('audio,video')) {
    expect(player.controls).toBe(true)
    expect(player.autoplay).toBe(false)
    expect(player.preload).toBe('metadata')
    expect(player.getAttribute('aria-label')).toBeTruthy()
  }
})

it('rejects missing, remote, traversing and ambiguous media embeds without reading', () => {
  render(<MarkdownPreview content={'![[missing.mp3]] ![外部](https://example.com/clip.mp4) ![越境](../outside.wav) ![[duplicate.wav]]'}
    notePath="n.md" attachments={[...attachments, ...['a/duplicate.wav', 'b/duplicate.wav'].map(path => ({ ...attachments[0], path }))]} onWikiLink={vi.fn()} />)
  expect(getVaultMediaUrl).not.toHaveBeenCalled()
  expect(document.querySelector('audio[src],video[src]')).toBeNull()
  expect(screen.getAllByText(/添付が見つからない/)).toHaveLength(4)
})

it('opens a regular media link without creating a note, and releases it on close', async () => {
  const onWikiLink = vi.fn()
  const { container } = render(<MarkdownPreview content={'[[assets/movie.webm|動画を開く]]'} notePath="n.md" attachments={attachments} onWikiLink={onWikiLink} />)
  const opener = screen.getByRole('link', { name: '動画を開く' })
  fireEvent.click(opener)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  const player = container.querySelector('video')!
  fireEvent.click(screen.getByRole('button', { name: '再生表示を閉じる' }))
  expect(player.getAttribute('src')).toBeNull()
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(document.activeElement).toBe(opener)
  expect(onWikiLink).not.toHaveBeenCalled()
})

it('stops the previous player on note change, and keeps it on ordinary rerenders', async () => {
  const props = { content: '![[assets/movie.webm]]', attachments, onWikiLink: vi.fn() }
  const { container, rerender, unmount } = render(<MarkdownPreview {...props} notePath="one.md" />)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  const first = container.querySelector('video')!
  rerender(<MarkdownPreview {...props} notePath="one.md" />)
  expect(container.querySelector('video')).toBe(first)
  rerender(<MarkdownPreview {...props} notePath="two.md" />)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  expect(container.querySelector('video')).not.toBe(first)
  expect(first.getAttribute('src')).toBeNull()
  const last = container.querySelector('video')!
  unmount()
  expect(last.getAttribute('src')).toBeNull()
})

it('reports playback failure and opens the original only on an explicit click', async () => {
  const { container } = render(<AttachmentPreview attachment={attachments[1]} onOpenExternally={() => { void openVaultFile() }} />)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  fireEvent.error(container.querySelector('video')!)
  expect(screen.getByText(/再生できません/)).toBeTruthy()
  expect(openVaultFile).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '既定のアプリで開く' }))
  expect(openVaultFile).toHaveBeenCalledOnce()
})

it('allows Live Preview controls without revealing or editing the source', async () => {
  const source = '# Media\n\n![[assets/movie.webm]]'
  const onChange = vi.fn()
  const { container } = render(<MarkdownEditor value={source} onChange={onChange} livePreview notePath="n.md" attachments={attachments} embedContext={embedContext} />)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  const video = container.querySelector('video')!
  fireEvent.pointerDown(video)
  fireEvent.click(video)
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  expect(container.querySelector('video')).toBe(video)
  expect(view.state.doc.toString()).toBe(source)
  expect(view.state.selection.main.head).toBe(0)
  expect(onChange).not.toHaveBeenCalled()
})

it('keeps media playback while editing another paragraph in Live Preview', async () => {
  const source = '# Memo\n\nBefore\n\n![[assets/movie.webm]]\n\nAfter'
  const { container } = render(<MarkdownEditor value={source} onChange={vi.fn()} livePreview notePath="n.md" attachments={attachments} embedContext={embedContext} />)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  const video = container.querySelector('video')!
  video.currentTime = 3
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  await act(async () => { view.dispatch({ selection: { anchor: source.indexOf('Before') } }) })
  expect(container.querySelector('video')).toBe(video)
  await act(async () => { view.dispatch({ changes: { from: source.indexOf('Before'), insert: 'New ' } }) })
  expect(container.querySelector('video')).toBe(video)
  expect(video.currentTime).toBe(3)
  expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled()
})

it('opens a Live Preview media link with Ctrl-click without invoking note navigation', async () => {
  const onWikiLink = vi.fn()
  const { container } = render(<MarkdownEditor value={'# Media\n\n[[assets/movie.webm|動画]]'} onChange={vi.fn()}
    livePreview notePath="n.md" attachments={attachments} embedContext={embedContext} onWikiLink={onWikiLink} />)
  const link = await screen.findByRole('link', { name: '動画' })
  fireEvent.pointerDown(link, { ctrlKey: true })
  fireEvent.click(link, { ctrlKey: true, detail: 1 })
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  expect(onWikiLink).not.toHaveBeenCalled()
  expect(getVaultMediaUrl).toHaveBeenCalledWith('assets/movie.webm', vaultPath)
})
