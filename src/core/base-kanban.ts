import { inspectFrontmatterProperty } from './frontmatter'
import { readPropertyAsDeclared, transformProperty } from './property-changes'
import { isAiImmutablePath } from '../shared/ai-write-policy'
import { parseDeclaredPropertyTypes, type PropertyChangeOperation } from '../shared/property-changes'
import type { NoteDocument } from '../shared/types'
import type { BaseEvaluation } from './base-evaluator'
import type { BaseProfile } from './base-profile'

export interface KanbanMoveState {
  status: 'ready'
  profile: BaseProfile
  evaluation: BaseEvaluation
  notes?: NoteDocument[]
  declaredTypes?: Record<string, string>
  viewIndex?: number
}

/** Create a revision-previewable typed Property set for a drop onto a populated Kanban column. */
export function kanbanMove(state: KanbanMoveState, path: string, destination: number): Extract<PropertyChangeOperation, { kind: 'set' }> | null {
  if (!state.notes || state.notes.length > 10000) return null
  const view = (state.profile.views ?? [state.profile.view])[state.viewIndex ?? state.evaluation.viewIndex ?? 0] ?? state.profile.view
  const column = view.groupBy?.property
  if (view.type !== 'kanban' || !column || /^(file|formula)\./.test(column)) return null
  const property = column.replace(/^note\./, '')
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(property)) return null
  const groups = state.evaluation.groups
  const target = groups?.[destination]
  const origin = groups?.findIndex(group => group.rows.some(row => row.path === path)) ?? -1
  if (!target || target.rows.length === 0 || origin < 0 || origin === destination || target.key == null || target.key === '') return null

  const note = state.notes.find(item => item.path === path)
  const targetNote = state.notes.find(item => item.path === target.rows[0]?.path)
  if (!note || !targetNote || isAiImmutablePath(path) || path.split('/').some(part => part.startsWith('.')) ||
      isAiImmutablePath(targetNote.path) || targetNote.path.split('/').some(part => part.startsWith('.'))) return null

  const current = inspectFrontmatterProperty(note.content, property)
  const targetValue = inspectFrontmatterProperty(targetNote.content, property)
  if (!current.ok || !targetValue.ok || !targetValue.property) return null
  const rawType = state.declaredTypes?.[property] ?? state.profile.properties?.[`note.${property}`]?.type ?? state.profile.properties?.[property]?.type
  const declared = parseDeclaredPropertyTypes({ [property]: rawType })[property]
  if (rawType !== undefined && !declared) return null
  if (declared && current.property && readPropertyAsDeclared(current.property, declared)?.type !== declared) return null
  const value = declared ? readPropertyAsDeclared(targetValue.property, declared) : targetValue.property
  if (!value || declared && value.type !== declared) return null
  const operation: Extract<PropertyChangeOperation, { kind: 'set' }> = { kind: 'set', property, value }
  const transformed = transformProperty(note.content, operation)
  if (!transformed.ok || JSON.stringify(transformed.before) === JSON.stringify(transformed.after)) return null
  return operation
}
