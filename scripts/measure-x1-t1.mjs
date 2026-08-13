import { createHash } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { mkdtemp, mkdir, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const expected = process.argv.at(2)
if (expected !== 'legacy' && expected !== 'candidate') {
  throw new Error('Usage: node scripts/measure-x1-t1.mjs <legacy|candidate>')
}

const hash = (value) => createHash('sha256').update(value).digest('hex')
const canonical = (structured) => ({
  ...structured,
  markdown: structured.markdown.replace(/^Generated: .*$/m, 'Generated: <volatile>')
})
const fixtureDigest = async (directory, markdownOnly = false) => {
  const paths = []
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && (!markdownOnly || path.endsWith('.md'))) paths.push(path)
    }
  }
  await visit(directory)
  return hash(
    (await Promise.all(
      paths.sort().map(async (path) => `${relative(directory, path)}:${hash(await readFile(path))}`)
    )).join('\n')
  )
}
const p95 = (samples) => samples[Math.ceil(samples.length * 0.95) - 1]
const vaultPath = await mkdtemp(join(tmpdir(), 'tsuzune-x1-t1-'))
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve('out/mcp/server.js'), '--vault', vaultPath]
})
const client = new Client({ name: 'tsuzune-x1-t1', version: '0.3.0' })
const call = () => client.callTool({
  name: 'build_context',
  arguments: {
    id: 'Home.md', max_characters: 5_000, query: 'Local Markdown', as_of: '2026-08-11'
  }
})

try {
  await mkdir(join(vaultPath, 'Projects'))
  await writeFile(join(vaultPath, 'Home.md'), '# Home\n\nTSUZUNE MCP smoke test. [[Projects/TSUZUNE]]', 'utf8')
  await writeFile(join(vaultPath, 'Projects', 'TSUZUNE.md'), '# TSUZUNE\n\nLocal Markdown knowledge base.', 'utf8')
  const fixtureTime = new Date('2026-08-11T00:00:00.000Z')
  await Promise.all([
    utimes(join(vaultPath, 'Home.md'), fixtureTime, fixtureTime),
    utimes(join(vaultPath, 'Projects', 'TSUZUNE.md'), fixtureTime, fixtureTime)
  ])
  await client.connect(transport)
  for (let index = 0; index < 10; index += 1) await call()
  const fixtureBefore = await fixtureDigest(vaultPath, true)
  const vaultBefore = await fixtureDigest(vaultPath)
  const samples = []
  const results = []
  for (let index = 0; index < 30; index += 1) {
    const started = performance.now()
    results.push(await call())
    samples.push(performance.now() - started)
  }
  const first = results[0]
  const structured = first.structuredContent
  const expectedContent = expected === 'legacy'
    ? [{ type: 'text', text: JSON.stringify(structured, null, 2) }]
    : []
  const canonicalJson = JSON.stringify(canonical(structured))
  if (
    first.isError ||
    JSON.stringify(first.content) !== JSON.stringify(expectedContent) ||
    results.some((result) => JSON.stringify(canonical(result.structuredContent)) !== canonicalJson)
  ) {
    throw new Error(`Unexpected ${expected} build_context result shape or canonical nondeterminism.`)
  }
  const legacy = {
    content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured
  }
  const candidate = { content: [], structuredContent: structured }
  const wireBytes = (result) => Buffer.byteLength(
    JSON.stringify({ jsonrpc: '2.0', id: 'x1-t1', result }), 'utf8'
  )
  const [fixtureAfter, vaultAfter] = await Promise.all([
    fixtureDigest(vaultPath, true), fixtureDigest(vaultPath)
  ])
  if (fixtureBefore !== fixtureAfter || vaultBefore !== vaultAfter) {
    throw new Error('X1-T1 measurement modified its fixture Vault.')
  }
  console.log(JSON.stringify({
    expected,
    fixture_sha256: fixtureBefore,
    canonical_context_markdown_sha256: hash(canonical(structured).markdown),
    markdown_chars: structured.markdown.length,
    markdown_utf8_bytes: Buffer.byteLength(structured.markdown, 'utf8'),
    structured_utf8_bytes: Buffer.byteLength(JSON.stringify(structured), 'utf8'),
    legacy_wire_utf8_bytes: wireBytes(legacy),
    candidate_wire_utf8_bytes: wireBytes(candidate),
    p95_ms: p95(samples.sort((left, right) => left - right))
  }))
} finally {
  await client.close().catch(() => undefined)
  await rm(vaultPath, { recursive: true, force: true })
}
