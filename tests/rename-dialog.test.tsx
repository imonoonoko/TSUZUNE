// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RenameDialog from '../src/renderer/components/RenameDialog'

afterEach(cleanup)

describe('RenameDialog', () => {
  it('closes only when the backdrop itself is clicked', () => {
    const onCancel = vi.fn()
    render(
      <RenameDialog
        entryPath="A.md"
        entryKind="note"
        currentName="A"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    )
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('ignores a backdrop click while busy', () => {
    const onCancel = vi.fn()
    render(
      <RenameDialog
        entryPath="A.md"
        entryKind="note"
        currentName="A"
        busy
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    )
    fireEvent.click(document.querySelector('.modal-backdrop') as HTMLElement)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
