import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  isValidPropertyDate,
  isValidPropertyDateTime,
  transformProperty
} from '../src/core/property-changes'
import { parseDeclaredPropertyTypes } from '../src/shared/property-changes'
import { PropertyChangesService } from '../src/main/property-changes'
import { VaultService } from '../src/main/vault'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'

const revisions = (content: string): string => createHash('sha256').update(content).digest('hex')

describe('property changes', () => {
  it('validates real calendar dates and ISO datetimes without normalizing the offset', () => {
    expect(isValidPropertyDate('2024-02-29')).toBe(true)
    expect(isValidPropertyDate('2023-02-29')).toBe(false)
    expect(isValidPropertyDateTime('2026-09-30T12:34:56.123+09:00')).toBe(true)
    expect(isValidPropertyDateTime('2026-09-30T12:34')).toBe(true)
    expect(isValidPropertyDateTime('2026-09-30T25:00Z')).toBe(false)
    expect(isValidPropertyDateTime('2026-09-30')).toBe(false)
  })

  it('renames only the key and preserves BOM, CRLF, comment, value and body', () => {
    const before = '\uFEFF---\r\nwhen: "2026-09-30T12:34:56.123+09:00" # keep\r\n---\r\n# Body\r\n'
    const result = transformProperty(before, { kind: 'rename', property: 'when', newName: 'occurred_at' })
    expect(result).toEqual({ ok: true, markdown: before.replace('when:', 'occurred_at:'),
      before: { type: 'text', value: '2026-09-30T12:34:56.123+09:00' },
      after: { type: 'text', value: '2026-09-30T12:34:56.123+09:00' } })
  })

  it('converts only representable values and keeps comments', () => {
    const before = '---\ncount: "12" # keep\n---\nBody'
    const result = transformProperty(before, { kind: 'convert', property: 'count', targetType: 'number' })
    expect(result.ok && result.markdown).toBe('---\ncount: 12 # keep\n---\nBody')
    expect(transformProperty('---\nvalues: [1, 2]\n---\n', { kind: 'convert', property: 'values', targetType: 'number' })).toMatchObject({ ok: false, issue: { code: 'CONVERSION_UNSAFE' } })
    expect(transformProperty('---\nwhen: "2026-09-30T12:00Z"\n---\n', { kind: 'convert', property: 'when', targetType: 'date' })).toMatchObject({ ok: false, issue: { code: 'CONVERSION_UNSAFE' } })
  })

  it('rejects malformed, duplicate, unsafe nested or colliding rename sources', () => {
    expect(transformProperty('---\na: 1\na: 2\n---\n', { kind: 'rename', property: 'a', newName: 'b' })).toMatchObject({ ok: false, issue: { code: 'DUPLICATE_PROPERTY' } })
    expect(transformProperty('---\na: 1\nb: 2\nb: 3\n---\n', { kind: 'rename', property: 'a', newName: 'c' })).toMatchObject({ ok: false, issue: { code: 'DUPLICATE_PROPERTY' } })
    expect(transformProperty('---\na: 1\nb: 2\n---\n', { kind: 'rename', property: 'a', newName: 'b' })).toMatchObject({ ok: false, issue: { code: 'DUPLICATE_PROPERTY' } })
    expect(transformProperty('---\na: &anchor value\n---\n', { kind: 'rename', property: 'a', newName: 'b' })).toMatchObject({ ok: false })
  })

  it('keeps malicious property registry keys inert', () => {
    const parsed = parseDeclaredPropertyTypes({ __proto__: 'text', constructor: 'date', when: 'datetime', other: 'unknown' })
    expect(Object.getPrototypeOf(parsed)).toBe(null)
    expect(parsed.when).toBe('datetime')
    expect(parsed.constructor).toBe('date')
    expect(Object.hasOwn(parsed, 'other')).toBe(false)
  })
})

describe('property change service', () => {
  const roots: string[] = []
  afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

  async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-properties-'))
    roots.push(root)
    await writeFile(join(root, 'a.md'), '---\ncount: "12"\n---\nA')
    await writeFile(join(root, 'b.md'), '---\ncount: "13"\n---\nB')
    const vault = new VaultService()
    await vault.setRootPath(root)
    const scope = { rootPath: await canonicalWorkspaceVaultKey(root), rootRevision: vault.getRootRevision() }
    const service = new PropertyChangesService(vault, () => [])
    const operation = { kind: 'convert' as const, property: 'count', targetType: 'number' as const }
    return { root, vault, scope, service, operation }
  }

  it('preflights all exact revisions before writing any selected note', async () => {
    const { root, scope, service, operation } = await fixture()
    const a = await readFile(join(root, 'a.md'), 'utf8')
    const preview = await service.preview({ scope, operation, paths: ['a.md', 'b.md'] })
    expect(preview.items.every((item) => !item.issue && item.expectedRevision && item.changed)).toBe(true)
    const applied = await service.apply({ scope, operation, targets: [
      { path: 'a.md', expectedRevision: revisions(a) },
      { path: 'b.md', expectedRevision: '0'.repeat(64) }
    ] })
    expect(applied).toMatchObject({ saved: [], failed: [{ path: 'b.md', code: 'FILE_CHANGED' }], notAttempted: ['a.md'] })
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe(a)
  })

  it('rejects protected paths and reports a mid-batch save failure without rollback', async () => {
    const { root, vault, scope, operation } = await fixture()
    await writeFile(join(root, 'c.md'), '---\ncount: "14"\n---\nC')
    const originalSave = vault.saveNote.bind(vault)
    let writes = 0
    vault.saveNote = async (input) => {
      writes += 1
      if (writes === 2) throw new Error('fixture failure')
      return originalSave(input)
    }
    const service = new PropertyChangesService(vault, () => ['hidden'])
    const preview = await service.preview({ scope, operation, paths: ['40_情報源/source.md', 'hidden.md', 'a.md', 'b.md', 'c.md'] })
    expect(preview.items.slice(0, 2).map((item) => item.issue?.code)).toEqual(['ACCESS_DENIED', 'ACCESS_DENIED'])
    const applied = await service.apply({ scope, operation, targets: preview.items.slice(2).map((item) => ({ path: item.path, expectedRevision: item.expectedRevision! })) })
    expect(applied).toMatchObject({ saved: ['a.md'], failed: [{ path: 'b.md', code: 'UNKNOWN' }], notAttempted: ['c.md'] })
    expect(await readFile(join(root, 'a.md'), 'utf8')).toContain('count: 12')
    expect(await readFile(join(root, 'b.md'), 'utf8')).toContain('count: "13"')
    expect(await readFile(join(root, 'c.md'), 'utf8')).toContain('count: "14"')
  })

  it('rejects a source edit that occurs between preflight and atomic save', async () => {
    const { root, vault, scope, operation } = await fixture()
    const service = new PropertyChangesService(vault, () => [])
    const preview = await service.preview({ scope, operation, paths: ['a.md', 'b.md'] })
    const originalSave = vault.saveNote.bind(vault)
    vault.saveNote = async (input) => {
      if (input.path === 'a.md') {
        await writeFile(join(root, 'a.md'), '---\ncount: "99"\n---\nExternal')
      }
      return originalSave(input)
    }
    const applied = await service.apply({ scope, operation, targets: preview.items.map((item) => ({ path: item.path, expectedRevision: item.expectedRevision! })) })
    expect(applied).toMatchObject({ saved: [], failed: [{ path: 'a.md', code: 'FILE_CHANGED' }], notAttempted: ['b.md'] })
    expect(await readFile(join(root, 'a.md'), 'utf8')).toContain('External')
  })
})
