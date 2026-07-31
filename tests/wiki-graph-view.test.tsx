// @vitest-environment jsdom

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WikiGraph } from '../src/core/graph'
import WikiGraphView from '../src/renderer/components/WikiGraphView'

afterEach(cleanup)

describe('WikiGraphView', () => {
  it('shows directed local connections and opens nodes by pointer or keyboard', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'C.md', targetPath: 'A.md' }
      ]
    }

    const { container } = render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        depth={1}
        scope="local"
        includeOrphans={false}
        onDepthChange={() => undefined}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={onOpen}
      />
    )

    expect(screen.getByRole('region', { name: 'ローカルグラフ' })).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'A（現在のノート）' })
        .getAttribute('aria-current')
    ).toBe('true')
    const outgoing = screen.getByRole('button', {
      name: 'B（リンク先）を開く'
    })
    const incoming = screen.getByRole('button', {
      name: 'C（バックリンク）を開く'
    })
    expect(
      container.querySelector(
        '[data-source-path="A.md"][data-target-path="B.md"]'
      )
    ).toBeTruthy()
    expect(
      container.querySelector(
        '[data-source-path="C.md"][data-target-path="A.md"]'
      )
    ).toBeTruthy()

    await user.click(outgoing)
    incoming.focus()
    await user.keyboard('{Enter}')

    expect(onOpen).toHaveBeenNthCalledWith(1, 'B.md')
    expect(onOpen).toHaveBeenNthCalledWith(2, 'C.md')
  })

  it('keeps an isolated current note visible and explains that it has no connections', () => {
    const graph: WikiGraph = {
      nodes: [{ path: '孤立.md', name: '孤立' }],
      edges: []
    }

    render(
      <WikiGraphView
        graph={graph}
        currentPath="孤立.md"
        depth={1}
        scope="local"
        includeOrphans={false}
        onDepthChange={() => undefined}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: '孤立（現在のノート）' })).toBeTruthy()
    expect(screen.getByText('このノートには接続がありません。')).toBeTruthy()
  })

  it('filters graph nodes by note name or path without hiding the current note', async () => {
    const user = userEvent.setup()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'folder/Beta.md', name: 'Beta' },
        { path: 'notes/Gamma.md', name: 'Gamma' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'folder/Beta.md' },
        { sourcePath: 'A.md', targetPath: 'notes/Gamma.md' }
      ]
    }

    const { container } = render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        depth={1}
        scope="local"
        includeOrphans={false}
        onDepthChange={() => undefined}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    await user.type(
      screen.getByRole('searchbox', { name: 'グラフを絞り込み' }),
      'FOLDER/b'
    )

    expect(screen.getByRole('button', { name: 'A（現在のノート）' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Beta（リンク先）を開く' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Gamma（リンク先）を開く' })
    ).toBeNull()
    expect(
      container.querySelector(
        '[data-source-path="A.md"][data-target-path="folder/Beta.md"]'
      )
    ).toBeTruthy()
    expect(
      container.querySelector(
        '[data-source-path="A.md"][data-target-path="notes/Gamma.md"]'
      )
    ).toBeNull()

    await user.clear(
      screen.getByRole('searchbox', { name: 'グラフを絞り込み' })
    )
    await user.type(
      screen.getByRole('searchbox', { name: 'グラフを絞り込み' }),
      'not-found'
    )

    expect(
      screen.getByText('絞り込み条件に一致する接続がありません。')
    ).toBeTruthy()
  })

  it('zooms, pans, and fits the graph viewport', async () => {
    const user = userEvent.setup()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' }
      ],
      edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
    }

    const { container } = render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        depth={1}
        scope="local"
        includeOrphans={false}
        onDepthChange={() => undefined}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    const canvas = screen.getByRole('region', { name: 'グラフキャンバス' })
    const stage = container.querySelector('.wiki-graph-stage')
    expect(stage).toBeTruthy()
    expect(screen.getByText('表示倍率 100%')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '拡大' }))
    expect(screen.getByText('表示倍率 120%')).toBeTruthy()
    expect(stage?.getAttribute('style')).toContain('scale(1.2)')

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 80 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 132, clientY: 104 })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 132, clientY: 104 })
    expect(stage?.getAttribute('style')).toContain('translate(32px, 24px)')

    canvas.focus()
    await user.keyboard('{ArrowRight}')
    expect(stage?.getAttribute('style')).toContain('translate(64px, 24px)')

    await user.click(screen.getByRole('button', { name: '全体表示' }))
    expect(screen.getByText('表示倍率 100%')).toBeTruthy()
    expect(stage?.getAttribute('style')).toContain(
      'translate(0px, 0px) scale(1)'
    )

    const zoomOut = screen.getByRole('button', { name: '縮小' })
    const zoomIn = screen.getByRole('button', { name: '拡大' })
    await user.click(zoomOut)
    await user.click(zoomOut)
    await user.click(zoomOut)
    expect(screen.getByText('表示倍率 60%')).toBeTruthy()
    expect((zoomOut as HTMLButtonElement).disabled).toBe(true)

    for (let step = 0; step < 6; step += 1) {
      await user.click(zoomIn)
    }
    expect(screen.getByText('表示倍率 180%')).toBeTruthy()
    expect((zoomIn as HTMLButtonElement).disabled).toBe(true)
  })
})
