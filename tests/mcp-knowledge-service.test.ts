import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { VaultMcpService } from '../src/mcp/service'

let root: string
let service: VaultMcpService
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'knowledge-service-'))
  await mkdir(join(root, '.tsuzune'))
  await mkdir(join(root, 'hidden'))
  await mkdir(join(root, '50_履歴'))
  await writeFile(join(root, '現在.md'), '# 現在\n[根拠](別ノート.md#消失した見出し)\n')
  await writeFile(join(root, '別ノート.md'), '# 別ノート\n確かめた本文。\n')
  await writeFile(join(root, 'hidden', '秘密.md'), '# 秘密\n[[現在]]')
  await writeFile(join(root, '50_履歴', '旧記録.md'), '# 旧記録\n[[現在]]')
  await writeFile(join(root, '表.base'), 'views: [{type: table, name: visible}]')
  await writeFile(join(root, 'hidden', '表.base'), 'views: [{type: table}]')
  await writeFile(join(root, '.tsuzune', 'path-aliases.json'), JSON.stringify({ '旧名.md': '現在.md' }))
  await writeFile(join(root, 'settings.json'), JSON.stringify({ lastVaultPath: root, userIgnoreFilters: ['hidden'] }))
  service = new VaultMcpService({ settingsPath: join(root, 'settings.json') })
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

it('canonicalizes duplicate seed aliases without writing creation metadata or settings', async () => {
  const path = join(root, 'settings.json'), original = await readFile(path), before = await stat(path)
  const result = await service.buildContextSet(['旧名.md', '現在.md', '別ノート.md'])
  expect(result.seeds.map((seed) => seed.id)).toEqual(['現在.md', '別ノート.md'])
  expect(result.included.filter((source) => source.path === '現在.md')).toHaveLength(1)
  expect(await readFile(path)).toEqual(original)
  expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
  await expect(stat(join(root, '.tsuzune', 'creation-times.json'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('rejects the whole comparison when any canonical seed is missing, hidden or history', async () => {
  await expect(service.buildContextSet(['現在.md', 'missing.md', 'hidden/秘密.md', '50_履歴/旧記録.md'])).rejects.toThrow(/missing.md.*hidden\/秘密.md.*50_履歴\/旧記録.md/s)
  await expect(service.buildContextSet(['../outside.md'])).rejects.toThrow()
})

it('counts an existing Markdown target despite a vanished heading and excludes hidden/history edges', async () => {
  const result = await service.getLocalGraph('旧名.md', { depth: 3 })
  expect(result.nodes.map((node) => node.id)).toEqual(['現在.md', '別ノート.md'])
  expect(result.edges).toEqual([{ source: '現在.md', target: '別ノート.md' }])
})

it('shares saved Base visibility and rejects explicit context outside the visible snapshot', async () => {
  expect((await service.listBases({})).bases).toEqual([expect.objectContaining({ id: '表.base' })])
  await expect(service.queryBase({ id: 'hidden/表.base' })).rejects.toThrow(/visible/)
  await expect(service.queryBase({ id: '表.base', context_note_id: 'hidden/秘密.md' })).rejects.toThrow()
})
