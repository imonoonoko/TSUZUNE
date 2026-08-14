import { describe, expect, it } from 'vitest'
import type { WikiGraphNode } from '../src/core/graph'
import {
  getGraphTimelineTiming,
  getGraphTimelinePrefix,
  orderGraphTimelineFileNodes
} from '../src/core/graph-timeline'

describe('Obsidian 1.13.4 global graph timeline core', () => {
  it('orders file-backed nodes oldest-first with stable path ties and unknown times last', () => {
    const nodes: WikiGraphNode[] = [
      { path: 'unknown-b.md', name: 'unknown-b', kind: 'note', createdAt: null },
      { path: 'tied-b.md', name: 'tied-b', kind: 'note', createdAt: 200 },
      { path: 'unknown-a.md', name: 'unknown-a', kind: 'note', createdAt: Number.NaN },
      { path: 'tied-a.md', name: 'tied-a', kind: 'attachment', createdAt: 200 },
      { path: 'oldest.md', name: 'oldest', kind: 'note', createdAt: 100 },
      { path: 'unknown-c.md', name: 'unknown-c', kind: 'note' },
      {
        path: 'unknown-d.md',
        name: 'unknown-d',
        kind: 'note',
        createdAt: Number.POSITIVE_INFINITY
      },
      { path: 'tag:#知識', name: '#知識', kind: 'tag' },
      { path: '未解決.md', name: '未解決', kind: 'unresolved' }
    ]

    expect(orderGraphTimelineFileNodes(nodes).map((node) => node.path)).toEqual([
      'oldest.md',
      'tied-a.md',
      'tied-b.md',
      'unknown-a.md',
      'unknown-b.md',
      'unknown-c.md',
      'unknown-d.md'
    ])
    expect(nodes[0].path).toBe('unknown-b.md')
  })

  it('derives the observed clamped reveal speed and interval from file count', () => {
    expect(getGraphTimelineTiming(0)).toEqual({
      filesPerSecond: 5,
      revealIntervalMs: 200
    })
    expect(getGraphTimelineTiming(400)).toEqual({
      filesPerSecond: 10,
      revealIntervalMs: 100
    })
    expect(getGraphTimelineTiming(40_000)).toEqual({
      filesPerSecond: 100,
      revealIntervalMs: 10
    })
  })

  it('reveals a chronological file prefix and introduces synthetic nodes with their first visible edge', () => {
    const graph = {
      nodes: [
        { path: '新.md', name: '新', kind: 'note' as const, createdAt: 200 },
        { path: 'tag:#知識', name: '#知識', kind: 'tag' as const },
        { path: '旧.md', name: '旧', kind: 'note' as const, createdAt: 100 },
        {
          path: '未解決.md',
          name: '未解決',
          kind: 'unresolved' as const
        },
        { path: 'tag:#孤立', name: '#孤立', kind: 'tag' as const }
      ],
      edges: [
        { sourcePath: '旧.md', targetPath: 'tag:#知識' },
        { sourcePath: '旧.md', targetPath: '新.md' },
        { sourcePath: '新.md', targetPath: '未解決.md' }
      ]
    }

    expect(getGraphTimelinePrefix(graph, 0)).toEqual({ nodes: [], edges: [] })

    const first = getGraphTimelinePrefix(graph, 1)
    expect(first.nodes.map((node) => node.path)).toEqual([
      '旧.md',
      'tag:#知識'
    ])
    expect(first.edges).toEqual([
      { sourcePath: '旧.md', targetPath: 'tag:#知識' }
    ])

    const second = getGraphTimelinePrefix(graph, 2)
    expect(second.nodes.map((node) => node.path)).toEqual([
      '旧.md',
      '新.md',
      'tag:#知識',
      '未解決.md'
    ])
    expect(second.edges).toEqual(graph.edges)
  })
})
