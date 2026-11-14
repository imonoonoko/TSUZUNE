import { parseDocument } from 'yaml'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, RootContent } from 'mdast'
import type { NoteDocument, SearchResult } from '../shared/types'
import { searchRendererRanked, searchSourceExcerpt, segmentJapaneseQuery } from './search'
import { extractMarkdownTags } from './tags'

type Expression =
  | { kind: 'and'; children: Expression[] }
  | { kind: 'or'; children: Expression[] }
  | { kind: 'not'; child: Expression }
  | { kind: 'scope'; name: string; child: Expression }
  | { kind: 'literal'; value: string; quoted: boolean }
  | { kind: 'regex'; value: RegExp }
  | { kind: 'property'; name: Expression; value?: Expression }

const fields = 'tag|path|file|category|topic|type|role|lifecycle|content|line|block|section|task-todo|task-done|task|match-case|ignore-case'
const fieldPrefix = new RegExp('^(' + fields + '):', 'i')
/** Detection only: never compile or run a user's regular expression on the UI thread. */
export function isAdvancedSearchQuery(query: string): boolean {
  const unquoted = query.replace(/"(?:\\.|[^"\\])*"/g, '""')
  return query.length > 4096 || /[()[\]]/.test(unquoted) || /(^|\s)OR(?=\s|$|\))/.test(unquoted)
    || /(?:^|[\s(:])-?\//.test(unquoted)
    || /(?:^|[\s(-])(?:content|line|block|section|task(?:-todo|-done)?|match-case|ignore-case):/i.test(unquoted)
}

class QueryParser {
  private index = 0
  private count = 0
  constructor(private readonly query: string) {}
  private fail(message: string): never { throw new Error('検索式 ' + (this.index + 1) + '文字目: ' + message) }
  private spaces(): void { while (/\s/.test(this.query[this.index] ?? '') && this.index < this.query.length) this.index++ }
  private isOr(): boolean { return /^OR(?=\s|$|[)\]])/.test(this.query.slice(this.index)) }
  parse(): Expression {
    if (this.query.length > 4096) this.fail('4096文字以内にしてください。')
    const result = this.expression(0)
    this.spaces()
    if (this.index < this.query.length) this.fail('余分な記号があります。')
    return result
  }
  private expression(depth: number, property = false): Expression {
    const branches = [this.conjunction(depth, property)]
    this.spaces()
    while (this.isOr()) { this.index += 2; branches.push(this.conjunction(depth, property)); this.spaces() }
    return branches.length === 1 ? branches[0] : { kind: 'or', children: branches }
  }
  private conjunction(depth: number, property: boolean): Expression {
    const children: Expression[] = []
    this.spaces()
    while (this.index < this.query.length && this.query[this.index] !== ')' && !(property && this.query[this.index] === ']') && !this.isOr()) {
      children.push(this.atom(depth, property)); this.spaces()
    }
    if (!children.length) this.fail('検索条件が必要です。')
    return children.length === 1 ? children[0] : { kind: 'and', children }
  }
  private quoted(): string {
    this.index++
    let value = ''
    while (this.index < this.query.length) {
      const char = this.query[this.index++]
      if (char === '"') return value
      if (char === '\\' && /["\\]/.test(this.query[this.index] ?? '')) value += this.query[this.index++]
      else value += char
    }
    return this.fail('引用符を閉じてください。')
  }
  private atom(depth: number, property = false): Expression {
    if (++this.count > 256 || depth > 16) this.fail('条件数または入れ子が上限を超えています。')
    this.spaces()
    const char = this.query[this.index]
    if (!char || char === ')' || this.isOr()) this.fail('検索条件が必要です。')
    if (char === '-' && this.query[this.index + 1] && !/\s/.test(this.query[this.index + 1])
      && !(property && /^-(?:\d+(?:\.\d*)?|\.\d+)(?=[\s)\]]|$)/.test(this.query.slice(this.index)))) {
      this.index++; return { kind: 'not', child: this.atom(depth + 1, property) }
    }
    if (char === '(') {
      this.index++; const child = this.expression(depth + 1, property); this.spaces()
      if (this.query[this.index++] !== ')') this.fail('括弧を閉じてください。')
      return child
    }
    const field = !property && fieldPrefix.exec(this.query.slice(this.index))
    if (field) {
      this.index += field[0].length
      return { kind: 'scope', name: field[1].toLowerCase(), child: this.atom(depth + 1) }
    }
    if (char === '"') return { kind: 'literal', value: this.quoted(), quoted: true }
    if (char === '/') {
      this.index++
      let pattern = '', inClass = false, closed = false
      while (this.index < this.query.length) {
        const current = this.query[this.index++]
        if (current === '\\') {
          if (this.index >= this.query.length) this.fail('正規表現を閉じてください。')
          pattern += current + this.query[this.index++]; continue
        }
        if (current === '[') inClass = true
        if (current === ']') inClass = false
        if (current === '/' && !inClass) { closed = true; break }
        pattern += current
      }
      if (!closed || pattern.length > 1024) this.fail('正規表現は / で閉じ、1024文字以内にしてください。')
      const flags = /^[a-z]*/i.exec(this.query.slice(this.index))![0]
      this.index += flags.length
      if (/[^imsu]/.test(flags) || new Set(flags).size !== flags.length) this.fail('正規表現のflagsは i/m/s/u です。')
      try { return { kind: 'regex', value: new RegExp(pattern, flags) } }
      catch { return this.fail('正規表現が正しくありません。') }
    }
    if (!property && char === '[') {
      this.index++; this.spaces()
      const start = this.index
      let quoted = false, regex = false, inClass = false
      while (this.index < this.query.length) {
        const current = this.query[this.index]
        if (current === '\\' && (quoted || regex)) { this.index += 2; continue }
        if (!regex && current === '"') quoted = !quoted
        if (!quoted && current === '/' && !inClass) regex = !regex
        if (regex && current === '[') inClass = true
        if (regex && current === ']') inClass = false
        if (!quoted && !regex && (current === ':' || current === ']')) break
        this.index++
      }
      const rawName = this.query.slice(start, this.index).trim()
      if (!rawName) this.fail('プロパティ名が必要です。')
      const name: Expression = /[()"/]|(?:^|\s)OR(?:\s|$)/.test(rawName)
        ? new QueryParser(rawName).parse() : { kind: 'literal', value: rawName, quoted: false }
      if (!validPropertyName(name)) this.fail('プロパティ名の条件が正しくありません。')
      this.spaces()
      let value: Expression | undefined
      if (this.query[this.index] === ':') {
        this.index++; this.spaces()
        // Preserve legacy whitespace phrases unless the value explicitly uses expression syntax.
        const plain = /^[^()[\]"\[]+/.exec(this.query.slice(this.index))?.[0]
        if (plain?.trim() && this.query[this.index + plain.length] === ']' && !plain.startsWith('/')
          && !/(?:^|\s)OR(?=\s|$)|(?:^|\s)-(?!\d|\.\d)\S/.test(plain)) {
          this.index += plain.length
          value = { kind: 'literal', value: plain.trim(), quoted: false }
        } else value = this.expression(depth + 1, true)
      }
      this.spaces()
      if (this.query[this.index++] !== ']') this.fail('プロパティ条件を ] で閉じてください。')
      return { kind: 'property', name, value }
    }
    const value = this.readUntil(/[\s()[\]]/)
    if (!value) this.fail('使用できない記号です。')
    return { kind: 'literal', value, quoted: false }
  }
  private readUntil(stop: RegExp): string {
    const start = this.index
    while (this.index < this.query.length && !stop.test(this.query[this.index])) this.index++
    return this.query.slice(start, this.index)
  }
}

function validPropertyName(expression: Expression): boolean {
  if (expression.kind === 'and' || expression.kind === 'or') return expression.children.every(validPropertyName)
  if (expression.kind === 'not') return validPropertyName(expression.child)
  return expression.kind === 'literal' || expression.kind === 'regex'
}
function propertyNameMatches(name: string, expression: Expression): boolean {
  if (expression.kind === 'and') return expression.children.every(child => propertyNameMatches(name, child))
  if (expression.kind === 'or') return expression.children.some(child => propertyNameMatches(name, child))
  if (expression.kind === 'not') return !propertyNameMatches(name, expression.child)
  if (expression.kind === 'regex') return expression.value.test(name)
  return expression.kind === 'literal' && name === expression.value
}
interface Range { text: string; offset?: number; weight: number }
interface Context { ranges: Range[]; sensitive: boolean; ordinary: boolean }
interface Match { score: number; start?: number; length?: number; matches?: { start: number; length: number }[] }
function within(ranges: Range[], context: Context): Range[] {
  return ranges.flatMap(range => context.ranges.flatMap(parent => {
    if (range.offset === undefined || parent.offset === undefined) return []
    const start = Math.max(range.offset, parent.offset), end = Math.min(range.offset + range.text.length, parent.offset + parent.text.length)
    const overlaps = end > start || end === start && (range.text.length === 0 || parent.text.length === 0)
    return overlaps ? [{ text: range.text.slice(start - range.offset, end - range.offset), offset: start, weight: range.weight }] : []
  }))
}
type SourceMatch = ReturnType<typeof searchSourceExcerpt> & { match_end?: number }
export type AdvancedSearchResult = SearchResult & { sourceMatch?: SourceMatch; sourceMatches?: SourceMatch[] }
const markdown = unified().use(remarkParse).use(remarkGfm)
const frontmatterPattern = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

function propertyMatches(value: unknown, expression: Expression): boolean {
  if (expression.kind === 'not') return !propertyMatches(value, expression.child)
  if (expression.kind === 'and') return expression.children.every(child => propertyMatches(value, child))
  if (expression.kind === 'or') return expression.children.some(child => propertyMatches(value, child))
  if (Array.isArray(value)) return value.some(item => propertyMatches(item, expression))
  if (expression.kind === 'regex') return typeof value === 'string' && expression.value.test(value)
  if (expression.kind !== 'literal') return false
  if (expression.quoted) return typeof value === 'string' && (expression.value === '' ? value === '' : value.toLowerCase().includes(expression.value.toLowerCase()))
  const expected = expression.value
  if (expected === 'null') return value === null
  if (expected === 'true' || expected === 'false') return value === (expected === 'true')
  const numeric = /^(<=|>=|<|>|=)?(-?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(expected)
  if (numeric) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false
    const number = Number(numeric[2])
    switch (numeric[1]) {
      case '<': return value < number
      case '>': return value > number
      case '<=': return value <= number
      case '>=': return value >= number
      default: return value === number
    }
  }
  return typeof value === 'string' && value.toLowerCase().includes(expected.toLowerCase())
}

function sourceExcerpt(content: string, match: Match): SourceMatch {
  if (match.start === undefined) return searchSourceExcerpt(content, '')
  let start = Math.max(0, match.start - 45), end = Math.min(content.length, match.start + (match.length ?? 0) + 75)
  if (start > 0 && /[\uDC00-\uDFFF]/.test(content[start])) start--
  if (end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1])) end--
  return { text: content.slice(start, end), start, end, match_start: match.start, match_end: match.start + (match.length ?? 0), kind: 'body_match' }
}
function literalMatches(text: string, value: string, sensitive: boolean): { start: number; length: number }[] {
  const haystack = sensitive ? text : text.toLowerCase()
  const needle = sensitive ? value : value.toLowerCase()
  let index = haystack.indexOf(needle)
  if (index < 0) return []
  const starts: number[] = [], ends: number[] = []
  if (haystack.length !== text.length) {
    let offset = 0
    for (const point of text) {
      const end = offset + point.length
      for (let unit = 0; unit < point.toLowerCase().length; unit++) {
        starts.push(offset)
        ends.push(end)
      }
      offset = end
    }
  }
  const matches: { start: number; length: number }[] = []
  while (index >= 0) {
    const start = starts[index] ?? index
    const end = needle.length ? ends[index + needle.length - 1] ?? index + needle.length : start
    matches.push({ start, length: end - start })
    const next = index + Math.max(1, needle.length)
    if (next > haystack.length) break
    index = haystack.indexOf(needle, next)
  }
  return matches
}

