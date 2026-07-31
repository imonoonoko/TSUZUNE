import type { NoteDocument } from '../shared/types'
import { getOutgoingLinks } from './links'

export interface WikiGraphNode {
  path: string
  name: string
}

export interface WikiGraphEdge {
  sourcePath: string
  targetPath: string
}

export interface WikiGraph {
  nodes: WikiGraphNode[]
  edges: WikiGraphEdge[]
}

export type WikiGraphDepth = 1 | 2
export type WikiGraphScope = 'local' | 'vault'

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, 'ja')
}

export function buildWikiGraph(notes: NoteDocument[]): WikiGraph {
  const nodes = notes
    .map((note) => ({
      path: note.path,
      name: note.name
    }))
    .sort((left, right) => comparePath(left.path, right.path))

  const edges = new Map<string, WikiGraphEdge>()

  for (const source of notes) {
    for (const link of getOutgoingLinks(source.content, notes)) {
      if (
        link.status !== 'resolved' ||
        !link.resolvedPath ||
        link.resolvedPath === source.path
      ) {
        continue
      }

      const edge: WikiGraphEdge = {
        sourcePath: source.path,
        targetPath: link.resolvedPath
      }
      edges.set(`${edge.sourcePath}\0${edge.targetPath}`, edge)
    }
  }

  return {
    nodes,
    edges: [...edges.values()].sort(
      (left, right) =>
        comparePath(left.sourcePath, right.sourcePath) ||
        comparePath(left.targetPath, right.targetPath)
    )
  }
}

export function getLocalWikiGraph(
  graph: WikiGraph,
  currentPath: string,
  depth: WikiGraphDepth = 1
): WikiGraph {
  if (!graph.nodes.some((node) => node.path === currentPath)) {
    return { nodes: [], edges: [] }
  }

  const localPaths = new Set<string>([currentPath])
  let frontier = new Set<string>([currentPath])

  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>()
    for (const edge of graph.edges) {
      if (frontier.has(edge.sourcePath) && !localPaths.has(edge.targetPath)) {
        next.add(edge.targetPath)
      }
      if (frontier.has(edge.targetPath) && !localPaths.has(edge.sourcePath)) {
        next.add(edge.sourcePath)
      }
    }
    for (const path of next) {
      localPaths.add(path)
    }
    frontier = next
  }

  return {
    nodes: graph.nodes
      .filter((node) => localPaths.has(node.path))
      .sort((left, right) => comparePath(left.path, right.path)),
    edges: graph.edges
      .filter(
        (edge) =>
          localPaths.has(edge.sourcePath) && localPaths.has(edge.targetPath)
      )
      .sort(
        (left, right) =>
          comparePath(left.sourcePath, right.sourcePath) ||
          comparePath(left.targetPath, right.targetPath)
      )
  }
}

export function getVaultWikiGraph(
  graph: WikiGraph,
  currentPath: string,
  includeOrphans: boolean
): WikiGraph {
  if (includeOrphans) {
    return graph
  }

  const connectedPaths = new Set<string>()
  for (const edge of graph.edges) {
    connectedPaths.add(edge.sourcePath)
    connectedPaths.add(edge.targetPath)
  }
  connectedPaths.add(currentPath)

  return {
    nodes: graph.nodes.filter((node) => connectedPaths.has(node.path)),
    edges: graph.edges
  }
}

export function filterWikiGraph(
  graph: WikiGraph,
  currentPath: string,
  query: string
): WikiGraph {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return graph
  }

  const visiblePaths = new Set(
    graph.nodes
      .filter(
        (node) =>
          node.path === currentPath ||
          node.name.toLocaleLowerCase().includes(normalizedQuery) ||
          node.path.toLocaleLowerCase().includes(normalizedQuery)
      )
      .map((node) => node.path)
  )

  return {
    nodes: graph.nodes.filter((node) => visiblePaths.has(node.path)),
    edges: graph.edges.filter(
      (edge) =>
        visiblePaths.has(edge.sourcePath) && visiblePaths.has(edge.targetPath)
    )
  }
}
