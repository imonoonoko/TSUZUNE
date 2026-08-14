import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  rmdir,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve
} from 'node:path'
import { performance } from 'node:perf_hooks'

const scriptStartedAt = performance.now()
const fixtureManifestName = '.tsuzune-performance-fixture.json'
const originalLoadFile = BrowserWindow.prototype.loadFile
let measurementStarted = false

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function integerArgument(name, minimum) {
  const value = Number.parseInt(argument(name) ?? '', 10)
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name}には${minimum}以上の整数が必要です。`)
  }
  return value
}

const vaultArgument = argument('--vault')
const outputArgument = argument('--output')

if (!vaultArgument || !outputArgument) {
  throw new Error(
    'Usage: electron scripts/measure-large-vault-electron.mjs ' +
      '--vault <generated-fixture> --output <directory-or-json> ' +
      '--expected-notes <count> --expected-rendered-edges <count>'
  )
}

const sourceFixturePath = resolve(vaultArgument)
const expectedNotes = integerArgument('--expected-notes', 1)
const expectedRenderedEdges = integerArgument('--expected-rendered-edges', 0)
const resolvedOutput = resolve(outputArgument)
const outputIsJson = extname(resolvedOutput).toLowerCase() === '.json'
const resultPath = outputIsJson
  ? resolvedOutput
  : resolve(resolvedOutput, 'measurement.json')
const screenshotPath = outputIsJson
  ? resolve(
      dirname(resolvedOutput),
      `${resolvedOutput.slice(dirname(resolvedOutput).length + 1, -5)}.png`
    )
  : resolve(resolvedOutput, 'graph.png')
const outputDirectory = dirname(resultPath)
const temporaryRoot = await mkdtemp(join(tmpdir(), 'tsuzune-large-vault-'))
const vault = resolve(temporaryRoot, 'measurement-vault')
const userDataDirectory = resolve(temporaryRoot, 'user-data')
const burstDirectory = resolve(
  vault,
  `99_TSUZUNE_Performance_Burst_${process.pid}`
)
const burstPaths = Array.from({ length: 20 }, (_, index) =>
  resolve(burstDirectory, `Burst-${String(index + 1).padStart(2, '0')}.md`)
)
let fixtureBefore = null
let sourceFixtureBefore = null
let manifest = null
let homePath = null
let originalHomeContent = null

function stage(message) {
  process.stderr.write(`[large-vault-electron] ${message}\n`)
}

function isInside(parent, candidate) {
  const path = relative(parent, candidate)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

async function listMarkdownFiles(directory = vault) {
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...(await listMarkdownFiles(path)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      paths.push(path)
    }
  }
  return paths.sort((left, right) => left.localeCompare(right, 'ja'))
}

async function listAllFiles(directory) {
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...(await listAllFiles(path)))
    } else if (entry.isFile()) {
      paths.push(path)
    }
  }
  return paths.sort((left, right) => left.localeCompare(right, 'ja'))
}

async function fileSnapshot(root, paths) {
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(relative(root, path).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(path))
    hash.update('\0')
  }
  return {
    fileCount: paths.length,
    combinedSha256: hash.digest('hex')
  }
}

async function markdownSnapshot(root = vault) {
  return fileSnapshot(root, await listMarkdownFiles(root))
}

async function recursiveSnapshot(root) {
  return fileSnapshot(root, await listAllFiles(root))
}

async function prepare() {
  stage('copying canonical fixture into isolated temporary measurement Vault')
  const info = await stat(sourceFixturePath)
  if (!info.isDirectory()) {
    throw new Error(`--vaultはディレクトリではありません: ${sourceFixturePath}`)
  }
  if (
    isInside(sourceFixturePath, resultPath) ||
    isInside(sourceFixturePath, screenshotPath)
  ) {
    throw new Error('--outputは計測対象fixtureの外を指定してください。')
  }

  sourceFixtureBefore = await recursiveSnapshot(sourceFixturePath)
  await cp(sourceFixturePath, vault, { recursive: true })

  manifest = JSON.parse(
    await readFile(resolve(vault, fixtureManifestName), 'utf8')
  )
  homePath = resolve(vault, manifest.homePath)
  if (!isInside(vault, homePath)) {
    throw new Error(`fixtureのhomePathがVault外を指しています: ${manifest.homePath}`)
  }
  originalHomeContent = await readFile(homePath, 'utf8')

  const burstDirectoryExists = await stat(burstDirectory)
    .then(() => true)
    .catch((error) => {
      if (error?.code === 'ENOENT') return false
      throw error
    })
  if (burstDirectoryExists) {
    throw new Error(`一時計測フォルダが既に存在します: ${burstDirectory}`)
  }

  fixtureBefore = await markdownSnapshot()
  if (
    manifest.schemaVersion !== 1 ||
    manifest.noteCount !== expectedNotes ||
    fixtureBefore.fileCount !== expectedNotes ||
    manifest.markdownSha256 !== fixtureBefore.combinedSha256
  ) {
    throw new Error(
      `生成fixtureが期待値と一致しません: ${JSON.stringify({
        manifestNoteCount: manifest.noteCount,
        actualNoteCount: fixtureBefore.fileCount,
        expectedNotes,
        manifestDigest: manifest.markdownSha256,
        actualDigest: fixtureBefore.combinedSha256
      })}`
    )
  }

  await mkdir(outputDirectory, { recursive: true })
  await mkdir(userDataDirectory, { recursive: true })
  await writeFile(
    resolve(userDataDirectory, 'settings.json'),
    `${JSON.stringify(
      {
        lastVaultPath: vault,
        lastNotePath: manifest.homePath
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  stage('isolated fixture and userData are ready')
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitForAppReady(window) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const startedAt = performance.now()
      const deadline = startedAt + 30000
      const check = () => {
        const ready = Boolean(
          document.querySelector('.graph-view-entry') &&
          document.querySelector('.markdown-editor .cm-content') &&
          document.querySelector('.save-status.is-saved')
        )
        if (ready) {
          resolve({ rendererWaitMs: performance.now() - startedAt })
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error('TSUZUNEの編集画面が30秒以内に使用可能になりませんでした。'))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

async function installGraphInstrumentation(window) {
  await evaluate(
    window,
    `(() => {
      const state = {
        canvasClearRectAt: [],
        editorBeforeText: null,
        inputStartedAt: null,
        graphClickedAt: null,
        firstUsableAt: null
      }
      window.__tsuzuneLargeVaultMeasurement = state
      const originalClearRect = CanvasRenderingContext2D.prototype.clearRect
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas?.classList?.contains('wiki-graph-edges')) {
          state.canvasClearRectAt.push(performance.now())
        }
        return originalClearRect.apply(this, args)
      }
    })()`
  )
}

async function prepareEditorInput(window) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const state = window.__tsuzuneLargeVaultMeasurement
      const content = document.querySelector('.markdown-editor .cm-content')
      if (!state || !(content instanceof HTMLElement)) {
        reject(new Error('CodeMirrorの編集欄を準備できませんでした。'))
        return
      }

      content.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(content)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)

      requestAnimationFrame(() => requestAnimationFrame(() => {
        state.editorBeforeText = content.textContent ?? ''
        state.inputStartedAt = performance.now()
        resolve({ beforeLength: state.editorBeforeText.length })
      }))
    })`
  )
}

async function waitForEditorDom(window) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const state = window.__tsuzuneLargeVaultMeasurement
      const deadline = performance.now() + 5000
      let paintPending = false

      const check = () => {
        const text =
          document.querySelector('.markdown-editor .cm-content')?.textContent ?? ''
        if (text !== state?.editorBeforeText && !paintPending) {
          paintPending = true
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const paintedText =
              document.querySelector('.markdown-editor .cm-content')?.textContent ?? ''
            if (paintedText === state.editorBeforeText) {
              paintPending = false
              check()
              return
            }
            resolve({
              doubleRafLatencyMs: performance.now() - state.inputStartedAt,
              afterLength: paintedText.length
            })
          }))
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error('入力が5秒以内にCodeMirror DOMへ反映されませんでした。'))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

async function waitForAutosave(window) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const state = window.__tsuzuneLargeVaultMeasurement
      const deadline = performance.now() + 5000
      let sawPending = false

      const check = () => {
        const status = document.querySelector('.save-status')
        sawPending ||= Boolean(
          status?.classList.contains('is-dirty') ||
          status?.classList.contains('is-saving')
        )
        if (sawPending && status?.classList.contains('is-saved')) {
          resolve({
            completedMs: performance.now() - state.inputStartedAt,
            sawPending,
            finalStatus: status.textContent?.trim() ?? ''
          })
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error('自動保存が5秒以内に完了しませんでした。'))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

async function restoreHomeNote(window) {
  const restored = await evaluate(
    window,
    `(async () => {
      const path = ${JSON.stringify(manifest?.homePath)}
      const originalContent = ${JSON.stringify(originalHomeContent)}
      const snapshot = await window.tsuzune.getSnapshot()
      if (!snapshot.ok) throw new Error(snapshot.error.message)
      const note = snapshot.value.notes.find((candidate) => candidate.path === path)
      if (!note) throw new Error('fixtureのホームノートがSnapshotにありません。')
      const saved = await window.tsuzune.saveNote({
        path,
        content: originalContent,
        expectedModifiedAt: note.modifiedAt
      })
      if (!saved.ok) throw new Error(saved.error.message)
      return { path: saved.value.path, size: saved.value.size }
    })()`
  )

  const content = await readFile(homePath, 'utf8')
  if (content !== originalHomeContent) {
    throw new Error('入力計測後にホームノート本文を完全復元できませんでした。')
  }
  return { ...restored, exactContentRestored: true }
}

async function measureEditorInput(window) {
  const prepared = await prepareEditorInput(window)
  window.webContents.sendInputEvent({ type: 'char', keyCode: 'x' })
  const dom = await waitForEditorDom(window)
  const autosave = await waitForAutosave(window)
  const restoration = await restoreHomeNote(window)

  return {
    insertedCharacter: 'x',
    beforeLength: prepared.beforeLength,
    afterLength: dom.afterLength,
    doubleRafLatencyMs: dom.doubleRafLatencyMs,
    autosave: {
      ...autosave,
      targetMs: 650,
      withinTarget: autosave.completedMs <= 650
    },
    restoration
  }
}

async function clickVaultGraph(window) {
  const clicked = await evaluate(
    window,
    `(() => {
      const state = window.__tsuzuneLargeVaultMeasurement
      const button = document.querySelector('button.graph-view-entry')
      if (!state || !button) return false
      state.graphClickedAt = performance.now()
      button.click()
      return true
    })()`
  )
  if (!clicked) {
    throw new Error('Vault全体グラフのボタンをクリックできませんでした。')
  }
}

async function waitForFirstUsableGraph(window) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const expectedNotes = ${expectedNotes}
      const expectedEdges = ${expectedRenderedEdges}
      const state = window.__tsuzuneLargeVaultMeasurement
      const deadline = performance.now() + 60000
      let paintPending = false

      const inspect = () => {
        const root = document.querySelector(
          '.wiki-graph-view[aria-label="Vault全体グラフ"]'
        )
        const region = document.querySelector(
          '.wiki-graph-canvas[aria-label="グラフキャンバス"]'
        )
        const canvas = document.querySelector('canvas.wiki-graph-edges')
        const nodes = [...document.querySelectorAll('.wiki-graph-node')]
        const regionRect = region?.getBoundingClientRect()
        const nodeRects = nodes.map((node) => node.getBoundingClientRect())
        const sampleRect = nodeRects[0]
        const finiteNodeGeometryCount = nodeRects.filter((rect) =>
          [
            rect.x,
            rect.y,
            rect.left,
            rect.top,
            rect.right,
            rect.bottom,
            rect.width,
            rect.height
          ].every(Number.isFinite) && rect.width > 0 && rect.height > 0
        ).length
        const edgeCount = Number(canvas?.dataset.edgeCount ?? -1)
        const drewAfterClick = state.canvasClearRectAt.some(
          (time) => time >= state.graphClickedAt
        )
        const usable = Boolean(
          root &&
          region &&
          canvas &&
          nodes.length === expectedNotes &&
          edgeCount === expectedEdges &&
          regionRect &&
          regionRect.width > 0 &&
          regionRect.height > 0 &&
          canvas.width > 0 &&
          canvas.height > 0 &&
          finiteNodeGeometryCount === expectedNotes &&
          drewAfterClick
        )
        return {
          usable,
          root,
          regionRect,
          canvas,
          nodes,
          edgeCount,
          sampleRect,
          finiteNodeGeometryCount
        }
      }

      const check = () => {
        const snapshot = inspect()
        if (snapshot.usable && !paintPending) {
          paintPending = true
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const painted = inspect()
            if (!painted.usable) {
              paintPending = false
              check()
              return
            }
            state.firstUsableAt = performance.now()
            resolve({
              firstUsableMs: state.firstUsableAt - state.graphClickedAt,
              nodeCount: painted.nodes.length,
              finiteNodeGeometryCount: painted.finiteNodeGeometryCount,
              edgeCount: painted.edgeCount,
              canvas: {
                cssWidth: painted.regionRect.width,
                cssHeight: painted.regionRect.height,
                pixelWidth: painted.canvas.width,
                pixelHeight: painted.canvas.height
              },
              sampleNode: {
                path: painted.nodes[0].title,
                width: painted.sampleRect.width,
                height: painted.sampleRect.height
              },
              canvasDrawCount: state.canvasClearRectAt.filter(
                (time) => time >= state.graphClickedAt
              ).length
            })
          }))
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error(JSON.stringify({
            message: 'グラフが60秒以内に使用可能になりませんでした。',
            actualNodes: snapshot.nodes.length,
            finiteNodeGeometryCount: snapshot.finiteNodeGeometryCount,
            actualEdges: snapshot.edgeCount,
            expectedNotes,
            expectedEdges,
            canvasDraws: state.canvasClearRectAt.length
          })))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

async function measureAnimationFrameCadence(window) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const root = document.querySelector(
        '.wiki-graph-view[aria-label="Vault全体グラフ"]'
      )
      const state = window.__tsuzuneLargeVaultMeasurement
      if (!root || !state) {
        reject(new Error('Vault全体グラフでrAF cadenceを測定できません。'))
        return
      }

      const timestamps = []
      const canvasDrawsBefore = state.canvasClearRectAt.length
      const sample = (timestamp) => {
        timestamps.push(timestamp)
        if (timestamps.length < 121) {
          requestAnimationFrame(sample)
          return
        }

        const intervals = timestamps.slice(1).map(
          (time, index) => time - timestamps[index]
        )
        const sorted = [...intervals].sort((left, right) => left - right)
        const percentile = (ratio) =>
          sorted[Math.floor((sorted.length - 1) * ratio)]
        resolve({
          sampleCount: intervals.length,
          p50Ms: percentile(0.5),
          p95Ms: percentile(0.95),
          maxMs: sorted.at(-1),
          canvasDrawCountDuringSample:
            state.canvasClearRectAt.length - canvasDrawsBefore
        })
      }
      requestAnimationFrame(sample)
    })`
  )
}

