// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import type { NoteDocument } from '../src/shared/types'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'

vi.mock('../src/renderer/components/PdfReader', () => ({
  default: ({ path, expectedRoot }: { path: string; expectedRoot: string }) => <span>{path} in {expectedRoot}</span>
}))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const note = (path: string, content: string): NoteDocument => ({ path, name: path, content, modifiedAt: 1, size: content.length })
const board = { nodes: [
  { id: 'a', type: 'text', text: 'Canvas body', x: -200, y: 40, width: 240, height: 140 },
  { id: 'b', type: 'file', file: 'Source.md', x: 120, y: 40, width: 240, height: 140 }
], edges: [{ id: 'edge', fromNode: 'a', toNode: 'b', label: 'Relation' }] }
function api(content = JSON.stringify(board), paths = ['Board.canvas']) {
  const readCanvas = vi.fn(async (path: string) => ({ ok: true, value: { path, content, modifiedAt: 1 } }))
  const listCanvases = vi.fn(async () => ({ ok: true, value: paths }))
  vi.stubGlobal('tsuzune', { readCanvas, listCanvases, readVaultImage: vi.fn(), writeCanvas: vi.fn() })
  return { readCanvas, listCanvases }
}
function preview(content = '![[Board.canvas]]', notes = [note('Source.md', '**Note body**')], open = vi.fn(), vaultPath = 'C:/fixture') {
  return <MarkdownPreview content={content} notePath="Home.md" notes={notes} attachments={[]} embedContext={{ vaultPath, notes, attachments: [], onOpenCanvas: open }} onWikiLink={vi.fn()} />
}
describe('Canvas embeds in normal notes', () => {
  it('shows a scoped PDF reader and media controls for Vault attachments', async () => {
    api(JSON.stringify({ nodes: [
      { id: 'pdf', type: 'file', file: 'assets/paper.pdf', x: 0, y: 0, width: 300, height: 250 },
      { id: 'media', type: 'file', file: 'assets/clip.wav', x: 400, y: 0, width: 300, height: 250 }
    ], edges: [] }))
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const getVaultMediaUrl = vi.fn(async () => ({ ok: true, value: 'tsuzune-media://vault/fixture' }))
    window.tsuzune.getVaultMediaUrl = getVaultMediaUrl
    const attachments = ['assets/paper.pdf', 'assets/clip.wav'].map(path => ({ path, name: path, size: 1, createdAt: 1, modifiedAt: 1 }))
    render(<MarkdownPreview content="![[Board.canvas]]" notePath="Home.md" attachments={attachments}
      onWikiLink={vi.fn()} embedContext={{ vaultPath: 'C:/fixture', notes: [], attachments }} />)
    expect(await screen.findByText('assets/paper.pdf in C:/fixture')).toBeTruthy()
    const player = await screen.findByLabelText('assets/clip.wav', { selector: 'audio' })
    expect(getVaultMediaUrl).toHaveBeenCalledWith('assets/clip.wav', 'C:/fixture')
    expect(player.hasAttribute('controls')).toBe(true)
  })
  it('shows layout, connections and Markdown file cards without edit controls, and opens the original Canvas', async () => {
    const { readCanvas } = api(); const open = vi.fn()
    const { container } = render(preview(undefined, undefined, open))
    const canvas = await screen.findByRole('region', { name: 'Canvasプレビュー（読み取り専用）' })
    expect(within(canvas).getByText('Canvas body')).toBeTruthy()
    expect(within(canvas).getByText('Note body').tagName).toBe('STRONG')
    expect(canvas.querySelectorAll('.canvas-edges line')).toHaveLength(1)
    expect(within(canvas).getByText('Relation')).toBeTruthy()
    expect(canvas.querySelector('.canvas-card')?.getAttribute('style')).toContain('width: 240px')
    expect(canvas.querySelector('.canvas-toolbar, .canvas-inspector, .canvas-resize, textarea, input, select')).toBeNull()
    fireEvent.keyDown(canvas, { key: 'Delete' }); fireEvent.keyDown(canvas, { key: 's', ctrlKey: true })
    expect(window.tsuzune.writeCanvas).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Canvasを開く' }))
    expect(open).toHaveBeenCalledWith('Board.canvas')
    expect(readCanvas).toHaveBeenCalledTimes(1)
    expect(container.querySelector('p .canvas-embed')).toBeNull()
  })
  it.each(['Missing.canvas', '../Board.canvas', 'Board.canvas#section'])('explains unresolved %s without reading an unsafe or missing path', async target => {
    const { readCanvas } = api()
    render(preview(`![[${target}]]`))
    await waitFor(() => expect(screen.getByRole('group', { name: `埋め込み: ${target}` }).textContent).toMatch(/見つかりません|パス|限定|使えません/))
    expect(readCanvas).not.toHaveBeenCalled()
  })
  it('reports invalid Canvas and stops note/Canvas cycles within the existing depth bound', async () => {
    api('invalid JSON'); const view = render(preview())
    await screen.findByText(/Canvasを表示できません/)
    view.unmount(); api()
    render(preview(undefined, [note('Source.md', '![[Board.canvas]]')]))
    await screen.findByText(/循環参照または埋め込みの深さの上限/)
    expect(document.querySelectorAll('.canvas-readonly')).toHaveLength(1)
  })
  it('refreshes after a snapshot change', async () => {
    const { readCanvas } = api()
    const view = render(preview())
    await screen.findByText('Canvas body')
    readCanvas.mockResolvedValue({ ok: true, value: { path: 'Board.canvas', content: JSON.stringify({ nodes: [], edges: [] }), modifiedAt: 2 } })
    view.rerender(preview(undefined, [note('Source.md', 'Changed')]))
    await screen.findByText('空のCanvasです。')
    expect(screen.queryByText('Canvas body')).toBeNull()
  })
  it('keeps Live Preview controls usable without revealing source on pointer down', async () => {
    api(); const open = vi.fn(); const onChange = vi.fn()
    render(<MarkdownEditor value={'# Host\n\n![[Board.canvas]]'} onChange={onChange} livePreview notePath="Home.md" embedContext={{ vaultPath: "C:/fixture", notes: [], attachments: [], onOpenCanvas: open }} notes={[]} attachments={[]} />)
    const button = await screen.findByRole('button', { name: 'Canvasを開く' })
    fireEvent.pointerDown(button); fireEvent.click(button)
    expect(open).toHaveBeenCalledWith('Board.canvas')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Canvasを開く' })).toBeTruthy()
  })
  it('limits Canvas file-card branches and rejects ambiguous basenames', async () => {
    api(JSON.stringify({ nodes: Array.from({ length: 80 }, (_, i) => ({ id: `n${i}`, type: 'file', file: 'Source.md', x: i * 100, y: 0, width: 100, height: 100 })), edges: [] }))
    const view = render(preview())
    await screen.findAllByText('Note body')
    expect(screen.getAllByText('Note body').length).toBeLessThanOrEqual(63)
    view.unmount(); const { readCanvas } = api('{}', ['a/Board.canvas', 'b/Board.canvas'])
    render(preview())
    await screen.findByText(/同名のCanvasが複数/)
    expect(readCanvas).not.toHaveBeenCalled()
  })
  it('ignores a late result after the Vault scope changes', async () => {
    const { readCanvas } = api()
    let finish!: (value: Awaited<ReturnType<typeof readCanvas>>) => void
    readCanvas.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const view = render(preview())
    await waitFor(() => expect(readCanvas).toHaveBeenCalledTimes(1))
    view.rerender(preview(undefined, [], vi.fn(), 'C:/other'))
    await screen.findByText('Canvas body')
    finish({ ok: true, value: { path: 'Board.canvas', content: JSON.stringify({ nodes: [{ ...board.nodes[0], text: 'Stale Vault body' }], edges: [] }), modifiedAt: 1 } })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByText('Stale Vault body')).toBeNull()
  })
})
