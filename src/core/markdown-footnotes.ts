import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Nodes } from 'mdast'
import { parseFrontmatter } from './frontmatter'

export interface MarkdownFootnote {
  identifier: string
  label: string
  from: number
  to: number
  source: string
  references: { from: number; to: number }[]
  editable: boolean
  reason?: string
}

const parser = unified().use(remarkParse).use(remarkGfm)

export function markdownFootnotes(source: string): MarkdownFootnote[] {
  if (!source.includes('[^')) return []
  const frontmatter = parseFrontmatter(source)
  if (frontmatter.warnings.length) return []
  const offset = source.length - frontmatter.body.length
  const notes: MarkdownFootnote[] = []
  const references = new Map<string, { from: number; to: number }[]>()
  function visit(node: Nodes, topLevel: boolean): void {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start !== undefined && end !== undefined) {
      const from = start + offset, to = end + offset
      if (node.type === 'footnoteDefinition') {
        notes.push({ identifier: node.identifier, label: node.label ?? node.identifier,
          from, to, source: source.slice(from, to), references: [], editable: topLevel,
          ...(!topLevel ? { reason: '入れ子の脚注定義は編集できません。' } : {}) })
      } else if (node.type === 'footnoteReference') {
        const items = references.get(node.identifier) ?? []
        items.push({ from, to })
        references.set(node.identifier, items)
      }
    }
    if ('children' in node) for (const child of node.children) visit(child, node.type === 'root')
  }
  visit(parser.parse(frontmatter.body), false)
  for (const note of notes) {
    note.references = references.get(note.identifier) ?? []
    if (notes.filter(other => other.identifier === note.identifier).length > 1) {
      note.editable = false
      note.reason = '同じ識別子の脚注定義が重複しています。'
    } else if (notes.some(other => other !== note && other.from > note.from && other.to <= note.to)) {
      note.editable = false
      note.reason = '入れ子の脚注定義を含むため編集できません。'
    }
  }
  return notes.sort((a, b) => a.from - b.from)
}

export function footnoteChange(source: string, from: number, replacement: string): { from: number; to: number; insert: string } {
  const notes = markdownFootnotes(source)
  const target = notes.find(note => note.from === from)
  if (!target?.editable) throw new Error(target?.reason ?? '編集できる脚注定義が見つかりません。')
  if (replacement === target.source) return { from, to: target.to, insert: replacement }

  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const text = replacement.replace(/\r\n|\r|\n/g, newline)
  const candidates = markdownFootnotes(text)
  const candidate = candidates[0]
  if (candidates.length !== 1 || !candidate.editable || candidate.identifier !== target.identifier ||
    text.slice(0, candidate.from).trim() || text.slice(candidate.to).trim()) {
    throw new Error('同じ識別子の脚注定義一件だけを入力してください。')
  }
  const insert = candidate.source
  // Lazy continuation can silently absorb unrelated prose; require explicit indentation.
  if (insert.split(newline).slice(1).some(line => line.trim() && !/^(?: {4}|\t)/.test(line))) {
    throw new Error('脚注の継続行には4つの空白またはタブで字下げしてください。')
  }
  const result = source.slice(0, target.from) + insert + source.slice(target.to)
  const updated = markdownFootnotes(result)
  const delta = insert.length - (target.to - target.from)
  // Parse in context too: an unterminated block must never swallow surrounding source.
  if (updated.length !== notes.length || updated.some((note, index) => {
    const previous = notes[index]
    return previous === target
      ? note.from !== from || note.to !== from + insert.length || !note.editable || note.identifier !== target.identifier
      : note.from !== previous.from + (previous.from > from ? delta : 0) || note.source !== previous.source
  })) {
    throw new Error('脚注の外側へ影響する変更は適用できません。')
  }
  return { from: target.from, to: target.to, insert }
}
