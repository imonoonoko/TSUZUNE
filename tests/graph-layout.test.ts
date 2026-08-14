import { afterEach, describe, expect, it } from 'vitest'
import {
  createWikiGraphSimulation,
  DEFAULT_GRAPH_FORCE_SETTINGS
} from '../src/core/graph-layout'
import type { WikiGraph } from '../src/core/graph'
import type { GraphForceSettings } from '../src/shared/types'

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

type Simulation = ReturnType<typeof createWikiGraphSimulation>

const simulations: Simulation[] = []

afterEach(() => {
  for (const simulation of simulations) {
    simulation.stop()
  }
  simulations.length = 0
})

function seededRandom(seed: number): () => number {
  return () => {
    seed += 0x6d2b79f5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function createSimulation(
  sourceGraph: WikiGraph = graph,
  settings: GraphForceSettings = DEFAULT_GRAPH_FORCE_SETTINGS,
  seed = 1
): Simulation {
  const simulation = createWikiGraphSimulation(sourceGraph, settings, {
    randomSource: seededRandom(seed)
  })
  simulations.push(simulation)
  return simulation
}

function positions(simulation: Simulation): Map<string, { x: number; y: number }> {
  return new Map(
    simulation.nodes.map((node) => [
      node.path,
      { x: node.x, y: node.y }
    ])
  )
}

function radialMean(nodePositions: Map<string, { x: number; y: number }>): number {
  const distances = [...nodePositions.values()].map((position) =>
    Math.hypot(position.x, position.y)
  )
  return distances.reduce((sum, distance) => sum + distance, 0) / distances.length
}

function pairwiseMean(nodePositions: Map<string, { x: number; y: number }>): number {
  const values = [...nodePositions.values()]
  const distances: number[] = []
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      distances.push(
        Math.hypot(
          values[left].x - values[right].x,
          values[left].y - values[right].y
        )
      )
    }
  }
  return distances.reduce((sum, distance) => sum + distance, 0) / distances.length
}

