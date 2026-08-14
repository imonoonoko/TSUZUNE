import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  buildWikiGraph,
  type WikiGraph
} from '../src/core/graph'
import {
  createWikiGraphSimulation,
  DEFAULT_GRAPH_FORCE_SETTINGS,
  type WikiGraphSimulation
} from '../src/core/graph-layout'
import type { NoteDocument } from '../src/shared/types'

interface TimingSummary {
  warmupRuns: number
  sampleRuns: number
  min: number
  p50: number
  p95: number
  max: number
  samples: number[]
}

interface LoadedVault {
  notes: NoteDocument[]
  bytes: number
  loadMilliseconds: number
}

const DEFAULT_WARMUP_RUNS = 3
const DEFAULT_SAMPLE_RUNS = 10
let observationSink = 0

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function positiveIntegerArgument(name: string, fallback: number): number {
  const raw = argumentValue(name)
  if (raw === undefined) {
    return fallback
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return value
}

function round(value: number): number {
  return Number(value.toFixed(4))
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  const index = (sortedValues.length - 1) * ratio
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)
  const lower = sortedValues[lowerIndex]
  const upper = sortedValues[upperIndex]
  return lower + (upper - lower) * (index - lowerIndex)
}

function summarize(
  samples: readonly number[],
  warmupRuns: number
): TimingSummary {
  const sorted = [...samples].sort((left, right) => left - right)
  return {
    warmupRuns,
    sampleRuns: samples.length,
    min: round(sorted[0]),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted.at(-1) as number),
    samples: samples.map(round)
  }
}

function measure<T>(
  warmupRuns: number,
  sampleRuns: number,
  operation: () => T,
  observe: (value: T) => void
): TimingSummary {
  for (let index = 0; index < warmupRuns; index += 1) {
    observe(operation())
  }

  const samples: number[] = []
  for (let index = 0; index < sampleRuns; index += 1) {
    const startedAt = performance.now()
    const result = operation()
    samples.push(performance.now() - startedAt)
    observe(result)
  }
  return summarize(samples, warmupRuns)
}

function measureWithSimulation(
  graph: WikiGraph,
  warmupRuns: number,
  sampleRuns: number,
  iterations: number
): TimingSummary {
  const run = (): number => {
    const simulation = createWikiGraphSimulation(
      graph,
      DEFAULT_GRAPH_FORCE_SETTINGS
    )
    const startedAt = performance.now()
    simulation.tick(iterations)
    const elapsed = performance.now() - startedAt
    observationSink += simulation.alpha + simulation.nodes.length
    simulation.stop()
    return elapsed
  }

  for (let index = 0; index < warmupRuns; index += 1) {
    run()
  }

  const samples = Array.from({ length: sampleRuns }, run)
  return summarize(samples, warmupRuns)
}

async function listMarkdownPaths(root: string): Promise<string[]> {
  const paths: string[] = []

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, 'ja'))
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue
      }
      const absolutePath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolutePath)
      } else if (entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.md')) {
        paths.push(relative(root, absolutePath).replaceAll('\\', '/'))
      }
    }
  }

  await visit(root)
  return paths
}

async function loadVault(root: string): Promise<LoadedVault> {
  const startedAt = performance.now()
  const paths = await listMarkdownPaths(root)
  const notes = await Promise.all(
    paths.map(async (path): Promise<NoteDocument> => {
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

  return {
    notes,
    bytes: notes.reduce((sum, note) => sum + note.size, 0),
    loadMilliseconds: performance.now() - startedAt
  }
}

function observeGraph(graph: WikiGraph): void {
  observationSink += graph.nodes.length + graph.edges.length
}

function observeSimulation(simulation: WikiGraphSimulation): void {
  observationSink += simulation.nodes.length + simulation.alpha
  simulation.stop()
}

async function main(): Promise<void> {
  const vaultArgument = argumentValue('--vault')
  const outputArgument = argumentValue('--output')
  if (!vaultArgument || !outputArgument) {
    throw new Error(
      'Usage: node scripts/run-measure-large-vault-core.mjs --vault <directory> --output <result.json> [--warmups <count>] [--samples <count>]'
    )
  }

  const vaultPath = resolve(vaultArgument)
  const outputPath = resolve(outputArgument)
  const vaultInformation = await stat(vaultPath)
  if (!vaultInformation.isDirectory()) {
    throw new Error(`Vault is not a directory: ${vaultPath}`)
  }

  const warmupRuns = positiveIntegerArgument('--warmups', DEFAULT_WARMUP_RUNS)
  const sampleRuns = positiveIntegerArgument('--samples', DEFAULT_SAMPLE_RUNS)
  const loaded = await loadVault(vaultPath)
  const graph = buildWikiGraph(loaded.notes)

  const buildWikiGraphTiming = measure(
    warmupRuns,
    sampleRuns,
    () => buildWikiGraph(loaded.notes),
    observeGraph
  )
  const createSimulationTiming = measure(
    warmupRuns,
    sampleRuns,
    () => createWikiGraphSimulation(graph, DEFAULT_GRAPH_FORCE_SETTINGS),
    observeSimulation
  )
  const tick1Timing = measureWithSimulation(
    graph,
    warmupRuns,
    sampleRuns,
    1
  )
  const tick180Timing = measureWithSimulation(
    graph,
    warmupRuns,
    sampleRuns,
    180
  )

  const positionedSimulation = createWikiGraphSimulation(
    graph,
    DEFAULT_GRAPH_FORCE_SETTINGS
  )
  positionedSimulation.tick(180)
  const positionsTiming = measure(
    warmupRuns,
    sampleRuns,
    () => positionedSimulation.positions(),
    (positions) => {
      observationSink += positions.size
    }
  )
  const finalPositions = positionedSimulation.positions()
  positionedSimulation.stop()

  const finitePositionCount = [...finalPositions.values()].filter(
    ({ x, y }) => Number.isFinite(x) && Number.isFinite(y)
  ).length
  const result = {
    schemaVersion: 1,
    measurementScope: 'node-core-only',
    measuredAt: new Date().toISOString(),
    limitations: [
      'Does not measure Electron startup, renderer work, DOM nodes, Canvas drawing, file watching, or input latency.',
      'loadMarkdownMs measures this standalone Node reader, not the production Vault scanner.'
    ],
    input: {
      vaultPath,
      noteCount: loaded.notes.length,
      bytes: loaded.bytes,
      loadMarkdownMs: round(loaded.loadMilliseconds)
    },
    graph: {
      nodeCount: graph.nodes.length,
      directedEdgeCount: graph.edges.length,
      positionCount: finalPositions.size,
      finitePositionCount
    },
    configuration: {
      warmupRuns,
      sampleRuns,
      forceSettings: DEFAULT_GRAPH_FORCE_SETTINGS
    },
    timingsMs: {
      buildWikiGraph: buildWikiGraphTiming,
      createWikiGraphSimulation: createSimulationTiming,
      tick1: tick1Timing,
      tick180: tick180Timing,
      positions: positionsTiming
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    observationSink: round(observationSink)
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

await main()
