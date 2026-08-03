import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY
} from 'd3-force'
import type {
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum
} from 'd3-force'
import type { GraphForceSettings } from '../shared/types'
import {
  DEFAULT_GRAPH_FORCE_SETTINGS,
  toGraphWorkerForceSettings
} from '../shared/graph-settings'
import type { WikiGraph } from './graph'

export { DEFAULT_GRAPH_FORCE_SETTINGS }

export interface GraphPosition {
  x: number
  y: number
}

export interface WikiGraphSimulationNode extends SimulationNodeDatum {
  path: string
  x: number
  y: number
}

interface ForceLink extends SimulationLinkDatum<WikiGraphSimulationNode> {
  source: string | WikiGraphSimulationNode
  target: string | WikiGraphSimulationNode
}

export interface WikiGraphSimulationOptions {
  randomSource?: () => number
}

export interface WikiGraphSimulation {
  readonly nodes: WikiGraphSimulationNode[]
  readonly alpha: number
  positions(): Map<string, GraphPosition>
  start(): void
  stop(): void
  tick(iterations?: number): void
  reheat(alpha?: number): void
  setGraph(graph: WikiGraph): void
  setForces(settings: GraphForceSettings): void
  dragStart(path: string, x: number, y: number): void
  drag(path: string, x: number, y: number): void
  dragEnd(path: string): void
  subscribe(listener: () => void): () => void
}

function finiteCoordinate(value: number | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0
}

function configureForces(
  simulation: Simulation<WikiGraphSimulationNode, ForceLink>,
  links: ForceLink[],
  settings: GraphForceSettings
): void {
  const workerSettings = toGraphWorkerForceSettings(settings)
  const linkForce = forceLink<WikiGraphSimulationNode, ForceLink>(links)
    .id((node) => node.path)
    .distance(workerSettings.linkDistance)
  const defaultLinkStrength = linkForce.strength()
  linkForce.strength(
    (link, index, allLinks) =>
      workerSettings.linkForce *
      defaultLinkStrength(link, index, allLinks)
  )

  simulation
    .force(
      'center-x',
      forceX<WikiGraphSimulationNode>(0).strength(
        workerSettings.centerForce
      )
    )
    .force(
      'center-y',
      forceY<WikiGraphSimulationNode>(0).strength(
        workerSettings.centerForce
      )
    )
    .force(
      'charge',
      forceManyBody<WikiGraphSimulationNode>().strength(
        workerSettings.repelForce
      )
    )
    .force('link', linkForce)
    .force(
      'collision',
      forceCollide<WikiGraphSimulationNode>(60).strength(0.5)
    )
}

export function createWikiGraphSimulation(
  graph: WikiGraph,
  settings: GraphForceSettings,
  options: WikiGraphSimulationOptions = {}
): WikiGraphSimulation {
  const createNode = (path: string): WikiGraphSimulationNode => ({
    path,
    // d3-force assigns its deterministic phyllotaxis seed when x/y are NaN.
    // Starting every node at (0, 0) creates a large random common drift before
    // the graph settles and makes the first visible layout unlike Obsidian.
    x: Number.NaN,
    y: Number.NaN,
    vx: 0,
    vy: 0,
    fx: null,
    fy: null
  })
  const nodes: WikiGraphSimulationNode[] = graph.nodes.map((node) =>
    createNode(node.path)
  )
  let links: ForceLink[] = graph.edges.map((edge) => ({
    source: edge.sourcePath,
    target: edge.targetPath
  }))
  const simulation = forceSimulation<WikiGraphSimulationNode>(nodes).stop()
  let currentSettings = settings
  if (options.randomSource) {
    simulation.randomSource(options.randomSource)
  }
  configureForces(simulation, links, settings)

  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const listener of listeners) {
      listener()
    }
  }
  simulation.on('tick', notify)

  const findNode = (path: string): WikiGraphSimulationNode | undefined =>
    nodes.find((node) => node.path === path)

  const controller: WikiGraphSimulation = {
    nodes,
    get alpha() {
      return simulation.alpha()
    },
    positions: () =>
      new Map(
        nodes.map((node) => [
          node.path,
          {
            x: finiteCoordinate(node.x),
            y: finiteCoordinate(node.y)
          }
        ])
      ),
    start: () => {
      simulation.restart()
    },
    stop: () => {
      simulation.stop()
    },
    tick: (iterations = 1) => {
      simulation.tick(Math.max(1, Math.floor(iterations)))
      notify()
    },
    reheat: (alpha = 0.3) => {
      simulation.alpha(Math.max(simulation.alpha(), alpha)).restart()
    },
    setGraph: (nextGraph) => {
      const existing = new Map(nodes.map((node) => [node.path, node]))
      const nextNodes = nextGraph.nodes.map(
        (node) => existing.get(node.path) ?? createNode(node.path)
      )
      nodes.splice(0, nodes.length, ...nextNodes)
      links = nextGraph.edges.map((edge) => ({
        source: edge.sourcePath,
        target: edge.targetPath
      }))
      simulation.nodes(nodes)
      configureForces(simulation, links, currentSettings)
      notify()
      controller.reheat(0.3)
    },
    setForces: (nextSettings) => {
      currentSettings = nextSettings
      configureForces(simulation, links, nextSettings)
      controller.reheat(0.3)
    },
    dragStart: (path, x, y) => {
      const node = findNode(path)
      if (!node) {
        return
      }
      node.fx = x
      node.fy = y
      simulation.alphaTarget(0.3)
      controller.reheat(0.3)
    },
    drag: (path, x, y) => {
      const node = findNode(path)
      if (!node) {
        return
      }
      node.fx = x
      node.fy = y
    },
    dragEnd: (path) => {
      const node = findNode(path)
      if (!node) {
        return
      }
      node.fx = null
      node.fy = null
      simulation.alphaTarget(0)
      controller.reheat(0.3)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }

  return controller
}

/**
 * Compatibility helper for callers that still need a one-shot snapshot.
 * Interactive graph views should use createWikiGraphSimulation instead.
 */
export function layoutWikiGraph(
  graph: WikiGraph,
  _pinnedPath: string | null,
  settings: GraphForceSettings
): Map<string, GraphPosition> {
  const simulation = createWikiGraphSimulation(graph, settings)
  simulation.tick(180)
  const positions = simulation.positions()
  simulation.stop()
  return positions
}
