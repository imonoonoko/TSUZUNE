export type BaseDiagnosticCode = 'MALFORMED_BASE' | 'UNSUPPORTED_BASE'

export interface BaseDiagnostic {
  code: BaseDiagnosticCode
  message: string
  line?: number
  key?: string
}

export type BaseComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<='
export type BaseScalar = string | number | boolean

export type BaseFilter =
  | { kind: 'inFolder'; folder: string }
  | {
      kind: 'comparison'
      property: string
      operator: BaseComparisonOperator
      value: BaseScalar
    }
  | {
      kind: 'contains'
      property: string
      value: BaseScalar
    }

export interface BaseSort {
  property: string
  direction: 'ASC' | 'DESC'
}

export interface BaseTableView {
  type: 'table'
  name: string
  filters: BaseFilter[]
  order: string[]
  sort?: BaseSort
}

export interface BaseProfile {
  filters: BaseFilter[]
  view: BaseTableView
}

export type BaseParseResult =
  | { ok: true; profile: BaseProfile }
  | { ok: false; diagnostics: BaseDiagnostic[] }

interface SourceLine {
  line: number
  indent: number
  text: string
}

interface KeyValue {
  key: string
  value: string
}

class BaseParseFailure extends Error {
  constructor(readonly diagnostic: BaseDiagnostic) {
    super(diagnostic.message)
  }
}

function fail(
  code: BaseDiagnosticCode,
  message: string,
  line: number,
  key?: string
): never {
  throw new BaseParseFailure({ code, message, line, ...(key ? { key } : {}) })
}

function sourceLines(content: string): SourceLine[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/)
  const result: SourceLine[] = []

  for (const [index, raw] of lines.entries()) {
    if (/\t/.test(raw)) {
      fail('MALFORMED_BASE', 'Tabs are not supported in a .base profile.', index + 1)
    }
    const text = raw.trimEnd()
    if (!text.trim() || text.trimStart().startsWith('#')) continue
    const indent = text.length - text.trimStart().length
    result.push({ line: index + 1, indent, text: text.trimStart() })
  }

  return result
}

function keyValue(line: SourceLine): KeyValue {
  const match = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s*(.*))?$/.exec(line.text)
  if (!match) {
    fail('MALFORMED_BASE', 'A mapping key and colon are required.', line.line)
  }
  return { key: match[1], value: match[2] ?? '' }
}

function listValue(line: SourceLine): string {
  const match = /^-\s*(.*)$/.exec(line.text)
  if (!match || !match[1]) {
    fail('MALFORMED_BASE', 'A non-empty list item is required.', line.line)
  }
  return match[1]
}

function scalar(value: string, line: number, key: string): string {
  const source = value.trim()
  if (!source) fail('MALFORMED_BASE', `A value is required for ${key}.`, line, key)

  if (source.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(source)
      if (typeof parsed !== 'string') {
        fail('MALFORMED_BASE', `${key} must be a string.`, line, key)
      }
      return parsed
    } catch {
      fail('MALFORMED_BASE', `The quoted value for ${key} is invalid.`, line, key)
    }
  }

  if (source.startsWith("'")) {
    if (!source.endsWith("'") || source.length < 2) {
      fail('MALFORMED_BASE', `The quoted value for ${key} is invalid.`, line, key)
    }
    return source.slice(1, -1).replace(/''/g, "'")
  }

  if (/^[\[\]{},&*!|>]/.test(source)) {
    fail('UNSUPPORTED_BASE', `${key} uses unsupported YAML syntax.`, line, key)
  }
  return source
}

