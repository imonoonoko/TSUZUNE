// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PaneActionsMenu from '../src/renderer/components/PaneActionsMenu'

afterEach(cleanup)

it('opens by keyboard, skips disabled actions, and restores focus with Escape', () => {
  const select = vi.fn()
  render(<PaneActionsMenu actions={[
    { label: '分割', onSelect: select }, { label: '閉じる', disabled: true, onSelect: select },
    { label: '移動', onSelect: select }
  ]} />)
  const trigger = screen.getByRole('button', { name: 'ペイン操作' })
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '分割' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '移動' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(select).not.toHaveBeenCalled()
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('menuitem', { name: '分割' }))
  expect(select).toHaveBeenCalledOnce()
  expect(screen.queryByRole('menu')).toBeNull()
})
