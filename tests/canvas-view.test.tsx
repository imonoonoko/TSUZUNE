// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { CanvasData } from '../src/shared/canvas'
import CanvasView from '../src/renderer/components/CanvasView'

afterEach(cleanup)

function renderEditor(onSave = vi.fn(), onOpenFile = vi.fn()) {
  function Harness() {
    const [data, setData] = useState<CanvasData>({ nodes: [], edges: [] })
    return <CanvasView data={data} disabled={false} status="保存済み" filePaths={['Notes/idea.md', 'Images/idea.png']}
      onChange={setData} onSave={onSave} onOpenFile={onOpenFile} />
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

it('adds only listed local files by picker or the Vault drag MIME', () => {
  const open = vi.fn()
  renderEditor(undefined, open)
  fireEvent.change(screen.getByRole('combobox', { name: 'Canvasに追加するファイル' }), { target: { value: 'Notes/idea.md' } })
  fireEvent.click(screen.getByRole('button', { name: 'Notes/idea.md' }))
  expect(open).toHaveBeenCalledWith('Notes/idea.md')
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
  expect(document.querySelector('.canvas-card-file:last-of-type')?.getAttribute('style')).toContain('left: 220px')
})
