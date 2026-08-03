export interface GraphSearchDocument {
  path: string
  name: string
  content?: string
  tags?: string[]
  kind?: 'note' | 'unresolved' | 'tag' | 'attachment'
}

type SearchField =
  | 'all'
  | 'file'
  | 'path'
  | 'content'
  | 'tag'
  | 'line'
  | 'block'
  | 'section'
  | 'task'
  | 'task-todo'
  | 'task-done'
  | 'match-case'
  | 'ignore-case'

type Token =
  | { kind: 'term'; value: string; regularExpression?: RegExp }
  | { kind: 'field'; field: SearchField }
  | { kind: 'property'; name: string; value: string | null }
  | { kind: 'and' | 'or' | 'not' | 'left' | 'right' }

type Expression =
  | { kind: 'term'; value: string; regularExpression?: RegExp }
  | { kind: 'and' | 'or'; expressions: Expression[] }
  | { kind: 'not'; expression: Expression }
  | { kind: 'field'; field: SearchField; expression: Expression }
  | { kind: 'property'; name: string; expression: Expression | null }

const SEARCH_FIELDS = new Set<SearchField>([
  'file',
  'path',
  'content',
  'tag',
  'line',
  'block',
  'section',
  'task',
  'task-todo',
  'task-done',
  'match-case',
  'ignore-case'
])

function readProperty(query: string, start: number): [Token, number] {
  const closing = query.indexOf(']', start + 1)
  const end = closing < 0 ? query.length : closing
  const body = query.slice(start + 1, end).trim()
  if (!body) {
    throw new Error('Missing property name')
  }
  const separator = body.indexOf(':')
  const name = (separator < 0 ? body : body.slice(0, separator)).trim()
  const value = separator < 0 ? null : body.slice(separator + 1).trim()
  if (!name || (separator >= 0 && !value)) {
    throw new Error('Invalid property query')
  }
  return [{ kind: 'property', name, value }, closing < 0 ? end : end + 1]
}

function readQuoted(query: string, start: number): [Token, number] {
  let value = ''
  let index = start + 1
  while (index < query.length) {
    const character = query[index]
    if (character === '\\' && index + 1 < query.length) {
      value += query[index + 1]
      index += 2
      continue
    }
    if (character === '"') {
      return [{ kind: 'term', value }, index + 1]
    }
    value += character
    index += 1
  }
  return [{ kind: 'term', value }, index]
}

function readRegularExpression(query: string, start: number): [Token, number] {
  let source = ''
  let index = start + 1
  let escaped = false
  while (index < query.length) {
    const character = query[index]
    if (!escaped && character === '/') {
      index += 1
      let flags = ''
      while (index < query.length && /[dgimsuvy]/.test(query[index])) {
        flags += query[index]
        index += 1
      }
      return [
        {
          kind: 'term',
          value: source,
          regularExpression: new RegExp(source, flags)
        },
        index
      ]
    }
    source += character
    escaped = !escaped && character === '\\'
    if (character !== '\\') {
      escaped = false
    }
    index += 1
  }
  return [
    {
      kind: 'term',
      value: source,
      regularExpression: new RegExp(source)
    },
    index
  ]
}

function readPlain(query: string, start: number): [string, number] {
  let index = start
  while (index < query.length && !/[\s()]/.test(query[index])) {
    index += 1
  }
  return [query.slice(start, index), index]
}

function tokenize(query: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < query.length) {
    const character = query[index]
    if (/\s/.test(character)) {
      index += 1
      continue
    }
    if (character === '(' || character === ')') {
      tokens.push({ kind: character === '(' ? 'left' : 'right' })
      index += 1
      continue
    }
    if (character === '[') {
      const [token, next] = readProperty(query, index)
      tokens.push(token)
      index = next
      continue
    }
    if (character === '-') {
      tokens.push({ kind: 'not' })
      index += 1
      continue
    }
    if (character === '"') {
      const [token, next] = readQuoted(query, index)
      tokens.push(token)
      index = next
      continue
    }
    if (character === '/') {
      const [token, next] = readRegularExpression(query, index)
      tokens.push(token)
      index = next
      continue
    }

    let prefixEnd = index
    while (
      prefixEnd < query.length &&
      !/[\s():]/.test(query[prefixEnd])
    ) {
      prefixEnd += 1
    }
    const prefix = query.slice(index, prefixEnd) as SearchField
    if (query[prefixEnd] === ':' && SEARCH_FIELDS.has(prefix)) {
      tokens.push({ kind: 'field', field: prefix })
      index = prefixEnd + 1
      if (query[index] === '(') {
        continue
      }
      if (query[index] === '"') {
        const [token, next] = readQuoted(query, index)
        tokens.push(token)
        index = next
        continue
      }
      if (query[index] === '/') {
        const [token, next] = readRegularExpression(query, index)
        tokens.push(token)
        index = next
        continue
      }
      const [value, next] = readPlain(query, index)
      if (!value) {
        throw new Error('Missing field value')
      }
      tokens.push({ kind: 'term', value })
      index = next
      continue
    }

    const [value, next] = readPlain(query, index)
    tokens.push({ kind: value === 'OR' ? 'or' : 'term', ...(value === 'OR' ? {} : { value }) } as Token)
    index = next
  }

  return tokens
}

