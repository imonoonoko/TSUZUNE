// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SidebarResizer from '../src/renderer/components/SidebarResizer'

beforeEach(() => {
  // jsdom has no PointerEvent constructor; keep pointer IDs and mouse coordinates observable.
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    readonly pointerId: number
    readonly isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.isPrimary = init.isPrimary ?? true
    }
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('SidebarResizer', () => {
  it.each(['left', 'right'] as const)('exposes bounds and keyboard resizing on the %s side', (side) => {
    const onChange = vi.fn()
    render(<SidebarResizer side={side} width={260} onChange={onChange} />)
    const separator = screen.getByRole('separator')
    expect(separator.getAttribute('aria-orientation')).toBe('vertical')
    expect(separator.getAttribute('aria-valuemin')).toBe('120')
    fireEvent.keyDown(separator, { key: side === 'left' ? 'ArrowRight' : 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(276)
    fireEvent.keyDown(separator, { key: '-' })
    expect(onChange).toHaveBeenLastCalledWith(244)
    fireEvent.keyDown(separator, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(120)
    fireEvent.keyDown(separator, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(640)
    fireEvent.keyDown(separator, { key: 'ArrowRight', isComposing: true })
    expect(onChange).toHaveBeenCalledTimes(4)
  })

  it.each(['left', 'right'] as const)('drags %s width in the correct direction and stops on pointer release', (side) => {
    const onChange = vi.fn()
    render(<SidebarResizer side={side} width={260} onChange={onChange} />)
    const separator = screen.getByRole('separator')
    fireEvent.pointerDown(separator, { button: 0, pointerId: 7, clientX: 300 })
    expect(document.activeElement).toBe(separator)
    fireEvent.pointerMove(window, { pointerId: 8, clientX: 400 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 400 })
    expect(onChange).toHaveBeenLastCalledWith(side === 'left' ? 360 : 160)
    fireEvent.pointerMove(window, { pointerId: 7, clientX: side === 'left' ? 2000 : -2000 })
    expect(onChange).toHaveBeenLastCalledWith(640)
    fireEvent.pointerUp(window, { pointerId: 7 })
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 200 })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('cleans active dragging on cancel, blur and unmount and supports mouse fallback', () => {
    const onChange = vi.fn()
    const { unmount } = render(<SidebarResizer side="left" width={130} onChange={onChange} />)
    const separator = screen.getByRole('separator')
    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 300 })
    fireEvent.pointerCancel(window, { pointerId: 1 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 350 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 300 })
    fireEvent.blur(window)
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 350 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 300 })
    unmount()
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 350 })
    expect(onChange).not.toHaveBeenCalled()

    vi.stubGlobal('PointerEvent', undefined)
    render(<SidebarResizer side="left" width={130} onChange={onChange} />)
    fireEvent.mouseDown(screen.getByRole('separator'), { button: 0, clientX: 300 })
    fireEvent.mouseMove(window, { clientX: 200 })
    expect(onChange).toHaveBeenLastCalledWith(120)
    fireEvent.mouseUp(window)
    fireEvent.mouseMove(window, { clientX: 400 })
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
