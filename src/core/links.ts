import type {
  NoteDocument,
  ResolvedWikiLink,
  WikiLinkOccurrence
} from '../shared/types'
import {
  basenameRelative,
  dirnameRelative,
  joinRelative,
  validateRelativePath,
  withMarkdownExtension,
  withoutMarkdownExtension
} from './paths'
import type { CompiledPathAliases } from './path-aliases'
import { isSupportedAttachmentPath } from '../shared/attachments'

interface FenceState {
  character: '`' | '~'
  length: number
}
function getFence(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})/)
  if (!match) {
    return null
  }

  return {
    character: match[1][0] as '`' | '~',
    length: match[1].length
  }
}

function isClosingFence(line: string, fence: FenceState): boolean {
  const pattern =
    fence.character === '`'
      ? new RegExp(`^\\s*\`{${fence.length},}\\s*$`)
      : new RegExp(`^\\s*~{${fence.length},}\\s*$`)
  return pattern.test(line)
}

function readWikiLink(raw: string): WikiLinkOccurrence | null {
  const body = raw.slice(2, -2)
  const separator = body.indexOf('|')
  const target = (separator < 0 ? body : body.slice(0, separator)).trim()
  const alias = separator < 0 ? null : body.slice(separator + 1).trim()

  if (!target) {
    return null
  }

  return {
    raw,
    target,
    alias: alias || null
  }
}

function processInlineLine(
  line: string,
  onLink: (occurrence: WikiLinkOccurrence, embedded: boolean) => string
): string {
  let output = ''
  let index = 0

  while (index < line.length) {
    if (line[index] === '`') {
      let tickCount = 1
      while (line[index + tickCount] === '`') {
        tickCount += 1
      }

      const marker = '`'.repeat(tickCount)
      const closing = line.indexOf(marker, index + tickCount)
      if (closing < 0) {
        output += line.slice(index)
        break
      }

      output += line.slice(index, closing + tickCount)
      index = closing + tickCount
      continue
    }

    if (line.startsWith('[[', index)) {
      const closing = line.indexOf(']]', index + 2)
      if (closing >= 0) {
        const raw = line.slice(index, closing + 2)
        const occurrence = readWikiLink(raw)
        output += occurrence
          ? onLink(occurrence, index > 0 && line[index - 1] === '!')
          : raw
        index = closing + 2
        continue
      }
    }

    output += line[index]
    index += 1
  }

  return output
}

function walkMarkdown(
  markdown: string,
  onLink: (occurrence: WikiLinkOccurrence, embedded: boolean) => string
): string {
  const lines = markdown.split('\n')
  let activeFence: FenceState | null = null

  return lines
    .map((line) => {
      if (activeFence) {
        if (isClosingFence(line, activeFence)) {
          activeFence = null
        }
        return line
      }

      const openingFence = getFence(line)
      if (openingFence) {
        activeFence = openingFence
        return line
      }

      return processInlineLine(line, onLink)
    })
    .join('\n')
}

export function extractWikiLinks(markdown: string): WikiLinkOccurrence[] {
  const links: WikiLinkOccurrence[] = []
  walkMarkdown(markdown, (occurrence) => {
    links.push(occurrence)
    return occurrence.raw
  })
  return links
}

function escapeMarkdownLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

export function transformWikiLinksForPreview(markdown: string): string {
  return walkMarkdown(markdown, (occurrence, embedded) => {
    const label = escapeMarkdownLabel(occurrence.alias ?? occurrence.target)
    const route = embedded ? 'vault-asset' : 'wiki'
    return `[${label}](#/${route}/${encodeURIComponent(occurrence.target)})`
  })
}

/**
 * Rewrites Markdown by transforming each Wiki link with the same parser used
 * for extraction, so fenced code blocks and inline code are left untouched.
 * The transform receives the parsed occurrence plus the embedded (`![[..]]`)
 * flag and must return the full replacement text for the link.
 */
export function transformWikiLinks(
  markdown: string,
  transform: (occurrence: WikiLinkOccurrence, embedded: boolean) => string
): string {
  return walkMarkdown(markdown, transform)
}

