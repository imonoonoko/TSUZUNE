import { getBacklinks, getOutgoingLinks } from './links'
import type { NoteDocument } from '../shared/types'

export type ContextRelation = 'seed' | 'outgoing' | 'backlink'

export interface ContextSource {
  path: string
  name: string
  relation: ContextRelation
  truncated: boolean
}

export interface ContextBundle {
  markdown: string
  characterCount: number
  truncated: boolean
  included: ContextSource[]
  omittedPaths: string[]
}

export interface ContextBundleOptions {
  maxCharacters?: number
  maxOutgoing?: number
  maxBacklinks?: number
}

const DEFAULT_MAX_CHARACTERS = 15_000
const DEFAULT_MAX_OUTGOING = 5
const DEFAULT_MAX_BACKLINKS = 3
const TRUNCATION_MARKER = '\n\n[このノートは文字数上限で省略されました]\n'

function sourceSection(
  note: NoteDocument,
  relation: ContextRelation
): string {
  const relationLabel = {
    seed: '起点',
    outgoing: 'リンク先',
    backlink: 'バックリンク'
  }[relation]

  return [
    `## Source: ${note.name}`,
    `Path: ${note.path}`,
    `Relation: ${relationLabel}`,
    `Updated: ${new Date(note.modifiedAt).toISOString()}`,
    '',
    note.content.trim(),
    ''
  ].join('\n')
}

export function buildContextBundle(
  seedPath: string,
  notes: NoteDocument[],
  options: ContextBundleOptions = {}
): ContextBundle {
  const seed = notes.find((note) => note.path === seedPath)
  if (!seed) {
    throw new Error(`ノートが見つかりません: ${seedPath}`)
  }

  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS
  const maxOutgoing = options.maxOutgoing ?? DEFAULT_MAX_OUTGOING
  const maxBacklinks = options.maxBacklinks ?? DEFAULT_MAX_BACKLINKS

  const candidates: Array<{
    note: NoteDocument
    relation: ContextRelation
  }> = [{ note: seed, relation: 'seed' }]
  const selected = new Set([seed.path])

  for (const link of getOutgoingLinks(seed.content, notes)) {
    if (
      candidates.filter((candidate) => candidate.relation === 'outgoing').length >=
      maxOutgoing
    ) {
      break
    }
    if (
      link.status !== 'resolved' ||
      !link.resolvedPath ||
      selected.has(link.resolvedPath)
    ) {
      continue
    }
    const note = notes.find((item) => item.path === link.resolvedPath)
    if (note) {
      selected.add(note.path)
      candidates.push({ note, relation: 'outgoing' })
    }
  }

  for (const note of getBacklinks(seed.path, notes).slice(0, maxBacklinks)) {
    if (!selected.has(note.path)) {
      selected.add(note.path)
      candidates.push({ note, relation: 'backlink' })
    }
  }

  const header = [
    '# TSUZUNE Context Bundle',
    '',
    `Seed: ${seed.path}`,
    `Generated: ${new Date().toISOString()}`,
    ''
  ].join('\n')

  let markdown = header
  const included: ContextSource[] = []
  const omittedPaths: string[] = []
  let truncated = false

  for (const [index, candidate] of candidates.entries()) {
    const separator = markdown.endsWith('\n\n') ? '' : '\n'
    const section = `${separator}${sourceSection(candidate.note, candidate.relation)}`

    if (markdown.length + section.length <= maxCharacters) {
      markdown += section
      included.push({
        path: candidate.note.path,
        name: candidate.note.name,
        relation: candidate.relation,
        truncated: false
      })
      continue
    }

    const remaining = maxCharacters - markdown.length
    if (remaining > TRUNCATION_MARKER.length + 80) {
      const visibleLength = remaining - TRUNCATION_MARKER.length
      markdown += section.slice(0, visibleLength) + TRUNCATION_MARKER
      included.push({
        path: candidate.note.path,
        name: candidate.note.name,
        relation: candidate.relation,
        truncated: true
      })
    } else {
      omittedPaths.push(candidate.note.path)
    }

    for (const omitted of candidates.slice(index + 1)) {
      omittedPaths.push(omitted.note.path)
    }
    truncated = true
    break
  }

  return {
    markdown,
    characterCount: markdown.length,
    truncated,
    included,
    omittedPaths
  }
}
