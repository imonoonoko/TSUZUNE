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
  onLink: (occurrence: WikiLinkOccurrence) => string
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
        output += occurrence ? onLink(occurrence) : raw
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
  onLink: (occurrence: WikiLinkOccurrence) => string
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
  return walkMarkdown(markdown, (occurrence) => {
    const label = escapeMarkdownLabel(occurrence.alias ?? occurrence.target)
    return `[${label}](#/wiki/${encodeURIComponent(occurrence.target)})`
  })
}

export function resolveWikiLink(target: string, notes: NoteDocument[]): ResolvedWikiLink {
  const normalizedTarget = withoutMarkdownExtension(target.trim()).replaceAll('\\', '/')
  const validation = validateRelativePath(normalizedTarget)

  if (!validation.valid || !validation.normalized) {
    return {
      target,
      alias: null,
      status: 'invalid',
      candidates: [],
      reason: validation.reason ?? '無効なリンクです。'
    }
  }

  const normalized = validation.normalized
  const lowerTarget = withMarkdownExtension(normalized).toLocaleLowerCase()

  if (normalized.includes('/')) {
    const exact = notes.find((note) => note.path.toLocaleLowerCase() === lowerTarget)
    return exact
      ? {
          target,
          alias: null,
          status: 'resolved',
          resolvedPath: exact.path,
          candidates: [exact.path]
        }
      : {
          target,
          alias: null,
          status: 'missing',
          candidates: []
        }
  }

  const candidates = notes
    .filter(
      (note) =>
        withoutMarkdownExtension(basenameRelative(note.path)).toLocaleLowerCase() ===
        normalized.toLocaleLowerCase()
    )
    .map((note) => note.path)

  if (candidates.length === 1) {
    return {
      target,
      alias: null,
      status: 'resolved',
      resolvedPath: candidates[0],
      candidates
    }
  }

  return {
    target,
    alias: null,
    status: candidates.length === 0 ? 'missing' : 'ambiguous',
    candidates
  }
}

export function getOutgoingLinks(
  content: string,
  notes: NoteDocument[]
): ResolvedWikiLink[] {
  const unique = new Map<string, ResolvedWikiLink>()

  for (const occurrence of extractWikiLinks(content)) {
    const resolved = resolveWikiLink(occurrence.target, notes)
    const key = occurrence.target.toLocaleLowerCase()
    if (!unique.has(key)) {
      unique.set(key, {
        ...resolved,
        alias: occurrence.alias
      })
    }
  }

  return [...unique.values()]
}

export function getBacklinks(currentPath: string, notes: NoteDocument[]): NoteDocument[] {
  return notes.filter((note) => {
    if (note.path === currentPath) {
      return false
    }

    return extractWikiLinks(note.content).some(
      (link) => resolveWikiLink(link.target, notes).resolvedPath === currentPath
    )
  })
}

export interface LinkImpact {
  sourcePaths: string[]
  affectedCount: number
}

export function findLinkImpact(
  notes: NoteDocument[],
  pathChanges: ReadonlyMap<string, string>
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

  for (const source of notes) {
    for (const occurrence of extractWikiLinks(source.content)) {
      const before = resolveWikiLink(occurrence.target, notes)
      if (before.status !== 'resolved' || !before.resolvedPath) {
        continue
      }

      const expectedNewPath = pathChanges.get(before.resolvedPath)
      if (!expectedNewPath) {
        continue
      }

      const after = resolveWikiLink(occurrence.target, changedNotes)
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
