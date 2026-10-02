import { commonmarkLanguage } from '@codemirror/lang-markdown'
import type { NoteDocument } from '../shared/types'
import { inspectFrontmatterProperty } from './frontmatter'
import { extractNoteLinks, markdownExcludedRanges, type SourceRange } from './links'

export interface UnlinkedMention {
  sourcePath: string
  targetPath: string
  text: string
  range: SourceRange
  snippet: string
  ambiguous: boolean
  candidates: string[]
}

/** Literal candidates only; callers must obtain confirmation and revision-check before replacement. */
export function findUnlinkedMentions(targetPath: string, notes: readonly NoteDocument[]): UnlinkedMention[] {
  const names = new Map<string, Set<string>>()
  for (const note of notes) {
    const inspected = inspectFrontmatterProperty(note.content, 'aliases')
    const aliases = inspected.ok && inspected.property?.type === 'list'
      ? inspected.property.value.map(atom => atom.value)
      : inspected.ok && inspected.property?.type === 'text' ? [inspected.property.value] : []
    for (const name of [note.name, ...aliases]) {
      if (!name.trim()) continue
      const candidates = names.get(name) ?? new Set<string>()
      candidates.add(note.path)
      names.set(name, candidates)
    }
  }
  const targetNames = [...names].filter(([, candidates]) => candidates.has(targetPath)).sort((a, b) => b[0].length - a[0].length)
  const result: UnlinkedMention[] = []
  for (const note of notes) {
    if (note.path === targetPath) continue
    if (!targetNames.some(([name]) => note.content.includes(name))) continue
    const ignored = [...markdownExcludedRanges(note.content), ...extractNoteLinks(note.content, note.path).map(link => link.range)]
    // Also exclude image labels, external links and unused reference definitions.
    commonmarkLanguage.parser.parse(note.content).iterate({ enter(node) {
      if (['Link', 'Image', 'LinkReference'].includes(node.name)) { ignored.push({ from: node.from, to: node.to }); return false }
    } })
    const accepted: SourceRange[] = []
    for (const [name, candidates] of targetNames) {
      let from = note.content.indexOf(name)
      while (from >= 0) {
        const to = from + name.length
        const word = (char: string | undefined) => !!char && /[A-Za-z0-9_]/.test(char)
        const boundary = !(word(name[0]) && word(note.content[from - 1])) && !(word(name.at(-1)) && word(note.content[to]))
        if (boundary && ![...ignored, ...accepted].some(range => from < range.to && to > range.from)) {
          accepted.push({ from, to })
          result.push({ sourcePath: note.path, targetPath, text: name, range: { from, to }, snippet: note.content.slice(Math.max(0, from - 60), Math.min(note.content.length, to + 60)).replace(/\s+/g, ' '), ambiguous: candidates.size > 1, candidates: [...candidates].sort() })
        }
        from = note.content.indexOf(name, to)
      }
    }
  }
  return result.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'ja') || a.range.from - b.range.from)
}
