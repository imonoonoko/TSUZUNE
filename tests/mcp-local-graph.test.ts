import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { VaultMcpService } from '../src/mcp/service'

let root: string, service: VaultMcpService
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-local-graph-'))
  await mkdir(join(root, '50_履歴'))
  for (const [path, body] of Object.entries({
    '起点.md': '# 起点\n[[B]] [別名](日本語%20空白.md#消失見出し)\n[[B]]\n',
    'B.md': '# B\n[[C]]\n', 'C.md': '# C\n[[D]] [[起点]]\n', 'D.md': '# D\n',
    '日本語 空白.md': '# 日本語\n', '入.md': '# 入\n[[起点]]\n',
    '50_履歴/秘密.md': '[[起点]]'
  })) await writeFile(join(root, path), body)
  service = new VaultMcpService({explicitVaultPath: root})
})
afterEach(async () => { await rm(root, {recursive:true,force:true}) })
it('uses shared Markdown/Wiki links, ignores missing headings and legacy history, preserves read-only state', async () => {
  const before = (await stat(root)).mtimeMs
  const graph = await service.getLocalGraph('起点.md')
  expect(graph.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['起点.md', 'B.md', '日本語 空白.md', '入.md', 'C.md']))
  expect(graph.nodes.some(n => n.id.startsWith('50_履歴'))).toBe(false)
  expect(graph.edges.filter(e => e.source === '起点.md' && e.target === 'B.md')).toHaveLength(1)
  expect(graph.nodes.every(n => /^sha256:/.test(n.revision))).toBe(true)
  expect((await stat(root)).mtimeMs).toBe(before)
  await expect(stat(join(root,'.tsuzune'))).rejects.toMatchObject({code:'ENOENT'})
})
it('tracks depth, direction and cycles without duplicate nodes', async () => {
  const one = await service.getLocalGraph('起点.md',{direction:'outgoing'})
  expect(one.nodes.some(n => n.id === '入.md')).toBe(false)
  expect(one.nodes.some(n => n.id === 'C.md')).toBe(false)
  const two = await service.getLocalGraph('起点.md',{direction:'outgoing',depth:2})
  expect(two.nodes.find(n=>n.id==='C.md')?.distance).toBe(2)
  expect(two.nodes.some(n=>n.id==='D.md')).toBe(false)
  const three = await service.getLocalGraph('起点.md',{direction:'outgoing',depth:3})
  expect(three.nodes.find(n=>n.id==='D.md')?.distance).toBe(3)
  expect(new Set(three.nodes.map(n=>n.id)).size).toBe(three.nodes.length)
  const incoming = await service.getLocalGraph('起点.md',{direction:'incoming'})
  expect(incoming.nodes.some(n=>n.id==='B.md')).toBe(false)
})
it('keeps nearest nodes first and reports excluded edges at the cap', async () => {
  const graph = await service.getLocalGraph('起点.md',{depth:3,max_nodes:2})
  expect(graph.nodes[0].distance).toBe(0)
  expect(graph.nodes[1].distance).toBe(1)
  expect(graph.omitted_nodes).toBeGreaterThan(0)
  expect(graph.omitted_edges).toBeGreaterThan(0)
  const ids = new Set(graph.nodes.map(n=>n.id))
  expect(graph.edges.every(e=>ids.has(e.source)&&ids.has(e.target))).toBe(true)
  await expect(service.getLocalGraph('50_履歴/秘密.md')).rejects.toThrow()
  await expect(service.getLocalGraph('../秘密.md')).rejects.toThrow()
})
it('adds neighbor edges only when requested', async () => {
  await writeFile(join(root,'B.md'),'[[日本語 空白]]')
  const plain = await service.getLocalGraph('起点.md',{direction:'outgoing'})
  expect(plain.edges.some(e=>e.source==='B.md')).toBe(false)
  const neighbor = await service.getLocalGraph('起点.md',{direction:'outgoing',neighbor_links:true})
  expect(neighbor.edges.some(e=>e.source==='B.md')).toBe(true)
})