/** Run only in a disposable Worker for untrusted advanced queries (regex can backtrack). */
export function searchAdvancedNotes(notes: NoteDocument[], query: string): AdvancedSearchResult[] {
  if (!isAdvancedSearchQuery(query)) return searchRendererRanked(notes, query)
  const expression = new QueryParser(query).parse()
  const results: AdvancedSearchResult[] = []
  for (const note of notes) {
    const frontmatter = frontmatterPattern.exec(note.content)
    const bodyOffset = frontmatter?.[0].length ?? 0
    let tree: Root | undefined, properties: Record<string, unknown> | undefined
    const body = note.content.slice(bodyOffset)
    const original: Context = { ranges: [{ text: note.name, weight: 40 }, { text: note.path, weight: 20 }, { text: note.content, offset: 0, weight: 10 }], sensitive: false, ordinary: true }
    function structure(name: string): Range[] {
      if (name === 'line') {
        const ranges: Range[] = []
        let offset = 0
        for (const text of note.content.split(/\r?\n/)) {
          ranges.push({ text, offset, weight: 10 })
          offset += text.length + (note.content[offset + text.length] === '\r' ? 2 : 1)
        }
        return ranges
      }
      tree ??= markdown.parse(body)
      const ranges: Range[] = [], headings: number[] = [0]
      function visit(node: Root | RootContent): void {
        const start = node.position?.start.offset, end = node.position?.end.offset
        if (node.type === 'heading' && start !== undefined && !headings.includes(start)) headings.push(start)
        const isTask = node.type === 'listItem' && typeof node.checked === 'boolean'
        const wanted = name === 'block' ? ['paragraph', 'listItem', 'blockquote', 'code'].includes(node.type)
          : isTask && (name === 'task' || name === 'task-todo' && !node.checked || name === 'task-done' && node.checked)
        if (wanted && start !== undefined && end !== undefined) {
          const ownEnd = isTask && name !== 'block' ? (node.children.find(child => child.type === 'list')?.position?.start.offset ?? end) : end
          ranges.push({ text: body.slice(start, ownEnd), offset: bodyOffset + start, weight: 10 })
        }
        if ('children' in node) for (const child of node.children) visit(child as RootContent)
      }
      visit(tree)
      if (name === 'section') return headings.map((start, i) => ({ text: body.slice(start, headings[i + 1] ?? body.length), offset: bodyOffset + start, weight: 10 }))
      return ranges
    }
    function evaluate(expr: Expression, context: Context): Match | undefined {
      if (expr.kind === 'not') return evaluate(expr.child, context) ? undefined : { score: 0 }
      if (expr.kind === 'and' || expr.kind === 'or') {
        const matches = expr.children.map(child => evaluate(child, context))
        if (expr.kind === 'and' && matches.some(match => !match)) return undefined
        const successful = matches.filter((match): match is Match => !!match)
        if (!successful.length) return undefined
        const anchor = successful.find(match => match.start !== undefined)
        const all = successful.flatMap(match => match.matches ?? (match.start !== undefined ? [{ start: match.start, length: match.length ?? 0 }] : []))
        return { matches: all, score: successful.reduce((sum, match) => sum + match.score, 0), ...(anchor ? { start: anchor.start, length: anchor.length } : {}) }
      }
      if (expr.kind === 'property') {
        if (!properties) {
          try {
            const document = parseDocument(frontmatter?.[1] ?? '', { uniqueKeys: true, strict: true })
            const value: unknown = document.errors.length ? undefined : document.toJS({ maxAliasCount: 50 })
            properties = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
          } catch { properties = {} }
        }
        return Object.entries(properties).some(([name, value]) => propertyNameMatches(name, expr.name)
          && (expr.value === undefined || propertyMatches(value, expr.value))) ? { score: 1 } : undefined
      }
      if (expr.kind === 'scope') {
        if (expr.name === 'match-case' || expr.name === 'ignore-case') return evaluate(expr.child, { ...context, sensitive: expr.name === 'match-case', ordinary: false })
        if (['line', 'block', 'section', 'task', 'task-todo', 'task-done'].includes(expr.name)) {
          const successful: Match[] = []
          for (const range of within(structure(expr.name), context)) {
            const result = evaluate(expr.child, { ranges: [range], sensitive: context.sensitive, ordinary: false })
            if (result) successful.push(result)
          }
          return successful.length ? { ...successful[0], matches: successful.flatMap(match => match.matches ?? (match.start !== undefined ? [{ start: match.start, length: match.length ?? 0 }] : [])) } : undefined
        }
        if (expr.name === 'content') return evaluate(expr.child, { ranges: within([{ text: note.content, offset: 0, weight: 10 }], context), sensitive: context.sensitive, ordinary: false })
        if (expr.child.kind === 'literal' && !context.sensitive) {
          const result = searchRendererRanked([note], expr.name + ':' + JSON.stringify(expr.child.value))[0]
          return result ? { score: result.score } : undefined
        }
        let values: string[] = []
        if (expr.name === 'path') values = [note.path]
        else if (expr.name === 'file') values = [note.path.split('/').at(-1) ?? note.name]
        else if (expr.name === 'tag') values = extractMarkdownTags(note.content)
        else {
          const doc = parseDocument(frontmatter?.[1] ?? '')
          try {
            const raw = doc.errors.length ? undefined : doc.toJS({ maxAliasCount: 50 })?.[expr.name === 'topic' ? 'topics' : expr.name]
            values = (Array.isArray(raw) ? raw : [raw]).filter(item => typeof item === 'string')
          } catch { values = [] }
        }
        return evaluate(expr.child, { ranges: values.map(text => ({ text, weight: 1 })), sensitive: context.sensitive, ordinary: false })
      }
      if (expr.kind === 'literal' && context.ordinary) {
        const result = searchRendererRanked([note], expr.quoted ? JSON.stringify(expr.value) : expr.value)[0]
        if (!result) return undefined
        const raw = searchSourceExcerpt(note.content, expr.quoted ? JSON.stringify(expr.value) : expr.value)
        const terms = expr.quoted ? [expr.value] : segmentJapaneseQuery(expr.value)
        const matches = terms.flatMap(term => literalMatches(note.content, term, false))
        const anchor = raw.kind === 'body_match' && matches.find(match => match.start === raw.match_start)
        return { score: result.score, matches, ...(anchor || {}) }
      }
      let best: Match | undefined
      const occurrences: { start: number; length: number }[] = []
      for (const range of context.ranges) {
        const matches = expr.kind === 'literal' ? literalMatches(range.text, expr.value, context.sensitive) :
          [...range.text.matchAll(new RegExp(expr.value.source, expr.value.flags + 'g'))]
            .map(match => ({ start: match.index, length: match[0].length }))
        const found = matches[0]
        if (!found) continue
        if (range.offset !== undefined) {
          const offset = range.offset
          for (const match of matches) occurrences.push({ start: offset + match.start, length: match.length })
        }
        const current = { score: range.weight, ...(range.offset === undefined ? {} : { start: range.offset + found.start, length: found.length }) }
        best = { score: (best?.score ?? 0) + current.score, ...(best?.start !== undefined ? { start: best.start, length: best.length } : current.start !== undefined ? { start: current.start, length: current.length } : {}) }
      }
      return best ? { ...best, matches: occurrences } : undefined
    }
    const match = evaluate(expression, original)
    if (!match) continue
    const raw = sourceExcerpt(note.content, match)
    results.push({ path: note.path, name: note.name, modifiedAt: note.modifiedAt, score: Math.max(1, match.score), excerpt: (raw.start ? '…' : '') + raw.text.replace(/\s+/g, ' ').trim() + (raw.end < note.content.length ? '…' : ''), sourceMatch: raw, sourceMatches: (match.matches ?? (match.start !== undefined ? [match] : [])).map(item => sourceExcerpt(note.content, { score: 0, ...item })) })
  }
  return results.sort((a, b) => b.score - a.score || b.modifiedAt - a.modifiedAt || a.path.localeCompare(b.path, 'ja'))
}
