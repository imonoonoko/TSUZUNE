import { isMap, isSeq, parseDocument, stringify } from 'yaml'
import { parseBaseExpression, validateBaseExpression } from './base-expression'
export type BaseDiagnosticCode = 'MALFORMED_BASE' | 'UNSUPPORTED_BASE'
export interface BaseDiagnostic { code: BaseDiagnosticCode; message: string; line?: number; key?: string }
export type BaseScalar = string | number | boolean
export type BaseComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<='
export type BaseFilter = { kind: 'expression'; expression: string } | { kind: 'and' | 'or' | 'not'; children: BaseFilter[] } | { kind: 'inFolder'; folder: string } | { kind: 'comparison'; property: string; operator: BaseComparisonOperator; value: BaseScalar } | { kind: 'contains'; property: string; value: BaseScalar }
export interface BaseSort { property: string; direction: 'ASC' | 'DESC' }
export interface BaseTableView { type: 'table'; name: string; filters: BaseFilter[]; order: string[]; sort?: BaseSort; sorts?: BaseSort[]; groupBy?: BaseSort; summaries?: Record<string, string>; limit?: number; sourceIndex?: number }
export interface BaseProfile { filters: BaseFilter[]; view: BaseTableView; views?: BaseTableView[]; formulas?: Record<string, string>; properties?: Record<string, { displayName?: string; type?: string }>; summaries?: Record<string, string> }
export type BaseParseResult = { ok: true; profile: BaseProfile } | { ok: false; diagnostics: BaseDiagnostic[] }
const unsafe = new Set(['__proto__', 'prototype', 'constructor'])
function mapping(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key} must be a mapping.`)
  const object = value as Record<string, unknown>
  if (Object.keys(object).some((name) => unsafe.has(name))) throw new Error(`Unsafe key in ${key}.`)
  return object
}
function text(value: unknown, key: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} must be a non-empty string.`); return value }
function expression(value: unknown, key: string): string { const source = text(value, key); validateBaseExpression(parseBaseExpression(source)); return source }
function filter(value: unknown): BaseFilter {
  if (typeof value === 'string') return { kind: 'expression', expression: expression(value, 'filter') }
  const object = mapping(value, 'filter'); const keys = Object.keys(object)
  if (keys.length !== 1 || !['and', 'or', 'not'].includes(keys[0])) throw new Error('Filters require one and, or, or not group.')
  const kind = keys[0] as 'and' | 'or' | 'not'
  return { kind, children: (Array.isArray(object[kind]) ? object[kind] as unknown[] : [object[kind]]).map(filter) }
}
function filters(value: unknown): BaseFilter[] { return value == null ? [] : [filter(value)] }
function stringMap(value: unknown, key: string): Record<string, string> { return Object.fromEntries(Object.entries(mapping(value, key)).map(([name, item]) => [name, expression(item, `${key}.${name}`)])) }
function sort(value: unknown): BaseSort {
  const item = mapping(value, 'sort'); const direction = String(item.direction ?? 'ASC').toUpperCase()
  if (direction !== 'ASC' && direction !== 'DESC') throw new Error('Sort direction must be ASC or DESC.')
  return { property: text(item.property, 'sort.property'), direction }
}
export function parseBaseProfile(content: string): BaseParseResult {
  try {
    if (content.length > 1_000_000) throw new Error('Base profile is too large.')
    const doc = parseDocument(content, { uniqueKeys: true, strict: true })
    if (doc.errors.length) return { ok: false, diagnostics: doc.errors.map((error) => ({ code: 'MALFORMED_BASE', message: error.message, line: error.linePos?.[0].line })) }
    const data = mapping(doc.toJS({ maxAliasCount: 50 }), 'Base')
    if (!Array.isArray(data.views) || !data.views.length) throw new Error('At least one view is required.')
    const views = data.views.map((raw, index): BaseTableView => {
      const item = mapping(raw, 'view')
      if (item.type !== 'table') throw new Error(`Unsupported view type: ${String(item.type)}.`)
      const order = item.order == null ? ['file.name'] : item.order
      if (!Array.isArray(order) || !order.length || order.some((key) => typeof key !== 'string')) throw new Error('View order must be a non-empty property list.')
      const sorts = item.sort == null ? [] : (Array.isArray(item.sort) ? item.sort : [item.sort]).map(sort)
      const summaries = item.summaries == null ? undefined : Object.fromEntries(Object.entries(mapping(item.summaries, 'view.summaries')).map(([key, value]) => [key, text(value, 'summary')]))
      if (item.limit != null && (!Number.isInteger(item.limit) || Number(item.limit) < 0)) throw new Error('View limit must be a nonnegative integer.')
      return { type: 'table', name: item.name == null ? `Table ${index + 1}` : text(item.name, 'view.name'), sourceIndex: index, filters: filters(item.filters), order: order as string[], ...(sorts.length ? { sorts, sort: sorts[0] } : {}), ...(item.groupBy ? { groupBy: sort(item.groupBy) } : {}), ...(summaries ? { summaries } : {}), ...(item.limit != null ? { limit: Number(item.limit) } : {}) }
    })
    const properties = data.properties == null ? undefined : Object.fromEntries(Object.entries(mapping(data.properties, 'properties')).map(([key, value]) => {
      const item = mapping(value, `properties.${key}`)
      return [key, { ...(item.displayName != null ? { displayName: text(item.displayName, 'displayName') } : {}), ...(item.type != null ? { type: text(item.type, 'property.type') } : {}) }]
    }))
    return { ok: true, profile: { filters: filters(data.filters), view: views[0], views, ...(data.formulas ? { formulas: stringMap(data.formulas, 'formulas') } : {}), ...(properties ? { properties } : {}), ...(data.summaries ? { summaries: stringMap(data.summaries, 'summaries') } : {}) } }
  } catch (error) { return { ok: false, diagnostics: [{ code: 'MALFORMED_BASE', message: error instanceof Error ? error.message : String(error) }] } }
}
export function baseFilterSource(item: BaseFilter): unknown {
  if (item.kind === 'expression') return item.expression
  if (item.kind === 'and' || item.kind === 'or' || item.kind === 'not') return { [item.kind]: item.children.map(baseFilterSource) }
  if (item.kind === 'inFolder') return `file.inFolder(${JSON.stringify(item.folder)})`
  if (item.kind === 'contains') return `${item.property}.contains(${JSON.stringify(item.value)})`
  if (item.kind === 'comparison') return `${item.property} ${item.operator} ${JSON.stringify(item.value)}`
  return ''
}
export function serializeBaseProfile(profile: BaseProfile): string {
  return stringify({ ...(profile.filters.length ? { filters: { and: profile.filters.map(baseFilterSource) } } : {}), ...(profile.formulas ? { formulas: profile.formulas } : {}), ...(profile.properties ? { properties: profile.properties } : {}), ...(profile.summaries ? { summaries: profile.summaries } : {}), views: (profile.views ?? [profile.view]).map((view) => ({ type: view.type, name: view.name, ...(view.filters.length ? { filters: { and: view.filters.map(baseFilterSource) } } : {}), order: view.order, ...((view.sorts ?? (view.sort ? [view.sort] : [])).length ? { sort: view.sorts ?? [view.sort] } : {}), ...(view.groupBy ? { groupBy: view.groupBy } : {}), ...(view.summaries ? { summaries: view.summaries } : {}), ...(view.limit != null ? { limit: view.limit } : {}) })) })
}