describe('Wiki graph live force simulation', () => {
  it('exposes one finite world-space node for every graph node without pinning a current note', () => {
    const simulation = createSimulation()

    expect(simulation.nodes.map((node) => node.path)).toEqual([
      'A.md',
      'B.md',
      'C.md'
    ])
    for (const node of simulation.nodes) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
      expect(node.fx ?? null).toBeNull()
      expect(node.fy ?? null).toBeNull()
    }
  })

  it('starts nodes at distinct irregular force-layout positions instead of stacking them at one point', () => {
    const simulation = createSimulation()
    const distinctPositions = new Set(
      simulation.nodes.map((node) => `${node.x.toFixed(6)},${node.y.toFixed(6)}`)
    )

    expect(distinctPositions.size).toBe(simulation.nodes.length)
  })

  it('advances node positions when tick is called', () => {
    const simulation = createSimulation()
    const before = positions(simulation)

    simulation.tick(1)

    const after = positions(simulation)
    expect(
      [...after].some(([path, position]) => {
        const previous = before.get(path)!
        return position.x !== previous.x || position.y !== previous.y
      })
    ).toBe(true)
  })

  it('raises a cooled simulation alpha when reheated', () => {
    const simulation = createSimulation()
    simulation.tick(180)
    const cooledAlpha = simulation.alpha

    simulation.reheat(0.7)

    expect(simulation.alpha).toBeGreaterThan(cooledAlpha)
    expect(simulation.alpha).toBeGreaterThanOrEqual(0.7)
  })

  it('updates the graph in place while preserving surviving node positions', () => {
    const simulation = createSimulation()
    simulation.tick(180)
    const before = positions(simulation)

    simulation.setGraph({
      nodes: [
        { path: 'A.md', name: 'A' },
        { path: 'B.md', name: 'B' },
        { path: 'D.md', name: 'D' }
      ],
      edges: [
        { sourcePath: 'A.md', targetPath: 'B.md' },
        { sourcePath: 'B.md', targetPath: 'D.md' }
      ]
    })

    expect(simulation.nodes.map((node) => node.path)).toEqual([
      'A.md',
      'B.md',
      'D.md'
    ])
    expect(simulation.positions().get('A.md')).toEqual(before.get('A.md'))
    expect(simulation.positions().get('B.md')).toEqual(before.get('B.md'))
    expect(simulation.positions().has('C.md')).toBe(false)
    expect(Number.isFinite(simulation.positions().get('D.md')?.x)).toBe(true)
    expect(Number.isFinite(simulation.positions().get('D.md')?.y)).toBe(true)
    expect(simulation.alpha).toBeGreaterThanOrEqual(0.3)
  })

  it('pins a dragged node in world space and releases it when dragging ends', () => {
    const simulation = createSimulation()
    const dragged = () => simulation.nodes.find((node) => node.path === 'B.md')!

    simulation.dragStart('B.md', 120, -45)
    expect(dragged().fx).toBe(120)
    expect(dragged().fy).toBe(-45)

    simulation.drag('B.md', 160, -80)
    simulation.tick(3)
    expect(dragged()).toMatchObject({
      x: 160,
      y: -80,
      fx: 160,
      fy: -80
    })

    simulation.dragEnd('B.md')
    expect(dragged().fx ?? null).toBeNull()
    expect(dragged().fy ?? null).toBeNull()
  })

  it('produces the same world-space trajectory when given the same random seed', () => {
    const first = createSimulation(graph, DEFAULT_GRAPH_FORCE_SETTINGS, 42)
    const second = createSimulation(graph, DEFAULT_GRAPH_FORCE_SETTINGS, 42)

    first.tick(60)
    second.tick(60)

    expect(positions(first)).toEqual(positions(second))
  })

  it('does not clamp or normalize a large graph into the legacy percent viewport', () => {
    const largeGraph: WikiGraph = {
      nodes: Array.from({ length: 40 }, (_, index) => ({
        path: `Node-${index}.md`,
        name: `Node ${index}`
      })),
      edges: []
    }
    const simulation = createSimulation(largeGraph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      centerForce: 0,
      repelForce: 20
    })

    simulation.tick(120)

    const coordinates = simulation.nodes.flatMap((node) => [node.x, node.y])
    expect(coordinates.some((coordinate) => coordinate < 0)).toBe(true)
    expect(Math.max(...coordinates) - Math.min(...coordinates)).toBeGreaterThan(100)
  })

  it('places linked notes farther apart when link distance increases', () => {
    const twoNodeGraph: WikiGraph = {
      nodes: graph.nodes.slice(0, 2),
      edges: graph.edges.slice(0, 1)
    }
    const short = createSimulation(twoNodeGraph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      linkDistance: 30
    })
    const long = createSimulation(twoNodeGraph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      linkDistance: 500
    })
    short.tick(180)
    long.tick(180)

    const distance = (simulation: Simulation) => {
      const nodePositions = positions(simulation)
      const current = nodePositions.get('A.md')!
      const linked = nodePositions.get('B.md')!
      return Math.hypot(linked.x - current.x, linked.y - current.y)
    }

    expect(distance(long)).toBeGreaterThan(distance(short))
  })

  it('pulls nodes closer to the world origin when center force increases', () => {
    const loose = createSimulation(graph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      centerForce: 0
    })
    const compact = createSimulation(graph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      centerForce: 1
    })
    loose.tick(180)
    compact.tick(180)

    expect(radialMean(positions(compact))).toBeLessThan(radialMean(positions(loose)))
  })

  it('separates nodes when repel force increases', () => {
    const close = createSimulation(graph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      repelForce: 0
    })
    const separated = createSimulation(graph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      repelForce: 20
    })
    close.tick(180)
    separated.tick(180)

    expect(pairwiseMean(positions(separated))).toBeGreaterThan(
      pairwiseMean(positions(close))
    )
  })

  it('draws linked nodes toward their target distance when link force increases', () => {
    const weak = createSimulation(graph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      linkForce: 0,
      linkDistance: 30
    })
    const strong = createSimulation(graph, {
      ...DEFAULT_GRAPH_FORCE_SETTINGS,
      linkForce: 1,
      linkDistance: 30
    })
    weak.tick(180)
    strong.tick(180)

    const linkedDistance = (simulation: Simulation) => {
      const nodePositions = positions(simulation)
      const left = nodePositions.get('A.md')!
      const right = nodePositions.get('B.md')!
      return Math.hypot(right.x - left.x, right.y - left.y)
    }

    expect(linkedDistance(strong)).toBeLessThan(linkedDistance(weak))
  })
})
