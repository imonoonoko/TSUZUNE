import { describe, expect, it } from 'vitest'
import type { WikiGraph } from '../src/core/graph'
import {
  calculateGraphNodeWeights,
  deduplicateGraphGeometryEdges
} from '../src/core/graph-geometry'

describe('Obsidian 1.13.4 graph geometry contract', () => {
  const graph: WikiGraph = {
    nodes: [
      { path: 'A.md', name: 'A' },
      { path: 'B.md', name: 'B' },
      { path: 'C.md', name: 'C' },
      { path: 'D.md', name: 'D' }
    ],
    edges: [
      { sourcePath: 'A.md', targetPath: 'B.md' },
      { sourcePath: 'B.md', targetPath: 'A.md' },
      { sourcePath: 'A.md', targetPath: 'C.md' },
      { sourcePath: 'C.md', targetPath: 'A.md' }
    ]
  }

  it('weights nodes by unique related neighbors regardless of link direction', () => {
    expect([...calculateGraphNodeWeights(graph)]).toEqual([
      ['A.md', 2],
      ['B.md', 1],
      ['C.md', 1],
      ['D.md', 0]
    ])
  })

  it('overrides only the local graph root weight with the observed value 30', () => {
    expect([...calculateGraphNodeWeights(graph, 'B.md')]).toEqual([
      ['A.md', 2],
      ['B.md', 30],
      ['C.md', 1],
      ['D.md', 0]
    ])
  })

  it('uses one line geometry for mutual reverse directed edges', () => {
    expect(
      deduplicateGraphGeometryEdges([
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'A.md' },
        { sourcePath: 'A.md', targetPath: 'C.md' },
        { sourcePath: 'A.md', targetPath: 'C.md' }
      ])
    ).toEqual([
      { sourcePath: 'A.md', targetPath: 'B.md' },
      { sourcePath: 'A.md', targetPath: 'C.md' }
    ])
  })
})
