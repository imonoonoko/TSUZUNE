// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CommandPaletteDialog, { type CommandPaletteCommand } from '../src/renderer/components/CommandPaletteDialog'

const commands: CommandPaletteCommand[] = [
  { id: 'open', label: 'ノートを開く', keywords: ['検索', 'ファイル'], shortcut: 'Ctrl+O', state: '準備完了' },
  { id: 'save', label: '保存', keywords: ['書き込み'], shortcut: 'Ctrl+S' },
  { id: 'disabled', label: '同期を実行', keywords: ['クラウド'], state: '停止中', disabledReason: '接続されていません' }
]

afterEach(cleanup)

describe('CommandPaletteDialog', () => {
  it('renders the modal contract and all commands in stable order', () => {
    render(<CommandPaletteDialog commands={commands} onExecute={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: '操作を実行' }).getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('combobox', { name: 'コマンドを検索' })).toBe(document.activeElement)
    expect(screen.getByRole('listbox', { name: 'コマンド候補' })).toBeTruthy()
    expect(screen.getAllByRole('option').map((item) => item.getAttribute('data-command-id'))).toEqual(['open', 'save', 'disabled'])
    expect(screen.getByRole('option', { name: /ノートを開く.*Ctrl\+O.*現在: 準備完了/ })).toBeTruthy()
    const disabled = screen.getByRole('option', { name: /同期を実行.*現在: 停止中.*利用不可: 接続されていません/ })
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    expect(disabled.getAttribute('title')).toBe('利用不可: 接続されていません')
  })

  it('normalizes NFKC lowercase and requires every whitespace token', () => {
    render(<CommandPaletteDialog commands={commands} onExecute={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: ' ＣＴＲＬ+ｏ  検索 ' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option').getAttribute('data-command-id')).toBe('open')
  })

  it('caps results at 50 and keeps deterministic source order', () => {
    const many = Array.from({ length: 80 }, (_, index) => ({ id: `id-${index}`, label: `Action ${index}`, keywords: ['common'] }))
    render(<CommandPaletteDialog commands={many} onExecute={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'common' } })
    expect(screen.getAllByRole('option')).toHaveLength(50)
    expect(screen.getAllByRole('option')[0].getAttribute('data-command-id')).toBe('id-0')
  })

  it('supports keyboard navigation, executes enabled commands, and does not execute disabled commands', () => {
    const onExecute = vi.fn()
    const onClose = vi.fn()
    render(<CommandPaletteDialog commands={commands} onExecute={onExecute} onClose={onClose} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'End' })
    expect(input.getAttribute('aria-activedescendant')).toBe('command-palette-option-disabled')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onExecute).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Home' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onExecute).toHaveBeenCalledWith('open')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('executes by click, scrolls active option, traps Tab, and closes on Escape', () => {
    const onExecute = vi.fn()
    const onClose = vi.fn()
    render(<CommandPaletteDialog commands={commands} onExecute={onExecute} onClose={onClose} />)
    const options = screen.getAllByRole('option')
    const scrollIntoView = vi.fn()
    options[1].scrollIntoView = scrollIntoView
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    expect(scrollIntoView).toHaveBeenCalled()
    fireEvent.click(options[1])
    expect(onExecute).toHaveBeenCalledWith('save')
    const dialog = screen.getByRole('dialog')
    screen.getByRole('combobox').focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '閉じる' }))
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes from a visible close button', () => {
    const onClose = vi.fn()
    render(<CommandPaletteDialog commands={commands} onExecute={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes from the backdrop without dismissing dialog clicks', () => {
    const onClose = vi.fn()
    const { container } = render(
      <CommandPaletteDialog commands={commands} onExecute={vi.fn()} onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(container.querySelector('.command-palette-backdrop')!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the explicit no-match state', () => {
    render(<CommandPaletteDialog commands={commands} onExecute={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '存在しない操作' } })
    expect(screen.getByText('一致するコマンドはありません')).toBeTruthy()
  })
})
