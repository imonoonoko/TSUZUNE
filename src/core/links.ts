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
import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { decodeString } from 'micromark-util-decode-string'

export interface SourceRange { from: number; to: number }
export interface NoteLinkOccurrence extends WikiLinkOccurrence {
  kind: 'wiki' | 'markdown'
  sourcePath: string
  fragment?: string
  range: SourceRange
  destinationRange: SourceRange
}
export interface ResolvedNoteLink extends NoteLinkOccurrence, ResolvedWikiLink {}

/** CommonMark syntax ranges; shared by navigation, mention scanning and link analysis. */
export function markdownExcludedRanges(content: string, tree = commonmarkLanguage.parser.parse(content)): SourceRange[] {
  const ranges: SourceRange[] = []
  const frontmatter = content.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/)
  if (frontmatter) ranges.push({ from: 0, to: frontmatter[0].length })
  tree.iterate({ enter(node) {
    if (['FencedCode', 'CodeBlock', 'InlineCode', 'Comment', 'CommentBlock', 'HTMLBlock', 'HTMLTag'].includes(node.name)) {
      ranges.push({ from: node.from, to: node.to })
      return false
    }
  } })
  return ranges
}

export function extractNoteLinks(content: string, sourcePath: string, includeEmbeddedAttachments = false): NoteLinkOccurrence[] {
  if (!content.includes('[')) return []
  const tree = commonmarkLanguage.parser.parse(content)
  const ignored = markdownExcludedRanges(content, tree)
  const frontmatter = content.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/)?.[0] ?? ''
  // Preserve the legacy Wiki structural index in YAML, including indented values.
  // A same-length mask reuses its code exclusion rules while retaining source offsets.
  const frontmatterWikiMask = walkMarkdown(frontmatter, occurrence => ' '.repeat(occurrence.raw.length))
  const excluded = (from: number, to: number) => ignored.some(range => from < range.to && to > range.from)
  const references = new Map<string, SourceRange>()
  const normalizeLabel = (label: string) => label.replace(/^\[|\]$/g, '').replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  tree.iterate({ enter(node) {
    if (node.name !== 'LinkReference' || excluded(node.from, node.to)) return
    const label = node.node.getChild('LinkLabel')
    const url = node.node.getChild('URL')
    if (label && url) {
      const key = normalizeLabel(content.slice(label.from, label.to))
      if (!references.has(key)) references.set(key, { from: url.from, to: url.to })
    }
  } })
  const links: NoteLinkOccurrence[] = []
  const markdownRanges: SourceRange[] = []
  tree.iterate({ enter(node) {
    if (!['Link', 'Image', 'LinkReference'].includes(node.name) || excluded(node.from, node.to)) return
    if (node.name !== 'Link') {
      if (!content.slice(node.from, node.to).startsWith('![[')) markdownRanges.push({ from: node.from, to: node.to })
      return
    }
    const url = node.node.getChild('URL')
    const label = node.node.getChild('LinkLabel')
    const raw = content.slice(node.from, node.to)
    const reference = label ? content.slice(label.from, label.to) : raw
    const span = url ? { from: url.from, to: url.to } : references.get(normalizeLabel(reference === '[]' ? raw.split(']')[0] + ']' : reference))
    if (!span) return
    markdownRanges.push({ from: node.from, to: node.to })
    const destinationRange = { ...span }
    if (content[destinationRange.from] === '<' && content[destinationRange.to - 1] === '>') { destinationRange.from++; destinationRange.to-- }
    const target = decodeString(content.slice(destinationRange.from, destinationRange.to))
    if (!/\.md(?:#|$)/i.test(target) && !target.startsWith('#')) return
    links.push({ kind: 'markdown', sourcePath, raw, target, alias: null, fragment: target.includes('#') ? target.slice(target.indexOf('#') + 1) : undefined, range: { from: node.from, to: node.to }, destinationRange })
  } })
  for (const match of content.matchAll(/\[\[([^\]\r\n]+)\]\]/g)) {
    const from = match.index
    const to = from + match[0].length
    let escapes = 0
    for (let i = from - 1; i >= 0 && content[i] === '\\'; i--) escapes++
    const frontmatterWiki = to <= frontmatter.length && frontmatterWikiMask.slice(from, to) !== match[0]
    if (escapes % 2 || (!frontmatterWiki && excluded(from, to)) || markdownRanges.some(range => from < range.to && to > range.from)) continue
    const occurrence = readWikiLink(match[0])
    if (!occurrence || (!includeEmbeddedAttachments && content[from - 1] === '!' && isSupportedAttachmentPath(occurrence.target.split('#')[0]))) continue
    links.push({ ...occurrence, kind: 'wiki', sourcePath, fragment: occurrence.target.includes('#') ? occurrence.target.slice(occurrence.target.indexOf('#') + 1) : undefined, range: { from, to }, destinationRange: { from: from + 2, to: from + 2 + match[1].split('|')[0].length } })
  }
  return links.sort((a, b) => a.range.from - b.range.from)
}