function expressionScalar(value: string, line: number): BaseScalar {
  const source = value.trim()
  if (!source) fail('MALFORMED_BASE', 'A filter comparison value is required.', line)

  if (source.startsWith('"') || source.startsWith("'")) {
    return scalar(source, line, 'filter')
  }
  if (source === 'true' || source === 'false') return source === 'true'
  if (/^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(source)) {
    return Number(source)
  }
  if (/^(?:null|~)$/i.test(source)) {
    fail('UNSUPPORTED_BASE', 'Null filter values are outside the fixed profile.', line)
  }
  const date = /^date\((.*)\)$/.exec(source)
  if (date) {
    const dateText = scalar(date[1], line, 'date')
    const parts = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(dateText)
    // The fixed profile uses this PC's local time, matching the isolated reference.
    const timestamp = Date.parse(dateText.replace(' ', 'T'))
    const parsed = new Date(timestamp)
    const local = [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate(),
      parsed.getHours(), parsed.getMinutes(), parsed.getSeconds()]
    if (!parts || !Number.isFinite(timestamp) || local.some((value, index) => value !== Number(parts[index + 1]))) {
      fail('MALFORMED_BASE', `The date value "${dateText}" is invalid.`, line)
    }
    return timestamp
  }
  fail('UNSUPPORTED_BASE', 'Only quoted text, numbers, and booleans are supported in filters.', line)
}

function propertyReference(value: string, line: number): string {
  const property = value.trim()
  if (
    !/^(?:file\.(?:name|basename|path|folder|ext|size|mtime|ctime)|note\.[A-Za-z_][A-Za-z0-9_-]*|[A-Za-z_][A-Za-z0-9_-]*)$/.test(
      property
    )
  ) {
    fail('UNSUPPORTED_BASE', `Property reference "${property}" is unsupported.`, line)
  }
  return property
}

