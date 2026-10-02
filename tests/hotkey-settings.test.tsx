// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HotkeySettings from '../src/renderer/components/HotkeySettings'
import { DEFAULT_HOTKEYS } from '../src/shared/hotkeys'

afterEach(cleanup)

describe('HotkeySettings', () => {
  it('captures valid chords, reports conflicts, and refuses typing intercepts', () => {
    const onChange = vi.fn()
    render(<HotkeySettings value={DEFAULT_HOTKEYS} onChange={onChange} />)
    const save = screen.getByRole('button', { name: '保存のキー' })
    fireEvent.click(save)
    fireEvent.keyDown(save, { key: 'q', ctrlKey: true })
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ command: 'save', key: 'q', ctrl: true })]))

    onChange.mockClear()
    fireEvent.click(save)
    fireEvent.keyDown(save, { key: 'o', ctrlKey: true })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/同じキー/)

    fireEvent.click(save)
    fireEvent.keyDown(save, { key: 'q', shiftKey: true })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/予約済み/)
  })

  it('supports unassignment and restores default bindings', () => {
    const onChange = vi.fn()
    const custom = DEFAULT_HOTKEYS.filter((item) => item.command !== 'save')
    render(<HotkeySettings value={custom} onChange={onChange} />)
    expect(screen.getByRole('button', { name: '保存のキー' }).textContent).toBe('未割り当て')
    fireEvent.click(screen.getByRole('button', { name: '既定に戻す' }))
    expect(onChange).toHaveBeenCalledWith(DEFAULT_HOTKEYS)
  })

  it('cancels capture on Escape and skips composing and repeated key events', () => {
    const onChange = vi.fn()
    render(<HotkeySettings value={DEFAULT_HOTKEYS} onChange={onChange} />)
    const save = screen.getByRole('button', { name: '保存のキー' })
    fireEvent.click(save)
    fireEvent.keyDown(save, { key: 'x', ctrlKey: true, repeat: true })
    fireEvent.keyDown(save, { key: 'x', ctrlKey: true, isComposing: true })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(save, { key: 'Escape' })
    expect(save.textContent).toMatch(/Ctrl\+S/)
  })
})
