import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBaseProfile } from '../src/core/base-profile'

const fixturePath = join(process.cwd(), 'tests/fixtures/bases/projects.base')

describe('parseBaseProfile', () => {
  it('parses the fixed table profile fixture', async () => {
    const result = parseBaseProfile(await readFile(fixturePath, 'utf8'))

    expect(result).toEqual({
      ok: true,
      profile: {
        filters: [
          { kind: 'inFolder', folder: '10_プロジェクト' },
          { kind: 'comparison', property: 'file.ext', operator: '==', value: 'md' },
          { kind: 'comparison', property: 'status', operator: '==', value: 'active' }
        ],
        view: {
          type: 'table',
          name: 'Active projects',
          filters: [],
          order: ['file.name', 'status', 'updated'],
          sort: { property: 'updated', direction: 'DESC' }
        }
      }
    })
  })

  it('keeps global and view filters separate while requiring Markdown rows', () => {
    const result = parseBaseProfile(`
filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Filtered
    filters:
      and:
        - priority >= 2
    order:
      - file.name
      - priority
`)

    expect(result).toEqual({
      ok: true,
      profile: {
        filters: [{ kind: 'comparison', property: 'file.ext', operator: '==', value: 'md' }],
        view: {
          type: 'table',
          name: 'Filtered',
          filters: [{ kind: 'comparison', property: 'priority', operator: '>=', value: 2 }],
          order: ['file.name', 'priority']
        }
      }
    })
  })

  it('accepts file.path as a file property reference', () => {
    const result = parseBaseProfile(`
filters:
  and:
    - file.path == "10_プロジェクト/Alpha.md"
    - file.ext == "md"
views:
  - type: table
    name: Path
    order:
      - file.name
      - file.path
`)

    expect(result).toMatchObject({
      ok: true,
      profile: {
        filters: [
          {
            kind: 'comparison',
            property: 'file.path',
            operator: '==',
            value: '10_プロジェクト/Alpha.md'
          },
          {
            kind: 'comparison',
            property: 'file.ext',
            operator: '==',
            value: 'md'
          }
        ],
        view: { order: ['file.name', 'file.path'] }
      }
    })
  })

  it('parses official contains functions and fixed date literals', () => {
    const result = parseBaseProfile(`
filters:
  and:
    - file.ext == "md"
    - file.ext.contains("md")
    - tags.contains("work")
    - file.mtime > date("2025-01-01 00:00:00")
views:
  - type: table
    name: Functions
    order:
      - file.name
`)

    expect(result).toEqual({
      ok: true,
      profile: {
        filters: [
          { kind: 'comparison', property: 'file.ext', operator: '==', value: 'md' },
          { kind: 'contains', property: 'file.ext', value: 'md' },
          { kind: 'contains', property: 'tags', value: 'work' },
          {
            kind: 'comparison',
            property: 'file.mtime',
            operator: '>',
            value: Date.parse('2025-01-01 00:00:00')
          }
        ],
        view: {
          type: 'table',
          name: 'Functions',
          filters: [],
          order: ['file.name']
        }
      }
    })
  })

  it.each([
    ['unknown view key', `views:\n  - type: table\n    name: X\n    limit: 10\n    order:\n      - file.name\n    filters:\n      and:\n        - file.ext == "md"\n`, 'UNSUPPORTED_BASE'],
    ['unsupported filter operator', `filters:\n  and:\n    - file.ext contains "md"\nviews:\n  - type: table\n    name: X\n    order:\n      - file.name\n`, 'UNSUPPORTED_BASE'],
    ['unsupported global function', `filters:\n  and:\n    - contains(file.ext, "md")\nviews:\n  - type: table\n    name: X\n    order:\n      - file.name\n`, 'UNSUPPORTED_BASE'],
    ['missing markdown filter', `views:\n  - type: table\n    name: X\n    order:\n      - file.name\n`, 'UNSUPPORTED_BASE'],
    ['malformed sort direction', `filters:\n  and:\n    - file.ext == "md"\nviews:\n  - type: table\n    name: X\n    order:\n      - file.name\n    sort:\n      - property: file.name\n        direction: ASC\n        direction: DESC\n`, 'MALFORMED_BASE']
  ])('returns a diagnostic for %s', (_name, source, code) => {
    const result = parseBaseProfile(source)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe(code)
  })

  it('does not evaluate arbitrary functions', () => {
    const result = parseBaseProfile(`
filters:
  and:
    - system("process.exit()")
views:
  - type: table
    name: X
    order:
      - file.name
`)

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNSUPPORTED_BASE' }]
    })
  })

  it.each(['file.size.contains(1)', 'file.mtime.contains(1)', 'file.ctime.contains(1)'])(
    'diagnoses unsupported numeric contains: %s', (expression) => {
      expect(parseBaseProfile(`filters:\n  and:\n    - file.ext == "md"\n    - ${expression}\nviews:\n  - type: table\n    name: X\n    order:\n      - file.name\n`))
        .toMatchObject({ ok: false, diagnostics: [{ code: 'UNSUPPORTED_BASE' }] })
    }
  )

  it.each(['2025-02-30 12:00:00', '2025-01-01', '2025-01-01T00:00:00Z'])(
    'rejects dates outside the fixed local-time format: %s', (date) => {
      expect(parseBaseProfile(`filters:\n  and:\n    - file.ext == "md"\n    - file.mtime > date("${date}")\nviews:\n  - type: table\n    name: X\n    order:\n      - file.name\n`))
        .toMatchObject({ ok: false, diagnostics: [{ code: 'MALFORMED_BASE' }] })
    }
  )
})