function filterExpression(value: string, line: number): BaseFilter {
  const expression = scalar(value, line, 'filter')
  const folder = /^file\.inFolder\((['"])(.*)\1\)$/.exec(expression)
  if (folder) {
    if (!folder[2]) fail('MALFORMED_BASE', 'file.inFolder requires a folder.', line)
    return { kind: 'inFolder', folder: folder[2] }
  }

  const comparison =
    /^(file\.(?:name|basename|path|folder|ext|size|mtime|ctime)|note\.[A-Za-z_][A-Za-z0-9_-]*|[A-Za-z_][A-Za-z0-9_-]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(
      expression
    )
  if (comparison) {
    return {
      kind: 'comparison',
      property: propertyReference(comparison[1], line),
      operator: comparison[2] as BaseComparisonOperator,
      value: expressionScalar(comparison[3], line)
    }
  }

  const contains = /^(file\.(?:name|basename|path|folder|ext)|note\.[A-Za-z_][A-Za-z0-9_-]*|[A-Za-z_][A-Za-z0-9_-]*)\.contains\((.+)\)$/.exec(
    expression
  )
  if (contains) {
    return {
      kind: 'contains',
      property: propertyReference(contains[1], line),
      value: expressionScalar(contains[2], line)
    }
  }

  if (/\w+\s*\(/.test(expression)) {
    fail('UNSUPPORTED_BASE', `Filter function "${expression}" is unsupported.`, line)
  }
  if (/^\S+\s+[A-Za-z][A-Za-z0-9_-]*\s+\S/.test(expression)) {
    fail('UNSUPPORTED_BASE', `The filter operator in "${expression}" is unsupported.`, line)
  }
  fail('MALFORMED_BASE', `Filter expression "${expression}" is invalid.`, line)
}

function filterSection(
  lines: SourceLine[],
  start: number,
  parentIndent: number
): { filters: BaseFilter[]; next: number } {
  const header = lines[start]
  const headerValue = keyValue(header)
  if (headerValue.value) {
    fail('UNSUPPORTED_BASE', 'Only an and filter list is supported.', header.line, 'filters')
  }

  const conjunction = lines[start + 1]
  if (!conjunction || conjunction.indent !== parentIndent + 2) {
    fail('MALFORMED_BASE', 'A filter conjunction is required.', header.line, 'filters')
  }
  const conjunctionValue = keyValue(conjunction)
  if (conjunctionValue.key !== 'and') {
    fail('UNSUPPORTED_BASE', `Filter conjunction "${conjunctionValue.key}" is unsupported.`, conjunction.line, conjunctionValue.key)
  }
  if (conjunctionValue.value) {
    fail('MALFORMED_BASE', 'The and filter must contain a list.', conjunction.line, 'and')
  }

  const filters: BaseFilter[] = []
  let index = start + 2
  while (index < lines.length && lines[index].indent === parentIndent + 4) {
    const item = lines[index]
    filters.push(filterExpression(listValue(item), item.line))
    index += 1
  }
  if (filters.length === 0) {
    fail('MALFORMED_BASE', 'The and filter list cannot be empty.', conjunction.line, 'and')
  }
  if (lines[index] && lines[index].indent === parentIndent + 2) {
    fail('UNSUPPORTED_BASE', 'Only an and filter group is supported.', lines[index].line)
  }
  if (lines[index] && lines[index].indent > parentIndent) {
    fail('MALFORMED_BASE', 'Unexpected indentation after the filter list.', lines[index].line)
  }
  return { filters, next: index }
}

function listSection(
  lines: SourceLine[],
  start: number,
  parentIndent: number,
  key: string
): { values: string[]; next: number } {
  const header = lines[start]
  if (keyValue(header).value) {
    fail('MALFORMED_BASE', `${key} must contain a list.`, header.line, key)
  }

  const values: string[] = []
  let index = start + 1
  while (index < lines.length && lines[index].indent === parentIndent + 2) {
    const item = lines[index]
    values.push(scalar(listValue(item), item.line, key))
    index += 1
  }
  if (values.length === 0) fail('MALFORMED_BASE', `${key} cannot be empty.`, header.line, key)
  if (lines[index] && lines[index].indent > parentIndent && lines[index].indent < parentIndent + 2) {
    fail('MALFORMED_BASE', `Unexpected indentation in ${key}.`, lines[index].line, key)
  }
  return { values, next: index }
}

function sortSection(
  lines: SourceLine[],
  start: number,
  parentIndent: number
): { sort: BaseSort; next: number } {
  const header = lines[start]
  if (keyValue(header).value) {
    fail('MALFORMED_BASE', 'sort must contain a list.', header.line, 'sort')
  }
  const item = lines[start + 1]
  if (!item || item.indent !== parentIndent + 2) {
    fail('MALFORMED_BASE', 'sort requires one property item.', header.line, 'sort')
  }
  const itemValue = listValue(item)
  const propertyLine = {
    ...item,
    text: itemValue
  }
  const property = keyValue(propertyLine)
  if (property.key !== 'property') {
    fail('MALFORMED_BASE', 'sort requires a property key.', item.line, 'sort')
  }
  const sortProperty = propertyReference(scalar(property.value, item.line, 'property'), item.line)
  let direction: BaseSort['direction'] = 'ASC'
  let directionSeen = false
  let index = start + 2
  while (index < lines.length && lines[index].indent === parentIndent + 4) {
    const field = keyValue(lines[index])
    if (field.key !== 'direction') {
      fail('UNSUPPORTED_BASE', `sort field "${field.key}" is unsupported.`, lines[index].line, field.key)
    }
    if (directionSeen) {
      fail('MALFORMED_BASE', 'sort direction is duplicated.', lines[index].line, 'direction')
    }
    directionSeen = true
    const value = scalar(field.value, lines[index].line, 'direction').toUpperCase()
    if (value !== 'ASC' && value !== 'DESC') {
      fail('MALFORMED_BASE', 'sort direction must be ASC or DESC.', lines[index].line, 'direction')
    }
    direction = value
    index += 1
  }
  if (lines[index] && lines[index].indent === parentIndent + 2) {
    fail('UNSUPPORTED_BASE', 'Only one sort is supported.', lines[index].line, 'sort')
  }
  if (lines[index] && lines[index].indent > parentIndent) {
    fail('MALFORMED_BASE', 'Unexpected indentation in sort.', lines[index].line, 'sort')
  }
  return { sort: { property: sortProperty, direction }, next: index }
}

function viewSection(
  lines: SourceLine[],
  start: number
): { view: BaseTableView; next: number } {
  const item = lines[start]
  const itemValue = listValue(item)
  const first = keyValue({ ...item, text: itemValue })
  if (first.key !== 'type' || !first.value) {
    fail('MALFORMED_BASE', 'Each view must start with type.', item.line, 'views')
  }

  const type = scalar(first.value, item.line, 'type')
  if (type !== 'table') {
    fail('UNSUPPORTED_BASE', `View type "${type}" is unsupported.`, item.line, 'type')
  }

  let name: string | undefined
  let filters: BaseFilter[] = []
  let order: string[] | undefined
  let sort: BaseSort | undefined
  const seen = new Set<string>(['type'])
  let index = start + 1

  while (index < lines.length && lines[index].indent >= 4) {
    if (lines[index].indent !== 4) {
      fail('MALFORMED_BASE', 'View fields must use two-space nesting.', lines[index].line, 'views')
    }
    const field = keyValue(lines[index])
    if (seen.has(field.key)) fail('MALFORMED_BASE', `View key "${field.key}" is duplicated.`, lines[index].line, field.key)
    seen.add(field.key)
    if (field.key === 'name') {
      name = scalar(field.value, lines[index].line, 'name')
      index += 1
    } else if (field.key === 'filters') {
      const parsed = filterSection(lines, index, 4)
      filters = parsed.filters
      index = parsed.next
    } else if (field.key === 'order') {
      const parsed = listSection(lines, index, 4, 'order')
      order = parsed.values
      index = parsed.next
    } else if (field.key === 'sort') {
      const parsed = sortSection(lines, index, 4)
      sort = parsed.sort
      index = parsed.next
    } else {
      fail('UNSUPPORTED_BASE', `View key "${field.key}" is unsupported.`, lines[index].line, field.key)
    }
  }

  if (!name) fail('MALFORMED_BASE', 'A table view name is required.', item.line, 'name')
  if (!order) fail('MALFORMED_BASE', 'A table view order is required.', item.line, 'order')
  if (order.length > 3 || !order.includes('file.name')) {
    fail('UNSUPPORTED_BASE', 'The fixed profile requires file.name and at most two other columns.', item.line, 'order')
  }
  for (const property of order) propertyReference(property, item.line)

  return { view: { type: 'table', name, filters, order, ...(sort ? { sort } : {}) }, next: index }
}

function hasMarkdownFilter(filters: BaseFilter[]): boolean {
  return filters.some(
    (filter) =>
      filter.kind === 'comparison' &&
      filter.property === 'file.ext' &&
      filter.operator === '==' &&
      filter.value === 'md'
  )
}

export function parseBaseProfile(content: string): BaseParseResult {
  try {
    const lines = sourceLines(content)
    if (lines.length === 0) {
      fail('MALFORMED_BASE', 'A .base profile cannot be empty.', 1)
    }

    let filters: BaseFilter[] = []
    let view: BaseTableView | undefined
    const seen = new Set<string>()
    let index = 0

    while (index < lines.length) {
      const line = lines[index]
      if (line.indent !== 0) {
        fail('MALFORMED_BASE', 'Top-level keys must not be indented.', line.line)
      }
      const field = keyValue(line)
      if (seen.has(field.key)) fail('MALFORMED_BASE', `Top-level key "${field.key}" is duplicated.`, line.line, field.key)
      seen.add(field.key)

      if (field.key === 'filters') {
        const parsed = filterSection(lines, index, 0)
        filters = parsed.filters
        index = parsed.next
      } else if (field.key === 'views') {
        if (field.value) fail('MALFORMED_BASE', 'views must contain a list.', line.line, 'views')
        const firstView = lines[index + 1]
        if (!firstView || firstView.indent !== 2 || !firstView.text.startsWith('-')) {
          fail('MALFORMED_BASE', 'views requires a list.', line.line, 'views')
        }
        const parsed = viewSection(lines, index + 1)
        view = parsed.view
        index = parsed.next
        if (lines[index] && lines[index].indent === 2 && lines[index].text.startsWith('-')) {
          fail('UNSUPPORTED_BASE', 'Only one table view is supported.', lines[index].line, 'views')
        }
      } else {
        fail('UNSUPPORTED_BASE', `Top-level key "${field.key}" is unsupported.`, line.line, field.key)
      }
    }

    if (!view) fail('MALFORMED_BASE', 'A table view is required.', 1, 'views')
    const allFilters = [...filters, ...view.filters]
    if (!hasMarkdownFilter(allFilters)) {
      fail('UNSUPPORTED_BASE', 'The fixed profile requires file.ext == "md".', 1, 'filters')
    }
    return { ok: true, profile: { filters, view } }
  } catch (error) {
    if (error instanceof BaseParseFailure) {
      return { ok: false, diagnostics: [error.diagnostic] }
    }
    return {
      ok: false,
      diagnostics: [{ code: 'MALFORMED_BASE', message: 'The .base profile could not be parsed.' }]
    }
  }
}