async function waitForGraphNodeCount(window, expectedCount) {
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const expectedCount = ${expectedCount}
      const deadline = performance.now() + 60000
      let paintPending = false

      const inspect = () => ({
        nodeCount: document.querySelectorAll('.wiki-graph-node').length,
        edgeCount: Number(
          document.querySelector('canvas.wiki-graph-edges')?.dataset.edgeCount ?? -1
        )
      })
      const check = () => {
        const snapshot = inspect()
        if (snapshot.nodeCount === expectedCount && !paintPending) {
          paintPending = true
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const painted = inspect()
            if (painted.nodeCount !== expectedCount) {
              paintPending = false
              check()
              return
            }
            resolve(painted)
          }))
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error(
            'watcher burst後のグラフノード数が60秒以内に一致しませんでした。' +
            JSON.stringify({ expectedCount, actualCount: snapshot.nodeCount })
          ))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

function burstNoteContent(index) {
  return [
    `# Performance Burst ${String(index + 1).padStart(2, '0')}`,
    '',
    '生成fixture限定のwatcher burst計測用一時ノートです。',
    '',
    '[[00_Home]]',
    ''
  ].join('\n')
}

async function removeBurstFiles() {
  for (const path of burstPaths) {
    await rm(path, { force: true })
  }
  await rmdir(burstDirectory).catch((error) => {
    if (error?.code !== 'ENOENT') throw error
  })
}

