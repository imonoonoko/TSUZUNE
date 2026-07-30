// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
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
      <WikiGraphView graph={graph} currentPath="A.md" onOpen={onOpen} />
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
      <WikiGraphView graph={graph} currentPath="孤立.md" onOpen={() => undefined} />
    )

    expect(screen.getByRole('button', { name: '孤立（現在のノート）' })).toBeTruthy()
    expect(screen.getByText('このノートには接続がありません。')).toBeTruthy()
  })
})