export function relativeMarkdownPath(href: string, currentPath: string): string | null {
  if (!href || href.startsWith('/') || href.startsWith('\\') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href) || href.includes('?')) return null
  let decoded: string
  try { decoded = decodeURIComponent(href) } catch { return null }
  if (!/\.md$/i.test(decoded)) return null
  const parts = dirnameRelative(currentPath).split('/').filter(Boolean)
  for (const part of decoded.replaceAll('\\', '/').split('/')) {
    if (part === '.') continue
    if (part === '..') { if (!parts.length) return null; parts.pop() }
    else if (part) parts.push(part)
    else return null
  }
  const path = parts.join('/')
  return validateRelativePath(path).valid ? path : null
}

export function resolveIndexedNoteLink(link: Pick<NoteLinkOccurrence, 'kind' | 'target' | 'sourcePath'>, index: WikiLinkIndex): IndexedWikiLinkResolution {
  if (link.kind === 'wiki') return resolveIndexedWikiLink(link.target, index)
  const pathPart = link.target.split('#')[0]
  const path = pathPart ? relativeMarkdownPath(pathPart, link.sourcePath) : link.sourcePath
  if (!path) return { status: 'invalid', candidates: [], reason: 'Vault 内の相対 .md リンクを指定してください。' }
  const resolved = index.exactPaths.get(path.toLocaleLowerCase()) ?? index.aliasExactPaths.get(path.toLocaleLowerCase())
  return resolved ? { status: 'resolved', path: resolved, candidates: [resolved] } : { status: 'missing', path, candidates: [] }
}

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
  pathAliases?: CompiledPathAliases,
  sourcePath = ''
): ResolvedNoteLink[] {
  const unique = new Map<string, ResolvedNoteLink>()
  const index = buildWikiLinkIndex(notes, pathAliases)

  for (const occurrence of extractNoteLinks(content, sourcePath)) {
    const resolved = resolvedWikiLink(occurrence.target, resolveIndexedNoteLink(occurrence, index))
    const key = `${occurrence.kind}:${occurrence.target.toLocaleLowerCase()}`
    if (!unique.has(key)) unique.set(key, { ...occurrence, ...resolved, alias: occurrence.alias })
  }

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

    return extractNoteLinks(note.content, note.path).some(
      (link) =>
        resolvedWikiLink(
          link.target,
          resolveIndexedNoteLink(link, index)
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
    for (const occurrence of extractNoteLinks(source.content, source.path)) {
      const before = resolvedWikiLink(
        occurrence.target,
        resolveIndexedNoteLink(occurrence, beforeIndex)
      )
      if (before.status !== 'resolved' || !before.resolvedPath) {
        continue
      }

      const expectedNewPath = pathChanges.get(before.resolvedPath)
      if (!expectedNewPath && !pathChanges.has(source.path)) {
        continue
      }

      const after = resolvedWikiLink(
        occurrence.target,
        resolveIndexedNoteLink({ ...occurrence, sourcePath: pathChanges.get(source.path) ?? source.path }, afterIndex)
      )
      if (after.status !== 'resolved' || after.resolvedPath !== (expectedNewPath ?? before.resolvedPath)) {
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
