import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { parseFrontmatter } from './frontmatter'

export interface MarkdownTable {
  from: number
  to: number
  rows: string[][]
  align: ('left' | 'center' | 'right' | null)[]
  newline: string
}

const parser = unified().use(remarkParse).use(remarkGfm)

export function newMarkdownTable(text: string, position: number): MarkdownTable | null {
  const frontmatter = parseFrontmatter(text)
  if (frontmatter.found && frontmatter.raw === null) return null
  const offset = text.length - frontmatter.body.length
  const block = parser.parse(frontmatter.body).children.find(node => node.position &&
    node.position.start.offset! + offset <= position && node.position.end.offset! + offset >= position)
  // Insert outside the enclosing block so code, quotes and lists stay intact.
  const lineEnd = text.indexOf('\n', position)
  const from = Math.max(offset, block?.position ? offset + block.position.end.offset! : lineEnd < 0 ? text.length : text[lineEnd - 1] === '\r' ? lineEnd - 1 : lineEnd)
  const table: MarkdownTable = { from, to: from, rows: [['列1', '列2'], ['', '']], align: [null, null], newline: text.includes('\r\n') ? '\r\n' : '\n' }
  const insert = markdownTableChange(table, text)
  const result = text.slice(0, from) + insert + text.slice(from)
  return markdownTables(result).some(candidate => candidate.from >= from && candidate.to <= from + insert.length) ? table : null
}

export function markdownTableChange(table: MarkdownTable, source: string): string {
  const rendered = renderMarkdownTable(table)
  if (table.from !== table.to) return rendered
  const before = source.slice(0, table.from), after = source.slice(table.to), line = table.newline
  return (before ? before.endsWith(line + line) ? '' : before.endsWith(line) ? line : line + line : '') + rendered +
    (after ? after.startsWith(line + line) ? '' : after.startsWith(line) ? line : line + line : line)
}

export function markdownTables(text: string): MarkdownTable[] {
  const frontmatter = parseFrontmatter(text)
  if (frontmatter.found && frontmatter.raw === null) return []
  const body = frontmatter.body
  const offset = text.length - body.length
  return parser.parse(body).children.flatMap(node => {
    if (node.type !== 'table' || !node.position) return []
    const rows = node.children.map(row => row.children.map(cell => cell.children.length
      ? body.slice(cell.children[0].position!.start.offset!, cell.children.at(-1)!.position!.end.offset!) : ''))
    const width = Math.max(...rows.map(row => row.length))
    return [{
      from: offset + node.position.start.offset!, to: offset + node.position.end.offset!,
      rows: rows.map(row => Array.from({ length: width }, (_, column) => row[column] ?? '')),
      align: Array.from({ length: width }, (_, column) => node.align?.[column] ?? null),
      newline: text.includes('\r\n') ? '\r\n' : '\n'
    }]
  })
}

export function renderMarkdownTable(table: MarkdownTable): string {
  if (table.rows.some(row => row.some(cell => /[\r\n]/.test(cell)))) throw new Error('セル内に改行は使えません。')
  const row = (cells: string[]): string => `| ${cells.map(cell => cell.replace(/\\*\|/g, match => match.length % 2 ? `\\${match}` : match)).join(' | ')} |`
  const alignment = table.align.map(align => align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---')
  return [row(table.rows[0]), row(alignment), ...table.rows.slice(1).map(row)].join(table.newline)
}