class QueryParser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): Expression {
    const expression = this.parseOr()
    if (this.index !== this.tokens.length) {
      throw new Error('Unexpected token')
    }
    return expression
  }

  private parseOr(): Expression {
    const expressions = [this.parseAnd()]
    while (this.tokens[this.index]?.kind === 'or') {
      this.index += 1
      if (
        this.index >= this.tokens.length ||
        this.tokens[this.index]?.kind === 'right'
      ) {
        break
      }
      expressions.push(this.parseAnd())
    }
    return expressions.length === 1
      ? expressions[0]
      : { kind: 'or', expressions }
  }

  private parseAnd(): Expression {
    const expressions: Expression[] = []
    while (
      this.index < this.tokens.length &&
      this.tokens[this.index].kind !== 'or' &&
      this.tokens[this.index].kind !== 'right'
    ) {
      expressions.push(this.parseUnary())
    }
    if (expressions.length === 0) {
      throw new Error('Missing expression')
    }
    return expressions.length === 1
      ? expressions[0]
      : { kind: 'and', expressions }
  }

  private parseUnary(): Expression {
    const token = this.tokens[this.index]
    if (!token) {
      throw new Error('Missing expression')
    }
    if (token.kind === 'not') {
      this.index += 1
      return { kind: 'not', expression: this.parseUnary() }
    }
    if (token.kind === 'field') {
      this.index += 1
      return {
        kind: 'field',
        field: token.field,
        expression: this.parsePrimary()
      }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    const token = this.tokens[this.index]
    if (!token) {
      throw new Error('Missing expression')
    }
    if (token.kind === 'term') {
      this.index += 1
      return token
    }
    if (token.kind === 'property') {
      this.index += 1
      return {
        kind: 'property',
        name: token.name,
        expression:
          token.value === null
            ? null
            : new QueryParser(tokenize(token.value)).parse()
      }
    }
    if (token.kind === 'left') {
      this.index += 1
      const expression = this.parseOr()
      if (this.tokens[this.index]?.kind === 'right') {
        this.index += 1
      } else if (this.index !== this.tokens.length) {
        throw new Error('Unclosed group')
      }
      return expression
    }
    throw new Error('Unexpected token')
  }
}

interface EvaluationContext {
  field: 'all' | 'file' | 'path' | 'content' | 'tag'
  caseSensitive: boolean
}

interface MarkdownListItem {
  start: number
  end: number
  indent: number
  task: boolean | null
}

const LIST_ITEM_PATTERN = /^(\s*)(?:[-*+]|\d+[.)])(?:\s+|$)/
const TASK_ITEM_PATTERN =
  /^(\s*)(?:[-*+]|\d+[.)])\s+\[([^\]])\](?:\s+|$)/

function lineIndent(line: string): number {
  return line.match(/^\s*/)?.[0].replaceAll('\t', '    ').length ?? 0
}

function listItems(lines: string[]): MarkdownListItem[] {
  const starts = lines.flatMap((line, index) => {
    const listItem = LIST_ITEM_PATTERN.exec(line)
    if (!listItem) {
      return []
    }
    const task = TASK_ITEM_PATTERN.exec(line)
    return [
      {
        start: index,
        end: index + 1,
        indent: lineIndent(listItem[1]),
        task: task ? task[2] !== ' ' : null
      }
    ]
  })

  for (const item of starts) {
    let end = item.start + 1
    while (end < lines.length) {
      const nextItem = LIST_ITEM_PATTERN.exec(lines[end])
      if (nextItem && lineIndent(nextItem[1]) <= item.indent) {
        break
      }
      if (lines[end].trim() && lineIndent(lines[end]) <= item.indent) {
        break
      }
      end += 1
    }
    item.end = end
  }
  return starts
}

