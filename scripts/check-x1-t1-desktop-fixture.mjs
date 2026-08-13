import { createHash } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const fixturePath = resolve('work/x1-t1-desktop-fixture-2026-08-09-v2')
const seeds = [
  '10_プロジェクト/TSUZUNE.md',
  '10_プロジェクト/ONOKO・CodexAtelier・Forest Room.md',
  '10_プロジェクト/宵灯工房.md'
]
const questions = [
  ['現在動いているプロジェクトは何か。', '2026-08-09'],
  ['2026-07-22時点では何が動いていたか。', '2026-07-22'],
  ['再確認が必要な情報は何か。', '2026-08-09'],
  ['この状態を採用した根拠は何か。', '2026-08-09']
]

const digest = async (directory) => {
  const paths = []
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) paths.push(path)
    }
  }
  await visit(directory)
  const rows = await Promise.all(paths.sort().map(async (path) => {
    const content = await readFile(path)
    return `${relative(directory, path)}:${createHash('sha256').update(content).digest('hex')}`
  }))
  return createHash('sha256').update(rows.join('\n')).digest('hex')
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve('out/mcp/server.js'), '--vault', fixturePath]
})
const client = new Client({ name: 'tsuzune-x1-t1-desktop-fixture', version: '0.3.0' })

try {
  await client.connect(transport)
  for (const id of seeds) {
    await client.callTool({
      name: 'build_context',
      arguments: { id, query: questions[0][0], as_of: questions[0][1], max_characters: 50_000 }
    })
  }
  const before = await digest(fixturePath)
  const results = []
  for (const [query, as_of] of questions) {
    for (const id of seeds) {
      results.push(await client.callTool({
        name: 'build_context',
        arguments: { id, query, as_of, max_characters: 50_000 }
      }))
    }
  }
  if (results.some((result) => result.isError || JSON.stringify(result.content) !== '[]' || !result.structuredContent)) {
    throw new Error('Reconstructed fixture did not return structured-only build_context results.')
  }
  const after = await digest(fixturePath)
  if (before !== after) throw new Error('Fixture changed during read-only MCP validation.')
  console.log(JSON.stringify({
    fixture_sha256: before,
    calls: results.length,
    structured_only_calls: results.filter((result) => result.content.length === 0).length,
    seed_paths: seeds
  }))
} finally {
  await client.close().catch(() => undefined)
}
