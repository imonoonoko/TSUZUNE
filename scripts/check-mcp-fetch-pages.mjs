import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const root = await mkdtemp(join(tmpdir(), 'tsuzune-fetch-pages-'))
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(process.env.TSUZUNE_MCP_SERVER_PATH ?? 'out/mcp/server.js'),
    '--vault', root, '--settings', join(root, 'settings.json'), '--fetch-page-characters', '4000'],
  stderr: 'pipe'
})
const client = new Client({ name: 'fetch-pages-check', version: '1.0.0' })
try {
  const original = `${'日'.repeat(3999)}🦞\n${'日本語\\"\t\n'.repeat(2900)}`
  await writeFile(join(root, '長文.md'), original, 'utf8')
  await client.connect(transport)
  let after = 0
  let restored = ''
  const revisions = new Set()
  for (let count = 0; count < 20; count += 1) {
    const result = await client.callTool({ name: 'fetch', arguments: { id: '長文.md', after } })
    assert(!result.isError)
    const page = result.structuredContent
    assert.deepEqual(JSON.parse(result.content[0].text), page)
    assert.equal(page.metadata.start_character, after)
    assert(page.text.length <= 4000)
    assert(page.text.isWellFormed())
    assert.equal(page.metadata.editable, true)
    revisions.add(page.metadata.revision)
    restored += page.text
    if (page.next_after === undefined) break
    assert(page.next_after > after)
    after = page.next_after
  }
  assert.equal(restored, original)
  assert.equal(revisions.size, 1)
  const missing = await client.callTool({ name: 'fetch', arguments: { id: 'missing.md' } })
  assert.equal(missing.isError, true)
  const outside = await client.callTool({ name: 'fetch', arguments: { id: '../outside.md' } })
  assert.equal(outside.isError, true)
  console.log('MCP bounded fetch: complete Unicode reconstruction, revision consistency, missing/outside denial PASS')
} finally {
  await client.close()
  await rm(root, { recursive: true, force: true })
}
