import { mkdtemp, writeFile, mkdir, rm, stat, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { VaultService } from '../src/main/vault'
import { evaluateBase } from '../src/core/base-evaluator'
import { listBases, queryBase } from '../src/mcp/bases'
import { resolveVaultSource } from '../src/mcp/vault-source'
import type { VaultSnapshot } from '../src/shared/types'
import type { BaseWorkerRequest } from '../src/mcp/base-worker-client'

let root: string; let vault: VaultService; let snapshot: VaultSnapshot
const evaluate = async (request: BaseWorkerRequest) => evaluateBase(request.profile, request.notes, request.viewIndex, request.options)
const note = (path: string, content: string) => ({ path, name: path, content, modifiedAt: 123, size: Buffer.byteLength(content) })
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mcp-bases-')); vault = new VaultService(); await vault.setRootPath(root)
  snapshot = { rootPath: root, rootName: 'test', directories: [], notes: [note('a.md', '---\nrank: 2\ngroup: A\ndate: "2026-10-01T01:00:00+09:00"\n---'), note('b.md', '---\nrank: 1\ngroup: A\n---')] }
  await writeFile(join(root, 'test.base'), 'formulas:\n  doubled: rank * 2\nviews:\n  - type: table\n    name: Ranks\n    order: [file.name, rank, formula.doubled, date]\n    sort: [{property: rank, direction: DESC}]\n    groupBy: {property: group, direction: ASC}\n    summaries: {rank: Sum}\n')
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
it('uses saved views/formulas/sorts/groups/types and preserves files', async () => {
  const before = await stat(join(root, 'test.base'))
  const output = await queryBase(vault, snapshot, [], { date: 'datetime' }, { id: 'test.base' }, evaluate)
  const rows = output.rows as Array<{ id: string; cells: Record<string, unknown> }>
  expect(rows.map((row) => row.id)).toEqual(['a.md', 'b.md'])
  expect(rows[0].cells['formula.doubled']).toEqual({ kind: 'value', value: 4 })
  expect(rows[0].cells.date).toEqual({ kind: 'value', value: { baseType: 'date', value: '2026-10-01T01:00:00+09:00' } })
  expect(output.summaries).toEqual({ rank: { kind: 'value', value: 3 } })
  expect(output.groups).toHaveLength(1)
  expect((await stat(join(root, 'test.base'))).mtimeMs).toBe(before.mtimeMs)
})
it('rejects changed snapshot, settings, base, context, and explicit time across pages', async () => {
  const first = await queryBase(vault, snapshot, [], {}, { id: 'test.base', limit: 1, now: 100 }, evaluate)
  const input = { id: 'test.base', limit: 1, after: first.next_after as string }
  const next = await queryBase(vault, snapshot, [], {}, input, evaluate)
  expect((next.rows as Array<{ id: string }>)[0].id).toBe('b.md')
  await expect(queryBase(vault, snapshot, [], { rank: 'text' }, input, evaluate)).rejects.toThrow('Restart')
  await expect(queryBase(vault, snapshot, [], {}, { ...input, now: 101 }, evaluate)).rejects.toThrow('Restart')
  await expect(queryBase(vault, snapshot, [], {}, { ...input, context_note_id: 'a.md' }, evaluate)).rejects.toThrow('Restart')
  await expect(queryBase(vault, { ...snapshot, notes: [note('a.md', 'changed')] }, [], {}, input, evaluate)).rejects.toThrow('Restart')
  await writeFile(join(root, 'test.base'), 'views: [{type: table}]')
  await expect(queryBase(vault, snapshot, [], {}, input, evaluate)).rejects.toThrow('Restart')
})
it('requires explicit this context and returns literal html/link data without rendering', async () => {
  await writeFile(join(root, 'test.base'), 'filters: file.path == this.file.path\nformulas:\n  markup: html("<b>safe data</b>")\nviews: [{type: table, order: [file.name, formula.markup]}]')
  await expect(queryBase(vault, snapshot, [], {}, { id: 'test.base' }, evaluate)).rejects.toThrow('context_note_id')
  const result = await queryBase(vault, snapshot, [], {}, { id: 'test.base', context_note_id: 'a.md' }, evaluate)
  expect(result.rows).toHaveLength(1)
  expect(JSON.stringify(result.rows)).toContain('<b>safe data</b>')
})
it('bounds huge cells and returns omission counts', async () => {
  snapshot.notes[0] = note('a.md', `---\nrank: 2\nlarge: "${'x'.repeat(100000)}"\n---`)
  await writeFile(join(root, 'test.base'), 'views: [{type: table, order: [file.name, large]}]\n# ' + 'x'.repeat(100000))
  const result = await queryBase(vault, snapshot, [], {}, { id: 'test.base', max_characters: 1000 }, evaluate)
  expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(1000)
  expect((result.omitted as { cells: number }).cells).toBeGreaterThan(0)
})
it('supports query pages up to 200 and scopes this dependencies to the selected view', async () => {
  await writeFile(join(root, 'test.base'), 'views:\n  - type: table\n    name: plain\n  - type: table\n    name: context\n    filters: file.path == this.file.path\n')
  expect((await queryBase(vault, snapshot, [], {}, { id: 'test.base', limit: 200 }, evaluate)).rows).toHaveLength(2)
  await expect(queryBase(vault, snapshot, [], {}, { id: 'test.base', view_index: 1 }, evaluate)).rejects.toThrow('context_note_id')
  const result = await listBases(vault, snapshot, [], { query: 'TEST', limit: 1, max_characters: 1000 })
  expect(result.bases).toHaveLength(1)
  expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(1000)
})
it('lists only visible saved Bases and reports malformed complex YAML', async () => {
  await mkdir(join(root, 'hidden')); await writeFile(join(root, 'hidden', 'secret.base'), 'views: [{type: table}]')
  await writeFile(join(root, 'bad.base'), 'views: &views [{type: table}]\nviews: *views')
  const result = await listBases(vault, snapshot, ['hidden'])
  expect((result.bases as Array<{ id: string }>).map((base) => base.id)).toEqual(['bad.base', 'test.base'])
  await expect(queryBase(vault, snapshot, ['hidden'], {}, { id: 'hidden/secret.base' }, evaluate)).rejects.toThrow('visible')
  expect((await queryBase(vault, snapshot, [], {}, { id: 'bad.base' }, evaluate)).diagnostics).toBeTruthy()
})
it('rejects a saved cursor when only registry creation time changes file.ctime sorting', async () => {
  await writeFile(join(root, 'test.base'), 'views: [{type: table, order: [file.name, file.ctime], sort: [{property: file.ctime, direction: ASC}]}]')
  snapshot.notes = snapshot.notes.map((note, index) => ({ ...note, createdAt: 1000 + index }))
  const first = await queryBase(vault, snapshot, [], {}, { id: 'test.base', limit: 1 }, evaluate)
  expect((first.rows as Array<{ id: string }>)[0].id).toBe('a.md')
  const input = { id: 'test.base', limit: 1, after: first.next_after as string }
  expect((await queryBase(vault, snapshot, [], {}, input, evaluate)).rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'b.md' })]))
  const changed = { ...snapshot, notes: snapshot.notes.map((note) => note.path === 'a.md' ? { ...note, createdAt: 2000 } : note) }
  expect(changed.notes[0].content).toBe(snapshot.notes[0].content)
  expect(changed.notes[0].modifiedAt).toBe(snapshot.notes[0].modifiedAt)
  await expect(queryBase(vault, changed, [], {}, input, evaluate)).rejects.toThrow('Restart the query')
  expect((await queryBase(vault, changed, [], {}, { id: 'test.base', limit: 1 }, evaluate)).rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'b.md' })]))
})
it('reads only explicit settings scope for fixture Vault property types using canonical realpath key', async () => {
  const settings = join(root, 'settings.json'); const key = resolve(await realpath(root)).replaceAll('\\', '/').toLowerCase()
  await writeFile(settings, JSON.stringify({ propertyTypesByVault: { [key]: { date: 'datetime', bad: 'bogus' } } }))
  const before = await stat(settings)
  expect((await resolveVaultSource({ explicitVaultPath: root })).propertyTypes).toEqual({})
  expect((await resolveVaultSource({ explicitVaultPath: root, settingsPath: settings })).propertyTypes).toEqual({ date: 'datetime' })
  expect((await stat(settings)).mtimeMs).toBe(before.mtimeMs)
})
