import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HumanChangesService } from '../src/main/human-changes'
import { VaultService } from '../src/main/vault'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'
import type { BaseChangeInput } from '../src/shared/base-changes'
import type { MentionChangeInput } from '../src/shared/mention-changes'

const hash = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')
const baseContent = '\uFEFF# keep comment\r\nfuture: {setting: keep} # unknown preserved\r\nviews:\r\n  - type: table\r\n    name: Before # name comment\r\n    order: [file.name]\r\n'
const sourceContent = '\uFEFF# Source\r\n別名 と Target。\r\n'
const targetContent = '---\naliases: [別名]\n---\n# Target\n'
const roots: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-human-changes-'))
  roots.push(root)
  await Promise.all([writeFile(join(root, 'table.base'), baseContent), writeFile(join(root, 'Source.md'), sourceContent), writeFile(join(root, 'Target.md'), targetContent)])
  return root
}
async function fixture(filters: readonly string[] = []) {
  const root = await makeRoot()
  const vault = new VaultService()
  await vault.setRootPath(root)
  const scope = { rootPath: await canonicalWorkspaceVaultKey(root), rootRevision: vault.getRootRevision() }
  const service = new HumanChangesService(vault, async () => filters)
  const base: BaseChangeInput = { scope, path: 'table.base', expectedRevision: hash(baseContent), content: baseContent.replace('Before', 'After') }
  const from = sourceContent.indexOf('別名')
  const mention: MentionChangeInput = { scope, sourcePath: 'Source.md', targetPath: 'Target.md', expectedRevision: hash(sourceContent), range: { from, to: from + 2 }, text: '別名' }
  return { root, vault, scope, service, base, mention }
}
const error = (code: string) => ({ appError: { code } })

