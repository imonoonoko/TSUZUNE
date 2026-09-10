import { describe, expect, it } from 'vitest'
import { evaluateBase } from '../src/core/base-evaluator'
import { parseBaseProfile, type BaseProfile } from '../src/core/base-profile'
import type { NoteDocument } from '../src/shared/types'

function note(
  path: string,
  content: string,
  values: Partial<Pick<NoteDocument, 'modifiedAt' | 'createdAt' | 'size'>> = {}
): NoteDocument {
  return {
    path,
    name: 'stale-name.md',
    content,
    modifiedAt: values.modifiedAt ?? 0,
    createdAt: values.createdAt ?? null,
    size: values.size ?? content.length
  }
}

function parsedProfile(source: string): BaseProfile {
  const result = parseBaseProfile(source)
  if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'profile parse failed')
  return result.profile
}

describe('evaluateBase', () => {
  it('keeps duplicate null property diagnostics in columns and filters', () => {
    const profile: BaseProfile = {
      filters: [],
      view: { type: 'table', name: 'Null diagnostics', filters: [], order: ['status'] }
    }
    const notes = [note('Duplicate.md', '---\nstatus: null\nstatus: null\n---\n')]
    const shown = evaluateBase(profile, notes)
    expect(shown.rows[0].cells.status).toMatchObject({ kind: 'diagnostic' })
    expect(shown.diagnostics).toHaveLength(1)
    const filtered = evaluateBase({
      ...profile,
      filters: [{ kind: 'comparison', property: 'status', operator: '!=', value: 'done' }]
    }, notes)
    expect(filtered.rows).toEqual([])
    expect(filtered.diagnostics).toHaveLength(1)
  })

  it('filters the normal snapshot and sorts values before missing cells', () => {
    const profile = parsedProfile(`
filters:
  and:
    - file.inFolder("10_プロジェクト")
    - file.ext == "md"
    - status == "active"
views:
  - type: table
    name: Active projects
    order:
      - file.name
      - status
      - updated
    sort:
      - property: updated
        direction: DESC
`)
    const notes = [
      note('10_プロジェクト/Bravo.md', '---\nstatus: active\nupdated: 10\n---\n', {
        modifiedAt: 20
      }),
      note('10_プロジェクト/Alpha.md', '---\nstatus: active\nupdated: 10\n---\n'),
      note('10_プロジェクト/No-date.md', '---\nstatus: active\n---\n'),
      note('10_プロジェクト/Old.md', '---\nstatus: paused\nupdated: 99\n---\n'),
      note('20_アーカイブ/Outside.md', '---\nstatus: active\nupdated: 100\n---\n')
    ]

    const result = evaluateBase(profile, notes)

    expect(result.scope).toBe('normal-discovery-snapshot')
    expect(result.targetCount).toBe(5)
    expect(result.excludedCount).toBe(2)
    expect(result.rows.map((row) => row.path)).toEqual([
      '10_プロジェクト/Alpha.md',
      '10_プロジェクト/Bravo.md',
      '10_プロジェクト/No-date.md'
    ])
    expect(result.rows[0]?.cells['file.name']).toEqual({ kind: 'value', value: 'Alpha' })
    expect(result.rows[0]?.cells.updated).toEqual({ kind: 'value', value: 10 })
    expect(result.rows[2]?.cells.updated).toEqual({ kind: 'missing' })
    expect(result.diagnostics).toEqual([])
  })

  it('maps file attributes from the normalized path and file metadata', () => {
    const profile: BaseProfile = {
      filters: [],
      view: {
        type: 'table',
        name: 'Attributes',
        filters: [],
        order: [
          'file.name',
          'file.basename',
          'file.path',
          'file.folder',
          'file.ext',
          'file.size',
          'file.mtime',
          'file.ctime'
        ]
      }
    }

    const result = evaluateBase(
      profile,
      [
        note('10_プロジェクト\\Alpha.md', 'body', {
          modifiedAt: 123,
          createdAt: 45,
          size: 42
        })
      ]
    )

    expect(result.rows[0]).toEqual({
      path: '10_プロジェクト/Alpha.md',
      cells: {
        'file.name': { kind: 'value', value: 'Alpha' },
        'file.basename': { kind: 'value', value: 'Alpha' },
        'file.path': { kind: 'value', value: '10_プロジェクト/Alpha.md' },
        'file.folder': { kind: 'value', value: '10_プロジェクト' },
        'file.ext': { kind: 'value', value: 'md' },
        'file.size': { kind: 'value', value: 42 },
        'file.mtime': { kind: 'value', value: 123 },
        'file.ctime': { kind: 'value', value: 45 }
      }
    })
  })

  it('does not coerce scalar types and keeps unsupported properties visible', () => {
    const profile: BaseProfile = {
      filters: [{ kind: 'comparison', property: 'status', operator: '==', value: 1 }],
      view: {
        type: 'table',
        name: 'Typed',
        filters: [],
        order: ['file.name', 'status', 'tags']
      }
    }
    const source = '---\nstatus: "1"\ntags: [one]\n---\n'

    const filtered = evaluateBase(profile, [note('Typed.md', source)])
    expect(filtered.rows).toEqual([])
    expect(filtered.excludedCount).toBe(1)

    const shown = evaluateBase({ ...profile, filters: [] }, [note('Typed.md', source)])
    expect(shown.rows[0]?.cells.status).toEqual({ kind: 'value', value: '1' })
    expect(shown.rows[0]?.cells.tags).toMatchObject({
      kind: 'diagnostic',
      code: 'UNSUPPORTED_PROPERTY'
    })
    expect(shown.diagnostics).toHaveLength(1)
  })

  it('matches official string and list contains filters without changing list columns', () => {
    const profile = parsedProfile(`
filters:
  and:
    - file.ext == "md"
    - file.ext.contains("md")
    - tags.contains("work")
    - status.contains("act")
views:
  - type: table
    name: Contains
    order:
      - file.name
      - tags
`)

    const result = evaluateBase(profile, [
      note('Match.md', '---\ntags: [work, home]\nstatus: active\n---\n'),
      note('Wrong-tag.md', '---\ntags: [home]\nstatus: active\n---\n'),
      note('Wrong-status.md', '---\ntags: [work]\nstatus: paused\n---\n')
    ])

    expect(result.rows.map((row) => row.path)).toEqual(['Match.md'])
    expect(result.rows[0]?.cells.tags).toMatchObject({
      kind: 'diagnostic',
      code: 'UNSUPPORTED_PROPERTY'
    })
    expect(result.diagnostics).toEqual([
      {
        code: 'UNSUPPORTED_PROPERTY',
        message: 'List properties are outside the fixed Bases profile.',
        path: 'Match.md',
        property: 'tags'
      }
    ])
  })

  it('normalizes date literals to snapshot millisecond metadata', () => {
    const profile = parsedProfile(`
filters:
  and:
    - file.ext == "md"
    - file.mtime > date("2025-01-01 00:00:00")
views:
  - type: table
    name: Recent
    order:
      - file.name
      - file.mtime
`)

    const result = evaluateBase(profile, [
      note('Old.md', '', { modifiedAt: Date.parse('2020-06-15T12:00:00Z') }),
      note('New.md', '', { modifiedAt: Date.parse('2026-06-15T12:00:00Z') })
    ])

    expect(result.rows.map((row) => row.path)).toEqual(['New.md'])
    expect(result.rows[0]?.cells['file.mtime']).toEqual({
      kind: 'value',
      value: Date.parse('2026-06-15T12:00:00Z')
    })
  })

  it('does not match missing, null, or empty values even for inequality filters', () => {
    const profile: BaseProfile = {
      filters: [{ kind: 'comparison', property: 'status', operator: '!=', value: 'done' }],
      view: { type: 'table', name: 'Empty', filters: [], order: ['file.name', 'status'] }
    }

    const result = evaluateBase(profile, [
      note('Empty.md', '---\nstatus: ""\n---\n'),
      note('Null.md', '---\nstatus: null\n---\n'),
      note('Missing.md', '---\nother: value\n---\n')
    ])

    expect(result.rows).toEqual([])
    expect(result.excludedCount).toBe(3)

    const shown = evaluateBase({ ...profile, filters: [] }, [
      note('Empty.md', '---\nstatus: ""\n---\n'),
      note('Null.md', '---\nstatus: null\n---\n'),
      note('Missing.md', '---\nother: value\n---\n')
    ])
    expect(shown.rows.map((row) => row.cells.status)).toEqual([
      { kind: 'empty' },
      { kind: 'empty' },
      { kind: 'missing' }
    ])
  })

  it('places non-value sort cells after values with a deterministic path fallback', () => {
    const profile: BaseProfile = {
      filters: [],
      view: {
        type: 'table',
        name: 'Sort missing values',
        filters: [],
        order: ['file.name', 'updated'],
        sort: { property: 'updated', direction: 'DESC' }
      }
    }

    const result = evaluateBase(profile, [
      note('10_プロジェクト/Null.md', '---\nupdated: null\n---\n'),
      note('10_プロジェクト/Missing.md', '---\nstatus: active\n---\n'),
      note('10_プロジェクト/Value.md', '---\nupdated: 10\n---\n'),
      note('10_プロジェクト/Empty.md', '---\nupdated: ""\n---\n'),
      note('10_プロジェクト/Second.md', '---\nupdated: 5\n---\n')
    ])

    expect(result.rows.map((row) => row.path)).toEqual([
      '10_プロジェクト/Value.md',
      '10_プロジェクト/Second.md',
      '10_プロジェクト/Empty.md',
      '10_プロジェクト/Missing.md',
      '10_プロジェクト/Null.md'
    ])
  })

  it('fails closed when the snapshot contains duplicate path IDs', () => {
    const profile: BaseProfile = {
      filters: [],
      view: { type: 'table', name: 'Duplicates', filters: [], order: ['file.name'] }
    }

    const result = evaluateBase(profile, [note('folder/A.md', ''), note('folder\\A.md', '')])

    expect(result.rows).toEqual([])
    expect(result.excludedCount).toBe(2)
    expect(result.diagnostics).toEqual([
      {
        code: 'DUPLICATE_PATH',
        path: 'folder/A.md',
        message: 'The snapshot contains the path more than once: folder/A.md.'
      }
    ])
  })
})
