import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import { dirname, resolve } from 'node:path'
import electron from 'electron'

const repoRoot = resolve(import.meta.dirname, '..')

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function parseSizes(value = '500,2000') {
  const sizes = value.split(',').map((item) => Number.parseInt(item.trim(), 10))
  if (sizes.length === 0 || sizes.some((size) => !Number.isInteger(size) || size < 3)) {
    throw new Error('--sizesには3以上の整数をカンマ区切りで指定してください。')
  }
  return [...new Set(sizes)]
}

function positiveInteger(value, fallback, name) {
  const parsed = Number.parseInt(value ?? String(fallback), 10)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name}には1以上の整数を指定してください。`)
  }
  return parsed
}

async function run(command, args, timeoutMs) {
  await new Promise((resolvePromise, reject) => {
    let settled = false
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true
    })
    const watchdog = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(
        new Error(
          `${command} ${args.join(' ')} timed out after ${timeoutMs} ms`
        )
      )
    }, timeoutMs)

    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed: code=${code}, signal=${signal}`
        )
      )
    })
  })
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true
  })
  return result.status === 0 ? result.stdout.trim() : null
}

function round(value) {
  return Number(value.toFixed(4))
}

function summarize(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (sorted.length === 0) return undefined
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]
  return {
    sampleCount: sorted.length,
    min: round(sorted[0]),
    median: round(median),
    max: round(sorted.at(-1))
  }
}

function valueAtPath(value, path) {
  return path.reduce((current, key) => current?.[key], value)
}

function firstFiniteAtPaths(value, paths) {
  for (const path of paths) {
    const candidate = valueAtPath(value, path)
    if (Number.isFinite(candidate)) return candidate
  }
  return undefined
}

function aggregateCore(core) {
  const result = {}
  for (const [name, timing] of Object.entries(core.timingsMs ?? {})) {
    if (![timing?.min, timing?.p50, timing?.max].every(Number.isFinite)) continue
    result[name] = {
      sampleCount: timing.sampleRuns,
      min: timing.min,
      median: timing.p50,
      max: timing.max
    }
  }
  return result
}

const electronMetricPaths = {
  freshProfileWarmCacheOpenMs: [
    ['freshProfileWarmCacheOpen', 'loadFileToAppReadyMs'],
    ['coldOpen', 'loadFileToAppReadyMs']
  ],
  graphFirstUsableMs: [['graph', 'firstUsableMs']],
  editorInputDoubleRafMs: [['editorInput', 'doubleRafLatencyMs']],
  autosaveCompleteMs: [['editorInput', 'autosave', 'completedMs']],
  watcherAddVisibleMs: [['watcherBurst', 'addVisibleMs']],
  watcherRemoveVisibleMs: [['watcherBurst', 'removeVisibleMs']],
  animationFrameP50Ms: [['animationFrameCadence', 'p50Ms']],
  animationFrameP95Ms: [['animationFrameCadence', 'p95Ms']],
  animationFrameMaxMs: [['animationFrameCadence', 'maxMs']]
}

function aggregateElectron(trials) {
  return Object.fromEntries(
    Object.entries(electronMetricPaths).flatMap(([name, paths]) => {
      const aggregate = summarize(
        trials.map((trial) => firstFiniteAtPaths(trial, paths))
      )
      return aggregate ? [[name, aggregate]] : []
    })
  )
}

const sizes = parseSizes(argument('--sizes'))
const trialCount = positiveInteger(argument('--trials'), 3, '--trials')
const childTimeoutMs = positiveInteger(
  argument('--timeout-ms'),
  180000,
  '--timeout-ms'
)
const outputDirectory = resolve(
  argument('--output') ?? resolve(repoRoot, 'work', 'large-vault-performance')
)
await mkdir(outputDirectory, { recursive: true })

const measurements = []
for (const size of sizes) {
  const vault = resolve(outputDirectory, `vault-${size}`)
  const corePath = resolve(outputDirectory, `core-${size}.json`)

  await run(process.execPath, [
    'scripts/generate-large-vault-fixture.mjs',
    '--count',
    String(size),
    '--output',
    vault
  ], childTimeoutMs)
  const manifest = await readJson(
    resolve(vault, '.tsuzune-performance-fixture.json')
  )

  await run(process.execPath, [
    'scripts/run-measure-large-vault-core.mjs',
    '--vault',
    vault,
    '--output',
    corePath
  ], childTimeoutMs)
  const electronTrials = []
  for (let trial = 1; trial <= trialCount; trial += 1) {
    const electronPath = resolve(
      outputDirectory,
      `electron-${size}-trial-${trial}.json`
    )
    await run(electron, [
      'scripts/measure-large-vault-electron.mjs',
      '--vault',
      vault,
      '--output',
      electronPath,
      '--expected-notes',
      String(manifest.noteCount),
      '--expected-rendered-edges',
      String(manifest.renderedUndirectedPairCount)
    ], childTimeoutMs)
    electronTrials.push(await readJson(electronPath))
  }

  const core = await readJson(corePath)
  measurements.push({
    size,
    fixture: manifest,
    core,
    electronTrials,
    aggregate: {
      coreMs: aggregateCore(core),
      electronMs: aggregateElectron(electronTrials)
    }
  })
}

const gitStatus = capture('git', ['status', '--porcelain', '--untracked-files=normal'])
const firstElectronRuntime = measurements[0]?.electronTrials[0]?.runtime ?? {}
const cpuList = cpus()

const summaryPath = resolve(outputDirectory, 'summary.json')
await writeFile(
  summaryPath,
  `${JSON.stringify(
    {
      schemaVersion: 2,
      measuredAt: new Date().toISOString(),
      scope: 'TSUZUNE generated large-Vault performance baseline',
      trialCount,
      childTimeoutMs,
      revision: {
        gitHead: capture('git', ['rev-parse', 'HEAD']),
        gitDirty: gitStatus === null ? null : gitStatus.length > 0
      },
      runtime: {
        node: process.version,
        electron: firstElectronRuntime.electron ?? null,
        chrome: firstElectronRuntime.chrome ?? null
      },
      host: {
        platform: platform(),
        release: release(),
        arch: arch(),
        cpuModel: cpuList[0]?.model ?? null,
        logicalCpuCount: cpuList.length,
        totalMemoryBytes: totalmem()
      },
      conditions: {
        fixture: 'controlled sparse fixture, approximately degree 4',
        cache: 'warm OS cache; this is not a power-cycle cold-start measurement',
        electron:
          `${trialCount} independent temporary-copy and fresh-profile trials per size`
      },
      measurements
    },
    null,
    2
  )}\n`,
  'utf8'
)
process.stdout.write(`${summaryPath}\n`)
