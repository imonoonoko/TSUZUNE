// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PaneLayout from '../src/renderer/components/PaneLayout'
import { closeWorkspacePane, moveWorkspaceTab, paneIds, resizePaneSplit, splitWorkspacePane } from '../src/shared/pane-layout'
import { migrateWorkspaceSnapshotV1, type PaneLayoutNode } from '../src/shared/workspace-state'

const initial = migrateWorkspaceSnapshotV1({ tabs: [{ kind: 'note', path: 'A.md' }, { kind: 'note', path: 'B.md' }], activeIndex: 0,
  noteView: 'edit', left: { open: true, view: 'files', query: '' }, right: { open: false, view: 'outline' } })

afterEach(cleanup)

describe('pane layout operations', () => {
  it('splits to eight nested panes, preserving original tabs, and collapses closed branches', () => {
    let state = initial
    for (let index = 2; index <= 8; index++) state = splitWorkspacePane(state, state.activePaneId, index % 2 ? 'vertical' : 'horizontal', `pane-${index}`)
    expect(state.panes).toHaveLength(8)
    expect(state.panes[0].tabs).toEqual(initial.tabs)
    expect(paneIds(state.layout)).toHaveLength(8)
    expect(() => splitWorkspacePane(state, 'pane-1', 'horizontal', 'pane-9')).toThrow(/8/)
    for (let index = 8; index >= 2; index--) state = closeWorkspacePane(state, `pane-${index}`)
    expect(state.layout).toEqual(initial.layout)
    expect(state.activePaneId).toBe('pane-1')
    expect(() => closeWorkspacePane(state, 'pane-1')).toThrow()
  })

  it('moves tabs with target deduplication and preserves independent panes and active indices', () => {
    const split = splitWorkspacePane(initial, 'pane-1', 'horizontal', 'pane-2')
    const moved = moveWorkspaceTab(split, 'pane-1', 0, 'pane-2')
    expect(moved.panes[0].tabs).toEqual([{ kind: 'note', path: 'B.md' }])
    expect(moved.panes[0].activeIndex).toBe(0)
    expect(moved.panes[1].tabs).toHaveLength(1)
    expect(moved.activePaneId).toBe('pane-2')
    expect(moved.tabs).toEqual(moved.panes[1].tabs)
    expect(split.panes[0].tabs).toHaveLength(2)
    expect(moveWorkspaceTab(moved, 'pane-1', 0, 'pane-2').panes[0].activeIndex).toBeNull()
  })

  it('resizes only the chosen nested split and clamps the ratio', () => {
    const split = splitWorkspacePane(splitWorkspacePane(initial, 'pane-1', 'horizontal', 'pane-2'), 'pane-2', 'vertical', 'pane-3')
    const layout = resizePaneSplit(split.layout, ['second'], 100)
    expect(layout.kind === 'split' && layout.ratio).toBe(0.5)
    expect(layout.kind === 'split' && layout.second.kind === 'split' && layout.second.ratio).toBe(0.9)
  })
})

describe('PaneLayout', () => {
  it('restores view scrolling, captures the actual scroller, and does not rewind ordinary rerenders', () => {
    const onScroll = vi.fn()
    const props = { layout: initial.layout, activePaneId: 'pane-1', onLayoutChange: vi.fn(), onActivePaneChange: vi.fn(),
      getScroll: () => ({ top: 120, left: 7 }), onPaneScroll: onScroll }
    const { rerender } = render(<PaneLayout {...props} renderPane={() => <article className="markdown-preview">本文</article>} />)
    const article = screen.getByRole('article')
    expect(article.scrollTop).toBe(120)
    article.scrollTop = 200
    article.scrollLeft = 8
    fireEvent.scroll(article)
    expect(onScroll).toHaveBeenLastCalledWith('pane-1', { top: 200, left: 8 })
    rerender(<PaneLayout {...props} renderPane={() => <article className="markdown-preview">更新した本文</article>} />)
    expect(article.scrollTop).toBe(200)
    rerender(<PaneLayout {...props} renderPane={() => <div className="cm-scroller" role="region" aria-label="編集スクロール">編集</div>} />)
    expect(screen.getByRole('region', { name: '編集スクロール' }).scrollTop).toBe(120)
  })

  it('exposes accessible keyboard resizing and focus activation on each pane', () => {
    const split = splitWorkspacePane(initial, 'pane-1', 'horizontal', 'pane-2')
    const onChange = vi.fn()
    const onFocus = vi.fn()
    render(<PaneLayout layout={split.layout} activePaneId="pane-1" onLayoutChange={onChange} onActivePaneChange={onFocus}
      renderPane={(id) => <button>{id}</button>} />)
    const separator = screen.getByRole('separator')
    expect(separator.getAttribute('aria-orientation')).toBe('vertical')
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect((onChange.mock.calls[0][0] as Extract<PaneLayoutNode, { kind: 'split' }>).ratio).toBe(0.55)
    fireEvent.keyDown(separator, { key: 'Home' })
    expect(onChange.mock.calls[1][0].ratio).toBe(0.1)
    fireEvent.focus(screen.getByRole('button', { name: 'pane-2' }))
    expect(onFocus).toHaveBeenCalledWith('pane-2')
  })

  it('supports pointer dragging and vertical keyboard adjustment', () => {
    const split = splitWorkspacePane(initial, 'pane-1', 'vertical', 'pane-2')
    const onChange = vi.fn()
    render(<PaneLayout layout={split.layout} activePaneId="pane-1" onLayoutChange={onChange} onActivePaneChange={vi.fn()}
      renderPane={(id) => <button>{id}</button>} />)
    const separator = screen.getByRole('separator')
    separator.setPointerCapture = vi.fn()
    separator.hasPointerCapture = vi.fn(() => true)
    separator.releasePointerCapture = vi.fn()
    separator.parentElement!.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 500, bottom: 1000, width: 500, height: 1000, toJSON() {} })
    fireEvent.keyDown(separator, { key: 'ArrowUp' })
    expect(onChange.mock.calls[0][0].ratio).toBe(0.45)
    fireEvent.pointerMove(separator, { pointerId: 1, clientY: 800 })
    expect(onChange.mock.calls[1][0].ratio).toBe(0.8)
  })
})
