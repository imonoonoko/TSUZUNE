import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const sourceFixture = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(repoRoot, 'work/graph-gp6')
const captureRoot = resolve(workRoot, 'tsuzune-working-tree')
const vault = resolve(captureRoot, 'vault')
const userData = resolve(captureRoot, 'userdata')
const outputRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp6')
const outputDirectory = resolve(outputRoot, 'tsuzune-working-tree')
const screenshotPath = resolve(outputDirectory, '01-global-baseline.png')
const observationPath = resolve(
  outputDirectory,
  '01-global-baseline.observation.json'
)
const environmentPath = resolve(outputDirectory, 'environment.json')
const manifestPath = resolve(outputDirectory, 'manifest.json')
const originalLoadFile = BrowserWindow.prototype.loadFile
const viewport = { width: 1265, height: 768, deviceScaleFactor: 1 }
const expected = {
  markdownCount: 7,
  nodeCount: 8,
  directedLinkCount: 12,
  undirectedPairCount: 8
}
let captureStarted = false
let sourceFixtureBefore
let isolatedMarkdownBefore
let isolatedProtectedBefore
let sourceFingerprintBefore
let builtAppFingerprintBefore

function stage(message) {
  process.stderr.write(`[graph-gp6-working-tree] ${message}\n`)
}

function assertWithin(parent, candidate) {
  if (candidate !== parent && !candidate.startsWith(`${parent}${sep}`)) {
    throw new Error(`許可されたディレクトリ外です: ${candidate}`)
  }
}

function ordinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

async function listFiles(directory, options = {}) {
  const files = []
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name)
      const relativePath = relative(directory, path).replaceAll('\\', '/')
      if (options.ignoreTopLevel === relativePath.split('/')[0]) continue
      if (entry.isDirectory()) await visit(path)
      else if (!options.extension || extname(entry.name).toLowerCase() === options.extension) {
        files.push({ path, relativePath })
      }
    }
  }
  await visit(directory)
  return files.sort((left, right) => ordinal(left.relativePath, right.relativePath))
}

async function digestFiles(files) {
  const combined = createHash('sha256')
  for (const file of files) {
    combined.update(file.relativePath)
    combined.update('\0')
    combined.update(await readFile(file.path))
    combined.update('\0')
  }
  return {
    fileCount: files.length,
    combinedSha256: combined.digest('hex').toUpperCase()
  }
}

async function treeDigest(directory, options) {
  return digestFiles(await listFiles(directory, options))
}

async function selectedSourceDigest() {
  const selections = [
    'src',
    'package.json',
    'package-lock.json',
    'electron.vite.config.ts',
    'tsconfig.json',
    'tsconfig.node.json',
    'tsconfig.web.json'
  ]
  const files = []
  for (const selection of selections) {
    const path = resolve(repoRoot, selection)
    const info = await stat(path).catch(() => null)
    if (!info) continue
    if (info.isDirectory()) {
      for (const file of await listFiles(path)) {
        files.push({
          path: file.path,
          relativePath: `${selection}/${file.relativePath}`.replaceAll('\\', '/')
        })
      }
    } else {
      files.push({ path, relativePath: selection })
    }
  }
  files.sort((left, right) => ordinal(left.relativePath, right.relativePath))
  return digestFiles(files)
}

function git(command) {
  const result = spawnSync('git', command, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true
  })
  if (result.status !== 0) throw new Error(result.stderr || `git ${command.join(' ')} failed`)
  return result.stdout
}

function gitIdentity() {
  const status = git(['status', '--porcelain=v1', '-z'])
  return {
    head: git(['rev-parse', 'HEAD']).trim(),
    dirty: status.length > 0,
    changedEntryCount: status.split('\0').filter(Boolean).length,
    porcelainSha256: createHash('sha256').update(status).digest('hex').toUpperCase()
  }
}

function normalizeTarget(raw) {
  return raw.split('|', 1)[0].split('#', 1)[0].trim().replaceAll('\\', '/')
}

