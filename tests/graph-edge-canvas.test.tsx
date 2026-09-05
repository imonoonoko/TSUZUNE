import { describe, expect, it } from 'vitest'
import type { WikiGraph } from '../src/core/graph'
import {
  buildGraphArrowDrawCommands,
  buildGraphEdgeDrawCommands,
  edgeEndpointsAtNodeBoundaries,
  graphPointToViewport,
  graphRadiusToViewport,
  resolveGraphThemePalette
} from '../src/renderer/components/GraphEdgeCanvas'

describe('Graph edge canvas', () => {
  it('projects world geometry into the final viewport before rasterizing at a deep zoom', () => {
    const viewport = {
      width: 1000,
      height: 600,
      zoom: 0.125,
      pan: { x: 40, y: -20 }
    }

    expect(graphPointToViewport({ x: 800, y: -400 }, viewport)).toEqual({
      x: 640,
      y: 230
    })
    expect(graphRadiusToViewport(64, viewport.zoom)).toBe(8)
  })

  it('connects a horizontal edge from one circular node boundary to the other', () => {
    expect(
      edgeEndpointsAtNodeBoundaries(
        { x: 0, y: 20 },
        { x: 100, y: 20 },
        8,
        20
      )
    ).toEqual({
      source: { x: 8, y: 20 },
      target: { x: 80, y: 20 }
    })
  })

  it('uses the Night Workshop edge colors and dims only edges unrelated to the active note', () => {
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
    const positions = new Map([
      ['A.md', { x: 10, y: 20 }],
      ['B.md', { x: 30, y: 40 }],
      ['C.md', { x: 50, y: 60 }],
      ['D.md', { x: 70, y: 80 }]
    ])

    expect(buildGraphEdgeDrawCommands(graph, positions, 'B.md')).toEqual([
      {
        sourcePath: 'A.md',
        targetPath: 'B.md',
        source: { x: 10, y: 20 },
        target: { x: 30, y: 40 },
        color: '#78BFB2',
        lineWidth: 1.8,
        opacity: 1
      },
      {
        sourcePath: 'C.md',
        targetPath: 'D.md',
        source: { x: 50, y: 60 },
        target: { x: 70, y: 80 },
        color: '#64766F',
        lineWidth: 1,
        opacity: 0.16
      }
    ])
  })

  it('keeps every default edge fully visible when there is no active note', () => {
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' }
      ],
      edges: [{ sourcePath: 'A.md', targetPath: 'B.md' }]
    }
    const positions = new Map([
      ['A.md', { x: 10, y: 20 }],
      ['B.md', { x: 30, y: 40 }]
    ])

    expect(buildGraphEdgeDrawCommands(graph, positions, null)).toEqual([
      {
        sourcePath: 'A.md',
        targetPath: 'B.md',
        source: { x: 10, y: 20 },
        target: { x: 30, y: 40 },
        color: '#64766F',
        lineWidth: 1,
        opacity: 1
      }
    ])
  })

  it('resolves CSS graph tokens and falls back to the Night Workshop palette', () => {
    expect(
      resolveGraphThemePalette({
        getPropertyValue: (name) =>
          name === '--graph-edge' ? ' #36433F ' : ' #93D3C7 '
      })
    ).toEqual({ edge: '#36433F', edgeActive: '#93D3C7' })

    expect(
      resolveGraphThemePalette({ getPropertyValue: () => '' })
    ).toEqual({ edge: '#64766F', edgeActive: '#78BFB2' })
  })

  it('draws mutual and duplicate links as one geometry edge', () => {
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'A.md' },
        { sourcePath: 'A.md', targetPath: 'B.md' }
      ]
    }
    const positions = new Map([
      ['A.md', { x: 10, y: 20 }],
      ['B.md', { x: 30, y: 40 }]
    ])

    expect(buildGraphEdgeDrawCommands(graph, positions, null)).toHaveLength(1)
  })

  it('keeps both directed arrows for a mutual link and applies the observed zoom alpha and scale', () => {
    const graph: WikiGraph = {
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'C.md', name: 'C' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'A.md' },
        { sourcePath: 'C.md', targetPath: 'A.md' }
      ]
    }
    const positions = new Map([
      ['A.md', { x: 10, y: 20 }],
      ['B.md', { x: 30, y: 40 }],
      ['C.md', { x: 50, y: 60 }]
    ])

    const commands = buildGraphArrowDrawCommands(
      graph,
      positions,
      'B.md',
      0.55,
      4
    )

    expect(commands).toHaveLength(3)
    expect(commands[0].opacity).toBeCloseTo(0.25, 12)
    expect(commands[1].opacity).toBeCloseTo(0.25, 12)
    expect(commands[2].opacity).toBeCloseTo(0.05, 12)
    expect(commands.every((command) => command.localScale === 4 / 0.55)).toBe(
      true
    )
  })
})
