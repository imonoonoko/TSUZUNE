import { buildWikiGraph, getLocalWikiGraph } from '../core/graph'
import { compilePathAliases } from '../core/path-aliases'
import type { NoteDocument, VaultSnapshot } from '../shared/types'

export interface LocalGraphInput {
  depth?: 1 | 2 | 3
  direction?: 'incoming' | 'outgoing' | 'both'
  neighbor_links?: boolean
  max_nodes?: number
}

/** Saved, visible note links only. Graph edges are discovery, not evidence for a claim. */
export function localGraph(
  snapshot: VaultSnapshot,
  seed: NoteDocument,
  revision: (note: NoteDocument) => string,
  input: LocalGraphInput = {}
) {
  const depth = input.depth ?? 1
  const direction = input.direction ?? 'both'
  const maxNodes = input.max_nodes ?? 100
  if (![1, 2, 3].includes(depth) || !['incoming', 'outgoing', 'both'].includes(direction) ||
      !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 500) {
    throw new Error('Graphは深さ1〜3、最大ノード数1〜500と有効な方向を指定してください。')
  }
  const graph = buildWikiGraph(snapshot.notes, {
    includeUnresolved: false,
    includeTags: false,
    includeAttachments: false,
    pathAliases: compilePathAliases(snapshot.pathAliases ?? {})
  })
  const options = {
    depth,
    incomingLinks: direction !== 'outgoing',
    outgoingLinks: direction !== 'incoming',
    neighborLinks: input.neighbor_links ?? false
  }
  const discovered = getLocalWikiGraph(graph, seed.path, options)
  const distances = new Map([[seed.path, 0]])
  let frontier = [seed.path]
  for (let hop = 1; hop <= depth; hop++) {
    const current = new Set(frontier), next = new Set<string>()
    for (const edge of graph.edges) {
      if (options.outgoingLinks && current.has(edge.sourcePath) && !distances.has(edge.targetPath)) next.add(edge.targetPath)
      if (options.incomingLinks && current.has(edge.targetPath) && !distances.has(edge.sourcePath)) next.add(edge.sourcePath)
    }
    frontier = [...next]
    for (const path of frontier) distances.set(path, hop)
  }
  const byPath = new Map(snapshot.notes.map(note => [note.path, note]))
  const ordered = discovered.nodes.sort((a, b) =>
    (distances.get(a.path)! - distances.get(b.path)!) || a.path.localeCompare(b.path, 'ja') ||
    (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const nodes = ordered.slice(0, maxNodes).map(node => {
    const note = byPath.get(node.path)!
    return { id: note.path, title: note.name, distance: distances.get(note.path)!,
      revision: revision(note), modified_at: new Date(note.modifiedAt).toISOString() }
  })
  const retained = new Set(nodes.map(node => node.id))
  const edges = discovered.edges.filter(edge => retained.has(edge.sourcePath) && retained.has(edge.targetPath))
  return {
    seed_id: seed.path, depth, direction, neighbor_links: options.neighborLinks,
    nodes, edges: edges.slice(0, 2_000).map(edge => ({ source: edge.sourcePath, target: edge.targetPath })),
    omitted_nodes: ordered.length - nodes.length,
    omitted_edges: discovered.edges.length - Math.min(2_000, edges.length),
    truncated: ordered.length > nodes.length || discovered.edges.length > Math.min(2_000, edges.length),
    evidence_notice: '辺は保存済みの明示リンクです。主張の根拠には対象ノートの本文を取得してください。'
  }
}