describe('HumanChangesService Bases writes', () => {
  it('previews without writing and atomically applies while preserving BOM, CRLF, comments and unknown settings', async () => {
    const { root, service, base } = await fixture()
    expect(await service.previewBase(base)).toEqual({ path: base.path, expectedRevision: base.expectedRevision, before: baseContent, after: base.content, changed: true })
    expect(await readFile(join(root, base.path), 'utf8')).toBe(baseContent)
    const saved = await service.applyBase(base)
    expect(saved.revision).toBe(hash(base.content))
    expect(await readFile(join(root, base.path), 'utf8')).toBe(base.content)
    expect((await readdir(root)).some(path => path.endsWith('.tmp'))).toBe(false)
  })
  it('reports an unchanged preview', async () => {
    const { service, base } = await fixture()
    expect((await service.previewBase({ ...base, content: baseContent })).changed).toBe(false)
  })
  it.each([
    ['root comment', (content: string) => content.replace('# keep comment', '')],
    ['inline comment', (content: string) => content.replace(' # name comment', '')],
    ['changed comment', (content: string) => content.replace('# name comment', '# different')]
  ])('rejects removal of %s through direct IPC preview', async (_label, transform) => {
    const { root, service, base } = await fixture()
    await expect(service.previewBase({ ...base, content: transform(base.content) })).rejects.toMatchObject(error('INVALID_PATH'))
    expect(await readFile(join(root, base.path), 'utf8')).toBe(baseContent)
  })
  it.each([
    ['view setting', (content: string) => content.replace('enabled: true', 'enabled: false')],
    ['property setting', (content: string) => content.replace('color: blue', 'color: red')],
    ['deleted property', (content: string) => content.replace(/^properties:.*\r\n/m, '')],
    ['sort setting', (content: string) => content.replace('nulls: first', 'nulls: last')],
    ['deleted extension view', (content: string) => content.replace(/  - type: table\r\n    name: Before[\s\S]*?(?=  - type: table)/, '')]
  ])('rejects changes to nested unknown %s', async (_label, transform) => {
    const { root, service, base } = await fixture()
    const content = baseContent + '    extension: {enabled: true}\r\n    sort: [{property: file.name, direction: ASC, nulls: first}]\r\n  - type: table\r\n    name: Second\r\nproperties: {status: {displayName: Status, custom: {color: blue}}}\r\n'
    await writeFile(join(root, base.path), content)
    await expect(service.applyBase({ ...base, expectedRevision: hash(content), content: transform(content) })).rejects.toMatchObject(error('INVALID_PATH'))
    expect(await readFile(join(root, base.path), 'utf8')).toBe(content)
  })
  it('allows supported edits and semantic key reorder while preserving nested extensions', async () => {
    const { root, service, base } = await fixture()
    const content = baseContent + '    extension: {enabled: true, color: blue}\r\nproperties: {status: {displayName: Status, custom: {color: blue, enabled: true}}}\r\n'
    await writeFile(join(root, base.path), content)
    const after = content.replace('Before', 'Renamed').replace('displayName: Status', 'displayName: New').replace('{enabled: true, color: blue}', '{color: blue, enabled: true}')
    expect((await service.previewBase({ ...base, expectedRevision: hash(content), content: after })).changed).toBe(true)
  })
  it('counts repeated comments and includes sequence and trailing comments', async () => {
    const { root, service, base } = await fixture()
    const content = baseContent + '    # repeated\r\n    limit: 3 # repeated\r\n# tail\r\n'
    await writeFile(join(root, base.path), content)
    for (const after of [content.replace('    # repeated\r\n', ''), content.replace('# tail', '')])
      await expect(service.previewBase({ ...base, expectedRevision: hash(content), content: after })).rejects.toMatchObject(error('INVALID_PATH'))
    expect((await service.previewBase({ ...base, expectedRevision: hash(content), content: content.replace('limit: 3', 'limit: 4') })).changed).toBe(true)
  })
  it('allows changing a quoted hash which is not a YAML comment', async () => {
    const { root, service, base } = await fixture()
    const content = baseContent.replace('Before # name comment', '"Before # text" # name comment')
    await writeFile(join(root, base.path), content)
    expect((await service.previewBase({ ...base, expectedRevision: hash(content), content: content.replace('# text', '# changed text') })).changed).toBe(true)
  })
  it.each(['[]\r\n', 'views: [not-a-mapping]\r\n', 'views: [{type: table}]\r\nproperties: {status: []}\r\n'])('rejects an invalid original structure without replacing it', async content => {
    const { root, service, base } = await fixture()
    await writeFile(join(root, base.path), content)
    await expect(service.applyBase({ ...base, expectedRevision: hash(content) })).rejects.toMatchObject(error('INVALID_PATH'))
    expect(await readFile(join(root, base.path), 'utf8')).toBe(content)
  })
  it.each([
    ['removed BOM', (content: string) => content.slice(1)],
    ['changed CRLF', (content: string) => content.replaceAll('\r\n', '\n')],
    ['unknown changed', (content: string) => content.replace('setting: keep', 'setting: changed')],
    ['unknown removed', (content: string) => content.replace(/^future:.*\r\n/m, '')],
    ['unknown added', (content: string) => content + 'unexpected: value\r\n'],
    ['duplicate key', (content: string) => content + 'views: []\r\n'],
    ['invalid profile', (content: string) => content.replace('type: table', 'type: unsupported')]
  ])('rejects %s and preserves source', async (_label, transform) => {
    const { root, service, base } = await fixture()
    await expect(service.applyBase({ ...base, content: transform(base.content) })).rejects.toMatchObject(error('INVALID_PATH'))
    expect(await readFile(join(root, base.path), 'utf8')).toBe(baseContent)
  })
  it('rejects a stale hash even when the external content remains valid', async () => {
    const { root, service, base } = await fixture()
    const external = baseContent.replace('Before', 'External')
    await writeFile(join(root, base.path), external)
    await expect(service.applyBase(base)).rejects.toMatchObject(error('FILE_CHANGED'))
    expect(await readFile(join(root, base.path), 'utf8')).toBe(external)
  })
  it('serializes two simultaneous writes from the same expected revision so one wins', async () => {
    const { root, service, base } = await fixture()
    const results = await Promise.allSettled([service.applyBase(base), service.applyBase({ ...base, content: base.content.replace('After', 'Other') })])
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(item => item.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject(error('FILE_CHANGED'))
    expect([base.content, base.content.replace('After', 'Other')]).toContain(await readFile(join(root, base.path), 'utf8'))
  })
  it('rejects a stale Vault scope', async () => {
    const { root, vault, service, base } = await fixture()
    await vault.setRootPath(await makeRoot())
    await expect(service.applyBase(base)).rejects.toMatchObject(error('FILE_CHANGED'))
    expect(await readFile(join(root, base.path), 'utf8')).toBe(baseContent)
  })
  it('catches a Vault switch while awaiting eligibility', async () => {
    const { root, vault, base } = await fixture()
    const other = await makeRoot()
    const service = new HumanChangesService(vault, async () => { await vault.setRootPath(other); return [] })
    await expect(service.applyBase(base)).rejects.toMatchObject(error('FILE_CHANGED'))
    for (const path of [root, other]) expect(await readFile(join(path, base.path), 'utf8')).toBe(baseContent)
  })
  it('catches a Vault switch during the final save read without replacing either source', async () => {
    const { root, vault, service, base } = await fixture()
    const other = await makeRoot()
    const original = vault.readBase.bind(vault)
    let reads = 0
    vi.spyOn(vault, 'readBase').mockImplementation(async path => {
      const result = await original(path)
      if (++reads === 3) await vault.setRootPath(other)
      return result
    })
    await expect(service.applyBase(base)).rejects.toMatchObject(error('FILE_CHANGED'))
    for (const path of [root, other]) expect(await readFile(join(path, base.path), 'utf8')).toBe(baseContent)
    expect((await readdir(root)).some(path => path.endsWith('.tmp'))).toBe(false)
  })
})

describe('HumanChangesService mention writes', () => {
  it('links the selected alias only and preserves surrounding source bytes', async () => {
    const { root, service, mention } = await fixture()
    await service.linkMention(mention)
    expect(await readFile(join(root, mention.sourcePath), 'utf8')).toBe(sourceContent.replace('別名', '[[Target|別名]]'))
  })
  it.each(['source', 'target'] as const)('rejects an excluded %s', async which => {
    const { root, service, mention } = await fixture([which === 'source' ? 'Source.md' : 'Target.md'])
    await expect(service.linkMention(mention)).rejects.toMatchObject(error('ACCESS_DENIED'))
    expect(await readFile(join(root, 'Source.md'), 'utf8')).toBe(sourceContent)
  })
  it.each(['40_情報源', '50_履歴'])('rejects immutable path %s', async directory => {
    const { root, service, mention } = await fixture()
    await mkdir(join(root, directory))
    await writeFile(join(root, directory, 'Source.md'), sourceContent)
    await expect(service.linkMention({ ...mention, sourcePath: `${directory}/Source.md` })).rejects.toMatchObject(error('ACCESS_DENIED'))
    await expect(service.linkMention({ ...mention, targetPath: `${directory}/Target.md` })).rejects.toMatchObject(error('ACCESS_DENIED'))
    expect(await readFile(join(root, directory, 'Source.md'), 'utf8')).toBe(sourceContent)
  })
  it('rejects an external revision, out-of-range occurrence and mismatched literal', async () => {
    const { root, service, mention } = await fixture()
    await expect(service.linkMention({ ...mention, range: { from: 1000, to: 1002 } })).rejects.toMatchObject(error('INVALID_PATH'))
    await expect(service.linkMention({ ...mention, text: '違う' })).rejects.toMatchObject(error('INVALID_PATH'))
    await writeFile(join(root, 'Source.md'), sourceContent + 'external')
    await expect(service.linkMention(mention)).rejects.toMatchObject(error('FILE_CHANGED'))
    expect(await readFile(join(root, 'Source.md'), 'utf8')).toBe(sourceContent + 'external')
  })
  it('rejects a chosen target with # rather than creating an unintended heading link', async () => {
    const { root, service, mention } = await fixture()
    await writeFile(join(root, 'Target#Part.md'), targetContent)
    await expect(service.linkMention({ ...mention, targetPath: 'Target#Part.md' })).rejects.toMatchObject(error('INVALID_PATH'))
    expect(await readFile(join(root, 'Source.md'), 'utf8')).toBe(sourceContent)
  })
  it('rechecks the exact source again at save after candidate validation', async () => {
    const { root, vault, service, mention } = await fixture()
    const original = vault.saveNote.bind(vault)
    vi.spyOn(vault, 'saveNote').mockImplementation(async input => {
      await writeFile(join(root, 'Source.md'), sourceContent + 'external')
      return original(input)
    })
    await expect(service.linkMention(mention)).rejects.toMatchObject(error('FILE_CHANGED'))
    expect(await readFile(join(root, 'Source.md'), 'utf8')).toBe(sourceContent + 'external')
  })
  it('rejects a Vault switch during note save before atomic replacement', async () => {
    const { root, vault, service, mention } = await fixture()
    const other = await makeRoot()
    const internal = vault as unknown as { assertNoSymlinkTraversal(path: string): Promise<void> }
    const original = internal.assertNoSymlinkTraversal.bind(vault)
    let saving = false
    const save = vault.saveNote.bind(vault)
    vi.spyOn(vault, 'saveNote').mockImplementation(input => { saving = true; return save(input) })
    vi.spyOn(internal, 'assertNoSymlinkTraversal').mockImplementation(async path => {
      await original(path)
      if (saving) { saving = false; await vault.setRootPath(other) }
    })
    await expect(service.linkMention(mention)).rejects.toMatchObject(error('FILE_CHANGED'))
    for (const path of [root, other]) expect(await readFile(join(path, 'Source.md'), 'utf8')).toBe(sourceContent)
  })
})
