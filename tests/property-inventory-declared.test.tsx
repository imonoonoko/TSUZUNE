// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPropertyInventory } from '../src/core/property-inventory'
import PropertyInventoryView from '../src/renderer/components/PropertyInventoryView'
import type { NoteDocument } from '../src/shared/types'

afterEach(cleanup)

const note = (path: string, source: string): NoteDocument => ({
  path, name: path, content: `---\n${source}\n---\n本文`, modifiedAt: 1, size: source.length
})

describe('declared property inventory', () => {
  it('separates declared type from observed values and opens mismatch, empty, and unsupported notes', () => {
    const notes = [
      note('number.md', 'count: 3'),
      note('text.md', 'count: words'),
      note('empty.md', 'count:'),
      note('nested.md', 'count:\n  nested: true')
    ]
    const onOpenNote = vi.fn()
    const onManage = vi.fn()
    render(<PropertyInventoryView inventory={buildPropertyInventory(notes)} notes={notes}
      declaredTypes={{ count: 'number' }} onOpenNote={onOpenNote} onManage={onManage} />)

    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('数値')).toBeTruthy()
    expect(within(row).getByText(/テキスト 1/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'countのサンプルを表示' }))
    const region = screen.getByRole('region', { name: 'countのサンプルノート' })
    expect(within(region).getByText('宣言型と異なる値 1件')).toBeTruthy()
    expect(within(region).getByText('空値 1件')).toBeTruthy()
    expect(within(region).getByText('解析できない値 1件')).toBeTruthy()
    fireEvent.click(within(region).getAllByRole('button', { name: 'text.md' }).at(-1)!)
    fireEvent.click(within(region).getAllByRole('button', { name: 'empty.md' }).at(-1)!)
    fireEvent.click(within(region).getAllByRole('button', { name: 'nested.md' }).at(-1)!)
    expect(onOpenNote.mock.calls.map(([path]) => path)).toEqual(['text.md', 'empty.md', 'nested.md'])
    fireEvent.click(screen.getByRole('button', { name: 'countを管理' }))
    expect(onManage).toHaveBeenCalledWith('count')
  })

  it('saves declaration changes only through onDeclare, including unspecified, and honors disabled', async () => {
    const notes = [note('date.md', 'when: 2026-09-30')]
    const inventory = buildPropertyInventory(notes)
    const onDeclare = vi.fn(async () => {})
    const { rerender } = render(<PropertyInventoryView inventory={inventory} notes={notes}
      declaredTypes={{ when: 'date' }} onOpenNote={vi.fn()} onDeclare={onDeclare} />)
    fireEvent.click(screen.getByRole('button', { name: 'whenのサンプルを表示' }))
    expect(screen.getByRole('combobox', { name: 'whenの宣言型' })).toHaveProperty('value', 'date')
    expect(screen.getByText('宣言型と異なる値 0件')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'whenの宣言型' }), { target: { value: '' } })
    await waitFor(() => expect(onDeclare).toHaveBeenCalledWith('when', null))
    rerender(<PropertyInventoryView inventory={inventory} notes={notes} declaredTypes={{ when: 'date' }}
      onOpenNote={vi.fn()} onDeclare={onDeclare} disabled />)
    expect(screen.getByRole('combobox', { name: 'whenの宣言型' })).toHaveProperty('disabled', true)
  })
})