function headingSections(content: string, lines: string[]): string[] {
  const headings: Array<{ line: number; level: number }> = []
  let frontmatter = lines[0]?.trim() === '---'
  let fenceMarker: '`' | '~' | null = null
  let fenceLength = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (frontmatter) {
      if (index > 0 && line.trim() === '---') {
        frontmatter = false
      }
      continue
    }
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const marker = fence[1][0] as '`' | '~'
      if (!fenceMarker) {
        fenceMarker = marker
        fenceLength = fence[1].length
      } else if (marker === fenceMarker && fence[1].length >= fenceLength) {
        fenceMarker = null
        fenceLength = 0
      }
      continue
    }
    if (fenceMarker) {
      continue
    }
    const heading = /^\s{0,3}(#{1,6})(?:\s+|$)/.exec(line)
    if (heading) {
      headings.push({ line: index, level: heading[1].length })
    }
  }

  if (headings.length === 0) {
    return [content]
  }

  const sections: string[] = []
  if (headings[0].line > 0) {
    sections.push(lines.slice(0, headings[0].line).join('\n'))
  }
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]
    const nextPeer = headings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level)
    sections.push(
      lines.slice(heading.line, nextPeer?.line ?? lines.length).join('\n')
    )
  }
  return sections
}

function markdownBlocks(lines: string[]): string[] {
  const items = listItems(lines)
  const coveredListLines = new Set<number>()
  for (const item of items) {
    for (let index = item.start; index < item.end; index += 1) {
      coveredListLines.add(index)
    }
  }

  const blocks: string[] = items.map((item) =>
    lines.slice(item.start, item.end).join('\n')
  )
  let current: string[] = []
  let fenceMarker: '`' | '~' | null = null
  let fenceLength = 0
  const flush = (): void => {
    if (current.some((line) => line.trim())) {
      blocks.push(current.join('\n'))
    }
    current = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (coveredListLines.has(index)) {
      flush()
      continue
    }
    const line = lines[index]
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const marker = fence[1][0] as '`' | '~'
      if (!fenceMarker) {
        flush()
        fenceMarker = marker
        fenceLength = fence[1].length
      } else if (marker === fenceMarker && fence[1].length >= fenceLength) {
        fenceMarker = null
        fenceLength = 0
      }
      current.push(line)
      if (!fenceMarker) {
        flush()
      }
      continue
    }
    if (fenceMarker) {
      current.push(line)
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    if (/^\s{0,3}#{1,6}(?:\s+|$)/.test(line)) {
      flush()
      blocks.push(line)
      continue
    }
    current.push(line)
  }
  flush()
  return blocks
}

function markdownUnits(content: string, field: SearchField): string[] {
  const lines = content.split(/\r?\n/)
  if (field === 'line') {
    return lines
  }
  if (field === 'block') {
    return markdownBlocks(lines)
  }
  if (field === 'section') {
    return headingSections(content, lines)
  }

  const tasks = listItems(lines).filter((item) => item.task !== null)
  return tasks
    .filter((item) => {
      if (field === 'task-todo') {
        return item.task === false
      }
      if (field === 'task-done') {
        return item.task === true
      }
      return true
    })
    .map((item) => lines.slice(item.start, item.end).join('\n'))
}

function evaluateWithinMarkdownUnit(
  expression: Expression,
  document: GraphSearchDocument,
  context: EvaluationContext,
  field: SearchField
): boolean {
  return markdownUnits(document.content ?? '', field).some((content) =>
    evaluate(
      expression,
      { ...document, content },
      { ...context, field: 'content' }
    )
  )
}

type GraphPropertyValue = string | null

function parsePropertyScalar(rawValue: string): GraphPropertyValue {
  const value = rawValue.trim()
  if (!value || value === 'null' || value === '~') {
    return null
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

function parseInlinePropertyArray(rawValue: string): GraphPropertyValue[] | null {
  const value = rawValue.trim()
  if (!value.startsWith('[') || !value.endsWith(']')) {
    return null
  }

  const items: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaped = false
  for (const character of value.slice(1, -1)) {
    if (quote) {
      current += character
      if (quote === '"' && character === '\\' && !escaped) {
        escaped = true
        continue
      }
      if (character === quote && !escaped) {
        quote = null
      }
      escaped = false
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      current += character
      continue
    }
    if (character === ',') {
      items.push(current)
      current = ''
      continue
    }
    current += character
  }
  if (current.trim() || items.length > 0) {
    items.push(current)
  }
  return items.map(parsePropertyScalar)
}

function graphPropertyValues(
  content: string,
  propertyName: string
): GraphPropertyValue[] | null {
  const frontmatter = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
    content
  )
  if (!frontmatter) {
    return null
  }

  const lines = frontmatter[1].split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const field = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(lines[index])
    if (
      !field ||
      field[1].toLocaleLowerCase() !== propertyName.toLocaleLowerCase()
    ) {
      continue
    }

    const inlineArray = parseInlinePropertyArray(field[2] ?? '')
    if (inlineArray) {
      return inlineArray
    }
    if ((field[2] ?? '').trim()) {
      return [parsePropertyScalar(field[2] ?? '')]
    }

    const values: GraphPropertyValue[] = []
    for (let itemIndex = index + 1; itemIndex < lines.length; itemIndex += 1) {
      if (/^[A-Za-z_][A-Za-z0-9_-]*:/.test(lines[itemIndex])) {
        break
      }
      const item = /^\s+-\s*(.*)$/.exec(lines[itemIndex])
      if (item) {
        values.push(parsePropertyScalar(item[1]))
      }
    }
    return values.length > 0 ? values : [null]
  }
  return null
}

