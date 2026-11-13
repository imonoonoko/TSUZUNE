import { inspectFrontmatterProperty } from './frontmatter'
import { readPropertyAsDeclared, transformProperty } from './property-changes'
import { isAiImmutablePath } from '../shared/ai-write-policy'
import { parseDeclaredPropertyTypes, type PropertyChangeOperation } from '../shared/property-changes'
import { dirnameRelative, validateRelativePath } from './paths'
import { baseValueEqual } from './base-expression'
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

export type KanbanFolderMoveState = KanbanMoveState & { revision?: string }

export interface KanbanFolderMoveIndex {
  state: KanbanFolderMoveState
  sourcePaths: Set<string>
  targetDirectories: Map<number, string>
  destinationDirectories: Set<string>
}

/** Validate the saved snapshot once so card and destination checks stay constant time. */
export function createKanbanFolderMoveIndex(state: KanbanFolderMoveState): KanbanFolderMoveIndex | null {
  if (!state.revision || !state.notes || state.notes.length > 10000) return null
  const view = (state.profile.views ?? [state.profile.view])[state.viewIndex ?? state.evaluation.viewIndex ?? 0] ?? state.profile.view
  if (view.type !== 'kanban' || view.groupBy?.property !== 'file.folder') return null
  const sourcePaths = new Set(state.notes.filter(note => !isAiImmutablePath(note.path) && !note.path.split('/').some(part => part.startsWith('.'))).map(note => note.path))
  const targetDirectories = new Map<number, string>()
  state.evaluation.groups?.forEach((target, index) => {
    if (!target.rows.length || view.groupBy?.hidden?.some(key => baseValueEqual(key, target.key))) return
    const directory = target.key === null ? '' : target.key
    if (typeof directory !== 'string' || (directory !== '' && (!validateRelativePath(directory).valid || isAiImmutablePath(directory) || directory.split('/').some(part => part.startsWith('.'))))) return
    if (!target.rows.every(row => dirnameRelative(row.path) === directory)) return
    targetDirectories.set(index, directory)
  })
  return { state, sourcePaths, targetDirectories, destinationDirectories: new Set(targetDirectories.values()) }
}

export function canMoveKanbanFolderPath(index: KanbanFolderMoveIndex | null, path: string): boolean {
  if (!index?.sourcePaths.has(path) || index.destinationDirectories.size === 0) return false
  if (index.destinationDirectories.size > 1) return true
  return !index.destinationDirectories.has(dirnameRelative(path))
}

/** Return a safe destination for a populated folder column in a saved Kanban snapshot. */
export function kanbanFolderMove(state: KanbanFolderMoveState, path: string, destination: number, index = createKanbanFolderMoveIndex(state)): string | null {
  if (!index || index.state !== state || !index.sourcePaths.has(path)) return null
  const directory = index.targetDirectories.get(destination)
  if (directory === undefined || dirnameRelative(path) === directory) return null
  return directory
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
