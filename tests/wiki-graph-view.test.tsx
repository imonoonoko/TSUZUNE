// @vitest-environment jsdom

import React, { useState } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WikiGraph } from '../src/core/graph'
import {
  createWikiGraphSimulation,
  DEFAULT_GRAPH_FORCE_SETTINGS
} from '../src/core/graph-layout'
import WikiGraphView from '../src/renderer/components/WikiGraphView'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../src/shared/graph-display'
import type { GraphGroup, GraphViewState } from '../src/shared/types'

const canvasContext = {
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '',
  globalAlpha: 1,
  lineWidth: 1,
  strokeStyle: ''
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => canvasContext as unknown as CanvasRenderingContext2D
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('WikiGraphView', () => {
  it('rasterizes edges in the unscaled viewport instead of a clipped world canvas', () => {
    const { container } = render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
        }}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        viewState={{
          scale: 0.125,
          query: '',
          settingsOpen: false,
          settingsSections: {
            filters: false,
            groups: false,
            display: false,
            forces: false
          }
        }}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    const viewport = screen.getByRole('region', { name: 'グラフキャンバス' })
    const stage = container.querySelector('.wiki-graph-stage')
    const edges = container.querySelector('canvas.wiki-graph-edges')

    expect(edges?.parentElement).toBe(viewport)
    expect(stage?.contains(edges)).toBe(false)
    expect(edges?.getAttribute('data-render-space')).toBe('viewport')
    expect(canvasContext.setTransform).toHaveBeenCalledWith(
      0.125,
      0,
      0,
      0.125,
      500,
      300
    )
  })

  it('renders the global graph without requiring an active note', () => {
    render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
        }}
        currentPath={null}
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'A（関連ノート）を開く' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'B（関連ノート）を開く' })).toBeTruthy()
    expect(screen.queryByText('現在のノートをグラフに表示できません。')).toBeNull()
  })

  it('offers the chronological time-lapse only in the global graph', async () => {
    const graph: WikiGraph = {
      nodes: [
        { path: 'new.md', name: 'new', kind: 'note', createdAt: 200 },
        { path: 'old.md', name: 'old', kind: 'note', createdAt: 100 }
      ],
      edges: [{ sourcePath: 'old.md', targetPath: 'new.md' }]
    }
    const props = {
      graph,
      currentPath: null,
      includeOrphans: true,
      onScopeChange: () => undefined,
      onIncludeOrphansChange: () => undefined,
      onOpen: () => undefined
    }
    const { rerender } = render(<WikiGraphView {...props} scope="vault" />)

    const start = screen.getByRole('button', {
      name: 'グラフのタイムラプスアニメーションを開始'
    })
    fireEvent.click(start)
    expect(screen.queryByRole('button', { name: 'old（関連ノート）を開く' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'new（関連ノート）を開く' })).toBeNull()

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'old（関連ノート）を開く' })
        ).toBeTruthy(),
      { timeout: 500 }
    )
    expect(screen.queryByRole('button', { name: 'new（関連ノート）を開く' })).toBeNull()

    rerender(<WikiGraphView {...props} currentPath="old.md" scope="local" />)
    expect(
      screen.queryByRole('button', {
        name: 'グラフのタイムラプスアニメーションを開始'
      })
    ).toBeNull()
  })

  it('runs a time-lapse force simulation with only the revealed prefix', () => {
    vi.useFakeTimers()
    const oldNode = {
      path: 'old.md',
      name: 'old',
      kind: 'note' as const,
      createdAt: 100
    }
    const graph: WikiGraph = {
      // Keep source order opposite to chronological order. If the future node
      // is initialized early, old.md receives index 1 and a different seed.
      nodes: [
        { path: 'new.md', name: 'new', kind: 'note', createdAt: 200 },
        oldNode
      ],
      edges: [{ sourcePath: 'old.md', targetPath: 'new.md' }]
    }
    const expectedSimulation = createWikiGraphSimulation(
      { nodes: [oldNode], edges: [] },
      DEFAULT_GRAPH_FORCE_SETTINGS
    )
    const expected = expectedSimulation.positions().get('old.md')!
    expectedSimulation.stop()

    render(
      <WikiGraphView
        graph={graph}
        currentPath={null}
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'グラフのタイムラプスアニメーションを開始'
      })
    )
    act(() => {
      vi.advanceTimersByTime(200)
    })

    const old = screen.getByRole('button', {
      name: 'old（関連ノート）を開く'
    })
    const graphCoordinate = (value: string): number => {
      const match = value.match(/^calc\(50% ([+-]) (.+)px\)$/)
      return Number(match?.[2]) * (match?.[1] === '-' ? -1 : 1)
    }
    expect(graphCoordinate(old.style.left)).toBeCloseTo(expected.x, 10)
    expect(graphCoordinate(old.style.top)).toBeCloseTo(expected.y, 10)
    expect(
      screen.queryByRole('button', { name: 'new（関連ノート）を開く' })
    ).toBeNull()
  })

  it('keeps surviving node positions when the live graph topology changes', () => {
    vi.useFakeTimers()
    const props = {
      currentPath: null,
      scope: 'vault' as const,
      includeOrphans: true,
      onScopeChange: () => undefined,
      onIncludeOrphansChange: () => undefined,
      onOpen: () => undefined
    }
    const { rerender } = render(
      <WikiGraphView
        {...props}
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
        }}
      />
    )
    const before = ['A', 'B'].map((name) => {
      const node = screen.getByRole('button', {
        name: `${name}（関連ノート）を開く`
      })
      return { left: node.style.left, top: node.style.top }
    })

    rerender(
      <WikiGraphView
        {...props}
        graph={{
          // Prepending C would reseed A and B if the simulation were rebuilt.
          nodes: [
            { path: 'C.md', name: 'C' },
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [
            { sourcePath: 'A.md', targetPath: 'B.md' },
            { sourcePath: 'B.md', targetPath: 'C.md' }
          ]
        }}
      />
    )

    expect(
      ['A', 'B'].map((name) => {
        const node = screen.getByRole('button', {
          name: `${name}（関連ノート）を開く`
        })
        return { left: node.style.left, top: node.style.top }
      })
    ).toEqual(before)
    expect(
      screen.getByRole('button', { name: 'C（関連ノート）を開く' })
    ).toBeTruthy()
  })

  it('does not force the active editor note through a global graph search filter', async () => {
    const user = userEvent.setup()

    render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: []
        }}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'ファイルを検索…' }),
      'B'
    )

    expect(screen.queryByTitle('A.md')).toBeNull()
    expect(screen.getByTitle('B.md')).toBeTruthy()
  })

  it('opens an Obsidian-style floating settings panel with collapsible sections', async () => {
    const user = userEvent.setup()

    render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="vault"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    const panel = screen.getByRole('complementary', { name: 'グラフ設定' })
    expect(panel.style.position).toBe('absolute')
    expect(panel.style.top).toBe('12px')
    expect(panel.style.width).toBe('240px')
    expect(screen.queryByRole('searchbox', { name: 'ファイルを検索…' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    expect(screen.getByRole('searchbox', { name: 'ファイルを検索…' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: '存在するファイルのみ表示' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'オーファン' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '表示を開く' }))
    expect(screen.getByRole('slider', { name: 'ノードの大きさ' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '力の強さを開く' }))
    expect(screen.getByRole('slider', { name: '中心力' })).toBeTruthy()
  })

  it('restores and commits the saved zoom and settings panel state for its scope', async () => {
    const user = userEvent.setup()
    const onViewStateCommit = vi.fn()
    const viewState: GraphViewState = {
      scale: 2,
      query: '',
      settingsOpen: true,
      settingsSections: {
        filters: true,
        groups: false,
        display: false,
        forces: false
      }
    }

    const { container } = render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        viewState={viewState}
        onViewStateCommit={onViewStateCommit}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    expect(container.querySelector<HTMLElement>('.wiki-graph-stage')?.style.transform)
      .toContain('scale(2)')
    expect(screen.getByRole('complementary', { name: 'グラフ設定' })).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'ファイルを検索…' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'フィルタを閉じる' }))
    expect(onViewStateCommit).toHaveBeenLastCalledWith({
      ...viewState,
      settingsSections: {
        ...viewState.settingsSections,
        filters: false
      }
    })

    await user.click(screen.getByRole('button', { name: 'グラフ設定を閉じる' }))
    expect(onViewStateCommit).toHaveBeenLastCalledWith({
      ...viewState,
      settingsOpen: false,
      settingsSections: {
        ...viewState.settingsSections,
        filters: false
      }
    })
  })

  it('restores and commits the saved search query for the global graph', () => {
    const onViewStateCommit = vi.fn()
    const viewState = {
      scale: 1,
      query: 'file:Beta',
      settingsOpen: true,
      settingsSections: {
        filters: true,
        groups: false,
        display: false,
        forces: false
      }
    } satisfies GraphViewState

    render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'Alpha.md', name: 'Alpha' },
            { path: 'Beta.md', name: 'Beta' }
          ],
          edges: []
        }}
        currentPath={null}
        scope="vault"
        includeOrphans
        viewState={viewState}
        onViewStateCommit={onViewStateCommit}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    const search = screen.getByRole('searchbox', { name: 'ファイルを検索…' })
    expect((search as HTMLInputElement).value).toBe('file:Beta')

    fireEvent.change(search, { target: { value: 'path:Projects' } })
    expect(onViewStateCommit).toHaveBeenLastCalledWith({
      ...viewState,
      query: 'path:Projects'
    })
  })

  it('adds, edits, recolors, and deletes ordered graph groups', async () => {
    const user = userEvent.setup()
    const onGroupsCommit = vi.fn()

    function Harness(): React.JSX.Element {
      const [groups, setGroups] = useState<GraphGroup[]>([])
      return (
        <WikiGraphView
          graph={{ nodes: [{ path: 'Projects/A.md', name: 'A' }], edges: [] }}
          currentPath={null}
          scope="vault"
          includeOrphans
          groups={groups}
          onScopeChange={() => undefined}
          onIncludeOrphansChange={() => undefined}
          onGroupsChange={setGroups}
          onGroupsCommit={onGroupsCommit}
          onOpen={() => undefined}
        />
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: 'グループを開く' }))
    await user.click(screen.getByRole('button', { name: '新規グループ' }))

    const query = screen.getByPlaceholderText('クエリを入力…')
    expect(query).toBeTruthy()
    expect(onGroupsCommit).toHaveBeenCalledTimes(1)

    fireEvent.change(query, { target: { value: 'path:Projects' } })
    fireEvent.blur(query)
    expect(onGroupsCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ query: 'path:Projects', color: '#e57373' })
    ])

    const color = screen.getByLabelText('グループ1の色')
    fireEvent.change(color, { target: { value: '#123abc' } })
    expect(onGroupsCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ query: 'path:Projects', color: '#123abc' })
    ])

    await user.click(screen.getByRole('button', { name: 'グループ1を削除' }))
    expect(screen.queryByPlaceholderText('クエリを入力…')).toBeNull()
    expect(onGroupsCommit).toHaveBeenLastCalledWith([])
  })

  it('uses group color for matching nodes while active purple still wins', async () => {
    const user = userEvent.setup()
    render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'Projects/A.md', name: 'A', kind: 'note' },
            { path: 'B.md', name: 'B', kind: 'note' }
          ],
          edges: [{ sourcePath: 'B.md', targetPath: 'Projects/A.md' }]
        }}
        currentPath="B.md"
        scope="vault"
        includeOrphans
        groups={[
          { id: 'projects', query: 'path:Projects', color: '#123abc' }
        ]}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    const node = screen.getByRole('button', { name: 'A（リンク先）を開く' })
    const dot = node.querySelector<HTMLElement>('.wiki-graph-node-dot')
    expect(dot?.style.background).toBe('rgb(18, 58, 188)')

    await user.hover(node)
    expect(dot?.style.background).toBe('rgb(124, 92, 240)')
  })

  it('reorders groups by dragging the color swatch and persists first-match order', () => {
    const onGroupsCommit = vi.fn()

    function Harness(): React.JSX.Element {
      const [groups, setGroups] = useState<GraphGroup[]>([
        { id: 'name', query: 'file:A', color: '#e57373' },
        { id: 'path', query: 'path:Projects', color: '#64b5f6' }
      ])
      return (
        <WikiGraphView
          graph={{ nodes: [{ path: 'Projects/A.md', name: 'A' }], edges: [] }}
          currentPath={null}
          scope="vault"
          includeOrphans
          groups={groups}
          onScopeChange={() => undefined}
          onIncludeOrphansChange={() => undefined}
          onGroupsChange={setGroups}
          onGroupsCommit={onGroupsCommit}
          onOpen={() => undefined}
        />
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    fireEvent.click(screen.getByRole('button', { name: 'グループを開く' }))

    const node = screen.getByRole('button', { name: 'A（関連ノート）を開く' })
    const dot = node.querySelector<HTMLElement>('.wiki-graph-node-dot')
    expect(dot?.style.background).toBe('rgb(229, 115, 115)')

    const firstSwatch = screen.getByLabelText('グループ1の色')
    const secondSwatch = screen.getByLabelText('グループ2の色')
    expect(firstSwatch.getAttribute('title')).toBe(
      'クリックで色を変更\nドラッグでグループを並び替え'
    )
    fireEvent.dragStart(firstSwatch)
    fireEvent.dragOver(secondSwatch)
    fireEvent.drop(secondSwatch)

    expect(onGroupsCommit).toHaveBeenLastCalledWith([
      { id: 'path', query: 'path:Projects', color: '#64b5f6' },
      { id: 'name', query: 'file:A', color: '#e57373' }
    ])
    expect(dot?.style.background).toBe('rgb(100, 181, 246)')
  })

  it('exposes working Obsidian Local filters and unresolved node styling', async () => {
    const user = userEvent.setup()
    const onFilterSettingsChange = vi.fn()
    const onFilterSettingsCommit = vi.fn()
    const graphFilters = {
      showTags: false,
      showAttachments: false,
      existingFilesOnly: false,
      showOrphans: true,
      outgoingLinks: true,
      incomingLinks: true,
      neighborLinks: false
    }

    const { container } = render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A', kind: 'note', exists: true },
            {
              path: '未作成.md',
              name: '未作成',
              kind: 'unresolved',
              exists: false
            }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: '未作成.md' }]
        }}
        currentPath="A.md"
        scope="local"
        includeOrphans
        filterSettings={graphFilters}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onFilterSettingsChange={onFilterSettingsChange}
        onFilterSettingsCommit={onFilterSettingsCommit}
        onOpen={() => undefined}
      />
    )

    const unresolvedButton = screen.getByRole('button', {
      name: '未作成（リンク先）を開く'
    })
    const unresolvedDot = unresolvedButton.querySelector<HTMLElement>(
      '.wiki-graph-node-dot'
    )
    expect(unresolvedDot?.style.background).toBe('rgb(171, 171, 171)')
    expect(unresolvedButton.style.opacity).toBe('0.5')

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    await user.click(screen.getByRole('checkbox', { name: 'ネイバーリンク' }))

    expect(onFilterSettingsChange).toHaveBeenLastCalledWith({
      ...graphFilters,
      neighborLinks: true
    })
    expect(onFilterSettingsCommit).toHaveBeenLastCalledWith({
      ...graphFilters,
      neighborLinks: true
    })
    expect(screen.getByRole('checkbox', { name: '出ていくリンク' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: '入ってくるリンク' })).toBeTruthy()
  })

  it('shows the Obsidian tag filter before existing files and commits changes', async () => {
    const user = userEvent.setup()
    const onFilterSettingsChange = vi.fn()
    const onFilterSettingsCommit = vi.fn()
    const graphFilters = {
      showTags: false,
      showAttachments: false,
      existingFilesOnly: false,
      showOrphans: true,
      outgoingLinks: true,
      incomingLinks: true,
      neighborLinks: false
    }

    render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        filterSettings={graphFilters}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onFilterSettingsChange={onFilterSettingsChange}
        onFilterSettingsCommit={onFilterSettingsCommit}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: 'フィルタを開く' }))

    const tags = screen.getByRole('checkbox', { name: 'タグ' })
    const existingFiles = screen.getByRole('checkbox', {
      name: '存在するファイルのみ表示'
    })
    expect(
      tags.compareDocumentPosition(existingFiles) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    await user.click(tags)

    expect(onFilterSettingsChange).toHaveBeenLastCalledWith({
      ...graphFilters,
      showTags: true
    })
    expect(onFilterSettingsCommit).toHaveBeenLastCalledWith({
      ...graphFilters,
      showTags: true
    })
  })

  it('shows the attachment filter after tags and commits changes', async () => {
    const user = userEvent.setup()
    const onFilterSettingsChange = vi.fn()
    const onFilterSettingsCommit = vi.fn()
    const graphFilters = {
      showTags: false,
      showAttachments: false,
      existingFilesOnly: false,
      showOrphans: true,
      outgoingLinks: true,
      incomingLinks: true,
      neighborLinks: false
    }

    render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        filterSettings={graphFilters}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onFilterSettingsChange={onFilterSettingsChange}
        onFilterSettingsCommit={onFilterSettingsCommit}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: 'フィルタを開く' }))

    const tags = screen.getByRole('checkbox', { name: 'タグ' })
    const attachments = screen.getByRole('checkbox', { name: '添付書類' })
    const existingFiles = screen.getByRole('checkbox', {
      name: '存在するファイルのみ表示'
    })
    expect(
      tags.compareDocumentPosition(attachments) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      attachments.compareDocumentPosition(existingFiles) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    await user.click(attachments)

    expect(onFilterSettingsChange).toHaveBeenLastCalledWith({
      ...graphFilters,
      showAttachments: true
    })
    expect(onFilterSettingsCommit).toHaveBeenLastCalledWith({
      ...graphFilters,
      showAttachments: true
    })
  })

  it('opens global tag search from tag nodes by click or right-click', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onSearchTag = vi.fn()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A', kind: 'note', exists: true },
        {
          path: 'tag:#design',
          name: '#design',
          kind: 'tag' as never,
          exists: true
        }
      ],
      edges: [{ sourcePath: 'A.md', targetPath: 'tag:#design' }]
    }

    render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onSearchTag={onSearchTag}
        onOpen={onOpen}
      />
    )

    const tagNode = screen.getByRole('button', {
      name: '#design（タグ）を検索'
    })
    expect(
      tagNode.querySelector<HTMLElement>('.wiki-graph-node-dot')?.style.background
    ).toBe('rgb(8, 185, 78)')

    await user.click(tagNode)
    expect(onSearchTag).toHaveBeenNthCalledWith(1, '#design')
    fireEvent.contextMenu(tagNode)
    expect(onSearchTag).toHaveBeenNthCalledWith(2, '#design')
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.queryByRole('menuitem', { name: 'ファイルを移動…' })).toBeNull()
  })

  it('routes existing, unresolved, and attachment nodes through normal open resolution', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A', kind: 'note', exists: true },
        {
          path: 'Missing.md',
          name: 'Missing',
          kind: 'unresolved',
          exists: false
        },
        {
          path: 'assets/diagram.png',
          name: 'diagram.png',
          kind: 'attachment',
          exists: true
        }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'Missing.md' },
        { sourcePath: 'A.md', targetPath: 'assets/diagram.png' }
      ]
    }

    render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={onOpen}
      />
    )

    await user.click(screen.getByRole('button', { name: 'A（現在のノート）' }))
    await user.click(
      screen.getByRole('button', { name: 'Missing（リンク先）を開く' })
    )
    await user.click(
      screen.getByRole('button', { name: 'diagram.png（添付書類）を開く' })
    )

    expect(onOpen).toHaveBeenNthCalledWith(1, 'A.md')
    expect(onOpen).toHaveBeenNthCalledWith(2, 'Missing.md')
    expect(onOpen).toHaveBeenNthCalledWith(3, 'assets/diagram.png')

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Missing（リンク先）を開く' })
    )
    expect(screen.queryByRole('menuitem', { name: 'ファイルを移動…' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'ブックマーク…' })).toBeNull()
  })

  it('opens the file context menu for file-backed nodes and exposes real callbacks only', async () => {
    const user = userEvent.setup()
    const onOpenInNewTab = vi.fn()
    const onOpenInNewWindow = vi.fn()
    const onMove = vi.fn()
    const onBookmark = vi.fn()
    const onCopyPath = vi.fn()
    const onTrash = vi.fn()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A', kind: 'note', exists: true },
        {
          path: 'assets/diagram.png',
          name: 'diagram.png',
          kind: 'attachment',
          exists: true
        }
      ],
      edges: [{ sourcePath: 'A.md', targetPath: 'assets/diagram.png' }]
    }

    render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpenInNewTab={onOpenInNewTab}
        onOpenInNewWindow={onOpenInNewWindow}
        onMove={onMove}
        onBookmark={onBookmark}
        onCopyPath={onCopyPath}
        onTrash={onTrash}
        onOpen={() => undefined}
      />
    )

    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'diagram.png（添付書類）を開く'
      }),
      { clientX: 240, clientY: 160 }
    )

    const menu = screen.getByRole('menu', { name: 'diagram.png' })
    expect(menu.querySelector('.wiki-graph-context-title')?.textContent).toBe(
      'diagram.png'
    )
    await user.click(screen.getByRole('menuitem', { name: '新規タブに開く' }))
    expect(onOpenInNewTab).toHaveBeenCalledWith('assets/diagram.png')

    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'diagram.png（添付書類）を開く'
      })
    )
    await user.click(screen.getByRole('menuitem', { name: '新規ウィンドウで開く' }))
    expect(onOpenInNewWindow).toHaveBeenCalledWith('assets/diagram.png')

    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'diagram.png（添付書類）を開く'
      })
    )
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.map((item) => item.textContent)).toEqual([
      '新規タブに開く',
      '新規ウィンドウで開く',
      'ファイルを移動…',
      'ブックマーク…',
      'パスをコピー ›',
      'ファイルを削除'
    ])
    await user.click(screen.getByRole('menuitem', { name: 'ブックマーク…' }))
    expect(onBookmark).toHaveBeenCalledWith('assets/diagram.png')

    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'diagram.png（添付書類）を開く'
      })
    )
    await user.click(screen.getByRole('menuitem', { name: 'パスをコピー' }))
    expect(screen.getByRole('menu', { name: 'diagram.png' })).toBeTruthy()
    expect(
      within(screen.getByRole('menu', { name: 'パスをコピー' }))
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      'Obsidian URL として',
      '保管庫フォルダから',
      'システムルートから'
    ])
    await user.click(screen.getByRole('menuitem', { name: '保管庫フォルダから' }))
    expect(onCopyPath).toHaveBeenCalledWith(
      'assets/diagram.png',
      'vault-relative'
    )
    expect(screen.queryByRole('menu', { name: 'diagram.png' })).toBeNull()

    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'diagram.png（添付書類）を開く'
      })
    )
    await user.click(screen.getByRole('menuitem', { name: 'ファイルを移動…' }))
    expect(onMove).toHaveBeenCalledWith('assets/diagram.png')

    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'diagram.png（添付書類）を開く'
      })
    )
    await user.click(screen.getByRole('menuitem', { name: 'ファイルを削除' }))
    expect(onTrash).toHaveBeenCalledWith('assets/diagram.png')

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'A（現在のノート）' })
    )
    await user.click(screen.getByRole('menuitem', { name: 'パスをコピー' }))
    await user.click(screen.getByRole('menuitem', { name: 'Obsidian URL として' }))
    expect(onCopyPath).toHaveBeenLastCalledWith('A.md', 'obsidian-url')

    const canvas = document.querySelector('.wiki-graph-canvas')
    expect(canvas).toBeTruthy()
    Object.defineProperty(canvas, 'clientWidth', {
      configurable: true,
      value: 800
    })
    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'diagram.png（添付書類）を開く'
      }),
      { clientX: 700 }
    )
    expect(
      (screen.getByRole('menu', { name: 'diagram.png' }) as HTMLElement).style.left
    ).toBe('610px')
    await user.click(screen.getByRole('menuitem', { name: 'パスをコピー' }))
    expect(
      screen
        .getByRole('menu', { name: 'パスをコピー' })
        .classList.contains('is-left')
    ).toBe(true)
    await user.click(screen.getByRole('menuitem', { name: 'システムルートから' }))

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'A（現在のノート）' })
    )
    await user.click(screen.getByRole('menuitem', { name: 'ファイルを移動…' }))
    expect(onMove).toHaveBeenLastCalledWith('A.md')
  })

  it('offers bookmark editing for an already-bookmarked file node', () => {
    render(
      <WikiGraphView
        graph={{
          nodes: [
            {
              path: 'assets/diagram.png',
              name: 'diagram.png',
              kind: 'attachment',
              exists: true
            }
          ],
          edges: []
        }}
        currentPath={null}
        scope="vault"
        includeOrphans
        bookmarkedPaths={new Set(['assets/diagram.png'])}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onBookmark={() => undefined}
        onOpen={() => undefined}
      />
    )

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'diagram.png（添付書類）を開く' })
    )
    expect(
      screen.getByRole('menuitem', { name: 'ブックマークを編集' })
    ).toBeTruthy()
  })

  it('does not pretend in-place opening is a new tab', () => {
    render(
      <WikiGraphView
        graph={{
          nodes: [{ path: 'A.md', name: 'A', kind: 'note', exists: true }],
          edges: []
        }}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onTrash={() => undefined}
        onOpen={() => undefined}
      />
    )

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'A（現在のノート）' })
    )
    expect(
      screen.getByRole('menuitem', { name: '新規タブに開く' })
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByRole('menuitem', { name: '新規ウィンドウで開く' })
    ).toHaveProperty('disabled', true)
  })

  it('renders interactive attachment nodes in gold and preserves drag suppression', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A', kind: 'note', exists: true },
        {
          path: 'assets/diagram.png',
          name: 'diagram.png',
          kind: 'attachment',
          exists: true
        }
      ],
      edges: [{ sourcePath: 'A.md', targetPath: 'assets/diagram.png' }]
    }

    render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={onOpen}
      />
    )

    const attachmentNode = screen.getByRole('button', {
      name: 'diagram.png（添付書類）を開く'
    })
    const attachmentDot = attachmentNode.querySelector<HTMLElement>(
      '.wiki-graph-node-dot'
    )
    expect(attachmentDot?.style.background).toBe('rgb(224, 172, 0)')

    await user.hover(attachmentNode)
    expect(attachmentDot?.style.background).toBe('rgb(124, 92, 240)')
    await user.unhover(attachmentNode)
    expect(attachmentDot?.style.background).toBe('rgb(224, 172, 0)')

    fireEvent.focus(attachmentNode)
    expect(attachmentDot?.style.background).toBe('rgb(124, 92, 240)')
    await user.click(attachmentNode)
    expect(onOpen).toHaveBeenCalledWith('assets/diagram.png')
    onOpen.mockClear()

    const styleBeforeDrag = attachmentNode.getAttribute('style')
    fireEvent.pointerDown(attachmentNode, {
      pointerId: 12,
      button: 0,
      buttons: 1,
      clientX: 200,
      clientY: 120
    })
    fireEvent.pointerMove(attachmentNode, {
      pointerId: 12,
      buttons: 1,
      clientX: 250,
      clientY: 160
    })
    await waitFor(() => {
      expect(attachmentNode.getAttribute('style')).not.toBe(styleBeforeDrag)
    })
    fireEvent.pointerUp(attachmentNode, {
      pointerId: 12,
      button: 0,
      clientX: 250,
      clientY: 160
    })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('keeps edge arrows off by default like Obsidian 1.13.4', async () => {
    canvasContext.fill.mockClear()
    canvasContext.stroke.mockClear()

    render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
        }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    await waitFor(() => expect(canvasContext.stroke).toHaveBeenCalled())
    expect(canvasContext.fill).not.toHaveBeenCalled()
  })

  it('exposes the Obsidian 1.13.4 display controls and ranges', async () => {
    const user = userEvent.setup()

    render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: '表示を開く' }))

    const arrows = screen.getByRole('checkbox', { name: '矢印' })
    expect((arrows as HTMLInputElement).checked).toBe(false)

    const textFade = screen.getByRole('slider', {
      name: 'テキストフェードの閾値'
    })
    expect(textFade.getAttribute('min')).toBe('-3')
    expect(textFade.getAttribute('max')).toBe('3')
    expect(textFade.getAttribute('step')).toBe('0.1')

    const nodeSize = screen.getByRole('slider', { name: 'ノードの大きさ' })
    expect(nodeSize.getAttribute('min')).toBe('0.1')
    expect(nodeSize.getAttribute('max')).toBe('5')

    const linkThickness = screen.getByRole('slider', {
      name: 'リンクの太さ'
    })
    expect(linkThickness.getAttribute('min')).toBe('0.1')
    expect(linkThickness.getAttribute('max')).toBe('5')
  })

  it('applies display setting changes to arrows, labels, nodes, and links', async () => {
    const user = userEvent.setup()
    canvasContext.fill.mockClear()
    canvasContext.stroke.mockClear()
    canvasContext.lineWidth = 1

    const { container } = render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
        }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: '表示を開く' }))

    canvasContext.fill.mockClear()
    await user.click(screen.getByRole('checkbox', { name: '矢印' }))
    await waitFor(() => expect(canvasContext.fill).toHaveBeenCalled())

    const nodeDot = container.querySelector<HTMLElement>(
      '.wiki-graph-node-dot'
    )!
    const initialNodeWidth = nodeDot.style.width
    fireEvent.change(screen.getByRole('slider', { name: 'ノードの大きさ' }), {
      target: { value: '2' }
    })
    await waitFor(() => expect(nodeDot.style.width).not.toBe(initialNodeWidth))

    fireEvent.change(screen.getByRole('slider', { name: 'リンクの太さ' }), {
      target: { value: '2' }
    })
    await waitFor(() => expect(canvasContext.lineWidth).toBe(3.6))

    const nodeLabel = container.querySelector<HTMLElement>(
      '.wiki-graph-node-label'
    )!
    const initialLabelOpacity = nodeLabel.style.opacity
    fireEvent.change(
      screen.getByRole('slider', { name: 'テキストフェードの閾値' }),
      { target: { value: '3' } }
    )
    await waitFor(() =>
      expect(nodeLabel.style.opacity).not.toBe(initialLabelOpacity)
    )
  })

  it('edits and restores the four Obsidian-compatible force settings', async () => {
    const user = userEvent.setup()
    const onForceSettingsChange = vi.fn()
    const onForceSettingsCommit = vi.fn()
    const forceSettings = {
      centerForce: 0.25,
      repelForce: 7,
      linkForce: 0.45,
      linkDistance: 288
    }

    render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        forceSettings={forceSettings}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onForceSettingsChange={onForceSettingsChange}
        onForceSettingsCommit={onForceSettingsCommit}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: '力の強さを開く' }))
    expect((screen.getByRole('slider', { name: '中心力' }) as HTMLInputElement).value).toBe('0.25')
    expect((screen.getByRole('slider', { name: '反発力' }) as HTMLInputElement).value).toBe('7')
    expect((screen.getByRole('slider', { name: 'リンクする力' }) as HTMLInputElement).value).toBe('0.45')
    expect((screen.getByRole('slider', { name: 'リンク距離' }) as HTMLInputElement).value).toBe('288')

    fireEvent.change(screen.getByRole('slider', { name: '中心力' }), {
      target: { value: '0.8' }
    })
    expect(onForceSettingsChange).toHaveBeenLastCalledWith({
      ...forceSettings,
      centerForce: 0.8
    })
    expect(onForceSettingsCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(screen.getByRole('slider', { name: '中心力' }))
    expect(onForceSettingsCommit).toHaveBeenLastCalledWith({
      ...forceSettings,
      centerForce: 0.8
    })
    expect(onForceSettingsCommit).toHaveBeenCalledTimes(1)
    fireEvent.blur(screen.getByRole('slider', { name: '中心力' }))
    expect(onForceSettingsCommit).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: '初期設定に戻す' }))
    expect(onForceSettingsChange).toHaveBeenLastCalledWith(
      DEFAULT_GRAPH_FORCE_SETTINGS
    )
    expect(onForceSettingsCommit).toHaveBeenLastCalledWith(
      DEFAULT_GRAPH_FORCE_SETTINGS
    )
    expect(onForceSettingsCommit).toHaveBeenCalledTimes(2)
  })

  it('restores filters, orphans, display, and force settings together', async () => {
    const user = userEvent.setup()
    const onIncludeOrphansChange = vi.fn()
    const onDisplaySettingsChange = vi.fn()
    const onDisplaySettingsCommit = vi.fn()
    const onForceSettingsChange = vi.fn()
    const onForceSettingsCommit = vi.fn()

    render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="vault"
        includeOrphans={false}
        displaySettings={{ arrows: true, textFade: 2, nodeSize: 2, lineSize: 2 }}
        forceSettings={{
          centerForce: 0.2,
          repelForce: 5,
          linkForce: 0.4,
          linkDistance: 180
        }}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={onIncludeOrphansChange}
        onDisplaySettingsChange={onDisplaySettingsChange}
        onDisplaySettingsCommit={onDisplaySettingsCommit}
        onForceSettingsChange={onForceSettingsChange}
        onForceSettingsCommit={onForceSettingsCommit}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: 'フィルタを開く' }))
    const search = screen.getByRole('searchbox', { name: 'ファイルを検索…' })
    await user.type(search, 'A')
    await user.click(screen.getByRole('button', { name: '初期設定に戻す' }))

    expect((search as HTMLInputElement).value).toBe('')
    expect(onIncludeOrphansChange).toHaveBeenLastCalledWith(true)
    expect(onDisplaySettingsChange).toHaveBeenLastCalledWith(
      DEFAULT_GRAPH_DISPLAY_SETTINGS
    )
    expect(onDisplaySettingsCommit).toHaveBeenLastCalledWith(
      DEFAULT_GRAPH_DISPLAY_SETTINGS
    )
    expect(onForceSettingsChange).toHaveBeenLastCalledWith(
      DEFAULT_GRAPH_FORCE_SETTINGS
    )
    expect(onForceSettingsCommit).toHaveBeenLastCalledWith(
      DEFAULT_GRAPH_FORCE_SETTINGS
    )
  })

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
        scope="local"
        includeOrphans={false}
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
      container
        .querySelector('canvas.wiki-graph-edges')
        ?.getAttribute('data-edge-count')
    ).toBe('2')
    expect(container.querySelector('svg')).toBeNull()

    await user.click(outgoing)
    incoming.focus()
    await user.keyboard('{Enter}')

    expect(onOpen).toHaveBeenNthCalledWith(1, 'B.md')
    expect(onOpen).toHaveBeenNthCalledWith(2, 'C.md')
  })

  it('renders every visible Markdown file as a circular node connected by canvas edges', () => {
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'C.md' }
      ]
    }

    const { container } = render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    const dots = container.querySelectorAll<HTMLElement>(
      '.wiki-graph-node-dot'
    )
    expect(dots).toHaveLength(3)
    for (const dot of dots) {
      expect(dot.style.width).toBe(dot.style.height)
      expect(dot.style.borderRadius).toBe('50%')
    }
    expect(container.querySelectorAll('.wiki-graph-node-label')).toHaveLength(3)
    expect(
      container
        .querySelector('canvas.wiki-graph-edges')
        ?.getAttribute('data-edge-count')
    ).toBe('2')
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
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: '孤立（現在のノート）' })).toBeTruthy()
    expect(screen.getByText('このノートには接続がありません。')).toBeTruthy()
  })

  it('uses one neutral node color instead of a visible relation legend', () => {
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' },
        { path: 'D.md', name: 'D' },
        { path: 'E.md', name: 'E' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'C.md', targetPath: 'A.md' },
        { sourcePath: 'A.md', targetPath: 'E.md' },
        { sourcePath: 'E.md', targetPath: 'A.md' }
      ]
    }

    const { container } = render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    expect(screen.queryByRole('list', { name: 'グラフ凡例' })).toBeNull()
    expect(screen.queryByText('矢印はWikiリンクの向き')).toBeNull()

    const dotFor = (accessibleName: string): HTMLElement =>
      screen
        .getByRole('button', { name: accessibleName })
        .querySelector<HTMLElement>('.wiki-graph-node-dot')!
    const outgoing = dotFor('B（リンク先）を開く')
    const incoming = dotFor('C（バックリンク）を開く')
    const related = dotFor('D（関連ノート）を開く')
    const reciprocal = dotFor('E（相互リンク）を開く')
    const current = dotFor('A（現在のノート）')

    for (const node of [outgoing, incoming, related, reciprocal]) {
      expect(node.style.background).toBe('rgb(92, 92, 92)')
      expect(node.style.borderColor).toBe(outgoing.style.borderColor)
    }
    expect(current.style.background).toBe('rgb(124, 92, 240)')
    expect(current.style.background).not.toBe(outgoing.style.background)
    expect(container.querySelector('.wiki-graph-node.is-outgoing')).toBeTruthy()
  })

  it('highlights connections on pointer hover or keyboard focus', async () => {
    const user = userEvent.setup()
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' },
        { path: 'D.md', name: 'D' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'C.md', targetPath: 'D.md' }
      ]
    }

    const { container } = render(
      <WikiGraphView
        graph={graph}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    const nodeB = screen.getByRole('button', {
      name: 'B（リンク先）を開く'
    })
    const nodeD = screen.getByRole('button', {
      name: 'D（関連ノート）を開く'
    })
    const nodeC = screen.getByRole('button', {
      name: 'C（関連ノート）を開く'
    })
    const neutralNodeColor = nodeC.querySelector<HTMLElement>(
      '.wiki-graph-node-dot'
    )?.style.background
    const edgeCanvas = container.querySelector('canvas.wiki-graph-edges')

    expect(edgeCanvas?.getAttribute('data-active-path')).toBe('')
    expect(nodeD.style.opacity).toBe('1')

    await user.hover(nodeB)
    expect(edgeCanvas?.getAttribute('data-active-path')).toBe('B.md')
    expect(nodeD.style.opacity).toBe('0.28')
    expect(
      nodeB.querySelector<HTMLElement>('.wiki-graph-node-dot')?.style.background
    ).toBe('rgb(124, 92, 240)')
    expect(
      screen
        .getByRole('button', { name: 'A（現在のノート）' })
        .style.opacity
    ).toBe('1')

    await user.unhover(nodeB)
    expect(edgeCanvas?.getAttribute('data-active-path')).toBe('')
    expect(nodeD.style.opacity).toBe('1')

    fireEvent.focus(nodeD)
    expect(edgeCanvas?.getAttribute('data-active-path')).toBe('D.md')
    expect(nodeB.style.opacity).toBe('0.28')
    expect(
      nodeC.querySelector<HTMLElement>('.wiki-graph-node-dot')?.style.background
    ).toBe(neutralNodeColor)
    expect(nodeC.style.opacity).toBe('1')
  })

  it('keeps the current note active only in the local graph neutral state', () => {
    const { container } = render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
        }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    expect(
      container
        .querySelector('canvas.wiki-graph-edges')
        ?.getAttribute('data-active-path')
    ).toBe('A.md')
  })

  it('shows labels at the saved production zoom and fully reveals the hovered label', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="vault"
        includeOrphans
        viewState={{
          scale: 0.36288736930121135,
          query: '',
          settingsOpen: false,
          settingsSections: {
            filters: false,
            groups: false,
            display: false,
            forces: false
          }
        }}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )
    const node = screen.getByRole('button', { name: 'A（現在のノート）' })
    const label = container.querySelector<HTMLElement>(
      '.wiki-graph-node-label'
    )!

    expect(Number(label.style.opacity)).toBeGreaterThan(0)
    await user.hover(node)
    expect(label.style.opacity).toBe('1')
  })

  it('falls back to a visible keyboard focus after a hovered node disappears', async () => {
    const user = userEvent.setup()
    const firstGraph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' },
        { path: 'D.md', name: 'D' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'C.md', targetPath: 'D.md' }
      ]
    }
    const props = {
      currentPath: 'A.md',
      scope: 'vault' as const,
      includeOrphans: true,
      onScopeChange: () => undefined,
      onIncludeOrphansChange: () => undefined,
      onOpen: () => undefined
    }

    const { container, rerender } = render(
      <WikiGraphView graph={firstGraph} {...props} />
    )
    await user.hover(
      screen.getByRole('button', { name: 'B（リンク先）を開く' })
    )

    rerender(
      <WikiGraphView
        graph={{
          nodes: firstGraph.nodes.filter((node) => node.path !== 'B.md'),
          edges: [{ sourcePath: 'C.md', targetPath: 'D.md' }]
        }}
        {...props}
      />
    )
    fireEvent.focus(
      screen.getByRole('button', { name: 'D（関連ノート）を開く' })
    )

    expect(
      container
        .querySelector('canvas.wiki-graph-edges')
        ?.getAttribute('data-active-path')
    ).toBe('D.md')
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
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'グラフ設定を開く' }))
    await user.click(screen.getByRole('button', { name: 'フィルタを開く' }))

    await user.type(
      screen.getByRole('searchbox', { name: 'ファイルを検索…' }),
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
      container
        .querySelector('canvas.wiki-graph-edges')
        ?.getAttribute('data-edge-count')
    ).toBe('1')

    await user.clear(
      screen.getByRole('searchbox', { name: 'ファイルを検索…' })
    )
    await user.type(
      screen.getByRole('searchbox', { name: 'ファイルを検索…' }),
      'not-found'
    )

    expect(
      screen.getByText('絞り込み条件に一致する接続がありません。')
    ).toBeTruthy()
    expect(
      container
        .querySelector('canvas.wiki-graph-edges')
        ?.getAttribute('data-edge-count')
    ).toBe('0')
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
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    const canvas = screen.getByRole('region', { name: 'グラフキャンバス' })
    const stage = container.querySelector('.wiki-graph-stage')
    const [nodeA, nodeB] = container.querySelectorAll<HTMLElement>(
      '.wiki-graph-node'
    )
    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 400 }
    })
    Object.defineProperties(nodeA, {
      offsetLeft: { configurable: true, value: 100 },
      offsetTop: { configurable: true, value: 100 },
      offsetWidth: { configurable: true, value: 80 },
      offsetHeight: { configurable: true, value: 40 }
    })
    Object.defineProperties(nodeB, {
      offsetLeft: { configurable: true, value: 600 },
      offsetTop: { configurable: true, value: 300 },
      offsetWidth: { configurable: true, value: 80 },
      offsetHeight: { configurable: true, value: 40 }
    })
    expect(stage).toBeTruthy()
    canvas.focus()
    await user.keyboard('+')
    expect(stage?.getAttribute('style')).toContain('scale(1.5)')

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 80 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 132, clientY: 104 })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 132, clientY: 104 })
    expect(stage?.getAttribute('style')).toContain('translate(32px, 24px)')

    await user.keyboard('{ArrowRight}')
    expect(stage?.getAttribute('style')).toContain('translate(64px, 24px)')

    await user.keyboard('0')
    const fittedTransform = stage?.style.transform ?? ''
    const transformMatch = fittedTransform.match(
      /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/
    )
    expect(transformMatch).toBeTruthy()
    const [, panX, panY, fittedZoom] = transformMatch ?? []
    const fittedZoomNumber = Number(fittedZoom)
    expect(fittedZoomNumber).toBeGreaterThanOrEqual(1 / 128)
    expect(fittedZoomNumber).toBeLessThanOrEqual(8)

    const worldCoordinate = (value: string): number => {
      const match = value.match(/calc\(50% ([+-]) ([\d.]+)px\)/)
      expect(match).toBeTruthy()
      return Number(match?.[2]) * (match?.[1] === '-' ? -1 : 1)
    }
    for (const node of [nodeA, nodeB]) {
      const left = worldCoordinate(node.style.left)
      const top = worldCoordinate(node.style.top)
      const screenX = 400 + Number(panX) + left * fittedZoomNumber
      const screenY = 200 + Number(panY) + top * fittedZoomNumber
      expect(screenX).toBeGreaterThanOrEqual(0)
      expect(screenX).toBeLessThanOrEqual(800)
      expect(screenY).toBeGreaterThanOrEqual(0)
      expect(screenY).toBeLessThanOrEqual(400)
    }

    await user.keyboard('-')
    const zoomedOutScale = Number(
      stage?.style.transform.match(/scale\(([-\d.]+)\)/)?.[1]
    )
    expect(zoomedOutScale).toBeCloseTo(fittedZoomNumber / 1.5, 12)
  })

  it('zooms 1.5 times around the wheel pointer and keeps Obsidian zoom limits', () => {
    const { container } = render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )
    const canvas = screen.getByRole('region', { name: 'グラフキャンバス' })
    const stage = container.querySelector<HTMLElement>('.wiki-graph-stage')!
    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 400 }
    })
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      toJSON: () => ({})
    })

    fireEvent.wheel(canvas, {
      deltaY: -120,
      clientX: 600,
      clientY: 100
    })

    expect.soft(stage.style.transform).toBe(
      'translate(-100px, 50px) scale(1.5)'
    )

    for (let step = 0; step < 10; step += 1) {
      fireEvent.wheel(canvas, {
        deltaY: -120,
        clientX: 600,
        clientY: 100
      })
    }
    expect.soft(stage.style.transform).toContain('scale(8)')

    for (let step = 0; step < 40; step += 1) {
      fireEvent.wheel(canvas, {
        deltaY: 120,
        clientX: 600,
        clientY: 100
      })
    }
    expect(stage.style.transform).toContain('scale(0.0078125)')
  })

  it('drags a node in world space without panning or opening it after the drag', async () => {
    const onOpen = vi.fn()
    const { container } = render(
      <WikiGraphView
        graph={{
          nodes: [
            { path: 'A.md', name: 'A' },
            { path: 'B.md', name: 'B' }
          ],
          edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
        }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={onOpen}
      />
    )
    const canvas = screen.getByRole('region', { name: 'グラフキャンバス' })
    const stage = container.querySelector<HTMLElement>('.wiki-graph-stage')!
    const node = screen.getByRole('button', {
      name: 'B（リンク先）を開く'
    })
    const stageTransformBefore = stage.style.transform
    const nodeStyleBefore = node.getAttribute('style')

    fireEvent.pointerDown(node, {
      pointerId: 7,
      button: 0,
      buttons: 1,
      clientX: 300,
      clientY: 160
    })
    fireEvent.pointerMove(node, {
      pointerId: 7,
      buttons: 1,
      clientX: 360,
      clientY: 210
    })

    await waitFor(() => {
      expect(node.getAttribute('style')).not.toBe(nodeStyleBefore)
    })
    expect(stage.style.transform).toBe(stageTransformBefore)

    fireEvent.pointerUp(node, {
      pointerId: 7,
      button: 0,
      clientX: 360,
      clientY: 210
    })
    fireEvent.click(node)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('pans farther with Shift and an arrow key than with the arrow key alone', () => {
    const { container } = render(
      <WikiGraphView
        graph={{ nodes: [{ path: 'A.md', name: 'A' }], edges: [] }}
        currentPath="A.md"
        scope="local"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )
    const canvas = screen.getByRole('region', { name: 'グラフキャンバス' })
    const stage = container.querySelector<HTMLElement>('.wiki-graph-stage')!
    const panX = (): number => {
      const match = stage.style.transform.match(/translate\((-?[\d.]+)px,/)
      return Number(match?.[1] ?? Number.NaN)
    }

    fireEvent.keyDown(canvas, { key: 'ArrowRight' })
    const normalPan = panX()
    fireEvent.keyDown(canvas, { key: 'ArrowRight', shiftKey: true })
    const shiftedPan = panX() - normalPan

    expect(Number.isFinite(normalPan)).toBe(true)
    expect(shiftedPan).toBeGreaterThan(normalPan)
  })

  it('renders every Markdown node and link in a dense Vault graph', () => {
    const currentPath = 'ZZ-current.md'
    const neighbors = Array.from({ length: 51 }, (_, index) => ({
      path: `N${String(index).padStart(2, '0')}.md`,
      name: `ノート${index}`
    }))
    const graph: WikiGraph = {
      nodes: [...neighbors, { path: currentPath, name: '中心' }],
      edges: neighbors.map((node) => ({
        sourcePath: currentPath,
        targetPath: node.path
      }))
    }

    const { container } = render(
      <WikiGraphView
        graph={graph}
        currentPath={currentPath}
        scope="vault"
        includeOrphans={false}
        onScopeChange={() => undefined}
        onIncludeOrphansChange={() => undefined}
        onOpen={() => undefined}
      />
    )

    expect(container.querySelectorAll('.wiki-graph-node')).toHaveLength(52)
    expect(container.querySelectorAll('canvas.wiki-graph-edges')).toHaveLength(1)
    expect(
      container
        .querySelector('canvas.wiki-graph-edges')
        ?.getAttribute('data-edge-count')
    ).toBe('51')
    expect(container.querySelectorAll('line[data-source-path]')).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: '中心（現在のノート）' })
    ).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
