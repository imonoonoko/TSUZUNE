import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { assertNoTreeMutation } from './mcp-readonly-integrity.mjs'
import { createKnowledgeFixture, resultOriginal } from './codex-knowledge-fixture.mjs'

const directory = await mkdtemp(join(tmpdir(), 'tsuzune-knowledge-flow-'))
const vault = join(directory, 'vault'), profile = join(directory, 'profile')
const server = resolve(process.env.TSUZUNE_MCP_SERVER_PATH ?? 'out/mcp/server.js')
await createKnowledgeFixture(vault)
await mkdir(profile)
const scopes = [{ name: 'Vault', path: vault }, { name: 'settings', path: profile }]
let client
async function connect() {
  const next = new Client({ name: 'knowledge-flow-check', version: '1.0' })
  await next.connect(new StdioClientTransport({ command: process.execPath, args: [server, '--vault', vault, '--settings', join(profile, 'settings.json')], stderr: 'pipe' }))
  return next
}
async function call(name, args, readOnly = true) {
  const perform = async () => {
    const result = await client.callTool({ name, arguments: args })
    assert.ok(!result.isError, JSON.stringify(result))
    assert.deepEqual(JSON.parse(result.content.find((item) => item.type === 'text').text), result.structuredContent)
    return result.structuredContent
  }
  return readOnly ? assertNoTreeMutation(scopes, perform, name) : perform()
}
try {
  client = await connect()
  const names = (await client.listTools()).tools.map((tool) => tool.name)
  for (const name of ['build_context_set', 'list_bases', 'query_base', 'get_local_graph','list_note_sections','fetch_note_section']) assert.ok(names.includes(name), name)
  const sections = await call('list_note_sections',{id:'比較結果.md'})
  const target=sections.sections.find(section=>section.heading==='保持欄')
  const exact=await call('fetch_note_section',{id:sections.id,section_id:target.section_id,expected_revision:sections.revision})
  assert.equal(exact.text,resultOriginal.slice(target.start_character,target.end_character))
  assert.equal(exact.source_reference.start_character,target.start_character)
  await assertNoTreeMutation(scopes,async()=>{
    const stale=await client.callTool({name:'fetch_note_section',arguments:{id:sections.id,section_id:target.section_id,expected_revision:'stale'}})
    assert.equal(stale.isError,true)
    assert.equal(stale.structuredContent,undefined)
  },'stale section revision')
  const bases = await call('list_bases', { query: '設計比較' })
  assert.equal(bases.bases[0].id, '設計比較.base')
  const table = await call('query_base', { id: bases.bases[0].id, view_index: 0 })
  assert.deepEqual(table.rows.map((row) => row.id), ['比較C.md', '比較A.md'])
  assert.equal(table.columns.find((column) => column.property === 'priority').origin, 'saved_property')
  const bundle = await call('build_context_set', { ids: table.rows.map((row) => row.id) })
  assert.equal(bundle.seeds.length, 2)
  assert.match(bundle.markdown, /同期競合の実装が必要/)
  assert.match(bundle.markdown, /通信なしで利用できる/)
  const graph = await call('get_local_graph', { id: '比較A.md', depth: 2, direction: 'outgoing' })
  assert.ok(graph.nodes.some((node) => node.id === '哲学.md' && node.distance === 2))
  const fetched = await call('fetch', { id: '比較結果.md' })
  const replacement = '比較Aは通信なしで使える。比較Cは同期競合が未実装。\n出典: [[比較A#根拠]]、[[比較C#根拠]]。'
  await call('patch_note', { id: fetched.id, expected_revision: fetched.metadata.revision, operations: [{ find: 'まだ比較していない。', replace: replacement }], source_refs: ['比較A.md', '比較C.md'] }, false)
  const saved = await readFile(join(vault, '比較結果.md'), 'utf8')
  assert.equal(saved, resultOriginal.replace('まだ比較していない。', replacement.replaceAll('\n', '\r\n')))
  await assertNoTreeMutation(scopes, async () => {
    const conflict = await client.callTool({ name: 'patch_note', arguments: { id: fetched.id, expected_revision: fetched.metadata.revision, operations: [{ find: 'この本文は変更しない。', replace: 'stale overwrite' }] } })
    assert.equal(conflict.isError, true)
  }, 'stale revision')
  await client.close()
  client = await connect()
  const resumed = await call('fetch', { id: '比較結果.md' })
  assert.notEqual(resumed.metadata.revision, fetched.metadata.revision)
  assert.match(resumed.text, /同期競合が未実装/)
  console.log('MCP knowledge flow PASS: real Worker/Base → context → graph → patch → conflict → separate-client resume; BOM/CRLF/comment/body preserved. Model-driven acceptance not performed.')
} finally {
  await client?.close()
  await rm(directory, { recursive: true, force: true })
}
