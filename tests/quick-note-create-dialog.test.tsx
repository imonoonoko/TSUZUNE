// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QuickNoteCreateDialog from '../src/renderer/components/QuickNoteCreateDialog'

afterEach(cleanup)

const defaultProps = {
  initialName: '新しいノート',
  directories: ['', '10_プロジェクト', '30_知識'],
  initialDirectory: '10_プロジェクト',
  onCancel: vi.fn(),
  onConfirm: vi.fn()
}

describe('QuickNoteCreateDialog', () => {
  it('shows the selected destination and updates the full vault-relative preview', () => {
    render(<QuickNoteCreateDialog {...defaultProps} />)

    expect(screen.getByRole('dialog', { name: '新規ノートを作成' })).toBeTruthy()
    expect(screen.getByLabelText('名前')).toHaveProperty('value', '新しいノート')
    expect(screen.getByLabelText('作成先')).toHaveProperty('value', '10_プロジェクト')
    expect(screen.getByText('作成先: 10_プロジェクト/新しいノート.md')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('名前'), {
      target: { value: 'UI改善メモ' }
    })
    fireEvent.change(screen.getByLabelText('作成先'), { target: { value: '30_知識' } })

    expect(screen.getByText('作成先: 30_知識/UI改善メモ.md')).toBeTruthy()
  })

  it('confirms a trimmed name and directory, and blocks an empty name', () => {
    const onConfirm = vi.fn()
    render(<QuickNoteCreateDialog {...defaultProps} onConfirm={onConfirm} />)

    const name = screen.getByLabelText('名前')
    fireEvent.change(name, { target: { value: '  保存するノート  ' } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))

    expect(onConfirm).toHaveBeenCalledWith({
      name: '保存するノート',
      directory: '10_プロジェクト'
    })

    fireEvent.change(name, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: '作成' })).toHaveProperty('disabled', true)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('cancels on Escape, traps Tab, and restores the opener focus', () => {
    const onCancel = vi.fn()
    function Harness(): React.JSX.Element {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            クイックスイッチャー
          </button>
          {open && (
            <QuickNoteCreateDialog
              {...defaultProps}
              onCancel={() => {
                onCancel()
                setOpen(false)
              }}
            />
          )}
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'クイックスイッチャー' })
    opener.focus()
    fireEvent.click(opener)

    expect(document.activeElement).toBe(screen.getByLabelText('名前'))
    const create = screen.getByRole('button', { name: '作成' })
    create.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByLabelText('名前'))
    screen.getByLabelText('名前').focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(create)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('renders an error and disables controls while busy', () => {
    render(
      <QuickNoteCreateDialog
        {...defaultProps}
        busy
        error="同名のノートが既にあります"
      />
    )

    expect(screen.getByRole('alert').textContent).toContain('同名のノートが既にあります')
    expect(screen.getByLabelText('名前')).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('作成先')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: '作成' })).toHaveProperty('disabled', true)
  })

  it('returns focus to the name after a failed busy submission', () => {
    const { rerender } = render(<QuickNoteCreateDialog {...defaultProps} busy />)

    rerender(
      <QuickNoteCreateDialog
        {...defaultProps}
        busy={false}
        error="同名のノートが既にあります"
      />
    )

    expect(document.activeElement).toBe(screen.getByLabelText('名前'))
  })

  it('does not dismiss while busy, but dismisses from the backdrop when idle', () => {
    const onCancel = vi.fn()
    const { rerender } = render(
      <QuickNoteCreateDialog {...defaultProps} busy onCancel={onCancel} />
    )
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement
    fireEvent.click(backdrop)
    expect(onCancel).not.toHaveBeenCalled()
    rerender(<QuickNoteCreateDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('.modal-backdrop') as HTMLElement)
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
