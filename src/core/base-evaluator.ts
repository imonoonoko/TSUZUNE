import {
  inspectFrontmatterProperty,
  parseFrontmatter,
  type FrontmatterProperty
} from './frontmatter'
import {
  basenameRelative,
  dirnameRelative,
  isPathInsideOrEqual,
  withoutMarkdownExtension
} from './paths'
import type { NoteDocument } from '../shared/types'
import type {
  BaseComparisonOperator,
  BaseFilter,
  BaseProfile,
  BaseScalar
} from './base-profile'

export type BaseCell =
  | { kind: 'value'; value: BaseScalar }
  | { kind: 'missing' }
  | { kind: 'empty' }
  | { kind: 'diagnostic'; code: BaseEvaluationDiagnosticCode; message: string }

export type BaseEvaluationDiagnosticCode =
  | 'DUPLICATE_PATH'
  | 'MALFORMED_PROPERTY'
  | 'UNSUPPORTED_PROPERTY'

export interface BaseEvaluationDiagnostic {
  code: BaseEvaluationDiagnosticCode
  message: string
  path?: string
  property?: string
}

export interface BaseEvaluationRow {
  path: string
  cells: Record<string, BaseCell>
}

export interface BaseEvaluation {
  scope: 'normal-discovery-snapshot'
  columns: string[]
  targetCount: number
  excludedCount: number
  rows: BaseEvaluationRow[]
  diagnostics: BaseEvaluationDiagnostic[]
}

interface NoteContext {
  note: NoteDocument
  path: string
  cells: Map<string, BaseCell>
}

interface EvaluatedRow {
  row: BaseEvaluationRow
  sortCell?: BaseCell
}

function normalizedPath(path: string): string {
  return path.replaceAll('\\', '/')
}

function pathCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function diagnosticCell(
  code: BaseEvaluationDiagnosticCode,
  message: string
): BaseCell {
  return { kind: 'diagnostic', code, message }
}

function scalarCell(property: FrontmatterProperty): BaseCell {
  if (property.type === 'list') {
    return diagnosticCell(
      'UNSUPPORTED_PROPERTY',
      'List properties are outside the fixed Bases profile.'
    )
  }
  if (property.type === 'checkbox') return { kind: 'value', value: property.value }
  if (property.value === '') return { kind: 'empty' }
  if (property.type === 'number') {
    const value = Number(property.value)
    if (!Number.isFinite(value)) {
      return diagnosticCell('UNSUPPORTED_PROPERTY', 'The numeric property is not finite.')
    }
    return { kind: 'value', value }
  }
  return { kind: 'value', value: property.value }
}

function isNullLiteralProperty(markdown: string, name: string): boolean {
  const parsed = parseFrontmatter(markdown)
  if (!parsed.found || parsed.raw === null || parsed.attributes[name] !== null) return false
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const header = new RegExp(`^${escapedName}:[ \\t]*(null|~)[ \\t]*$`, 'mi')
  return header.test(parsed.raw)
}

function fileCell(note: NoteDocument, path: string, property: string): BaseCell {
  const name = basenameRelative(path)
  switch (property) {
    case 'file.name':
      return { kind: 'value', value: withoutMarkdownExtension(name) }
    case 'file.basename':
      return { kind: 'value', value: withoutMarkdownExtension(name) }
    case 'file.path':
      return { kind: 'value', value: path }
    case 'file.folder':
      return { kind: 'value', value: dirnameRelative(path) }
    case 'file.ext': {
      const separator = name.lastIndexOf('.')
      return {
        kind: 'value',
        value: separator < 0 ? '' : name.slice(separator + 1).toLowerCase()
      }
    }
    case 'file.size':
      return Number.isFinite(note.size)
        ? { kind: 'value', value: note.size }
        : { kind: 'missing' }
    case 'file.mtime':
      return Number.isFinite(note.modifiedAt)
        ? { kind: 'value', value: note.modifiedAt }
        : { kind: 'missing' }
    case 'file.ctime':
      return typeof note.createdAt === 'number' && Number.isFinite(note.createdAt)
        ? { kind: 'value', value: note.createdAt }
        : { kind: 'missing' }
    default:
      return diagnosticCell(
        'UNSUPPORTED_PROPERTY',
        `File property "${property}" is unsupported.`
      )
  }
}

function noteCell(note: NoteDocument, property: string): BaseCell {
  const inspection = inspectFrontmatterProperty(note.content, property)
  if (!inspection.ok) {
    if (inspection.code === 'NON_SCALAR_PROPERTY' && isNullLiteralProperty(note.content, property)) {
      return { kind: 'empty' }
    }
    const code: BaseEvaluationDiagnosticCode =
      inspection.code === 'MALFORMED_FRONTMATTER' || inspection.code === 'DUPLICATE_PROPERTY'
        ? 'MALFORMED_PROPERTY'
        : 'UNSUPPORTED_PROPERTY'
    return diagnosticCell(code, inspection.message)
  }
  if (inspection.property === null) return { kind: 'missing' }
  return scalarCell(inspection.property)
}

function resolveCell(context: NoteContext, property: string): BaseCell {
  const cached = context.cells.get(property)
  if (cached) return cached

  const cell = property.startsWith('file.')
    ? fileCell(context.note, context.path, property)
    : noteCell(context.note, property.startsWith('note.') ? property.slice(5) : property)
  context.cells.set(property, cell)
  return cell
}