/** Patch only supported fields in the original YAML AST; keep comments and extension keys. */
export function updateBaseProfileSource(content: string, profile: BaseProfile): string {
  const before = parseDocument(content, { uniqueKeys: true, strict: true })
  const document = parseDocument(content, { uniqueKeys: true, strict: true })
  if (document.errors.length || !isMap(document.contents)) throw new Error('Cannot modify malformed Base YAML.')
  const replacement = parseDocument(serializeBaseProfile(profile))
  for (const key of ['filters', 'formulas', 'properties', 'summaries']) {
    const next = replacement.get(key, true)
    if (next == null) { document.delete(key); continue }
    const current = document.get(key, true)
    if (isMap(current) && isMap(next)) {
      for (const entry of next.items) {
        const previous = current.get(entry.key, true)
        if (key === 'properties' && isMap(previous) && isMap(entry.value)) {
          for (const field of ['displayName', 'type']) { const value = entry.value.get(field, true); if (value == null) previous.delete(field); else previous.set(field, value) }
        } else current.set(entry.key, entry.value)
      }
      // Removed formulas/property labels are explicit GUI changes; extension keys live in views/root.
      for (const entry of [...current.items]) if (!next.has(entry.key)) current.delete(entry.key)
    } else document.set(key, next)
  }
  const existing = document.get('views', true); const proposed = replacement.get('views', true)
  if (!isSeq(existing) || !isSeq(proposed)) throw new Error('Views must be a YAML sequence.')
  const originalViews = [...existing.items]
  const changedViews = profile.views ?? [profile.view]
  proposed.items.forEach((next, index) => {
    const originalIndex = changedViews[index]?.sourceIndex
    const current = originalIndex == null ? undefined : originalViews[originalIndex]
    if (!isMap(current) || !isMap(next)) { existing.items[index] = next; return }
    existing.items[index] = current
    for (const key of ['type', 'name', 'filters', 'order', 'sort', 'groupBy', 'summaries', 'limit']) {
      const value = next.get(key, true)
      if (!current.has(key) && (key === 'order' && JSON.stringify(nodeValue(value)) === '["file.name"]' || key === 'name' && nodeValue(value) === `Table ${originalIndex! + 1}`)) continue
      if (value == null) current.delete(key); else { const previous = current.get(key, true); if (previous && typeof previous === 'object' && 'comment' in previous && typeof value === 'object') value.comment = previous.comment; current.set(key, value) }
    }
  })
  existing.items.length = proposed.items.length
  const source = patchYamlSource(content, before.contents, document.contents, changedViews.map((view) => view.sourceIndex))
  const verified = parseBaseProfile(source)
  if (!verified.ok) throw new Error(verified.diagnostics[0]?.message ?? 'Invalid edited Base.')
  return source
}

