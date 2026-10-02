import { createHash } from 'node:crypto'
import { parseBaseProfile, type BaseProfile } from '../core/base-profile'
import { parseBaseExpression, type BaseExpression } from '../core/base-expression'
import type { BaseCell, BaseEvaluation } from '../core/base-evaluator'
import type { VaultService } from '../main/vault'
import type { NoteDocument, VaultSnapshot } from '../shared/types'
import { evaluateBaseInWorker, type BaseWorkerRequest, type BaseWorkerOptions } from './base-worker-client'

export interface BasePageInput { limit?: number; after?: string; max_characters?: number; query?: string }
export interface QueryBaseInput extends BasePageInput { id: string; view_index?: number; context_note_id?: string; now?: number }
type Output = Record<string, unknown>
type Cursor = { fingerprint: string; offset: number; now?: number }
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function baseNoteRevision(root: string, note: NoteDocument): string {
  return `sha256:${createHash('sha256').update(root).update('\0').update(note.path).update('\0').update(String(note.modifiedAt)).update('\0').update(String(note.size)).update('\0').update(note.content).digest('hex')}`
}
function limits(input: BasePageInput, maxLimit = 100): { limit: number; budget: number } {
  const limit = input.limit ?? 50; const budget = input.max_characters ?? 15000
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) throw new Error(`limit must be 1–${maxLimit}.`)
  if (!Number.isInteger(budget) || budget < 1000 || budget > 100000) throw new Error('max_characters must be 1000–100000.')
  return { limit, budget }
}
function decode(raw?: string): Cursor | undefined {
  if (!raw) return undefined
  try {
    if (raw.length > 2048) throw new Error()
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor
    if (typeof value.fingerprint !== 'string' || !Number.isInteger(value.offset) || value.offset < 0 || value.now !== undefined && !Number.isFinite(value.now)) throw new Error()
    return value
  } catch { throw new Error('Invalid Bases cursor. Restart the query.') }
}
function cursor(fingerprint: string, offset: number, now?: number): string {
  return Buffer.from(JSON.stringify({ fingerprint, offset, ...(now !== undefined ? { now } : {}) })).toString('base64url')
}
function offsetFor(after: Cursor | undefined, fingerprint: string): number {
  if (after && after.fingerprint !== fingerprint) throw new Error('Bases input or source changed. Restart the query.')
  return after?.offset ?? 0
}
const length = (output: unknown): number => JSON.stringify(output, null, 2).length
function fit(output: Output, key: string, value: unknown, budget: number): boolean {
  output[key] = value
  if (length(output) <= budget - 250) return true
  delete output[key]; return false
}
async function visibleBase(vault: VaultService, snapshot: VaultSnapshot, filters: readonly string[], id: string, inventory?: string[]) {
  const visible = inventory ?? await vault.listBases(snapshot.rootPath, filters)
  if (!visible.includes(id)) throw new Error('Base is outside the visible Vault scope.')
  const document = await vault.readBase(id)
  return { document, parsed: parseBaseProfile(document.content), revision: `sha256:${hash([snapshot.rootPath, document.path, document.modifiedAt, document.content])}` }
}

export async function listBases(vault: VaultService, snapshot: VaultSnapshot, filters: readonly string[], input: BasePageInput = {}): Promise<Output> {
  const { limit, budget } = limits(input)
  const inventory = await vault.listBases(snapshot.rootPath, filters)
  const ids = inventory.filter((id) => !input.query || id.toLocaleLowerCase().includes(input.query.toLocaleLowerCase())).sort()
  const documents = await Promise.all(ids.map(async (id) => {
    const base = await visibleBase(vault, snapshot, filters, id, inventory)
    return { id, revision: base.revision, views: base.parsed.ok ? (base.parsed.profile.views ?? [base.parsed.profile.view]).map((view) => ({ name: view.name, source_index: view.sourceIndex, type: view.type })) : [], diagnostics: base.parsed.ok ? [] : base.parsed.diagnostics }
  }))
  const fingerprint = hash([snapshot.rootPath, filters, input.query, limit, documents]); const offset = offsetFor(decode(input.after), fingerprint)
  const result: Output = { bases: [], total: documents.length, omitted_bases: documents.length - offset, omitted_metadata: 0 }
  const page = result.bases as unknown[]
  let consumed = 0
  for (const base of documents.slice(offset, offset + limit)) {
    let item: unknown = base
    if (length(base) > budget / 2) { item = { id: base.id, revision: base.revision, metadata_omitted: true }; result.omitted_metadata = Number(result.omitted_metadata) + 1 }
    page.push(item)
    if (length(result) > budget - 250) { page.pop(); break }
    consumed++
  }
  result.omitted_bases = documents.length - page.length
  if (offset + consumed < documents.length) {
    if (!consumed) throw new Error('Base metadata exceeds the output budget. Increase max_characters.')
    result.next_after = cursor(fingerprint, offset + consumed)
  }
  return result
}

