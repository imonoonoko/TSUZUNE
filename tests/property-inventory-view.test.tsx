// @vitest-environment jsdom

import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PropertyInventoryView from '../src/renderer/components/PropertyInventoryView'
import type { PropertyInventory } from '../src/core/property-inventory'

const inventory: PropertyInventory = {
  scope: 'visible-snapshot',
  noteCount: 4,
  frontmatterNoteCount: 3,
  entries: [
    {
      name: 'status',
      noteCount: 2,
      shapeCounts: { text: 2 },
      status: 'consistent',
      samplePaths: ['A.md', 'B.md']
    },
    {
      name: 'priority',
      noteCount: 3,
      shapeCounts: { number: 2, text: 1 },
      status: 'mixed-types',
      samplePaths: ['A.md', 'C.md']
    }
  ]
}

describe('PropertyInventoryView', () => {
  it('filters, sorts, and opens a sampled note without exposing edit controls', () => {
    const onOpenNote = vi.fn()
    render(<PropertyInventoryView inventory={inventory} onOpenNote={onOpenNote} />)

    expect(screen.getByText('可視ノート 4件・Properties使用ノート 3件')).toBeTruthy()
    expect(screen.getByText('型混在')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /変更|編集|変換/ })).toBeNull()

    fireEvent.change(screen.getByRole('combobox', { name: '並び順' }), {
      target: { value: 'usage' }
    })
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByRole('button').textContent).toBe('priority')

    fireEvent.click(screen.getByRole('button', { name: 'priorityのサンプルを表示' }))
    fireEvent.click(screen.getByRole('button', { name: 'A.md' }))
    expect(onOpenNote).toHaveBeenCalledWith('A.md')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Property名を検索' }), {
      target: { value: 'status' }
    })
    expect(screen.getByRole('button', { name: 'statusのサンプルを表示' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'priorityのサンプルを表示' })).toBeNull()
  })
})
