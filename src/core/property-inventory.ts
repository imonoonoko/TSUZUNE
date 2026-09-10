import { inspectFrontmatterProperty, parseFrontmatter, type FrontmatterProperty } from './frontmatter'
import type { NoteDocument } from '../shared/types'

export type ObservedPropertyShape =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'list'
  | 'null'
  | 'unsupported'
  | 'malformed'

export type PropertyInventoryStatus =
  | 'consistent'
  | 'empty-values'
  | 'mixed-types'
  | 'unsupported'
  | 'malformed'

export interface PropertyInventoryEntry {
  name: string
  noteCount: number
  shapeCounts: Partial<Record<ObservedPropertyShape, number>>
  status: PropertyInventoryStatus
  samplePaths: string[]
}

export interface PropertyInventory {
  scope: 'visible-snapshot'
  noteCount: number
  frontmatterNoteCount: number
  entries: PropertyInventoryEntry[]
}

const SAMPLE_PATH_LIMIT = 5

interface MutableEntry {
  name: string
  noteCount: number
  shapeCounts: Partial<Record<ObservedPropertyShape, number>>
  samplePaths: Set<string>
}

function shapeFromProperty(property: FrontmatterProperty): ObservedPropertyShape {
  if (property.type === 'list' && property.value.length === 0) return 'null'
  return property.type
}

function isNullishPropertySource(markdown: string, name: string): boolean {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  if (!match) return false
  const lines = match[1].split(/\r?\n/)
  const target = new RegExp(`^${name}:(.*)$`)
  const topLevelField = /^[A-Za-z_][A-Za-z0-9_-]*:(?:\s.*)?$/
  const index = lines.findIndex((line) => target.test(line))
  if (index === -1) return false

  const rawValue = target.exec(lines[index])?.[1]?.trim() ?? ''
  if (rawValue !== '' && !rawValue.startsWith('#')) {
    const withoutComment = rawValue.split(/\s+#/)[0].trim()
    return withoutComment === 'null' || withoutComment === '~'
  }
  for (const line of lines.slice(index + 1)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (topLevelField.test(line)) break
    return false
  }
  return true
}

function inspectShape(
  markdown: string,
  name: string,
  parsed: ReturnType<typeof parseFrontmatter>
): ObservedPropertyShape {
  if (parsed.warnings.length > 0) return 'malformed'

  const inspection = inspectFrontmatterProperty(markdown, name)
  if (inspection.ok) {
    if (inspection.property !== null) return shapeFromProperty(inspection.property)
    return parsed.attributes[name] === null ? 'null' : 'unsupported'
  }
  if (
    parsed.attributes[name] === null &&
    inspection.code === 'NON_SCALAR_PROPERTY' &&
    isNullishPropertySource(markdown, name)
  ) {
    return 'null'
  }
  return inspection.code === 'MALFORMED_FRONTMATTER' || inspection.code === 'DUPLICATE_PROPERTY'
    ? 'malformed'
    : 'unsupported'
}

function statusFor(shapeCounts: Partial<Record<ObservedPropertyShape, number>>): PropertyInventoryStatus {
  if ((shapeCounts.malformed ?? 0) > 0) return 'malformed'
  if ((shapeCounts.unsupported ?? 0) > 0) return 'unsupported'

  const concreteShapes = (['text', 'number', 'checkbox', 'list'] as const).filter(
    (shape) => (shapeCounts[shape] ?? 0) > 0
  )
  if (concreteShapes.length > 1) return 'mixed-types'
  if ((shapeCounts.null ?? 0) > 0) return 'empty-values'
  return 'consistent'
}

export function buildPropertyInventory(notes: readonly NoteDocument[]): PropertyInventory {
  const entries = new Map<string, MutableEntry>()
  let frontmatterNoteCount = 0

  for (const note of notes) {
    const parsed = parseFrontmatter(note.content)
    if (!parsed.found) continue
    frontmatterNoteCount += 1

    for (const name of Object.keys(parsed.attributes)) {
      const entry = entries.get(name) ?? {
        name,
        noteCount: 0,
        shapeCounts: {},
        samplePaths: new Set<string>()
      }
      entry.noteCount += 1
      const shape = inspectShape(note.content, name, parsed)
      entry.shapeCounts[shape] = (entry.shapeCounts[shape] ?? 0) + 1
      entry.samplePaths.add(note.path)
      entries.set(name, entry)
    }
  }

  return {
    scope: 'visible-snapshot',
    noteCount: notes.length,
    frontmatterNoteCount,
    entries: [...entries.values()]
      .map((entry) => ({
        name: entry.name,
        noteCount: entry.noteCount,
        shapeCounts: entry.shapeCounts,
        status: statusFor(entry.shapeCounts),
        samplePaths: [...entry.samplePaths].sort((a, b) => a.localeCompare(b, 'ja')).slice(0, SAMPLE_PATH_LIMIT)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }
}
