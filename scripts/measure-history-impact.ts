import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { buildWikiGraph, type WikiGraph } from '../src/core/graph'
import {
  createWikiGraphSimulation,
  DEFAULT_GRAPH_FORCE_SETTINGS
} from '../src/core/graph-layout'
import { extractWikiLinks, getBacklinks } from '../src/core/links'
import { searchNotes } from '../src/core/search'
import type { NoteDocument } from '../src/shared/types'

const HISTORY_PREFIX = '50_履歴/'
const SAMPLE_RUNS = 10
const WARMUP_RUNS = 3
let observationSink = 0

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function round(value: number): number {
  return Number(value.toFixed(4))
}

function summarize(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right)
  return {
    min: round(sorted[0]),
    p50: round(sorted[Math.floor(sorted.length / 2)]),
    max: round(sorted.at(-1) as number),
    samples: samples.map(round)
  }
}

function measure<T>(operation: () => T, observe: (value: T) => void) {
  for (let index = 0; index < WARMUP_RUNS; index += 1) observe(operation())
  const samples: number[] = []
  for (let index = 0; index < SAMPLE_RUNS; index += 1) {
    const startedAt = performance.now()
    const value = operation()
    samples.push(performance.now() - startedAt)
    observe(value)
  }
  return summarize(samples)
}

function measureSimulation(graph: WikiGraph) {
  return measure(
    () => {
      const simulation = createWikiGraphSimulation(
        graph,
        DEFAULT_GRAPH_FORCE_SETTINGS
      )
      simulation.tick(180)
      const count = simulation.nodes.length
      simulation.stop()
      return count
    },
    (count) => {
      observationSink += count
    }
  )
}

async function markdownPaths(root: string): Promise<string[]> {
  const paths: string[] = []
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, 'ja'))
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      const absolutePath = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(absolutePath)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        paths.push(relative(root, absolutePath).replaceAll('\\', '/'))
      }
    }
  }
  await visit(root)
  return paths
}

async function loadNotes(root: string, paths: string[]): Promise<NoteDocument[]> {
  return Promise.all(
    paths.map(async (path) => {
      const absolutePath = resolve(root, path)
      const [content, information] = await Promise.all([
        readFile(absolutePath, 'utf8'),
        stat(absolutePath)
      ])
      return {
        path,
        name: basename(path).replace(/\.md$/i, ''),
        content,
        modifiedAt: information.mtimeMs,
        createdAt: information.birthtimeMs,
        size: information.size
      }
    })
  )
}

function digest(notes: NoteDocument[]): string {
  const hash = createHash('sha256')
  for (const note of notes) {
    hash.update(note.path)
    hash.update('\0')
    hash.update(note.content)
    hash.update('\0')
  }
  return hash.digest('hex')
}

function noteSummary(notes: NoteDocument[]) {
  return {
    noteCount: notes.length,
    bytes: notes.reduce((sum, note) => sum + note.size, 0),
    wikiLinkOccurrences: notes.reduce(
      (sum, note) => sum + extractWikiLinks(note.content).length,
      0
    )
  }
}

function operationMetrics(notes: NoteDocument[]) {
  const graph = buildWikiGraph(notes)
  const backlinkTarget = notes.some(
    (note) => note.path === '10_プロジェクト/TSUZUNE.md'
  )
    ? '10_プロジェクト/TSUZUNE.md'
    : notes[0]?.path
  const queries = ['TSUZUNE', 'MCP', 'Graph', '更新']
  return {
    graph: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      buildMs: measure(
        () => buildWikiGraph(notes),
        (value) => {
          observationSink += value.nodes.length + value.edges.length
        }
      ),
      simulation180Ms: measureSimulation(graph)
    },
    backlinks: backlinkTarget
      ? {
          target: backlinkTarget,
          count: getBacklinks(backlinkTarget, notes).length,
          scanMs: measure(
            () => getBacklinks(backlinkTarget, notes),
            (value) => {
              observationSink += value.length
            }
          )
        }
      : null,
    search: {
      queries,
      resultCounts: Object.fromEntries(
        queries.map((query) => [query, searchNotes(notes, query).length])
      ),
      suiteMs: measure(
        () => queries.map((query) => searchNotes(notes, query).length),
        (value) => {
          observationSink += value.reduce((sum, count) => sum + count, 0)
        }
      )
    }
  }
}

function growth(history: NoteDocument[]) {
  const dates = history
    .map((note) => note.path.match(/50_履歴\/AI更新\/(\d{4}-\d{2}-\d{2})T/)?.[1])
    .filter((value): value is string => Boolean(value))
    .sort()
  if (dates.length === 0) return null
  const first = Date.parse(`${dates[0]}T00:00:00Z`)
  const last = Date.parse(`${dates.at(-1)}T00:00:00Z`)
  const observedDays = Math.max(1, Math.floor((last - first) / 86_400_000) + 1)
  const bytes = history.reduce((sum, note) => sum + note.size, 0)
  const bytesPerDay = bytes / observedDays
  const thresholdBytes = 10 * 1024 * 1024
  return {
    firstDateUtc: dates[0],
    lastDateUtc: dates.at(-1),
    observedDays,
    bytesPerDay: round(bytesPerDay),
    daysTo10MiBAtObservedRate: Math.max(
      0,
      Math.ceil((thresholdBytes - bytes) / bytesPerDay)
    ),
    caveat: 'One-off bulk organization days are included, so this is an upper-bound linear projection.'
  }
}

async function main(): Promise<void> {
  const vaultPath = resolve(argument('--vault') ?? '')
  const outputPath = resolve(argument('--output') ?? '')
  if (!argument('--vault') || !argument('--output')) {
    throw new Error('Usage: --vault <directory> --output <result.json>')
  }

  const paths = await markdownPaths(vaultPath)
  const fullLoadStartedAt = performance.now()
  const full = await loadNotes(vaultPath, paths)
  const fullLoadMs = performance.now() - fullLoadStartedAt
  const activePaths = paths.filter((path) => !path.startsWith(HISTORY_PREFIX))
  const activeLoadStartedAt = performance.now()
  const withoutHistory = await loadNotes(vaultPath, activePaths)
  const withoutHistoryLoadMs = performance.now() - activeLoadStartedAt
  const beforeDigest = digest(full)

  const result = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    scope: 'read-only production Vault history impact',
    vaultPath,
    boundaries: [
      'No production Vault files are created, changed, moved, or deleted.',
      'Node-core timings do not measure DOM or Canvas drawing.',
      'Load timings are warm-cache standalone reads, not Electron startup.'
    ],
    full: {
      ...noteSummary(full),
      loadMarkdownMs: round(fullLoadMs),
      operations: operationMetrics(full)
    },
    withoutHistory: {
      ...noteSummary(withoutHistory),
      loadMarkdownMs: round(withoutHistoryLoadMs),
      operations: operationMetrics(withoutHistory)
    },
    history: {
      ...noteSummary(full.filter((note) => note.path.startsWith(HISTORY_PREFIX))),
      growth: growth(full.filter((note) => note.path.startsWith(HISTORY_PREFIX)))
    },
    integrity: {
      beforeDigest,
      afterDigest: digest(await loadNotes(vaultPath, await markdownPaths(vaultPath)))
    },
    observationSink: round(observationSink)
  }
  Object.assign(result.integrity, {
    unchanged: result.integrity.beforeDigest === result.integrity.afterDigest
  })

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

await main()
