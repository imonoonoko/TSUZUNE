import { isSupportedAttachmentPath } from '../shared/attachments'
import type { NoteDocument, VaultAttachment } from '../shared/types'
import { matchesGraphQuery } from './graph-query'
import {
  buildWikiLinkIndex,
  extractWikiLinks,
  resolveIndexedWikiLink
} from './links'
import type { CompiledPathAliases } from './path-aliases'
import {
  basenameRelative,
  validateRelativePath,
  withoutMarkdownExtension
} from './paths'
import { extractMarkdownTags } from './tags'

export interface WikiGraphNode {
  path: string
  name: string
  kind?: 'note' | 'unresolved' | 'tag' | 'attachment'
  exists?: boolean
  createdAt?: number | null
}

export interface WikiGraphEdge {
  sourcePath: string
  targetPath: string
}

export interface WikiGraph {
  nodes: WikiGraphNode[]
  edges: WikiGraphEdge[]
}

export interface BuildWikiGraphOptions {
  includeUnresolved?: boolean
  includeTags?: boolean
  includeAttachments?: boolean
  attachments?: readonly VaultAttachment[]
  pathAliases?: CompiledPathAliases
}

export interface LocalWikiGraphOptions {
  outgoingLinks: boolean
  incomingLinks: boolean
  neighborLinks: boolean
}

const DEFAULT_LOCAL_GRAPH_OPTIONS: LocalWikiGraphOptions = {
  outgoingLinks: true,
  incomingLinks: true,
  neighborLinks: false
}

export type WikiGraphScope = 'local' | 'vault'
export type WikiGraphViewMode = 'edit' | 'preview' | 'graph'

interface AttachmentLinkIndex {
  exactPaths: Map<string, string>
  uniqueBasenames: Map<string, string | null>
}

type IndexedAttachmentLinkResolution =
  | { status: 'resolved'; path: string }
  | { status: 'missing'; path: string }
  | { status: 'ambiguous' }
  | { status: 'invalid' }

function comparePath(left: string, right: string): number {
  const localized = left.localeCompare(right, 'ja')
  if (localized !== 0) {
    return localized
  }
  return left < right ? -1 : left > right ? 1 : 0
}

function buildAttachmentLinkIndex(
  attachments: readonly VaultAttachment[]
): AttachmentLinkIndex {
  const exactPaths = new Map<string, string>()
  const uniqueBasenames = new Map<string, string | null>()

  for (const attachment of attachments) {
    exactPaths.set(attachment.path.toLocaleLowerCase(), attachment.path)
    const basename = basenameRelative(attachment.path).toLocaleLowerCase()
    uniqueBasenames.set(
      basename,
      uniqueBasenames.has(basename) ? null : attachment.path
    )
  }
  return { exactPaths, uniqueBasenames }
}

function resolveIndexedAttachmentLink(
  target: string,
  index: AttachmentLinkIndex
): IndexedAttachmentLinkResolution {
  const noteTarget = target.trim().split('#', 1)[0].replaceAll('\\', '/')
  const validation = validateRelativePath(noteTarget)
  if (!validation.valid || !validation.normalized) {
    return { status: 'invalid' }
  }

  const normalized = validation.normalized
  if (normalized.includes('/')) {
    const resolvedPath = index.exactPaths.get(normalized.toLocaleLowerCase())
    return resolvedPath
      ? { status: 'resolved', path: resolvedPath }
      : { status: 'missing', path: normalized }
  }

  const candidate = index.uniqueBasenames.get(normalized.toLocaleLowerCase())
  if (candidate === null) {
    return { status: 'ambiguous' }
  }
  return candidate
    ? { status: 'resolved', path: candidate }
    : { status: 'missing', path: normalized }
}