export interface WikiLinkIndex {
  readonly exactPaths: ReadonlyMap<string, string>
  readonly basenameCandidates: ReadonlyMap<string, readonly string[]>
  readonly aliasExactPaths: ReadonlyMap<string, string>
  readonly aliasBasenameCandidates: ReadonlyMap<string, readonly string[]>
}

export type IndexedWikiLinkResolution =
  | { status: 'resolved'; path: string; candidates: string[] }
  | { status: 'missing'; path: string; candidates: [] }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'invalid'; candidates: []; reason: string }

function addCandidate(
  candidatesByName: Map<string, string[]>,
  name: string,
  path: string
): void {
  const candidates = candidatesByName.get(name) ?? []
  if (!candidates.some((candidate) => candidate.toLocaleLowerCase() === path.toLocaleLowerCase())) {
    candidates.push(path)
    candidatesByName.set(name, candidates)
  }
}

export function buildWikiLinkIndex(
  notes: readonly NoteDocument[],
  pathAliases?: CompiledPathAliases
): WikiLinkIndex {
  const exactPaths = new Map<string, string>()
  const basenameCandidates = new Map<string, string[]>()

  for (const note of notes) {
    const pathKey = note.path.toLocaleLowerCase()
    if (!exactPaths.has(pathKey)) {
      exactPaths.set(pathKey, note.path)
    }
    addCandidate(
      basenameCandidates,
      withoutMarkdownExtension(basenameRelative(note.path)).toLocaleLowerCase(),
      note.path
    )
  }

  const aliasExactPaths = new Map<string, string>()
  const aliasBasenameCandidates = new Map<string, string[]>()
  if (pathAliases) {
    for (const [oldPathKey, canonicalPath] of pathAliases.flattened) {
      if (exactPaths.has(oldPathKey)) {
        continue
      }
      const liveCanonicalPath = exactPaths.get(canonicalPath.toLocaleLowerCase())
      if (!liveCanonicalPath) {
        continue
      }
      aliasExactPaths.set(oldPathKey, liveCanonicalPath)
      addCandidate(
        aliasBasenameCandidates,
        withoutMarkdownExtension(basenameRelative(oldPathKey)).toLocaleLowerCase(),
        liveCanonicalPath
      )
    }
  }

  return {
    exactPaths,
    basenameCandidates,
    aliasExactPaths,
    aliasBasenameCandidates
  }
}

export function resolveIndexedWikiLink(
  target: string,
  index: WikiLinkIndex
): IndexedWikiLinkResolution {
  const baseTarget = target.trim().split('#', 1)[0]
  const normalizedTarget = withoutMarkdownExtension(baseTarget).replaceAll('\\', '/')
  const validation = validateRelativePath(normalizedTarget)

  if (!validation.valid || !validation.normalized) {
    return {
      status: 'invalid',
      candidates: [],
      reason: validation.reason ?? '無効なリンクです。'
    }
  }

  const normalized = validation.normalized
  const intendedPath = withMarkdownExtension(normalized)
  const lowerTarget = intendedPath.toLocaleLowerCase()

  if (normalized.includes('/')) {
    const resolvedPath =
      index.exactPaths.get(lowerTarget) ?? index.aliasExactPaths.get(lowerTarget)
    return resolvedPath
      ? { status: 'resolved', path: resolvedPath, candidates: [resolvedPath] }
      : { status: 'missing', path: intendedPath, candidates: [] }
  }

  const basenameKey = normalized.toLocaleLowerCase()
  const candidates = index.basenameCandidates.get(basenameKey)
  if (candidates) {
    return candidates.length === 1
      ? { status: 'resolved', path: candidates[0], candidates: [...candidates] }
      : { status: 'ambiguous', candidates: [...candidates] }
  }

  const aliasCandidates = index.aliasBasenameCandidates.get(basenameKey)
  if (aliasCandidates) {
    return aliasCandidates.length === 1
      ? {
          status: 'resolved',
          path: aliasCandidates[0],
          candidates: [...aliasCandidates]
        }
      : { status: 'ambiguous', candidates: [...aliasCandidates] }
  }

  return { status: 'missing', path: intendedPath, candidates: [] }
}