async function measureWatcherBurst(window) {
  await mkdir(burstDirectory)
  const addStartedAt = performance.now()
  await Promise.all(
    burstPaths.map((path, index) => writeFile(path, burstNoteContent(index), 'utf8'))
  )
  const added = await waitForGraphNodeCount(window, expectedNotes + burstPaths.length)
  const addVisibleMs = performance.now() - addStartedAt

  const removeStartedAt = performance.now()
  await removeBurstFiles()
  const removed = await waitForGraphNodeCount(window, expectedNotes)
  const removeVisibleMs = performance.now() - removeStartedAt

  return {
    fileCount: burstPaths.length,
    addVisibleMs,
    removeVisibleMs,
    added,
    removed,
    temporaryDirectoryRemoved: await stat(burstDirectory)
      .then(() => false)
      .catch((error) => {
        if (error?.code === 'ENOENT') return true
        throw error
      })
  }
}

async function restoreMeasurementCopy() {
  await removeBurstFiles().catch(() => undefined)
  if (homePath && originalHomeContent !== null) {
    await writeFile(homePath, originalHomeContent, 'utf8')
  }
}

async function writeResult(result) {
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
}

async function runMeasurement(window, loadFileStartedAt) {
  let foregroundActivated =
    window.isFocused() || BrowserWindow.getFocusedWindow() === window
  window.on('focus', () => {
    foregroundActivated = true
  })
  window.setSkipTaskbar(true)
  window.setFocusable(false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  window.setPosition(-32000, -32000, false)
  const measurementBounds = window.getBounds()
  const offscreen =
    measurementBounds.x <= -30000 && measurementBounds.y <= -30000
  if (!window.isVisible() || !offscreen) {
    throw new Error('計測用BrowserWindowを画面外でvisibleにできませんでした。')
  }
  if (
    foregroundActivated ||
    window.isFocused() ||
    BrowserWindow.getFocusedWindow() === window
  ) {
    throw new Error('計測用BrowserWindowがforegroundを取得しました。')
  }

  const appReady = await waitForAppReady(window)
  const appReadyAt = performance.now()
  stage('editor is ready')
  await installGraphInstrumentation(window)
  const editorInput = await measureEditorInput(window)
  stage('input, autosave, and home-note restoration completed')
  await clickVaultGraph(window)
  const graph = await waitForFirstUsableGraph(window)
  stage('global graph reached first usable state')
  const animationFrameCadence = await measureAnimationFrameCadence(window)
  stage('120-frame rAF cadence sample completed')
  const watcherBurst = await measureWatcherBurst(window)
  stage('20-note watcher add/remove burst completed')

  const image = await window.webContents.capturePage()
  const imageSize = image.getSize()
  if (image.isEmpty() || imageSize.width <= 0 || imageSize.height <= 0) {
    throw new Error('グラフのスクリーンショットを取得できませんでした。')
  }
  await writeFile(screenshotPath, image.toPNG())

  const fixtureAfter = await markdownSnapshot()
  if (
    fixtureAfter.fileCount !== fixtureBefore.fileCount ||
    fixtureAfter.combinedSha256 !== fixtureBefore.combinedSha256
  ) {
    throw new Error('計測中に生成fixtureのMarkdownが変化しました。')
  }
  const sourceFixtureAfter = await recursiveSnapshot(sourceFixturePath)
  const sourceFixtureUnchanged = Boolean(
    sourceFixtureBefore &&
      sourceFixtureAfter.fileCount === sourceFixtureBefore.fileCount &&
      sourceFixtureAfter.combinedSha256 === sourceFixtureBefore.combinedSha256
  )
  if (!sourceFixtureUnchanged) {
    throw new Error('canonical source fixtureが計測中に変化しました。')
  }
  if (foregroundActivated) {
    throw new Error('計測中にBrowserWindowがforegroundを取得しました。')
  }

  const result = {
    schemaVersion: 2,
    ok: true,
    measuredAt: new Date().toISOString(),
    runtime: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch
    },
    isolation: {
      productionProfileTouched: false,
      userDataDirectory,
      browserWindow: {
        initialShow: false,
        visibleDuringMeasurement: window.isVisible(),
        skipTaskbar: true,
        focusable: window.isFocusable(),
        offscreen,
        foregroundActivated,
        offscreenPosition: measurementBounds
      }
    },
    sourceFixture: {
      path: sourceFixturePath,
      manifest: fixtureManifestName,
      fileCount: sourceFixtureBefore.fileCount,
      recursiveSha256: sourceFixtureBefore.combinedSha256,
      unchanged: sourceFixtureUnchanged
    },
    measurementCopy: {
      path: vault,
      noteCount: fixtureBefore.fileCount,
      initialMarkdownSha256: fixtureBefore.combinedSha256,
      finalMarkdownSha256: fixtureAfter.combinedSha256,
      homeContentRestored: editorInput.restoration.exactContentRestored,
      markdownUnchanged: true,
      temporaryRootScheduledForDeletion: true
    },
    expected: {
      notes: expectedNotes,
      renderedEdges: expectedRenderedEdges
    },
    freshProfileWarmCacheOpen: {
      scriptToAppReadyMs: appReadyAt - scriptStartedAt,
      loadFileToAppReadyMs: appReadyAt - loadFileStartedAt,
      rendererWaitMs: appReady.rendererWaitMs,
      definition:
        'fresh temporary Electron userData profile; application files and OS filesystem cache may already be warm; graph entry, selected-note editor, and saved status are present'
    },
    graph: {
      ...graph,
      definition:
        'global graph root + exact node/edge counts + non-zero canvas/node geometry + first clearRect + double requestAnimationFrame'
    },
    editorInput,
    watcherBurst,
    animationFrameCadence,
    definitions: {
      editorInputDom:
        'off-screen non-focusable Electron webContents char input -> changed CodeMirror DOM -> double requestAnimationFrame',
      autosave:
        'same input start -> dirty/saving observed -> saved status; TSUZUNE currently uses a 600 ms debounce and 650 ms is the reporting target',
      watcherBurst:
        'create 20 explicit Markdown files inside the temporary measurement copy -> exact global graph node count + double requestAnimationFrame; then explicit removal -> original count + double requestAnimationFrame',
      animationFrameCadence:
        '120 requestAnimationFrame intervals while the global graph is displayed; this is a Canvas frame cadence proxy, not Canvas draw duration'
    },
    limitations: [
      'Canonical generated fixture is copied before launch; production profile, production Vault, and canonical fixture are not opened by TSUZUNE.',
      'The input is a synthetic Electron webContents char event in a visible compositor window positioned off-screen, marked non-focusable, and never foreground-activated; it is not physical keyboard or foreground OS input latency.',
      'Watcher completion means the React global graph DOM reached the expected node count, not the raw filesystem event timestamp.',
      'requestAnimationFrame cadence reflects renderer scheduling and event-loop pressure; it is not GPU paint time or per-Canvas draw duration.',
      'The visible off-screen compositor cadence may differ from an on-screen monitor refresh cadence.',
      'This command records one fresh-profile warm-cache run rather than a repeated statistical distribution or a true machine-cold launch.'
    ],
    artifacts: {
      json: resultPath,
      screenshot: screenshotPath,
      screenshotSize: imageSize
    }
  }

  await writeResult(result)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.setPath('userData', userDataDirectory)
await prepare()

BrowserWindow.prototype.loadFile = function (...args) {
  const loadFileStartedAt = performance.now()
  const loaded = originalLoadFile.apply(this, args)
  if (!measurementStarted) {
    measurementStarted = true
    void loaded
      .then(() => runMeasurement(this, loadFileStartedAt))
      .then(async () => {
        this.destroy()
        await rm(temporaryRoot, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 50
        }).catch(() => undefined)
        app.exit(0)
      })
      .catch(async (error) => {
        if (!this.isDestroyed()) {
          this.destroy()
        }
        await restoreMeasurementCopy().catch(() => undefined)
        const fixtureAfter = await markdownSnapshot().catch(() => null)
        const sourceFixtureAfter = await recursiveSnapshot(sourceFixturePath).catch(
          () => null
        )
        const failure = {
          schemaVersion: 2,
          ok: false,
          measuredAt: new Date().toISOString(),
          error: String(error?.stack || error),
          sourceFixture: {
            path: sourceFixturePath,
            before: sourceFixtureBefore,
            after: sourceFixtureAfter,
            unchanged: Boolean(
              sourceFixtureBefore &&
                sourceFixtureAfter &&
                sourceFixtureBefore.fileCount === sourceFixtureAfter.fileCount &&
                sourceFixtureBefore.combinedSha256 ===
                  sourceFixtureAfter.combinedSha256
            )
          },
          measurementCopy: {
            path: vault,
            before: fixtureBefore,
            after: fixtureAfter,
            unchanged: Boolean(
              fixtureBefore &&
                fixtureAfter &&
                fixtureBefore.fileCount === fixtureAfter.fileCount &&
                fixtureBefore.combinedSha256 === fixtureAfter.combinedSha256
            )
          }
        }
        await writeResult(failure).catch(() => undefined)
        await rm(temporaryRoot, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 50
        }).catch(() => undefined)
        console.error(error)
        app.exit(1)
      })
  }
  return loaded
}

await import('../out/main/index.js')
