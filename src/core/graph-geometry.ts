import type { WikiGraph, WikiGraphEdge } from './graph'

const LOCAL_ROOT_WEIGHT = 30

export function calculateGraphNodeWeights(
  graph: WikiGraph,
  localRootPath: string | null = null
): Map<string, number> {
  const relatedPaths = new Map(
    graph.nodes.map((node) => [node.path, new Set<string>()])
  )

  for (const edge of graph.edges) {
    relatedPaths.get(edge.sourcePath)?.add(edge.targetPath)
    relatedPaths.get(edge.targetPath)?.add(edge.sourcePath)
  }

  return new Map(
    graph.nodes.map((node) => [
      node.path,
      node.path === localRootPath
        ? LOCAL_ROOT_WEIGHT
        : relatedPaths.get(node.path)?.size ?? 0
    ])
  )
}

export function deduplicateGraphGeometryEdges(
  edges: readonly WikiGraphEdge[]
): WikiGraphEdge[] {
  const seen = new Set<string>()
  return edges.filter((edge) => {
    const key =
      edge.sourcePath < edge.targetPath
        ? `${edge.sourcePath}\0${edge.targetPath}`
        : `${edge.targetPath}\0${edge.sourcePath}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
