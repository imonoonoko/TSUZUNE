import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || !value) throw new Error(`Invalid argument: ${key ?? ''}`)
    args[key.slice(2)] = value
  }
  if (!args.vault || !args.corpus) {
    throw new Error('Usage: node scripts/run-search-evaluation.mjs --vault <path> --corpus <json> [--candidate baseline|token-and] [--holdout-sha256 <hex>] [--out <json>]')
  }
  return args
}

export async function loadSearchModule() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const output = await build({
    entryPoints: [join(repoRoot, 'src/core/search.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false
  })
  const source = Buffer.from(output.outputFiles[0].contents).toString('base64')
  return import(`data:text/javascript;base64,${source}`)
}

export function selectSearch(searchModule, candidate, split, holdoutHashMatches = false) {
  if (candidate === 'baseline') return searchModule.searchNotes
  if (candidate === 'token-and' || candidate === 'ranked') {
    if (split !== 'dev' && !holdoutHashMatches) {
      throw new Error(`Candidate ${candidate} requires an exact SHA-256 outside the development corpus`)
    }
    return candidate === 'ranked' ? searchModule.searchRendererRanked : searchModule.searchRendererNotes
  }
  throw new Error(`Unknown candidate: ${candidate}`)
}

async function loadNotes(vaultPath, root = vaultPath) {
  const notes = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolutePath = join(root, entry.name)
    const vaultPathName = relative(vaultPath, absolutePath).split(sep).join('/')
    if (entry.isDirectory()) {
      if (vaultPathName !== '50_履歴' && !vaultPathName.startsWith('50_履歴/')) {
        notes.push(...await loadNotes(vaultPath, absolutePath))
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const [content, metadata] = await Promise.all([readFile(absolutePath, 'utf8'), stat(absolutePath)])
      notes.push({
        path: vaultPathName,
        name: entry.name.replace(/\.md$/i, ''),
        content,
        modifiedAt: metadata.mtimeMs,
        size: metadata.size
      })
    }
  }
  return notes
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 0) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function metricsFor(rankedIds, relevance, requiredIds, k) {
  const top = rankedIds.slice(0, k)
  const relevantIds = Object.keys(relevance).filter((id) => relevance[id] > 0)
  const relevantInTop = top.filter((id) => relevance[id] > 0)
  const firstRelevantRank = top.findIndex((id) => relevance[id] > 0) + 1
  const gains = top.map((id, index) => ((2 ** (relevance[id] ?? 0)) - 1) / Math.log2(index + 2))
  const idealGains = Object.values(relevance)
    .sort((left, right) => right - left)
    .slice(0, k)
    .map((grade, index) => ((2 ** grade) - 1) / Math.log2(index + 2))
  const ideal = idealGains.reduce((sum, gain) => sum + gain, 0)
  return {
    recallAtK: relevantIds.length === 0 ? 1 : relevantInTop.length / relevantIds.length,
    precisionAtK: relevantInTop.length / k,
    mrrAtK: firstRelevantRank === 0 ? 0 : 1 / firstRelevantRank,
    ndcgAtK: ideal === 0 ? 1 : gains.reduce((sum, gain) => sum + gain, 0) / ideal,
    requiredPass: requiredIds.every((id) => top.includes(id))
  }
}

export function summarizeCases(cases) {
  return {
    caseCount: cases.length,
    hardGatePass: cases.every((item) => item.metrics.requiredPass),
    recallAtK: average(cases.map((item) => item.metrics.recallAtK)),
    precisionAtK: average(cases.map((item) => item.metrics.precisionAtK)),
    mrrAtK: average(cases.map((item) => item.metrics.mrrAtK)),
    ndcgAtK: average(cases.map((item) => item.metrics.ndcgAtK)),
    medianLatencyMs: median(cases.map((item) => item.latencyMs))
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const [searchModule, corpusBytes, notes] = await Promise.all([
    loadSearchModule(),
    readFile(resolve(args.corpus)),
    loadNotes(resolve(args.vault))
  ])
  const corpus = JSON.parse(corpusBytes.toString('utf8'))
  const corpusSha256 = createHash('sha256').update(corpusBytes).digest('hex')
  const k = corpus.k ?? 10
  if (!['dev', 'holdout', 'representative', 'confirm'].includes(corpus.split))
    throw new Error(`Invalid corpus split: ${corpus.split}`)
  if (corpus.cases.length === 0) throw new Error('Corpus has no cases')
  const candidate = args.candidate ?? 'baseline'
  const searchNotes = selectSearch(
    searchModule,
    candidate,
    corpus.split,
    args['holdout-sha256'] === corpusSha256
  )

  const cases = corpus.cases.map((item) => {
    const startedAt = performance.now()
    const rankedIds = searchNotes(notes, item.query).map((result) => result.path)
    const latencyMs = performance.now() - startedAt
    return {
      id: item.id,
      query: item.query,
      topIds: rankedIds.slice(0, k),
      latencyMs,
      metrics: metricsFor(rankedIds, item.relevance, item.requiredIds ?? [], k)
    }
  })
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    split: corpus.split,
    candidate,
    corpusSha256,
    k,
    noteCount: notes.length,
    tokenUsage: 'not_observable',
    summary: summarizeCases(cases),
    cases
  }
  const json = `${JSON.stringify(result, null, 2)}\n`
  if (args.out) await writeFile(resolve(args.out), json, 'utf8')
  process.stdout.write(json)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
