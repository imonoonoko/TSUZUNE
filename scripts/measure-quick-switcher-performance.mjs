import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import electron from 'electron'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { arch, cpus, hostname, platform, release, totalmem, version } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const fixtureName = 'quick-switcher-10000-fixture'
const workRoot = resolve(repoRoot, 'work', fixtureName)
const fixture = resolve(workRoot, 'vault')
const userData = resolve(workRoot, 'user-data')
const outputDirectory = resolve(repoRoot, 'docs/reports/assets/quick-switcher-2026-08-17')
const output = resolve(outputDirectory, 'performance-result.json')
const sampleCount = 30
const warmupCount = 1

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

async function markdownDigest(root) {
  const paths = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) paths.push(path)
    }
  }
  await visit(root)
  paths.sort((a, b) => relative(root, a).localeCompare(relative(root, b), 'ja'))
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(relative(root, path).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(path))
    hash.update('\0')
  }
  return { fileCount: paths.length, sha256: hash.digest('hex') }
}

async function fileDigest(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function prepare() {
  await mkdir(workRoot, { recursive: true })
  await mkdir(outputDirectory, { recursive: true })
  const exists = await stat(fixture).then(() => true).catch((error) => error?.code === 'ENOENT' ? false : Promise.reject(error))
  if (!exists) run(process.execPath, ['scripts/generate-large-vault-fixture.mjs', '--count', '10000', '--output', fixture])
  const manifest = JSON.parse(await readFile(resolve(fixture, '.tsuzune-performance-fixture.json'), 'utf8'))
  if (manifest.noteCount !== 10000) throw new Error(`Expected 10000 notes, received ${manifest.noteCount}`)
  const before = await markdownDigest(fixture)
  if (before.sha256 !== manifest.markdownSha256) throw new Error('Fixture manifest digest mismatch')
  const userDataRelative = relative(workRoot, userData)
  if (!userDataRelative || userDataRelative.startsWith('..') || isAbsolute(userDataRelative)) {
    throw new Error(`Unsafe userData path: ${userData}`)
  }
  await rm(resolve(workRoot, 'error.txt'), { force: true })
  await rm(output, { force: true })
  await rm(userData, { recursive: true, force: true })
  await mkdir(userData, { recursive: true })
  await writeFile(resolve(userData, 'settings.json'), `${JSON.stringify({ lastVaultPath: fixture, lastNotePath: '00_Home.md' }, null, 2)}\n`)
  return {
    manifest,
    before,
    generatorSha256: await fileDigest(resolve(repoRoot, 'scripts/generate-large-vault-fixture.mjs'))
  }
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  return Number(sorted[index].toFixed(3))
}

async function runWorker() {
  const { app, BrowserWindow } = await import('electron')
  const originalLoadFile = BrowserWindow.prototype.loadFile
  let started = false
  process.env.TSUZUNE_HEADLESS_SMOKE = '1'
  app.commandLine.appendSwitch('disable-background-timer-throttling')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  app.setPath('userData', userData)

  const evaluate = (window, expression) => window.webContents.executeJavaScript(expression, true)
  const waitFor = async (window, selector) => evaluate(window, `new Promise((resolve, reject) => {
    const deadline = Date.now() + 300000
    const timer = setInterval(() => {
      if (document.querySelector(${JSON.stringify(selector)})) {
        clearInterval(timer)
        resolve(true)
      } else if (Date.now() > deadline) {
        clearInterval(timer)
        reject(new Error('Timed out waiting for ${selector}: ' + JSON.stringify({
          title: document.title,
          bodyText: document.body?.innerText?.slice(0, 1000) ?? '',
          appShell: Boolean(document.querySelector('.app-shell')),
          welcome: Boolean(document.querySelector('.welcome')),
          busy: document.querySelector('.app-shell')?.getAttribute('aria-busy')
        })))
      }
    }, 50)
  })`)
  const settle = (window) => evaluate(window, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  const querySet = [
    { type: 'japanese-content', query: '性能' },
    { type: 'path', query: '10_Notes/Group-50' },
    { type: 'duplicate-title-prefix', query: 'Performance Note' },
    { type: 'title', query: 'Note-0500' },
    { type: 'content', query: 'Markdown' }
  ]
  const queries = Array.from({ length: sampleCount / querySet.length }, () => querySet).flat()

  async function measure(window, type, query) {
    return evaluate(window, `(() => {
      const input = document.querySelector('.quick-switcher-input')
      if (!(input instanceof HTMLInputElement)) throw new Error('Quick Switcher input missing')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!setter) throw new Error('Native input value setter missing')
      const startedAt = performance.now()
      setter.call(input, ${JSON.stringify(query)})
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: ${JSON.stringify(query)}
      }))
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const first = document.querySelector('.quick-switcher-option-path')?.textContent?.trim() ?? null
        resolve({
          type: ${JSON.stringify(type)},
          query: ${JSON.stringify(query)},
          durationMs: performance.now() - startedAt,
          committed: input.value === ${JSON.stringify(query)},
          resultCount: document.querySelectorAll('.quick-switcher-option').length,
          firstResultPath: first
        })
      })))
    })()`)
  }

  async function runMeasurement(window) {
    window.setSkipTaskbar(true)
    window.setSize(1440, 900, false)
    window.setPosition(-32000, -32000, false)
    window.showInactive()
    await waitFor(window, '.workspace')
    await settle(window)
    const indexing = await evaluate(window, `({ coldOpenToWorkspaceReadyMs: performance.now() })`)
    const opener = await evaluate(window, `(() => { const button = document.querySelector('button[title="ノートを開く（Ctrl+O）"]'); if (!(button instanceof HTMLButtonElement)) throw new Error('Quick Switcher opener not found'); button.focus(); button.click(); return document.activeElement?.textContent?.trim() ?? null })()`)
    if (opener === null) throw new Error('Quick Switcher opener did not focus')
    await waitFor(window, '.quick-switcher-input')
    await settle(window)
    const warmup = []
    for (let index = 0; index < warmupCount; index += 1) {
      warmup.push(await measure(window, 'warmup', '検索準備'))
    }
    const samples = []
    for (const item of queries) samples.push(await measure(window, item.type, item.query))
    const durations = samples.map((sample) => sample.durationMs)
    const metrics = { sampleCount: durations.length, p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95), maxMs: Number(Math.max(...durations).toFixed(3)) }
    const deterministicOrdering = querySet.every(({ query }) => {
      const firstPaths = samples.filter((sample) => sample.query === query).map((sample) => sample.firstResultPath)
      return firstPaths.length === sampleCount / querySet.length && new Set(firstPaths).size === 1
    })
    const afterOpen = await evaluate(window, `({ dialog: Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')), input: document.activeElement?.className ?? null })`)
    const after = await evaluate(window, `(() => { document.querySelector('.quick-switcher-input')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true })()`)
    await settle(window)
    return {
      indexing,
      opener,
      warmup,
      warmupCount,
      querySet,
      repetitionsPerQuery: sampleCount / querySet.length,
      samples,
      metrics,
      deterministicOrdering,
      thresholdMs: 150,
      pass: metrics.p95Ms <= 150 && samples.every((sample) => sample.committed) &&
        deterministicOrdering && afterOpen.dialog && Boolean(after),
      afterOpen
    }
  }

  BrowserWindow.prototype.loadFile = function (...args) {
    const loaded = originalLoadFile.apply(this, args)
    if (!started) {
      started = true
      this.webContents.on('console-message', (_event, details) => {
        console.error(`[renderer:${details.level}] ${details.message}`)
      })
      void loaded.then(() => runMeasurement(this)).then(async (measurement) => {
        const after = await markdownDigest(fixture)
        await writeFile(output, `${JSON.stringify({ measurement, runtime: { node: process.versions.node, electron: process.versions.electron, chrome: process.versions.chrome }, after }, null, 2)}\n`)
        app.exit(0)
      }).catch(async (error) => { await writeFile(resolve(workRoot, 'error.txt'), String(error?.stack || error)); console.error(error); app.exit(1) })
    }
    return loaded
  }
  await import('../out/main/index.js')
}

async function main() {
  const prepared = await prepare()
  const gitHead = run('git', ['rev-parse', 'HEAD'])
  const gitStatus = run('git', ['status', '--porcelain', '--untracked-files=normal'])
  const child = spawn(electron, [import.meta.filename, '--worker'], {
    cwd: repoRoot,
    env: process.env,
    windowsHide: true,
    stdio: 'inherit'
  })
  await new Promise((resolvePromise, reject) => { child.once('error', reject); child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`Electron worker failed with code ${code}`))) })
  const result = JSON.parse(await readFile(output, 'utf8'))
  result.measuredAt = new Date().toISOString()
  result.scope = 'Quick Switcher committed query-to-double-requestAnimationFrame latency on a deterministic 10,000-note fixture'
  const cpuList = cpus()
  result.host = {
    hostname: hostname(),
    platform: platform(),
    release: release(),
    osVersion: version(),
    arch: arch(),
    cpuModel: cpuList[0]?.model ?? null,
    logicalCpuCount: cpuList.length,
    totalMemoryBytes: totalmem()
  }
  result.revision = {
    gitHead,
    dirty: gitStatus.length > 0,
    changedPathCount: gitStatus.split(/\r?\n/).filter(Boolean).length
  }
  result.fixture = {
    path: relative(repoRoot, fixture).replaceAll('\\', '/'),
    manifest: prepared.manifest,
    generatorSha256: prepared.generatorSha256,
    markdownDigestBefore: prepared.before,
    markdownDigestAfter: result.after
  }
  result.method = { isolatedUserData: relative(repoRoot, userData).replaceAll('\\', '/'), window: '1440x900, off-screen (-32000,-32000), skip taskbar, showInactive', input: 'real DOM input event dispatched to focused Quick Switcher search input', commitBoundary: 'React DOM candidate list or explicit empty state followed by double requestAnimationFrame', note: 'Current NoteDocument model exposes no aliases; alias matching was not measured or claimed.' }
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`)
  if (result.fixture.markdownDigestBefore.sha256 !== result.fixture.markdownDigestAfter.sha256) throw new Error('Fixture Markdown digest changed during measurement')
  if (!result.measurement.pass) {
    throw new Error(`Quick Switcher p95 threshold failed: ${result.measurement.metrics.p95Ms}ms`)
  }
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv.includes('--worker')) await runWorker()
else await main()