export function buildWikiGraph(
  notes: NoteDocument[],
  options: BuildWikiGraphOptions = {}
): WikiGraph {
  const nodes = notes
    .map((note) => ({
      path: note.path,
      name: note.name,
      kind: 'note' as const,
      exists: true,
      ...(note.createdAt !== undefined ? { createdAt: note.createdAt } : {})
    }))
    .sort((left, right) => comparePath(left.path, right.path))

  const edges = new Map<string, WikiGraphEdge>()
  const unresolvedNodes = new Map<string, WikiGraphNode>()
  const tagNodes = new Map<string, WikiGraphNode>()
  const linkIndex = buildWikiLinkIndex(notes, options.pathAliases)
  const attachments = options.attachments ?? []
  const attachmentIndex = buildAttachmentLinkIndex(attachments)
  const attachmentNodes = options.includeAttachments
    ? attachments.map(
        (attachment): WikiGraphNode => ({
          path: attachment.path,
          name: attachment.name,
          kind: 'attachment',
          exists: true,
          createdAt: attachment.createdAt
        })
      )
    : []

  for (const source of notes) {
    for (const link of extractWikiLinks(source.content)) {
      const linkTarget = link.target.trim().split('#', 1)[0]
      if (isSupportedAttachmentPath(linkTarget)) {
        if (!options.includeAttachments) {
          continue
        }

        const resolution = resolveIndexedAttachmentLink(
          link.target,
          attachmentIndex
        )
        if (
          resolution.status === 'invalid' ||
          resolution.status === 'ambiguous' ||
          (resolution.status === 'missing' && !options.includeUnresolved)
        ) {
          continue
        }

        let targetPath = resolution.path
        if (resolution.status === 'missing') {
          const unresolvedKey = targetPath.toLocaleLowerCase()
          const existing = unresolvedNodes.get(unresolvedKey)
          if (existing) {
            targetPath = existing.path
          } else {
            unresolvedNodes.set(unresolvedKey, {
              path: targetPath,
              name: basenameRelative(targetPath),
              kind: 'unresolved',
              exists: false
            })
          }
        }

        const edge: WikiGraphEdge = {
          sourcePath: source.path,
          targetPath
        }
        edges.set(`${edge.sourcePath}\0${edge.targetPath}`, edge)
        continue
      }

      const resolution = resolveIndexedWikiLink(link.target, linkIndex)
      if (
        resolution.status === 'invalid' ||
        resolution.status === 'ambiguous'
      ) {
        continue
      }
      if (resolution.status === 'missing' && !options.includeUnresolved) {
        continue
      }

      let targetPath = resolution.path
      if (resolution.status === 'missing') {
        const unresolvedKey = targetPath.toLocaleLowerCase()
        const existing = unresolvedNodes.get(unresolvedKey)
        if (existing) {
          targetPath = existing.path
        } else {
          unresolvedNodes.set(unresolvedKey, {
            path: targetPath,
            name: withoutMarkdownExtension(basenameRelative(targetPath)),
            kind: 'unresolved',
            exists: false
          })
        }
      }

      if (targetPath === source.path) {
        continue
      }

      const edge: WikiGraphEdge = {
        sourcePath: source.path,
        targetPath
      }
      edges.set(`${edge.sourcePath}\0${edge.targetPath}`, edge)
    }

    if (options.includeTags) {
      for (const tag of extractMarkdownTags(source.content)) {
        const targetPath = `tag:${tag}`
        tagNodes.set(targetPath, {
          path: targetPath,
          name: tag,
          kind: 'tag',
          exists: true
        })
        const edge: WikiGraphEdge = {
          sourcePath: source.path,
          targetPath
        }
        edges.set(`${edge.sourcePath}\0${edge.targetPath}`, edge)
      }
    }
  }

  return {
    nodes: [
      ...nodes,
      ...unresolvedNodes.values(),
      ...tagNodes.values(),
      ...attachmentNodes
    ].sort((left, right) => comparePath(left.path, right.path)),
    edges: [...edges.values()].sort(
      (left, right) =>
        comparePath(left.sourcePath, right.sourcePath) ||
        comparePath(left.targetPath, right.targetPath)
    )
  }
}

export function buildWikiGraphForView(
  notes: NoteDocument[],
  viewMode: WikiGraphViewMode,
  options: BuildWikiGraphOptions = {}
): WikiGraph {
  return viewMode === 'graph'
    ? buildWikiGraph(notes, options)
    : { nodes: [], edges: [] }
}

export function getLocalWikiGraph(
  graph: WikiGraph,
  currentPath: string,
  options: LocalWikiGraphOptions = DEFAULT_LOCAL_GRAPH_OPTIONS
): WikiGraph {
  if (!graph.nodes.some((node) => node.path === currentPath)) {
    return { nodes: [], edges: [] }
  }

  const localPaths = new Set<string>([currentPath])
  for (const edge of graph.edges) {
    if (options.outgoingLinks && edge.sourcePath === currentPath) {
      localPaths.add(edge.targetPath)
    }
    if (options.incomingLinks && edge.targetPath === currentPath) {
      localPaths.add(edge.sourcePath)
    }
  }

  return {
    nodes: graph.nodes
      .filter((node) => localPaths.has(node.path))
      .sort((left, right) => comparePath(left.path, right.path)),
    edges: graph.edges
      .filter((edge) => {
        if (!localPaths.has(edge.sourcePath) || !localPaths.has(edge.targetPath)) {
          return false
        }
        if (edge.sourcePath === currentPath) {
          return options.outgoingLinks
        }
        if (edge.targetPath === currentPath) {
          return options.incomingLinks
        }
        return options.neighborLinks
      })
      .sort(
        (left, right) =>
          comparePath(left.sourcePath, right.sourcePath) ||
          comparePath(left.targetPath, right.targetPath)
      )
  }
}

export function getVaultWikiGraph(
  graph: WikiGraph,
  currentPath: string | null,
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
  if (currentPath) {
    connectedPaths.add(currentPath)
  }

  return {
    nodes: graph.nodes.filter((node) => connectedPaths.has(node.path)),
    edges: graph.edges
  }
}

export function filterWikiGraph(
  graph: WikiGraph,
  currentPath: string | null,
  query: string,
  notes: NoteDocument[] = []
): WikiGraph {
  if (!query.trim()) {
    return graph
  }

  const notesByPath = new Map(notes.map((note) => [note.path, note]))

  const visiblePaths = new Set(
    graph.nodes
      .filter((node) => {
        if (currentPath !== null && node.path === currentPath) {
          return true
        }
        const note = notesByPath.get(node.path)
        return matchesGraphQuery(
          {
            path: node.path,
            name: node.name,
            kind: node.kind,
            content: note?.content,
            tags:
              node.kind === 'tag'
                ? [node.name]
                : note
                  ? extractMarkdownTags(note.content)
                  : []
          },
          query
        )
      })
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