async function scanFixtureGraph(directory) {
  const markdownFiles = await listFiles(directory, { extension: '.md' })
  const notePaths = markdownFiles.map((file) => file.relativePath)
  const pathSet = new Set(notePaths)
  const byBasename = new Map()
  for (const path of notePaths) {
    const basename = path.split('/').at(-1).replace(/\.md$/i, '')
    const matches = byBasename.get(basename) ?? []
    matches.push(path)
    byBasename.set(basename, matches)
  }

  const links = []
  const seen = new Set()
  const unresolved = new Set()
  for (const file of markdownFiles) {
    const content = await readFile(file.path, 'utf8')
    for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      if (match.index > 0 && content[match.index - 1] === '!') continue
      const target = normalizeTarget(match[1])
      if (!target) continue
      const explicit = `${target.replace(/^\/+/, '').replace(/\.md$/i, '')}.md`
      let resolvedTarget = pathSet.has(explicit) ? explicit : null
      if (!resolvedTarget && !target.includes('/')) {
        const matches = byBasename.get(target.replace(/\.md$/i, '')) ?? []
        if (matches.length === 1) resolvedTarget = matches[0]
      }
      const targetPath = resolvedTarget ?? explicit
      const key = `${file.relativePath}\0${targetPath}`
      if (seen.has(key)) continue
      seen.add(key)
      if (!resolvedTarget) unresolved.add(targetPath)
      links.push({
        source: file.relativePath,
        target: targetPath,
        resolved: Boolean(resolvedTarget)
      })
    }
  }
  links.sort((left, right) => ordinal(`${left.source}\0${left.target}`, `${right.source}\0${right.target}`))
  const pairKeys = new Set(
    links.map(({ source, target }) => [source, target].sort(ordinal).join('\0'))
  )
  const nodes = [...notePaths, ...unresolved].sort(ordinal)
  return {
    markdownCount: markdownFiles.length,
    nodes,
    links,
    directedLinkCount: links.length,
    undirectedPairCount: pairKeys.size
  }
}

function assertExpectedStructure(structure) {
  const actual = {
    markdownCount: structure.markdownCount,
    nodeCount: structure.nodes.length,
    directedLinkCount: structure.directedLinkCount,
    undirectedPairCount: structure.undirectedPairCount
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`fixture構造が期待値と一致しません: ${JSON.stringify(actual)}`)
  }
}

