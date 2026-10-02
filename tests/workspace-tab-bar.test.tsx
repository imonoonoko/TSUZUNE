// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import WorkspaceTabBar, { type WorkspaceTab } from '../src/renderer/components/WorkspaceTabBar'

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})
const tabs: WorkspaceTab[] = [
  { id: 0, kind: 'note', path: '仕事/計画.md' }, { id: 1, kind: 'note', path: '個人/計画.md' },
  ...Array.from({ length: 10 }, (_, index) => ({ id: index + 2, kind: 'note' as const, path: `資料/長い日本語のタイトルでタブの見え方を確認するノート${index}.md` }))
]

it('disambiguates duplicate names only, keeps full paths in tooltips, and scrolls the selected tab', () => {
  const scroll = vi.fn()
  let resize!: () => void
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback }
    observe(): void {}
    disconnect(): void {}
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  const props = { tabs, activeTabId: 0, onActivate: vi.fn(), onClose: vi.fn() }
  const { rerender } = render(<WorkspaceTabBar {...props} />)
  expect(screen.getByRole('tab', { name: '計画 · 仕事' }).title).toBe('計画\n仕事/計画.md')
  expect(screen.getByRole('tab', { name: '計画 · 個人' })).toBeTruthy()
  expect(screen.getByRole('tab', { name: '長い日本語のタイトルでタブの見え方を確認するノート0' }).title).toContain('資料/')
  rerender(<WorkspaceTabBar {...props} activeTabId={11} />)
  expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' })
  expect(scroll.mock.instances.at(-1)).toBe(screen.getAllByRole('tab')[11].parentElement)
  scroll.mockClear()
  resize()
  expect(scroll.mock.instances.at(-1)).toBe(screen.getAllByRole('tab')[11].parentElement)
})

it('supports roving focus, Home/End, activation, closing and a keyboard tab list', () => {
  const activate = vi.fn(), close = vi.fn()
  render(<WorkspaceTabBar tabs={tabs} activeTabId={0} onActivate={activate} onClose={close} />)
  const first = screen.getAllByRole('tab')[0]
  fireEvent.keyDown(first, { key: 'End' })
  const last = screen.getAllByRole('tab')[11]
  expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'Home' })
  expect(document.activeElement).toBe(first)
  fireEvent.keyDown(first, { key: 'ArrowRight' })
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  expect(activate).toHaveBeenLastCalledWith(tabs[1])
  fireEvent.keyDown(document.activeElement!, { key: 'Delete' })
  expect(close).toHaveBeenLastCalledWith(1)
  const trigger = screen.getByRole('button', { name: '開いているタブの一覧' })
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(12)
  expect(screen.getAllByRole('menuitemradio')[0].getAttribute('aria-checked')).toBe('true')
  fireEvent.keyDown(document.activeElement!, { key: 'End' })
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  expect(activate).toHaveBeenLastCalledWith(tabs[11])
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(document.activeElement).toBe(trigger)
  expect(screen.queryByRole('menu')).toBeNull()
})