type SourceEdit = { from: number; to: number; insert: string }
function nodeRange(node: unknown): [number, number, number] | null {
  if (node && typeof node === 'object' && 'range' in node && Array.isArray(node.range)) return node.range as [number, number, number]
  return null
}
function nodeValue(node: unknown): unknown { return node && typeof node === 'object' && 'toJSON' in node && typeof node.toJSON === 'function' ? node.toJSON() : node }
/** YAML ranges refer to the original source, so unrelated bytes, BOM and line endings survive. */
function patchYamlSource(source: string, before: unknown, after: unknown, viewOrigins: (number | undefined)[]): string {
  const edits: SourceEdit[] = []
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const lineStart = (position: number): number => source.lastIndexOf('\n', position - 1) + 1
  const indentation = (position: number): string => /^ */.exec(source.slice(lineStart(position)))?.[0] ?? ''
  const fragment = (node: unknown): string => JSON.stringify(nodeValue(node))
  const preservedComments = (node: unknown, from: number, to: number): string[] => {
    const found: string[] = []
    const collect = (item: unknown): void => {
      if (!item || typeof item !== 'object') return
      for (const key of ['comment', 'commentBefore']) if (key in item) {
        const comment = (item as Record<string, unknown>)[key]
        if (typeof comment === 'string') for (const line of comment.split('\n')) {
          const token = `#${line}`; const position = source.indexOf(token, from)
          if (position >= from && position < to && !found.includes(token)) found.push(token)
        }
      }
      if (isMap(item)) item.items.forEach((pair) => { collect(pair.key); collect(pair.value) })
      else if (isSeq(item)) item.items.forEach(collect)
    }
    collect(node); return found
  }
  const withComments = (raw: string, node: unknown, from: number, to: number, indent: string): string => {
    const comments = preservedComments(node, from, to)
    return raw + (comments.length ? newline + comments.map((comment) => indent + comment).join(newline) : '')
  }
  const apply = (raw: string, changes: SourceEdit[], offset = 0): string => changes.sort((a, b) => b.from - a.from).reduce((text, edit) => text.slice(0, edit.from - offset) + edit.insert + text.slice(edit.to - offset), raw)
  const walk = (oldNode: unknown, newNode: unknown, key = ''): void => {
    if (JSON.stringify(nodeValue(oldNode)) === JSON.stringify(nodeValue(newNode))) return
    const range = nodeRange(oldNode)
    if (!range) throw new Error('Cannot safely locate the edited YAML node.')
    if (isMap(oldNode) && isMap(newNode)) {
      if (oldNode.flow && oldNode.items.some((pair) => !newNode.has(String(nodeValue(pair.key))))) {
        const fragments = newNode.items.map((pair) => {
          const name = String(nodeValue(pair.key)); const previous = oldNode.items.find((item) => String(nodeValue(item.key)) === name)
          const from = nodeRange(previous?.key)?.[0]; const to = nodeRange(previous?.value)?.[1]
          if (from == null || to == null) return `${JSON.stringify(name)}: ${fragment(pair.value)}`
          const start = edits.length; walk(previous!.value, pair.value, name); const changes = edits.splice(start)
          return apply(source.slice(from, to), changes, from)
        })
        edits.push({ from: range[0], to: range[1], insert: withComments(`{${fragments.join(', ')}}`, oldNode, range[0], range[1], indentation(range[0])) }); return
      }
      for (const pair of oldNode.items) {
        const name = String(nodeValue(pair.key))
        if (newNode.has(name)) { walk(pair.value, newNode.get(name, true), name); continue }
        const keyRange = nodeRange(pair.key); const valueRange = nodeRange(pair.value)
        if (!keyRange || !valueRange) throw new Error('Cannot safely remove YAML field.')
        if (oldNode.flow) {
          let from = keyRange[0]; let to = valueRange[1]
          const remaining = source.slice(to, range[1] - 1); const following = /^\s*,\s*/.exec(remaining)
          if (following) to += following[0].length
          else { const preceding = /,\s*$/.exec(source.slice(range[0] + 1, from)); if (preceding) from -= preceding[0].length }
          edits.push({ from, to, insert: '' })
        } else {
          const from = lineStart(keyRange[0]); const comments = preservedComments(pair.value, from, valueRange[2])
          edits.push({ from, to: valueRange[2], insert: comments.map((comment) => indentation(keyRange[0]) + comment + newline).join('') })
        }
      }
      const added = newNode.items.filter((pair) => !oldNode.has(String(nodeValue(pair.key))))
      if (added.length) {
        if (oldNode.flow) edits.push({ from: range[1] - 1, to: range[1] - 1, insert: `${oldNode.items.length ? ', ' : ''}${added.map((pair) => `${JSON.stringify(nodeValue(pair.key))}: ${fragment(pair.value)}`).join(', ')}` })
        else {
          const keyPosition = nodeRange(oldNode.items[0]?.key)?.[0] ?? range[0]
          const indent = ' '.repeat(source.slice(lineStart(keyPosition), keyPosition).replace(/^\uFEFF/, '').length)
          const values = Object.fromEntries(added.map((pair) => [String(nodeValue(pair.key)), nodeValue(pair.value)]))
          const block = stringify(values).trimEnd().split('\n').map((line) => indent + line).join(newline) + newline
          edits.push({ from: range[2], to: range[2], insert: (range[2] > 0 && source[range[2] - 1] !== '\n' ? newline : '') + block })
        }
      }
      return
    }
    if (isSeq(oldNode) && isSeq(newNode)) {
      if (key === 'views') {
        const sameOrigins = newNode.items.length === oldNode.items.length && viewOrigins.every((origin, at) => origin === at)
        if (sameOrigins) { oldNode.items.forEach((item, at) => walk(item, newNode.items[at])); return }
        if (oldNode.flow) {
          const segments = newNode.items.map((item, at) => {
            const origin = viewOrigins[at]; const original = origin == null ? undefined : oldNode.items[origin]; const itemRange = nodeRange(original)
            if (!itemRange) return fragment(item)
            const start = edits.length; walk(original, item); const changes = edits.splice(start)
            return apply(source.slice(itemRange[0], itemRange[1]), changes, itemRange[0])
          })
          edits.push({ from: range[0], to: range[1], insert: `[${segments.join(', ')}]` }); return
        }
        const firstRange = nodeRange(oldNode.items[0]); const firstStart = firstRange ? lineStart(firstRange[0]) : range[0]
        const indent = indentation(firstStart)
        const segments = newNode.items.map((item, at) => {
          const origin = viewOrigins[at]; const original = origin == null ? undefined : oldNode.items[origin]; const itemRange = nodeRange(original)
          if (!itemRange) return stringify([nodeValue(item)]).trimEnd().split('\n').map((line) => indent + line).join(newline) + newline
          const from = lineStart(itemRange[0]); const followingRange = nodeRange(oldNode.items[origin! + 1]); const to = followingRange ? lineStart(followingRange[0]) : range[2]
          const start = edits.length; walk(original, item); const changes = edits.splice(start)
          return apply(source.slice(from, to), changes, from)
        })
        edits.push({ from: firstStart, to: range[2], insert: segments.join('') }); return
      }
      if (oldNode.items.length === newNode.items.length) { oldNode.items.forEach((item, at) => walk(item, newNode.items[at])); return }
    }
    const comments = preservedComments(oldNode, range[0], range[1])
    // Put removed collection comments before a standalone replacement value, so a sibling field stays valid.
    const prefix = comments.length ? newline + comments.map((comment) => indentation(range[0]) + '  ' + comment).join(newline) + newline + indentation(range[0]) + '  ' : ''
    edits.push({ from: range[0], to: range[1], insert: prefix + fragment(newNode) })
  }
  walk(before, after)
  return apply(source, edits)
}