async function prepare() {
  assertWithin(workRoot, captureRoot)
  assertWithin(outputRoot, outputDirectory)
  sourceFixtureBefore = await treeDigest(sourceFixture)
  sourceFingerprintBefore = await selectedSourceDigest()
  builtAppFingerprintBefore = await treeDigest(resolve(repoRoot, 'out'))
  await rm(captureRoot, { recursive: true, force: true })
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(userData, { recursive: true })
  await mkdir(outputDirectory, { recursive: true })
  await cp(sourceFixture, vault, { recursive: true })
  await writeFile(
    resolve(userData, 'settings.json'),
    `${JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2)}\n`,
    'utf8'
  )
  isolatedMarkdownBefore = await treeDigest(vault, { extension: '.md' })
  isolatedProtectedBefore = await treeDigest(vault, { ignoreTopLevel: '.tsuzune' })
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitForEditor(window) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + 30000
      const check = () => {
        if (document.querySelector('button.graph-view-entry') &&
            document.querySelector('.markdown-editor .cm-content')) {
          resolve(true)
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error('編集画面が30秒以内に準備できませんでした。'))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

async function installCanvasProbe(window) {
  return evaluate(
    window,
    `(() => {
      const state = { clickedAt: null, clearRectAt: [] }
      window.__tsuzuneGp6WorkingTree = state
      const original = CanvasRenderingContext2D.prototype.clearRect
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas?.classList?.contains('wiki-graph-edges')) {
          state.clearRectAt.push(performance.now())
        }
        return original.apply(this, args)
      }
      return true
    })()`
  )
}

async function openGraph(window) {
  const clicked = await evaluate(
    window,
    `(() => {
      const state = window.__tsuzuneGp6WorkingTree
      const button = document.querySelector('button.graph-view-entry')
      if (!state || !(button instanceof HTMLButtonElement)) return false
      state.clickedAt = performance.now()
      button.click()
      return true
    })()`
  )
  if (!clicked) throw new Error('Vault全体グラフを開けませんでした。')
}

async function waitForGraph(window, expectedNodes) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const expectedNodes = ${JSON.stringify(expectedNodes)}
      const deadline = performance.now() + 30000
      const inspect = () => {
        const root = document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]')
        const region = document.querySelector('.wiki-graph-canvas[aria-label="グラフキャンバス"]')
        const canvas = document.querySelector('canvas.wiki-graph-edges')
        const settingsPanel = document.querySelector('aside[aria-label="グラフ設定"]')
        const nodes = [...document.querySelectorAll('button.wiki-graph-node')]
        const nodeGeometry = nodes.map((node) => {
          const rect = node.getBoundingClientRect()
          return {
            path: node.title,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            finite: [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
              rect.width > 0 && rect.height > 0
          }
        })
        const paths = nodeGeometry.map((node) => node.path).sort()
        const expectedPaths = [...expectedNodes].sort()
        const state = window.__tsuzuneGp6WorkingTree
        const drewAfterClick = Boolean(state?.clearRectAt.some((time) => time >= state.clickedAt))
        return {
          usable: Boolean(root && region && canvas && settingsPanel &&
            paths.length === expectedPaths.length &&
            paths.every((path, index) => path === expectedPaths[index]) &&
            nodeGeometry.every((node) => node.finite) &&
            drewAfterClick && canvas.width > 0 && canvas.height > 0),
          root,
          region,
          canvas,
          nodeGeometry,
          drewAfterClick,
          state
        }
      }
      const check = () => {
        const value = inspect()
        if (value.usable) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const painted = inspect()
            const regionRect = painted.region.getBoundingClientRect()
            resolve({
              nodeGeometry: painted.nodeGeometry,
              finiteNodeGeometryCount: painted.nodeGeometry.filter((node) => node.finite).length,
              canvasFirstDrawAfterClick: painted.drewAfterClick,
              canvasDrawCountAfterClick: painted.state.clearRectAt.filter((time) => time >= painted.state.clickedAt).length,
              canvasGeometryEdgeCount: Number(painted.canvas.dataset.edgeCount ?? -1),
              settingsPanelVisible: Boolean(document.querySelector('aside[aria-label="グラフ設定"]')),
              canvas: {
                x: regionRect.x,
                y: regionRect.y,
                width: regionRect.width,
                height: regionRect.height,
                pixelWidth: painted.canvas.width,
                pixelHeight: painted.canvas.height
              }
            })
          }))
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error(JSON.stringify({
            message: 'グラフが30秒以内に使用可能になりませんでした。',
            actualNodes: value.nodeGeometry.map((node) => node.path),
            finite: value.nodeGeometry.filter((node) => node.finite).length,
            drewAfterClick: value.drewAfterClick,
            canvasEdgeCount: Number(value.canvas?.dataset.edgeCount ?? -1)
          })))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

async function waitForLayout(window) {
  return evaluate(
    window,
    `new Promise((resolve) => {
      const deadline = performance.now() + 10000
      let previous = null
      let stableSamples = 0
      const sample = () => {
        const current = [...document.querySelectorAll('button.wiki-graph-node')]
          .map((node) => {
            const rect = node.getBoundingClientRect()
            return { path: node.title, x: rect.x, y: rect.y }
          })
          .sort((left, right) => left.path.localeCompare(right.path))
        const maxMovement = previous
          ? Math.max(...current.map((node, index) =>
              Math.hypot(node.x - previous[index].x, node.y - previous[index].y)))
          : Infinity
        stableSamples = maxMovement < 0.25 ? stableSamples + 1 : 0
        previous = current
        if (stableSamples >= 3 || performance.now() >= deadline) {
          resolve({ settled: stableSamples >= 3, stableSamples, finalMaxMovement: maxMovement })
          return
        }
        setTimeout(sample, 100)
      }
      sample()
    })`
  )
}

