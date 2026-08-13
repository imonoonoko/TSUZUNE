import { createHash } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const fixture = resolve(process.argv[2] ?? 'work/x1-t1-desktop-fixture-2026-08-09-v2')
const budget = Number(process.argv[3] ?? 4_000)
const scenarios = [
  { id: '10_プロジェクト/TSUZUNE.md', query: 'MCP' },
  { id: '10_プロジェクト/ONOKO・CodexAtelier・Forest Room.md', query: 'Forest' },
  { id: '10_プロジェクト/宵灯工房.md', query: '宵灯' }
]
const multiSourceScenario = {
  id: '10_プロジェクト/TSUZUNE.md',
  query: 'MCP',
  expected_paths: [
    '10_プロジェクト/TSUZUNE.md',
    '00_入口/TSUZUNE運用・開発資料.md',
    '30_知識/TSUZUNE現在地・証拠地図.md',
    '30_知識/TSUZUNE開発ロードマップ.md'
  ]
}

if (!Number.isInteger(budget) || budget < 1_000 || budget > 100_000) {
  throw new Error('Budget must be an integer from 1000 through 100000.')
}

const hash = (value) => createHash('sha256').update(value).digest('hex')
const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8')

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
  return hash((await Promise.all(paths.sort().map(async (path) =>
    `${relative(directory, path)}:${hash(await readFile(path))}`
  ))).join('\n'))
}

const measurementVault = await mkdtemp(join(tmpdir(), 'tsuzune-progressive-context-'))
await cp(fixture, measurementVault, { recursive: true, force: false })
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve('out/mcp/server.js'), '--vault', measurementVault]
})
const client = new Client({ name: 'tsuzune-progressive-context', version: '0.1.0' })

async function call(name, arguments_) {
  const started = performance.now()
  const result = await client.callTool({ name, arguments: arguments_ })
  if (result.isError || result.structuredContent === undefined) {
    throw new Error(`${name} failed.`)
  }
  return { value: result.structuredContent, latency_ms: performance.now() - started }
}

try {
  const before = await fixtureDigest(measurementVault)
  await client.connect(transport)
  const results = []

  for (const scenario of scenarios) {
    const search = await call('search', { query: scenario.query, limit: 10 })
    if (!search.value.results.some((result) => result.id === scenario.id)) {
      throw new Error(`Search did not reach expected source: ${scenario.id}`)
    }
    const fetch = await call('fetch', { id: scenario.id })
    const context = await call('build_context', {
      id: scenario.id,
      query: scenario.query,
      max_characters: budget
    })
    results.push({
      scenario,
      search_fetch: {
        calls: 2,
        response_utf8_bytes: bytes(search.value) + bytes(fetch.value),
        latency_ms: search.latency_ms + fetch.latency_ms,
        revision_present: typeof fetch.value.metadata.revision === 'string'
      },
      build_context: {
        calls: 1,
        response_utf8_bytes: bytes(context.value),
        latency_ms: context.latency_ms,
        included_paths: context.value.included.map((source) => source.path),
        omitted_ids: context.value.omitted_ids,
        markdown_chars: context.value.markdown.length
      }
    })
  }

  const temporalFetch = await call('fetch', { id: '10_プロジェクト/TSUZUNE.md' })
  const temporalContext = await call('build_context', {
    id: '10_プロジェクト/TSUZUNE.md',
    as_of: '2026-07-22',
    include_history: true,
    max_characters: budget
  })
  const temporalSeed = temporalContext.value.included.find(
    (source) => source.path === '10_プロジェクト/TSUZUNE.md'
  )
  const temporalWarningCodes = temporalContext.value.warnings.map((warning) => warning.code)
  if (
    temporalSeed?.content_omitted !== true ||
    !temporalWarningCodes.includes('UNSCOPED_NORMAL_CONTENT_OMITTED')
  ) {
    throw new Error('Temporal context did not omit unscoped current content.')
  }

  const multiSourceFetches = []
  for (const id of multiSourceScenario.expected_paths) {
    multiSourceFetches.push(await call('fetch', { id }))
  }
  const multiSourceContext = await call('build_context', {
    id: multiSourceScenario.id,
    query: multiSourceScenario.query,
    max_characters: budget
  })
  const multiSourceIncluded = multiSourceContext.value.included.map((source) => source.path)
  if (!multiSourceScenario.expected_paths.every((path) => multiSourceIncluded.includes(path))) {
    throw new Error('Multi-source context did not reach every expected source.')
  }

  const after = await fixtureDigest(measurementVault)
  if (before !== after) throw new Error('Progressive-context measurement modified its fixture copy.')
  console.log(JSON.stringify({
    fixture_sha256: before,
    source_fixture: relative(process.cwd(), fixture).replaceAll('\\', '/'),
    budget,
    results,
    temporal_safety: {
      as_of: '2026-07-22',
      direct_fetch: {
        calls: 1,
        response_utf8_bytes: bytes(temporalFetch.value),
        contains_current_body: temporalFetch.value.text.includes('active track: O0 / v0.6 Obsidian Graph Parity')
      },
      build_context: {
        calls: 1,
        response_utf8_bytes: bytes(temporalContext.value),
        seed_content_omitted: temporalSeed.content_omitted === true,
        warning_codes: temporalWarningCodes,
        included_paths: temporalContext.value.included.map((source) => source.path)
      }
    },
    multi_source: {
      scenario: multiSourceScenario,
      direct_fetches: {
        calls: multiSourceFetches.length,
        response_utf8_bytes: multiSourceFetches.reduce((total, fetch) => total + bytes(fetch.value), 0),
        revisions_present: multiSourceFetches.every(
          (fetch) => typeof fetch.value.metadata.revision === 'string'
        )
      },
      build_context: {
        calls: 1,
        response_utf8_bytes: bytes(multiSourceContext.value),
        included_paths: multiSourceIncluded,
        expected_sources_reached: true
      }
    },
    boundary: 'Measures MCP response size, calls, and local latency only. It does not measure answer quality, host-visible tokens, cost, or multi-source task success.'
  }, null, 2))
} finally {
  await client.close().catch(() => undefined)
  await rm(measurementVault, { recursive: true, force: true })
}
