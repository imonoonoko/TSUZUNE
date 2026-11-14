// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { CanvasData } from '../src/shared/canvas'
import CanvasView from '../src/renderer/components/CanvasView'

vi.mock('../src/renderer/canvas-png', () => ({ renderCanvasPng: vi.fn(async () => 'data:image/png;base64,test') }))

afterEach(cleanup)

function renderEditor(onSave = vi.fn(), onOpenFile = vi.fn(), initial: CanvasData = { nodes: [], edges: [] }, options: { readOnly?: boolean; onExportPng?: (png: string) => Promise<{ canceled: true } | { canceled: false; path: string }>; renderFile?: (path: string) => React.ReactNode } = {}) {
  function Harness() {
    const [data, setData] = useState(initial)
    return <CanvasView data={data} disabled={false} status="保存済み" filePaths={['Notes/idea.md', 'Images/idea.png']}
      onChange={setData} onSave={onSave} onOpenFile={onOpenFile} onExportPng={options.onExportPng} renderFile={options.renderFile} readOnly={options.readOnly} />
  }
  return render(<Harness />)
}

it('creates and edits a text card, supports local undo, and saves on request', () => {
  const save = vi.fn()
  renderEditor(save)
  fireEvent.click(screen.getByRole('button', { name: 'テキストカードを追加' }))
  const text = screen.getByRole('textbox', { name: 'Canvasテキストカード' }) as HTMLTextAreaElement
  fireEvent.change(text, { target: { value: '考えを整理する' } })
  expect(text.value).toBe('考えを整理する')
  fireEvent.keyDown(screen.getByRole('region', { name: 'Canvasエディター' }), { key: 'z', ctrlKey: true })
  expect(text.value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  expect(save).toHaveBeenCalledOnce()
})

it('groups selected cards, aligns and distributes them, then moves the group and undoes', () => {
  const initial: CanvasData = { nodes: [
    { id: 'a', type: 'text', x: 10, y: 20, width: 100, height: 80, text: 'A' },
    { id: 'b', type: 'text', x: 250, y: 80, width: 100, height: 80, text: 'B' },
    { id: 'c', type: 'text', x: 600, y: 50, width: 100, height: 80, text: 'C' }
  ], edges: [] }
  renderEditor(undefined, undefined, initial)
  fireEvent.click(screen.getByRole('button', { name: '全選択' }))
  fireEvent.click(screen.getByRole('button', { name: '左揃え' }))
  expect(document.querySelectorAll('.canvas-card-text')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: '横方向に等間隔' }))
  fireEvent.click(screen.getByRole('button', { name: 'グループ化' }))
  expect(document.querySelector('.canvas-card-group')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '元に戻す' }))
  expect(document.querySelector('.canvas-card-group')).toBeNull()
})

it('keeps modifier-selected cards together when dragging a selected member', () => {
  const initial: CanvasData = { nodes: [
    { id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 80, text: 'A' },
    { id: 'b', type: 'text', x: 300, y: 0, width: 100, height: 80, text: 'B' }
  ], edges: [] }
  renderEditor(undefined, undefined, initial)
  const cards = document.querySelectorAll('.canvas-card-text')
  fireEvent.pointerDown(cards[0], { button: 0, clientX: 130, clientY: 140 })
  fireEvent.pointerUp(window, { clientX: 130, clientY: 140 })
  fireEvent.pointerDown(cards[1], { button: 0, clientX: 430, clientY: 140, shiftKey: true })
  fireEvent.pointerUp(window, { clientX: 430, clientY: 140, shiftKey: true })
  expect(document.querySelectorAll('.canvas-card.is-selected')).toHaveLength(2)
  fireEvent.pointerDown(cards[0], { button: 0, clientX: 130, clientY: 140 })
  const move = createEvent.pointerMove(window), up = createEvent.pointerUp(window)
  Object.defineProperties(move, { clientX: { value: 150 }, clientY: { value: 150 } })
  Object.defineProperties(up, { clientX: { value: 150 }, clientY: { value: 150 } })
  fireEvent(window, move); fireEvent(window, up)
  fireEvent.click(cards[0])
  expect(document.querySelectorAll('.canvas-card.is-selected')).toHaveLength(2)
})

it('resizes a selected card and keeps PNG export available in read-only mode', async () => {
  const initial: CanvasData = { nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 80, text: 'body' }], edges: [] }
  const exportPng = vi.fn(async () => ({ canceled: false as const, path: 'out.png' }))
  renderEditor(undefined, undefined, initial, { readOnly: true, onExportPng: exportPng })
  expect(screen.getByRole('region', { name: 'Canvasプレビュー（読み取り専用）' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'グループを追加' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '拡大' }))
  expect(screen.getByText('110%')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'PNGで保存' }))
  await waitFor(() => expect(exportPng).toHaveBeenCalledOnce())
  expect(await screen.findByText('PNGを保存しました: out.png')).toBeTruthy()
})

it('resizes a selected card through its resize handle', () => {
  const initial: CanvasData = { nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 80, text: '' }], edges: [] }
  renderEditor(undefined, undefined, initial)
  fireEvent.pointerDown(document.querySelector('.canvas-card-text')!, { button: 0, clientX: 130, clientY: 140 })
  fireEvent.pointerUp(window, { clientX: 130, clientY: 140 })
  const handle = screen.getByRole('button', { name: 'カードのサイズ変更' })
  fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 80 })
  fireEvent.pointerMove(window, { clientX: 150, clientY: 110 })
  fireEvent.pointerUp(window, { clientX: 150, clientY: 110 })
  expect(document.querySelector('.canvas-card-text')?.getAttribute('style')).toContain('width: 150px')
  expect(document.querySelector('.canvas-card-text')?.getAttribute('style')).toContain('height: 110px')
})

it('adds only listed local files by picker or the Vault drag MIME', () => {
  const open = vi.fn()
  renderEditor(undefined, open)
  fireEvent.change(screen.getByRole('combobox', { name: 'Canvasに追加するファイル' }), { target: { value: 'Notes/idea.md' } })
  fireEvent.click(screen.getByRole('button', { name: 'Notes/idea.md' }))
  expect(document.querySelector('.canvas-card header')?.textContent).toBe('Notes/idea.md')

  const board = document.querySelector('.canvas-board') as HTMLDivElement
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 1360, bottom: 880, width: 1360, height: 880, x: 0, y: 0, toJSON() {} })
  const dataTransfer = { types: ['application/x-tsuzune-vault-file'], getData: vi.fn(() => 'Not-listed.md') }
  fireEvent.drop(document.querySelector('.canvas-board-scroll')!, { dataTransfer, clientX: 220, clientY: 180 })
  expect(dataTransfer.getData).toHaveBeenCalledWith('application/x-tsuzune-vault-file')
  expect(screen.queryByText('Not-listed.md')).toBeNull()
  const scroll = document.querySelector('.canvas-board-scroll')!
  const getListedFile = vi.fn(() => 'Images/idea.png')
  const listedFileDrop = createEvent.drop(scroll, { dataTransfer: { types: ['application/x-tsuzune-vault-file'], getData: getListedFile }, clientX: 220, clientY: 180 })
  Object.defineProperties(listedFileDrop, { clientX: { value: 220 }, clientY: { value: 180 } })
  fireEvent(scroll, listedFileDrop)
  expect(getListedFile).toHaveBeenCalledWith('application/x-tsuzune-vault-file')
  expect(document.querySelectorAll('.canvas-card')).toHaveLength(2)
  expect(document.querySelector('.canvas-card-file:last-of-type')?.getAttribute('style')).toContain('left: 180px')
})