async function runCapture(window) {
  let foregroundActivated = window.isFocused() || BrowserWindow.getFocusedWindow() === window
  window.on('focus', () => { foregroundActivated = true })
  window.setSkipTaskbar(true)
  window.setFocusable(false)
  window.setContentSize(viewport.width, viewport.height, false)
  window.setPosition(-32000, -32000, false)
  window.webContents.setZoomFactor(1)
  window.showInactive()
  window.setPosition(-32000, -32000, false)

  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3')
  await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: false
  })
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }]
  })

  const bounds = window.getBounds()
  const offscreen = bounds.x <= -30000 && bounds.y <= -30000
  if (!window.isVisible() || !offscreen || foregroundActivated || window.isFocused()) {
    throw new Error('背景安全なoff-screen BrowserWindowを準備できませんでした。')
  }

  await waitForEditor(window)
  await installCanvasProbe(window)
  const structure = await scanFixtureGraph(vault)
  assertExpectedStructure(structure)
  await openGraph(window)
  const graph = await waitForGraph(window, structure.nodes)
  if (graph.canvasGeometryEdgeCount !== expected.undirectedPairCount) {
    throw new Error(`Canvas geometry edge数が期待値と一致しません: ${graph.canvasGeometryEdgeCount}`)
  }
  const layout = await waitForLayout(window)
  const renderer = await evaluate(
    window,
    `(() => ({
      title: document.title,
      innerWidth,
      innerHeight,
      devicePixelRatio,
      lightMedia: matchMedia('(prefers-color-scheme: light)').matches,
      documentFocused: document.hasFocus(),
      graphLabel: document.querySelector('.wiki-graph-view')?.getAttribute('aria-label') ?? null,
      bodyBackground: getComputedStyle(document.body).backgroundColor
    }))()`
  )
  if (
    renderer.innerWidth !== viewport.width ||
    renderer.innerHeight !== viewport.height ||
    renderer.devicePixelRatio !== viewport.deviceScaleFactor ||
    !renderer.lightMedia
  ) {
    throw new Error(`viewport/themeが期待値と一致しません: ${JSON.stringify(renderer)}`)
  }

  const image = await window.webContents.capturePage({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height
  })
  const imageSize = image.getSize()
  if (image.isEmpty() || imageSize.width !== viewport.width || imageSize.height !== viewport.height) {
    throw new Error(`PNG寸法が期待値と一致しません: ${JSON.stringify(imageSize)}`)
  }
  const png = image.toPNG()
  await writeFile(screenshotPath, png)

  const sourceFixtureAfter = await treeDigest(sourceFixture)
  const isolatedMarkdownAfter = await treeDigest(vault, { extension: '.md' })
  const isolatedProtectedAfter = await treeDigest(vault, { ignoreTopLevel: '.tsuzune' })
  const sourceFingerprintAfter = await selectedSourceDigest()
  const builtAppFingerprintAfter = await treeDigest(resolve(repoRoot, 'out'))
  const unchanged = (before, after) =>
    before.fileCount === after.fileCount && before.combinedSha256 === after.combinedSha256
  const assertions = {
    viewportMatched: true,
    lightThemeMatched: true,
    backgroundSafe: !foregroundActivated && !window.isFocused() && !renderer.documentFocused,
    structureMatched: true,
    renderedNodeSetMatched: graph.finiteNodeGeometryCount === expected.nodeCount,
    canvasFirstDrawObserved: graph.canvasFirstDrawAfterClick,
    canvasGeometryPairsMatched: graph.canvasGeometryEdgeCount === expected.undirectedPairCount,
    settingsPanelVisibleByDefault: graph.settingsPanelVisible,
    sourceFixtureUnchanged: unchanged(sourceFixtureBefore, sourceFixtureAfter),
    isolatedMarkdownUnchanged: unchanged(isolatedMarkdownBefore, isolatedMarkdownAfter),
    isolatedProtectedFilesUnchanged: unchanged(isolatedProtectedBefore, isolatedProtectedAfter),
    productSourceUnchanged: unchanged(sourceFingerprintBefore, sourceFingerprintAfter),
    builtAppUnchangedDuringCapture: unchanged(builtAppFingerprintBefore, builtAppFingerprintAfter)
  }
  if (Object.values(assertions).some((value) => !value)) {
    throw new Error(`capture assertion failed: ${JSON.stringify(assertions)}`)
  }

  const gitState = gitIdentity()
  const screenshot = {
    path: relative(repoRoot, screenshotPath).replaceAll('\\', '/'),
    bytes: png.length,
    sha256: createHash('sha256').update(png).digest('hex').toUpperCase(),
    ...imageSize
  }
  const capturedAt = new Date().toISOString()
  const environment = {
    capturedAt,
    kind: 'TSUZUNE current dirty working-tree build',
    git: gitState,
    runtime: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch
    },
    fingerprints: {
      productSource: sourceFingerprintBefore,
      builtApp: builtAppFingerprintBefore
    },
    viewport
  }
  const observation = {
    capturedAt,
    title: renderer.title,
    vaultPath: vault,
    selectedBeforeGraph: '00_Home.md',
    renderedTheme: 'light',
    dimensions: { inner: { width: renderer.innerWidth, height: renderer.innerHeight }, devicePixelRatio: renderer.devicePixelRatio, windowBounds: bounds, canvas: graph.canvas },
    structure,
    rendering: { ...graph, layout, renderer },
    isolation: {
      userData,
      productionProfileTouched: false,
      visibleOffscreen: window.isVisible(),
      focusable: window.isFocusable(),
      foregroundActivated,
      offscreen
    },
    protectedData: {
      sourceFixture: { before: sourceFixtureBefore, after: sourceFixtureAfter },
      isolatedMarkdown: { before: isolatedMarkdownBefore, after: isolatedMarkdownAfter },
      isolatedProtectedFiles: { before: isolatedProtectedBefore, after: isolatedProtectedAfter }
    },
    fingerprints: environment.fingerprints,
    git: gitState,
    screenshot,
    expected,
    assertions,
    limitations: [
      'Directed and undirected link counts come from a deterministic scan of the isolated canonical fixture; the Canvas renderer intentionally exposes only deduplicated geometry pairs.',
      'Canvas evidence proves a first clearRect after graph entry and finite geometry for all eight expected nodes; it does not prove pixel identity with Obsidian.',
      'The force layout screenshot is a settled off-screen compositor sample, not an interaction or animation-performance benchmark.'
    ]
  }
  const manifest = {
    schemaVersion: 1,
    ok: true,
    capturedAt,
    artifacts: [
      relative(repoRoot, screenshotPath).replaceAll('\\', '/'),
      relative(repoRoot, observationPath).replaceAll('\\', '/'),
      relative(repoRoot, environmentPath).replaceAll('\\', '/')
    ],
    summary: { ...expected, screenshot },
    assertions
  }
  await writeFile(environmentPath, `${JSON.stringify(environment, null, 2)}\n`, 'utf8')
  await writeFile(observationPath, `${JSON.stringify(observation, null, 2)}\n`, 'utf8')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.setPath('userData', userData)
await prepare()

BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!captureStarted) {
    captureStarted = true
    void loaded
      .then(() => runCapture(this))
      .then(() => {
        this.destroy()
        app.exit(0)
      })
      .catch((error) => {
        if (!this.isDestroyed()) this.destroy()
        console.error(error)
        app.exit(1)
      })
  }
  return loaded
}

await import('../out/main/index.js')
