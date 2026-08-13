import { createHash } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const fixture = resolve(process.argv[2] ?? 'work/x1-t1-desktop-fixture-2026-08-09-v2')
const budgets = (process.argv[3] ?? '4000,6000,8000,15000')
  .split(',')
  .map((value) => Number(value))

if (budgets.some((value) => !Number.isInteger(value) || value < 1_000 || value > 100_000)) {
  throw new Error('Budgets must be comma-separated integers from 1000 through 100000.')
}

const scenarios = [
  { id: '10_プロジェクト/TSUZUNE.md', as_of: '2026-08-09' },
  { id: '10_プロジェクト/ONOKO・CodexAtelier・Forest Room.md', as_of: '2026-08-09' },
  { id: '10_プロジェクト/宵灯工房.md', as_of: '2026-08-09' },
  { id: '10_プロジェクト/TSUZUNE.md', as_of: '2026-07-22' }
]

const hash = (value) => createHash('sha256').update(value).digest('hex')
const canonical = (structured) => ({
  ...structured,
  markdown: structured.markdown.replace(/^Generated: .*$/m, 'Generated: <volatile>')
})

async function fixtureDigest(directory) {
  const paths = []
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) paths.push(path)
    }
  }
  await visit(directory)
  return hash(
    (await Promise.all(
      paths.sort().map(async (path) => `${relative(directory, path)}:${hash(await readFile(path))}`)
    )).join('\n')
  )
}

const measurementVault = await mkdtemp(join(tmpdir(), 'tsuzune-context-budget-'))
await cp(fixture, measurementVault, { recursive: true, force: false })

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve('out/mcp/server.js'), '--vault', measurementVault]
})
const client = new Client({ name: 'tsuzune-context-budget', version: '0.1.0' })

try {
  const before = await fixtureDigest(measurementVault)
  await client.connect(transport)
  const results = []

  for (const budget of budgets) {
    for (const scenario of scenarios) {
      const call = () => client.callTool({
        name: 'build_context',
        arguments: {
          ...scenario,
          max_characters: budget,
          include_history: true
        }
      })
      const [first, second] = await Promise.all([call(), call()])
      const structured = first.structuredContent
      const firstCanonical = JSON.stringify(canonical(structured))
      const secondCanonical = JSON.stringify(canonical(second.structuredContent))
      if (first.isError || second.isError || firstCanonical !== secondCanonical) {
        throw new Error(`Non-deterministic or failed result for ${scenario.id} at ${budget}.`)
      }
      results.push({
        budget,
        scenario,
        markdown_chars: structured.markdown.length,
        markdown_utf8_bytes: Buffer.byteLength(structured.markdown, 'utf8'),
        structured_utf8_bytes: Buffer.byteLength(JSON.stringify(structured), 'utf8'),
        canonical_markdown_sha256: hash(canonical(structured).markdown),
        included_paths: structured.included.map((source) => source.path),
        omitted_ids: structured.omitted_ids,
        warning_codes: structured.warnings.map((warning) => warning.code),
        deterministic: true
      })
    }
  }

  const after = await fixtureDigest(measurementVault)
  if (before !== after) throw new Error('Context-budget measurement modified its fixture copy.')

  console.log(JSON.stringify({
    fixture_sha256: before,
    source_fixture: relative(process.cwd(), fixture).replaceAll('\\', '/'),
    scenarios,
    budgets,
    results,
    boundary: 'This measures TSUZUNE Context determinism and size only; evaluate fixed-answer quality and host-visible token usage separately.'
  }, null, 2))
} finally {
  await client.close().catch(() => undefined)
  await rm(measurementVault, { recursive: true, force: true })
}