function evaluateProperty(
  expression: Extract<Expression, { kind: 'property' }>,
  document: GraphSearchDocument,
  context: EvaluationContext
): boolean {
  const content = document.content ?? ''
  const values = graphPropertyValues(content, expression.name)
  if (!values) {
    return false
  }
  if (!expression.expression) {
    return true
  }
  const propertyExpression = expression.expression

  return values.some((value) => {
    if (
      value === null &&
      propertyExpression.kind === 'term' &&
      propertyExpression.value.toLocaleLowerCase() === 'null'
    ) {
      return true
    }
    if (value === null) {
      return false
    }
    if (
      propertyExpression.kind === 'term' &&
      !propertyExpression.regularExpression
    ) {
      const comparison = /^([<>])(.+)$/.exec(propertyExpression.value)
      if (comparison) {
        const actual = Number(value)
        const expected = Number(comparison[2])
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
          return false
        }
        return comparison[1] === '<' ? actual < expected : actual > expected
      }
    }
    return evaluate(
      propertyExpression,
      { ...document, content: value },
      { ...context, field: 'content' }
    )
  })
}

function textForField(
  document: GraphSearchDocument,
  field: EvaluationContext['field']
): string[] {
  switch (field) {
    case 'file':
      return [document.path.split('/').at(-1) ?? document.name]
    case 'path':
      return [document.path]
    case 'content':
      return [document.content ?? '']
    case 'tag':
      return document.tags ?? []
    default:
      if (document.kind === 'attachment') {
        return document.content ? [document.content] : []
      }
      return [
        document.name,
        document.path,
        document.content ?? '',
        ...(document.tags ?? [])
      ]
  }
}

function evaluateTerm(
  expression: Extract<Expression, { kind: 'term' }>,
  document: GraphSearchDocument,
  context: EvaluationContext
): boolean {
  const values = textForField(document, context.field)
  if (expression.regularExpression) {
    return values.some((value) => {
      expression.regularExpression!.lastIndex = 0
      return expression.regularExpression!.test(value)
    })
  }

  const needle = context.caseSensitive
    ? expression.value
    : expression.value.toLocaleLowerCase()
  return values.some((value) => {
    const candidate = context.caseSensitive ? value : value.toLocaleLowerCase()
    if (context.field === 'tag') {
      const normalizedNeedle = needle.startsWith('#') ? needle : `#${needle}`
      return (
        candidate === normalizedNeedle ||
        candidate.startsWith(`${normalizedNeedle}/`)
      )
    }
    return candidate.includes(needle)
  })
}

function evaluate(
  expression: Expression,
  document: GraphSearchDocument,
  context: EvaluationContext
): boolean {
  switch (expression.kind) {
    case 'term':
      return evaluateTerm(expression, document, context)
    case 'and':
      return expression.expressions.every((child) =>
        evaluate(child, document, context)
      )
    case 'or':
      return expression.expressions.some((child) =>
        evaluate(child, document, context)
      )
    case 'not':
      return !evaluate(expression.expression, document, context)
    case 'property':
      return evaluateProperty(expression, document, context)
    case 'field': {
      if (expression.field === 'match-case') {
        return evaluate(expression.expression, document, {
          ...context,
          caseSensitive: true
        })
      }
      if (expression.field === 'ignore-case') {
        return evaluate(expression.expression, document, {
          ...context,
          caseSensitive: false
        })
      }
      if (
        expression.field === 'line' ||
        expression.field === 'block' ||
        expression.field === 'section' ||
        expression.field === 'task' ||
        expression.field === 'task-todo' ||
        expression.field === 'task-done'
      ) {
        return evaluateWithinMarkdownUnit(
          expression.expression,
          document,
          context,
          expression.field
        )
      }
      return evaluate(expression.expression, document, {
        ...context,
        field: expression.field
      })
    }
  }
}

export function matchesGraphQuery(
  document: GraphSearchDocument,
  rawQuery: string
): boolean {
  const query = rawQuery.trim()
  if (!query) {
    return true
  }
  try {
    const expression = new QueryParser(tokenize(query)).parse()
    return evaluate(expression, document, {
      field: 'all',
      caseSensitive: false
    })
  } catch {
    return false
  }
}
