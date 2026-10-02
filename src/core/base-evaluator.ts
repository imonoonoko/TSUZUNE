import { parseDocument } from 'yaml'
import { basenameRelative, dirnameRelative, withoutMarkdownExtension } from './paths'
import { extractNoteLinks, buildWikiLinkIndex, resolveIndexedNoteLink } from './links'
import { extractMarkdownTags } from './tags'
import type { NoteDocument } from '../shared/types'
import { baseFilterSource, type BaseFilter, type BaseProfile } from './base-profile'
import { baseDate, baseValueEqual, baseValueText, evaluateBaseExpression, parseBaseExpression, special, type BaseExpression, type BaseExpressionContext, type BaseValue } from './base-expression'
export type BaseCell = { kind: 'value'; value: BaseValue } | { kind: 'missing' } | { kind: 'empty' } | { kind: 'diagnostic'; code: BaseEvaluationDiagnosticCode; message: string }
export type BaseEvaluationDiagnosticCode = 'DUPLICATE_PATH' | 'MALFORMED_PROPERTY' | 'UNSUPPORTED_PROPERTY' | 'EXPRESSION_ERROR' | 'CIRCULAR_FORMULA' | 'TIMEOUT'
export interface BaseEvaluationDiagnostic { code: BaseEvaluationDiagnosticCode; message: string; path?: string; property?: string }
export interface BaseEvaluationRow { path: string; cells: Record<string, BaseCell> }
export interface BaseEvaluationGroup { key: BaseValue; rows: BaseEvaluationRow[]; summaries: Record<string, BaseCell> }
export interface BaseEvaluation { scope: 'normal-discovery-snapshot'; columns: string[]; targetCount: number; excludedCount: number; rows: BaseEvaluationRow[]; diagnostics: BaseEvaluationDiagnostic[]; groups?: BaseEvaluationGroup[]; summaries?: Record<string, BaseCell>; labels?: Record<string, string>; viewIndex?: number }
export interface BaseEvaluationOptions { propertyTypes?: Record<string, string>; now?: number; deadline?: number; maxSteps?: number; thisFile?: NoteDocument }
type FileValue = { baseType: 'file'; value: string; [key: string]: BaseValue }
const unsafe = new Set(['__proto__', 'constructor', 'prototype'])
function cell(value: BaseValue): BaseCell { return value == null ? { kind: 'empty' } : value === '' ? { kind: 'empty' } : { kind: 'value', value } }
function compare(left: BaseValue, right: BaseValue): number {
  if (left == null || right == null) return left == null ? right == null ? 0 : 1 : -1
  const a = special(left, 'date') ? Date.parse(left.value) : left; const b = special(right, 'date') ? Date.parse(right.value) : right
  return typeof a === 'number' && typeof b === 'number' ? a - b : baseValueText(a).localeCompare(baseValueText(b))
}
export const BASE_STANDARD_SUMMARIES = ['Average', 'Min', 'Max', 'Sum', 'Range', 'Median', 'Stddev', 'Earliest', 'Latest', 'Checked', 'Unchecked', 'Empty', 'Filled', 'Unique'] as const
export function evaluateBase(profile: BaseProfile, notes: readonly NoteDocument[], viewIndex = 0, options: BaseEvaluationOptions = {}): BaseEvaluation {
  const view = (profile.views ?? [profile.view])[viewIndex] ?? profile.view
  const columns = [...view.order]; const diagnostics: BaseEvaluationDiagnostic[] = []
  const normalized = notes.map((note) => ({ ...note, path: note.path.replaceAll('\\', '/') }))
  const paths = new Map<string, NoteDocument>(); const duplicates = new Set<string>()
  for (const note of normalized) { if (paths.has(note.path)) duplicates.add(note.path); paths.set(note.path, note) }
  if (duplicates.size) return { scope: 'normal-discovery-snapshot', columns, targetCount: notes.length, excludedCount: notes.length, rows: [], diagnostics: [...duplicates].sort().map((path) => ({ code: 'DUPLICATE_PATH', path, message: `The snapshot contains the path more than once: ${path}.` })) }
  const linkIndex = buildWikiLinkIndex(normalized)
  const files = new Map<string, FileValue>(); const propertyErrors = new Map<string, string>()
  const convertProperty = (value: unknown, property: string): BaseValue => {
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
    if (typeof value === 'string') {
      const type = options.propertyTypes?.[property] ?? profile.properties?.[`note.${property}`]?.type ?? profile.properties?.[property]?.type
      if (type === 'date' || type === 'datetime') return baseDate(value)
      const wiki = /^\[\[(.*?)(?:\|(.*))?\]\]$/.exec(value)
      return wiki ? { baseType: 'link', value: wiki[1], ...(wiki[2] ? { display: wiki[2] } : {}) } : value
    }
    if (Array.isArray(value) && value.every((atom) => atom == null || ['boolean', 'number', 'string'].includes(typeof atom))) return value.map((item) => convertProperty(item, property))
    throw new Error(`Property ${property} must be scalar or a scalar list.`)
  }
  for (const note of normalized) {
    const match = /^(?:\uFEFF)?---(?:\r?\n([\s\S]*?)\r?\n---|\r?\n---)(?:\r?\n|$)/.exec(note.content)
    const properties: Record<string, BaseValue> = Object.create(null) as Record<string, BaseValue>
    const names: string[] = []
    if (!match && /^(?:\uFEFF)?---(?:\r?\n|$)/.test(note.content)) propertyErrors.set(note.path, 'Frontmatter closing delimiter is missing.')
    if (match) {
      const doc = parseDocument(match[1] ?? '', { uniqueKeys: true, strict: true })
      if (doc.errors.length) propertyErrors.set(note.path, doc.errors.map((error) => error.message).join('; '))
      else {
        try {
          const data: unknown = doc.toJS({ maxAliasCount: 50 })
          if (data != null && (typeof data !== 'object' || Array.isArray(data))) throw new Error('Frontmatter must be a mapping.')
          for (const [key, value] of Object.entries(data ?? {})) {
            if (unsafe.has(key)) throw new Error('Unsafe frontmatter key.')
            names.push(key)
            try { properties[key] = convertProperty(value, key) } catch (error) { propertyErrors.set(`${note.path}\0${key}`, error instanceof Error ? error.message : String(error)) }
          }
        } catch (error) { propertyErrors.set(note.path, error instanceof Error ? error.message : String(error)) }
      }
    }
    const name = basenameRelative(note.path)
    const inlineTags = extractMarkdownTags(match ? note.content.slice(match[0].length) : note.content)
    const tags = [...new Set([...(Array.isArray(properties.tags) ? properties.tags : properties.tags == null ? [] : [properties.tags]).map(baseValueText), ...inlineTags].map((tag) => tag.replace(/^#/, '')))]
    const links = extractNoteLinks(note.content, note.path).map((link): BaseValue => {
      const resolved = resolveIndexedNoteLink(link, linkIndex)
      return { baseType: 'link', value: resolved.status === 'resolved' ? resolved.path : link.target, ...(link.alias ? { display: link.alias } : {}) }
    })
    for (const property of Object.values(properties)) for (const value of Array.isArray(property) ? property : [property]) if (special(value, 'link')) {
      const result = resolveIndexedNoteLink({ kind: 'wiki', target: value.value, sourcePath: note.path }, linkIndex)
      const resolved: BaseValue = { ...value, value: result.status === 'resolved' ? result.path : value.value }
      if (!links.some((link) => special(link, 'link') && link.value === (resolved as { value: string }).value)) links.push(resolved)
    }
    const embeds = extractNoteLinks(note.content, note.path, true).filter((link) => note.content[link.range.from - 1] === '!').map((link): BaseValue => ({ baseType: 'link', value: link.target }))
    files.set(note.path, { baseType: 'file', value: note.path, name, basename: withoutMarkdownExtension(name), path: note.path, folder: dirnameRelative(note.path), ext: name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '', size: note.size, mtime: baseDate(note.modifiedAt), ctime: typeof note.createdAt === 'number' ? baseDate(note.createdAt) : null, properties, tags, links, embeds, backlinks: [], basePropertyNames: names, basePropertyError: propertyErrors.get(note.path) ?? null, basePropertiesError: propertyErrors.get(note.path) ?? [...propertyErrors].filter(([key]) => key.startsWith(`${note.path}\0`)).map(([, error]) => error).join('; ') })
  }
  for (const source of files.values()) for (const value of source.links as BaseValue[]) {
    if (!special(value, 'link')) continue
    const target = files.get(value.value)
    if (target && !(target.backlinks as BaseValue[]).some((value) => special(value, 'link') && value.value === source.value)) (target.backlinks as BaseValue[]).push({ baseType: 'link', value: source.value })
  }
  const expressions = new Map<string, BaseExpression>()
  const parsed = (source: string): BaseExpression => { let ast = expressions.get(source); if (!ast) { ast = parseBaseExpression(source); expressions.set(source, ast) }; return ast }
  const now = options.now ?? Date.now()
  const resolveFile = (value: BaseValue, sourcePath: string): BaseValue => {
    if (special(value, 'file')) return value
    const raw = special(value, 'link') ? value.value : baseValueText(value)
    const wiki = /^\[\[(.*?)(?:\|.*)?\]\]$/.exec(raw)
    const target = wiki?.[1] ?? raw
    const result = resolveIndexedNoteLink({ kind: target.endsWith('.md') && (target.startsWith('./') || target.startsWith('../')) ? 'markdown' : 'wiki', target, sourcePath }, linkIndex)
    return result.status === 'resolved' ? files.get(result.path) ?? null : null
  }
  const evaluated: { row: BaseEvaluationRow; resolve: (property: string) => BaseValue; read: (property: string) => BaseCell }[] = []
  const record = (path: string, property: string, error: unknown): Extract<BaseCell, { kind: 'diagnostic' }> => {
    const message = error instanceof Error ? error.message : String(error)
    const code: BaseEvaluationDiagnosticCode = message.includes('Circular formula') ? 'CIRCULAR_FORMULA' : propertyErrors.has(path) ? 'MALFORMED_PROPERTY' : propertyErrors.has(`${path}\0${property.replace(/^note\./, '')}`) ? 'UNSUPPORTED_PROPERTY' : 'EXPRESSION_ERROR'
    if (!diagnostics.some((item) => item.path === path && item.property === property && item.message === message)) diagnostics.push({ code, message, path, property })
    return { kind: 'diagnostic', code, message }
  }
  for (const note of normalized) {
    const file = files.get(note.path) as FileValue; const props = file.properties as Record<string, BaseValue>
    const cache = new Map<string, BaseValue>(); const active = new Set<string>()
    const formula = (name: string): BaseValue => {
      if (cache.has(name)) return cache.get(name) ?? null
      if (!Object.hasOwn(profile.formulas ?? {}, name)) return null
      if (active.has(name)) throw new Error(`Circular formula: ${[...active, name].join(' → ')}.`)
      active.add(name)
      try { const value = evaluateBaseExpression(parsed(profile.formulas![name]), context); cache.set(name, value); return value } finally { active.delete(name) }
    }
    const resolve = (property: string): BaseValue => {
      if (property === 'file') return file
      if (property === 'this') {
        if (!options.thisFile) return null
        const base = options.thisFile; const name = basenameRelative(base.path)
        const thisFile: FileValue = { baseType: 'file', value: base.path, name, basename: name.replace(/\.[^.]+$/, ''), path: base.path, folder: dirnameRelative(base.path), ext: name.slice(name.lastIndexOf('.') + 1), size: base.size, mtime: baseDate(base.modifiedAt), ctime: base.createdAt == null ? null : baseDate(base.createdAt), properties: {}, tags: [], links: [] }
        return { file: thisFile }
      }
      if (property === 'note') {
        if (propertyErrors.has(note.path)) throw new Error(propertyErrors.get(note.path))
        return props
      }
      if (property === 'formula') return Object.fromEntries(Object.keys(profile.formulas ?? {}).map((name) => [name, formula(name)]))
      if (property.startsWith('formula.')) return formula(property.slice(8))
      if (property.startsWith('file.')) {
        const key = property.slice(5)
        if (key === 'file') return file
        if (key === 'properties') { const error = propertyErrors.get(note.path) ?? [...propertyErrors].find(([name]) => name.startsWith(`${note.path}\0`))?.[1]; if (error) throw new Error(error) }
        if (!Object.hasOwn(file, key) || key.startsWith('baseProperty')) throw new Error(`File property ${property} is unsupported.`)
        return file[key]
      }
      const name = property.replace(/^note\./, '')
      if (propertyErrors.has(note.path)) throw new Error(propertyErrors.get(note.path))
      if (propertyErrors.has(`${note.path}\0${name}`)) throw new Error(propertyErrors.get(`${note.path}\0${name}`))
      return Object.hasOwn(props, name) ? props[name] : null
    }
    // Resolve formula members lazily so a formula does not eagerly evaluate itself.
    const context: BaseExpressionContext = { resolve, file: (value) => resolveFile(value, note.path), now, deadline: options.deadline, maxSteps: options.maxSteps }
    const read = (property: string): BaseCell => {
      try {
        const value = resolve(property)
        if (value == null && !property.startsWith('file.') && !property.startsWith('formula.') && !Object.hasOwn(props, property.replace(/^note\./, ''))) return { kind: 'missing' }
        return cell(value)
      } catch (error) { return record(note.path, property, error) }
    }
    const matchFilter = (filter: BaseFilter): boolean => {
      if (filter.kind === 'and') return filter.children.every(matchFilter)
      if (filter.kind === 'or') return filter.children.some(matchFilter)
      if (filter.kind === 'not') return !filter.children.some(matchFilter)
      const source = baseFilterSource(filter)
      try { return Boolean(evaluateBaseExpression(parsed(String(source)), context)) } catch (error) { record(note.path, filter.kind === 'expression' ? filter.expression : 'property' in filter ? filter.property : 'filter', error); return false }
    }
    if (![...profile.filters, ...view.filters].every(matchFilter)) continue
    evaluated.push({ row: { path: note.path, cells: Object.fromEntries(columns.map((property) => [property, read(property)])) }, resolve, read })
  }
  const sorts = view.sorts ?? (view.sort ? [view.sort] : [])
  evaluated.sort((a, b) => {
    for (const order of sorts) {
      const left = a.read(order.property); const right = b.read(order.property)
      if (left.kind !== 'value' || right.kind !== 'value') { if (left.kind === 'value') return -1; if (right.kind === 'value') return 1; continue }
      const result = compare(left.value, right.value)
      if (result) return result * (order.direction === 'DESC' ? -1 : 1)
    }
    return a.row.path < b.row.path ? -1 : a.row.path > b.row.path ? 1 : 0
  })
  const included = view.limit == null ? evaluated : evaluated.slice(0, view.limit)
  const summaries = (rows: typeof included): Record<string, BaseCell> => Object.fromEntries(Object.entries(view.summaries ?? {}).map(([property, summary]) => {
    const values = rows.map((row) => row.read(property)).map((value) => value.kind === 'value' ? value.value : null)
    try {
      const filled = values.filter((value): value is Exclude<BaseValue, null> => value != null && value !== '' && !(Array.isArray(value) && value.length === 0))
      const numbers = filled.filter((value): value is number => typeof value === 'number').sort((a, b) => a - b)
      const sum = numbers.reduce((acc, value) => acc + value, 0)
      const mean = numbers.length ? sum / numbers.length : null
      const standard: Record<string, () => BaseValue> = {
        Average: () => mean, Sum: () => sum, Min: () => numbers[0] ?? null, Max: () => numbers.at(-1) ?? null,
        Range: () => numbers.length ? numbers[numbers.length - 1] - numbers[0] : (() => { const dates = filled.filter((value) => special(value, 'date')).sort(compare); return dates.length ? Date.parse((dates.at(-1) as { value: string }).value) - Date.parse((dates[0] as { value: string }).value) : null })(),
        Median: () => !numbers.length ? null : numbers.length % 2 ? numbers[Math.floor(numbers.length / 2)] : (numbers[numbers.length / 2 - 1] + numbers[numbers.length / 2]) / 2,
        Stddev: () => mean == null ? null : Math.sqrt(numbers.reduce((acc, value) => acc + (value - mean) ** 2, 0) / numbers.length),
        Earliest: () => filled.filter((value) => special(value, 'date')).sort(compare)[0] ?? null,
        Latest: () => filled.filter((value) => special(value, 'date')).sort(compare).at(-1) ?? null,
        Checked: () => values.filter((value) => value === true).length, Unchecked: () => values.filter((value) => value === false).length,
        Empty: () => values.length - filled.length, Filled: () => filled.length, Unique: () => filled.filter((value, index) => filled.findIndex((other) => baseValueEqual(value, other)) === index).length
      }
      const selected = Object.keys(standard).find((name) => name.toLowerCase() === summary.toLowerCase())
      const custom = profile.summaries?.[summary] ?? profile.summaries?.[summary.replace(/^summary\./, '')]
      if (!selected && !custom) throw new Error(`Unknown summary ${summary}.`)
      return [property, cell(selected ? standard[selected]() : evaluateBaseExpression(parsed(custom!), { resolve: (name) => name === 'values' ? values : null, file: () => null, now, deadline: options.deadline, maxSteps: options.maxSteps }))]
    } catch (error) { return [property, record('', property, error)] }
  }))
  let groups: BaseEvaluationGroup[] | undefined
  if (view.groupBy) {
    groups = []
    for (const item of included) {
      const groupCell = item.read(view.groupBy.property); const key = groupCell.kind === 'value' ? groupCell.value : null
      let group = groups.find((other) => baseValueEqual(other.key, key)); if (!group) { group = { key, rows: [], summaries: {} }; groups.push(group) }; group.rows.push(item.row)
    }
    groups.sort((a, b) => compare(a.key, b.key) * (view.groupBy!.direction === 'DESC' ? -1 : 1))
    for (const group of groups) group.summaries = summaries(included.filter((item) => group.rows.includes(item.row)))
  }
  return { scope: 'normal-discovery-snapshot', columns, targetCount: notes.length, excludedCount: notes.length - evaluated.length, rows: included.map((item) => item.row), diagnostics, ...(groups ? { groups } : {}), summaries: summaries(included), labels: Object.fromEntries(columns.map((column) => [column, profile.properties?.[column]?.displayName ?? column])), viewIndex }
}
