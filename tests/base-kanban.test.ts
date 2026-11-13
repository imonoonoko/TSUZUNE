import { describe, expect, it } from 'vitest'
import { evaluateBase } from '../src/core/base-evaluator'
import { parseBaseProfile } from '../src/core/base-profile'
import type { NoteDocument } from '../src/shared/types'
import { kanbanMove, type KanbanMoveState } from '../src/core/base-kanban'

function state(notes: NoteDocument[], declaredTypes: Record<string, string> = {}): KanbanMoveState {
  const parsed = parseBaseProfile(`views:\n - type: kanban\n   name: Status\n   order: [file.name]\n   groupBy: {property: status, direction: DESC}\n`)
  if (!parsed.ok) throw new Error(parsed.diagnostics[0].message)
  return { status: 'ready', profile: parsed.profile, evaluation: evaluateBase(parsed.profile, notes, 0, { propertyTypes: declaredTypes }), notes, declaredTypes, viewIndex: 0 }
}
const note = (path: string, status: string): NoteDocument => ({ path, name: path, content: `---\nstatus: "${status}"\n---\n`, modifiedAt: 1, createdAt: null, size: 30 })

describe('Kanban typed card moves', () => {
  it('copies a typed destination property as a previewable set operation', () => {
    const current = state([note('A.md', 'open'), note('B.md', 'done')])
    expect(current.evaluation.groups?.map(group => group.key)).toEqual(['open', 'done'])
    expect(kanbanMove(current, 'A.md', 1)).toEqual({ kind: 'set', property: 'status', value: { type: 'text', value: 'done' } })
  })
  it('preserves the declared date type and rejects no-ops, empty columns, and invalid destinations', () => {
    const dated = state([note('A.md', '2026-11-13'), note('B.md', '2026-11-14')], { status: 'date' })
    expect(kanbanMove(dated, 'A.md', 0)).toEqual({ kind: 'set', property: 'status', value: { type: 'date', value: '2026-11-14' } })
    expect(kanbanMove(dated, 'A.md', 1)).toBeNull()
    const oneColumn = state([note('A.md', 'open')])
    expect(kanbanMove(oneColumn, 'A.md', 1)).toBeNull()
    expect(kanbanMove(oneColumn, 'missing.md', 0)).toBeNull()
  })
  it('refuses immutable source paths and non-editable file groups', () => {
    const hidden = state([note('.private/A.md', 'open'), note('B.md', 'done')])
    expect(kanbanMove(hidden, '.private/A.md', 1)).toBeNull()
    const parsed = parseBaseProfile('views:\n - {type: kanban, order: [file.name], groupBy: {property: file.folder}}\n')
    if (!parsed.ok) throw new Error(parsed.diagnostics[0].message)
    const notes = [note('A.md', 'open'), note('B.md', 'done')]
    const fileGroup: KanbanMoveState = { status: 'ready', profile: parsed.profile, evaluation: evaluateBase(parsed.profile, notes), notes, viewIndex: 0 }
    expect(kanbanMove(fileGroup, 'A.md', 1)).toBeNull()
  })
})
