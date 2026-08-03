import type { WikiGraph, WikiGraphNode } from './graph'

function comparePath(left: string, right: string): number {
  return (
    left.localeCompare(right, 'ja') ||
    (left < right ? -1 : left > right ? 1 : 0)
  )
}

function timelineTime(node: WikiGraphNode): number {
  return typeof node.createdAt === 'number' && Number.isFinite(node.createdAt)
    ? node.createdAt
    : Number.POSITIVE_INFINITY
}

function isFileBackedNode(node: WikiGraphNode): boolean {
  return node.kind !== 'tag' && node.kind !== 'unresolved'
}

export interface GraphTimelineTiming {
  filesPerSecond: number
  revealIntervalMs: number
}

export function getGraphTimelineTiming(
  fileCount: number
): GraphTimelineTiming {
  const filesPerSecond = Math.min(
    100,
    Math.max(5, 0.5 * Math.sqrt(Math.max(0, fileCount)))
  )
  return {
    filesPerSecond,
    revealIntervalMs: 1000 / filesPerSecond
  }
}

export function orderGraphTimelineFileNodes(
  nodes: readonly WikiGraphNode[]
): WikiGraphNode[] {
  return nodes
    .filter(isFileBackedNode)
    .sort(
      (left, right) =>
        timelineTime(left) - timelineTime(right) ||
        comparePath(left.path, right.path)
    )
}

export function getGraphTimelinePrefix(
  graph: WikiGraph,
  revealedFileCount: number
): WikiGraph {
  const orderedFiles = orderGraphTimelineFileNodes(graph.nodes)
  const prefixLength = Math.min(
    orderedFiles.length,
    Math.max(0, Math.floor(revealedFileCount))
  )
  const visibleFiles = orderedFiles.slice(0, prefixLength)
  const visiblePaths = new Set(visibleFiles.map((node) => node.path))
  const nodesByPath = new Map(graph.nodes.map((node) => [node.path, node]))

  const edges = graph.edges.filter((edge) => {
    const source = nodesByPath.get(edge.sourcePath)
    const target = nodesByPath.get(edge.targetPath)
    if (!source || !target) {
      return false
    }

    const sourceIsFile = isFileBackedNode(source)
    const targetIsFile = isFileBackedNode(target)
    if (!sourceIsFile && !targetIsFile) {
      return false
    }
    if (sourceIsFile && !visiblePaths.has(source.path)) {
      return false
    }
    if (targetIsFile && !visiblePaths.has(target.path)) {
      return false
    }

    // Obsidian 1.13.4 creates unresolved/tag nodes only when the advancing
    // progression also admits their first connecting link.
    visiblePaths.add(source.path)
    visiblePaths.add(target.path)
    return true
  })

  return {
    nodes: [
      ...visibleFiles,
      ...graph.nodes.filter(
        (node) => !isFileBackedNode(node) && visiblePaths.has(node.path)
      )
    ],
    edges
  }
}