function resolvedWikiLink(
  target: string,
  resolution: IndexedWikiLinkResolution
): ResolvedWikiLink {
  if (resolution.status === 'resolved') {
    return {
      target,
      alias: null,
      status: 'resolved',
      resolvedPath: resolution.path,
      candidates: resolution.candidates
    }
  }
  return {
    target,
    alias: null,
    status: resolution.status,
    candidates: resolution.candidates,
    ...(resolution.status === 'invalid' ? { reason: resolution.reason } : {})
  }
}

export function resolveWikiLink(
  target: string,
  notes: NoteDocument[],
  pathAliases?: CompiledPathAliases
): ResolvedWikiLink {
  return resolvedWikiLink(
    target,
    resolveIndexedWikiLink(target, buildWikiLinkIndex(notes, pathAliases))
  )
}

export function getOutgoingLinks(
  content: string,
  notes: NoteDocument[],
  pathAliases?: CompiledPathAliases
): ResolvedWikiLink[] {
  const unique = new Map<string, ResolvedWikiLink>()
  const index = buildWikiLinkIndex(notes, pathAliases)

  walkMarkdown(content, (occurrence, embedded) => {
    if (embedded && isSupportedAttachmentPath(occurrence.target)) {
      return occurrence.raw
    }
    const resolved = resolvedWikiLink(
      occurrence.target,
      resolveIndexedWikiLink(occurrence.target, index)
    )
    const key = occurrence.target.toLocaleLowerCase()
    if (!unique.has(key)) {
      unique.set(key, {
        ...resolved,
        alias: occurrence.alias
      })
    }
    return occurrence.raw
  })

  return [...unique.values()]
}

export function getBacklinks(
  currentPath: string,
  notes: NoteDocument[],
  pathAliases?: CompiledPathAliases
): NoteDocument[] {
  const index = buildWikiLinkIndex(notes, pathAliases)
  return notes.filter((note) => {
    if (note.path === currentPath) {
      return false
    }

    return extractWikiLinks(note.content).some(
      (link) =>
        resolvedWikiLink(
          link.target,
          resolveIndexedWikiLink(link.target, index)
        ).resolvedPath === currentPath
    )
  })
}

export interface LinkImpact {
  sourcePaths: string[]
  affectedCount: number
}

export function findLinkImpact(
  notes: NoteDocument[],
  pathChanges: ReadonlyMap<string, string>,
  pathAliases?: CompiledPathAliases
): LinkImpact {
  const changedNotes = notes.map((note) => {
    const nextPath = pathChanges.get(note.path)
    return nextPath
      ? {
          ...note,
          path: nextPath,
          name: withoutMarkdownExtension(basenameRelative(nextPath))
        }
      : note
  })

  const affectedSources = new Set<string>()
  const beforeIndex = buildWikiLinkIndex(notes, pathAliases)
  const afterIndex = buildWikiLinkIndex(changedNotes, pathAliases)

  for (const source of notes) {
    for (const occurrence of extractWikiLinks(source.content)) {
      const before = resolvedWikiLink(
        occurrence.target,
        resolveIndexedWikiLink(occurrence.target, beforeIndex)
      )
      if (before.status !== 'resolved' || !before.resolvedPath) {
        continue
      }

      const expectedNewPath = pathChanges.get(before.resolvedPath)
      if (!expectedNewPath) {
        continue
      }

      const after = resolvedWikiLink(
        occurrence.target,
        resolveIndexedWikiLink(occurrence.target, afterIndex)
      )
      if (after.status !== 'resolved' || after.resolvedPath !== expectedNewPath) {
        affectedSources.add(source.path)
      }
    }
  }

  return {
    sourcePaths: [...affectedSources].sort((a, b) => a.localeCompare(b, 'ja')),
    affectedCount: affectedSources.size
  }
}

export function buildNoteCreationPath(
  currentNotePath: string | null,
  target: string
): string | null {
  const normalizedTarget = withoutMarkdownExtension(target.trim()).replaceAll('\\', '/')
  const validation = validateRelativePath(normalizedTarget)
  if (!validation.valid || !validation.normalized) {
    return null
  }

  if (validation.normalized.includes('/')) {
    return withMarkdownExtension(validation.normalized)
  }

  const directory = currentNotePath ? dirnameRelative(currentNotePath) : ''
  return joinRelative(directory, withMarkdownExtension(validation.normalized))
}