export function basePropertyReferences(profile: BaseProfile, name: string): string[] {
  const references: string[] = []
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = (source: string): boolean => new RegExp(`(?:\\bnote\\.)?${escaped}(?![\\p{L}\\p{N}_])|note\\[\\s*["']${escaped}["']\\s*\\]`, 'u').test(source)
  const inspectFilter = (item: BaseFilter, location: string): void => {
    if (item.kind === 'and' || item.kind === 'or' || item.kind === 'not') item.children.forEach((child, index) => inspectFilter(child, `${location}.${item.kind}[${index}]`))
    else if (matches(String(baseFilterSource(item)))) references.push(location)
  }
  profile.filters.forEach((item, index) => inspectFilter(item, `filters[${index}]`))
  for (const [index, view] of (profile.views ?? [profile.view]).entries()) {
    view.filters.forEach((item, at) => inspectFilter(item, `views[${index}].filters[${at}]`))
    for (const field of [...view.order, ...(view.sorts ?? (view.sort ? [view.sort] : [])).map((item) => item.property), ...(view.groupBy ? [view.groupBy.property] : []), ...Object.keys(view.summaries ?? {})]) if (matches(field)) references.push(`views[${index}]: ${field}`)
  }
  for (const [key, value] of Object.entries(profile.formulas ?? {})) if (matches(value)) references.push(`formulas.${key}`)
  for (const [key, value] of Object.entries(profile.summaries ?? {})) if (matches(value)) references.push(`summaries.${key}`)
  return [...new Set(references)]
}
