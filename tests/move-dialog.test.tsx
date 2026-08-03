// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MoveDialog from '../src/renderer/components/MoveDialog'

afterEach(cleanup)

describe('MoveDialog keyboard contract', () => {
  it('traps focus, closes with Escape, and restores the opener', () => {
    const onConfirm = vi.fn()

    function Harness(): React.JSX.Element {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            移動を開く
          </button>
          {open && (
            <MoveDialog
              notePath="A.md"
              directories={['', 'Archive']}
              currentDirectory=""
              onCancel={() => setOpen(false)}
              onConfirm={onConfirm}
            />
          )}
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: '移動を開く' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'ノートを移動' })
    const destination = screen.getByRole('combobox', { name: '移動先' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(destination)

    fireEvent.keyDown(destination, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: '移動', hidden: true })
    )

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'ノートを移動' })).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