function compareScalar(
  actual: BaseScalar,
  expected: BaseScalar,
  operator: BaseComparisonOperator
): boolean {
  if (typeof actual !== typeof expected) return false
  if (operator === '==' || operator === '!=') {
    return operator === '==' ? actual === expected : actual !== expected
  }
  if (typeof actual === 'boolean') return false
  if (operator === '>') return actual > expected
  if (operator === '<') return actual < expected
  if (operator === '>=') return actual >= expected
  return actual <= expected
}

function matchesFilter(context: NoteContext, filter: BaseFilter): boolean {
  if (filter.kind === 'inFolder') {
    return isPathInsideOrEqual(context.path, filter.folder)
  }
  if (filter.kind === 'contains') {
    const expected = filter.value
    if (filter.property.startsWith('file.')) {
      const cell = resolveCell(context, filter.property)
      return (
        cell.kind === 'value' &&
        typeof cell.value === 'string' &&
        typeof expected === 'string' &&
        cell.value.includes(expected)
      )
    }

    const property = filter.property.startsWith('note.')
      ? filter.property.slice(5)
      : filter.property
    const inspection = inspectFrontmatterProperty(context.note.content, property)
    if (!inspection.ok || inspection.property === null) return false
    if (inspection.property.type === 'list') {
      return inspection.property.value.some((atom) => {
        const actual = atom.type === 'number' ? Number(atom.value) : atom.value
        return typeof actual === typeof expected && actual === expected
      })
    }
    return (
      inspection.property.type === 'text' &&
      typeof expected === 'string' &&
      inspection.property.value.includes(expected)
    )
  }
  const cell = resolveCell(context, filter.property)
  return cell.kind === 'value' && compareScalar(cell.value, filter.value, filter.operator)
}

function cellCompare(left: BaseCell, right: BaseCell): number {
  if (left.kind !== 'value' || right.kind !== 'value') {
    if (left.kind === 'value') return -1
    if (right.kind === 'value') return 1
    return 0
  }
  if (typeof left.value !== typeof right.value) return 0
  if (typeof left.value === 'string' && typeof right.value === 'string') {
    return left.value.localeCompare(right.value)
  }
  if (typeof left.value === 'number' && typeof right.value === 'number') {
    return left.value - right.value
  }
  return Number(left.value) - Number(right.value)
}

function duplicatePathDiagnostics(notes: readonly NoteDocument[]): BaseEvaluationDiagnostic[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const note of notes) {
    const path = normalizedPath(note.path)
    if (seen.has(path)) duplicates.add(path)
    seen.add(path)
  }
  return [...duplicates].sort(pathCompare).map((path) => ({
    code: 'DUPLICATE_PATH',
    path,
    message: `The snapshot contains the path more than once: ${path}.`
  }))
}

export function evaluateBase(
  profile: BaseProfile,
  notes: readonly NoteDocument[]
): BaseEvaluation {
  const columns = [...profile.view.order]
  const duplicateDiagnostics = duplicatePathDiagnostics(notes)
  if (duplicateDiagnostics.length > 0) {
    return {
      scope: 'normal-discovery-snapshot',
      columns,
      targetCount: notes.length,
      excludedCount: notes.length,
      rows: [],
      diagnostics: duplicateDiagnostics
    }
  }

  const diagnostics: BaseEvaluationDiagnostic[] = []
  const diagnosticKeys = new Set<string>()
  const addDiagnostic = (
    context: NoteContext,
    property: string,
    cell: Extract<BaseCell, { kind: 'diagnostic' }>
  ): void => {
    const key = `${context.path}\u0000${property}\u0000${cell.code}\u0000${cell.message}`
    if (diagnosticKeys.has(key)) return
    diagnosticKeys.add(key)
    diagnostics.push({
      code: cell.code,
      message: cell.message,
      path: context.path,
      property
    })
  }

  const filterList = [...profile.filters, ...profile.view.filters]
  const evaluated: EvaluatedRow[] = []
  for (const note of notes) {
    const context: NoteContext = {
      note,
      path: normalizedPath(note.path),
      cells: new Map()
    }
    let included = true
    for (const filter of filterList) {
      if (filter.kind === 'comparison') {
        const cell = resolveCell(context, filter.property)
        if (cell.kind === 'diagnostic') addDiagnostic(context, filter.property, cell)
      }
      if (!matchesFilter(context, filter)) {
        included = false
        break
      }
    }
    if (!included) continue

    const cells: Record<string, BaseCell> = {}
    for (const property of columns) {
      const cell = resolveCell(context, property)
      cells[property] = cell
      if (cell.kind === 'diagnostic') addDiagnostic(context, property, cell)
    }
    let sortCell: BaseCell | undefined
    if (profile.view.sort) {
      sortCell = resolveCell(context, profile.view.sort.property)
      if (sortCell.kind === 'diagnostic') {
        addDiagnostic(context, profile.view.sort.property, sortCell)
      }
    }
    evaluated.push({ row: { path: context.path, cells }, sortCell })
  }

  if (profile.view.sort) {
    const direction = profile.view.sort.direction === 'DESC' ? -1 : 1
    evaluated.sort((left, right) => {
      const leftCell = left.sortCell ?? { kind: 'missing' as const }
      const rightCell = right.sortCell ?? { kind: 'missing' as const }
      if (leftCell.kind === 'value' && rightCell.kind !== 'value') return -1
      if (leftCell.kind !== 'value' && rightCell.kind === 'value') return 1
      const valueComparison = cellCompare(leftCell, rightCell)
      if (valueComparison !== 0) return valueComparison * direction
      return pathCompare(left.row.path, right.row.path)
    })
  }

  return {
    scope: 'normal-discovery-snapshot',
    columns,
    targetCount: notes.length,
    excludedCount: notes.length - evaluated.length,
    rows: evaluated.map(({ row }) => row),
    diagnostics
  }
}