function referencesThis(profile: BaseProfile): boolean {
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false
    const ast = value as BaseExpression
    if (ast.kind === 'identifier' && ast.name === 'this') return true
    return Object.values(value).some((item) => Array.isArray(item) ? item.some(visit) : visit(item))
  }
  // Parse strings individually: literals containing "this" must not require a context note.
  const strings: string[] = []
  const collect = (value: unknown): void => { if (typeof value === 'string') strings.push(value); else if (value && typeof value === 'object') Object.values(value).forEach(collect) }
  const collectFilters = (filters: BaseProfile['filters']): void => {
    for (const filter of filters) {
      if (filter.kind === 'expression') strings.push(filter.expression)
      else if ('children' in filter) collectFilters(filter.children)
      else if ('property' in filter) strings.push(filter.property)
    }
  }
  collectFilters(profile.filters); collectFilters(profile.view.filters)
  collect(profile.formulas); collect(profile.summaries); collect(profile.view.order)
  collect((profile.view.sorts ?? (profile.view.sort ? [profile.view.sort] : [])).map((sort) => sort.property))
  if (profile.view.groupBy) strings.push(profile.view.groupBy.property)
  return strings.some((source) => { try { return visit(parseBaseExpression(source)) } catch { return false } })
}

export async function queryBase(vault: VaultService, snapshot: VaultSnapshot, filters: readonly string[], propertyTypes: Record<string, string>, input: QueryBaseInput, evaluate: (request: BaseWorkerRequest, options?: BaseWorkerOptions) => Promise<BaseEvaluation> = evaluateBaseInWorker, workerOptions: BaseWorkerOptions = {}): Promise<Output> {
  const { limit, budget } = limits(input, 200); const base = await visibleBase(vault, snapshot, filters, input.id)
  if (!base.parsed.ok) {
    const output: Output = { id: input.id, revision: base.revision, diagnostics: [], omitted_diagnostics: base.parsed.diagnostics.length }
    for (const diagnostic of base.parsed.diagnostics) {
      const items = output.diagnostics as unknown[]; items.push(diagnostic)
      if (length(output) > budget) { items.pop(); break }
      output.omitted_diagnostics = Number(output.omitted_diagnostics) - 1
    }
    if (length(output) > budget) throw new Error('Base diagnostics exceed the output budget. Increase max_characters.')
    return output
  }
  const profile = base.parsed.profile; const viewIndex = input.view_index ?? 0
  if (!Number.isInteger(viewIndex) || viewIndex < 0 || viewIndex >= (profile.views ?? [profile.view]).length) throw new Error('Unknown Base view_index.')
  const thisFile = input.context_note_id ? snapshot.notes.find((note) => note.path === input.context_note_id) : undefined
  if (input.context_note_id && !thisFile) throw new Error('context_note_id is outside the visible snapshot.')
  if (referencesThis({ ...profile, views: undefined, view: (profile.views ?? [profile.view])[viewIndex] }) && !thisFile) throw new Error('This Base references this; provide an explicit context_note_id.')
  const after = decode(input.after); const now = input.now ?? after?.now ?? Date.now()
  if (!Number.isFinite(now)) throw new Error('now must be a finite timestamp.')
  const sources = snapshot.notes.map((note) => ({ id: note.path, revision: baseNoteRevision(snapshot.rootPath, note), created_at: note.createdAt ?? null })).sort((a, b) => a.id.localeCompare(b.id))
  const fingerprint = hash([snapshot.rootPath, base.revision, filters, sources, Object.entries(propertyTypes).sort(([a], [b]) => a.localeCompare(b)), viewIndex, input.context_note_id ?? null, limit, now])
  const offset = offsetFor(after, fingerprint)
  const evaluation = await evaluate({ profile, notes: snapshot.notes, viewIndex, options: { propertyTypes, now, thisFile, deadline: Date.now() + (workerOptions.timeoutMs ?? 3000) } }, workerOptions)
  const result: Output = { id: input.id, revision: base.revision, view_index: viewIndex, now, scope: evaluation.scope, total_rows: evaluation.rows.length, target_count: evaluation.targetCount, excluded_count: evaluation.excludedCount, rows: [], groups: [], summaries: {}, diagnostics: [], omitted: { rows: evaluation.rows.length, cells: 0, groups: evaluation.groups?.length ?? 0, summaries: Object.keys(evaluation.summaries ?? {}).length, diagnostics: evaluation.diagnostics.length, columns: 0 } }
  const omitted = result.omitted as Record<string, number>
  if (!fit(result, 'columns', evaluation.columns.map((property) => ({ property, origin: property.startsWith('formula.') ? 'computed' : property.startsWith('file.') ? 'file' : 'saved_property', label: evaluation.labels?.[property] })), budget)) omitted.columns = evaluation.columns.length
  const rows = result.rows as Output[]; let consumed = 0
  for (const row of evaluation.rows.slice(offset, offset + limit)) {
    const item: Output = { id: row.path, revision: sources.find((source) => source.id === row.path)?.revision, cells: {} }
    const cells = item.cells as Record<string, BaseCell>
    for (const [property, cell] of Object.entries(row.cells)) {
      if (length(cell) > Math.min(4000, budget / 4)) continue
      cells[property] = cell
    }
    rows.push(item)
    if (length(result) > budget - 250 && !consumed && result.columns) { delete result.columns; omitted.columns = evaluation.columns.length }
    if (length(result) > budget - 250) { rows.pop(); break }
    consumed++
  }
  omitted.rows = evaluation.rows.length - rows.length
  omitted.cells = evaluation.rows.reduce((sum, row) => sum + Object.keys(row.cells).length, 0) - rows.reduce((sum, row) => sum + Object.keys(row.cells as object).length, 0)
  for (const diagnostic of evaluation.diagnostics) {
    const list = result.diagnostics as unknown[]; list.push(diagnostic)
    if (length(result) > budget - 250) { list.pop(); break }
    omitted.diagnostics--
  }
  const summaries = result.summaries as Record<string, BaseCell>
  for (const [property, cell] of Object.entries(evaluation.summaries ?? {})) {
    summaries[property] = cell
    if (length(result) > budget - 250) { delete summaries[property]; continue }
    omitted.summaries--
  }
  for (const group of evaluation.groups ?? []) {
    const item = { key: group.key, row_ids: group.rows.map((row) => row.path), summaries: group.summaries }
    const groups = result.groups as unknown[]; groups.push(item)
    if (length(result) > budget - 250) { groups.pop(); continue }
    omitted.groups--
  }
  omitted.summaries += (evaluation.groups ?? []).reduce((sum, group) => sum + Object.keys(group.summaries).length, 0) - (result.groups as Array<{ summaries: object }>).reduce((sum, group) => sum + Object.keys(group.summaries).length, 0)
  if (offset + consumed < evaluation.rows.length) {
    if (!consumed) throw new Error('Base row exceeds the output budget. Increase max_characters.')
    result.next_after = cursor(fingerprint, offset + consumed, now)
  }
  if (length(result) > budget) throw new Error('Bases result exceeds the output budget. Increase max_characters.')
  return result
}
