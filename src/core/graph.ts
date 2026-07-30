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
  currentPath: string
): WikiGraph {
  if (!graph.nodes.some((node) => node.path === currentPath)) {
    return { nodes: [], edges: [] }
  }

  const localPaths = new Set<string>([currentPath])
  for (const edge of graph.edges) {
    if (edge.sourcePath === currentPath) {
      localPaths.add(edge.targetPath)
    }
    if (edge.targetPath === currentPath) {
      localPaths.add(edge.sourcePath)
    }
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
