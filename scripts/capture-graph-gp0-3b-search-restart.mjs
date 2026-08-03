import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const scriptPath = resolve(import.meta.filename)
const sourceFixture = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(repoRoot, 'work/graph-gp0-3b-search-restart-working-tree')
const vault = resolve(workRoot, 'vault')
const userData = resolve(workRoot, 'userdata')
const outputRoot = resolve(
  repoRoot,
  'docs/reports/assets/graph-gp0-3b-search-restart-working-tree'
)
const settingsPath = resolve(userData, 'settings.json')
const query = 'path:"10_projects"'
const viewport = { width: 1280, height: 800 }
const workerPhase = process.env.TSUZUNE_GRAPH_SEARCH_RESTART_PHASE

function stage(message) {
  process.stderr.write(`[graph-gp0-3b-search-restart] ${message}\n`)
}

function assertWithin(parent, candidate) {
  if (candidate !== parent && !candidate.startsWith(`${parent}${sep}`)) {
    throw new Error(`許可されたディレクトリ外です: ${candidate}`)
  }
}

function ordinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function listFiles(directory, options = {}) {
  const files = []
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name)
      const relativePath = relative(directory, path).replaceAll('\\', '/')
      if (entry.isDirectory()) {
        await visit(path)
      } else if (!options.extension || extname(entry.name).toLowerCase() === options.extension) {
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

async function treeDigest(directory, options = {}) {
  return digestFiles(await listFiles(directory, options))
}

async function selectedProductSourceDigest() {
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

async function fileDigest(path) {
  const bytes = await readFile(path)
  return {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase()
  }
}

function git(command) {
  const result = spawnSync('git', command, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${command.join(' ')} failed`)
  }
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

function pngDimensions(bytes) {
  if (bytes.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('PNG captureを読み取れません。')
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function processesUsingCommandLineFragment(fragment) {
  const escapedFragment = fragment.replaceAll("'", "''")
  const command = [
    `$needle = '${escapedFragment}';`,
    '@(Get-CimInstance Win32_Process |',
    'Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($needle) } |',
    'ForEach-Object { [pscustomobject]@{ processId = [int]$_.ProcessId; name = $_.Name; commandLine = $_.CommandLine } }) |',
    'ConvertTo-Json -Compress'
  ].join(' ')
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { encoding: 'utf8', windowsHide: true }
  )
  if (result.status !== 0) {
    throw new Error(`隔離profileのprocess確認に失敗しました: ${result.stderr || result.stdout}`)
  }
  const output = result.stdout.trim()
  if (!output) return []
  const parsed = JSON.parse(output)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function stopIsolatedProcesses() {
  let remaining = processesUsingCommandLineFragment(userData)
  for (const process of remaining) {
    spawnSync('taskkill.exe', ['/PID', String(process.processId), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true
    })
  }
  if (remaining.length > 0) {
    const waitUntil = Date.now() + 5_000
    while (Date.now() < waitUntil) {
      remaining = processesUsingCommandLineFragment(userData)
      if (remaining.length === 0) break
    }
  }
  return remaining
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitForPaint(window) {
  await evaluate(
    window,
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  )
}

async function waitForEditor(window) {
  await evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + 30000
      const check = () => {
        const graph = [...document.querySelectorAll('button')]
          .some((button) => button.textContent.trim() === 'グラフビュー')
        if (graph && document.querySelector('.markdown-editor .cm-content')) {
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

async function clickButton(window, label) {
  const clicked = await evaluate(
    window,
    `(() => {
      const button = [...document.querySelectorAll('button')].find(
        (candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)} ||
          candidate.textContent.trim() === ${JSON.stringify(label)}
      )
      if (!(button instanceof HTMLButtonElement)) return false
      button.click()
      return true
    })()`
  )
  if (!clicked) throw new Error(`ボタン「${label}」が見つかりませんでした。`)
  await delay(250)
  await waitForPaint(window)
}

async function ensureGlobalGraphControls(window) {
  if (!(await evaluate(window, `Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]'))`))) {
    await clickButton(window, 'グラフビュー')
  }
  if (!(await evaluate(window, `Boolean(document.querySelector('aside[aria-label="グラフ設定"]'))`))) {
    await clickButton(window, 'グラフ設定を開く')
  }
  if (!(await evaluate(window, `Boolean(document.querySelector('[aria-label="ファイルを検索…"]'))`))) {
    await clickButton(window, 'フィルタを開く')
  }
}

async function fillSearch(window, value) {
  const applied = await evaluate(
    window,
    `(() => {
      const input = document.querySelector('[aria-label="ファイルを検索…"]')
      if (!(input instanceof HTMLInputElement)) return null
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set
      input.focus()
      setter.call(input, ${JSON.stringify(value)})
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: ${JSON.stringify(value)},
        inputType: 'insertText'
      }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return input.value
    })()`
  )
  if (applied !== value) {
    throw new Error(`Graph検索queryを入力できませんでした: ${applied}`)
  }
}

async function graphState(window) {
  return evaluate(
    window,
    `(() => ({
      query: document.querySelector('[aria-label="ファイルを検索…"]')?.value ?? null,
      graphLabel: document.querySelector('.wiki-graph-view')?.getAttribute('aria-label') ?? null,
      settingsPanelVisible: Boolean(document.querySelector('aside[aria-label="グラフ設定"]')),
      filterSectionVisible: Boolean(document.querySelector('[aria-label="ファイルを検索…"]')),
      nodePaths: [...document.querySelectorAll('button.wiki-graph-node')]
        .map((node) => node.title)
        .sort(),
      edgeCount: Number(document.querySelector('canvas.wiki-graph-edges')?.dataset.edgeCount ?? 0),
      stageTransform: document.querySelector('.wiki-graph-stage')?.style.transform ?? '',
      dimensions: {
        innerWidth,
        innerHeight,
        devicePixelRatio
      }
    }))()`
  )
}

async function waitForStableGraph(window, expectedQuery) {
  const deadline = Date.now() + 30_000
  let previous = ''
  let stableSamples = 0
  while (Date.now() < deadline) {
    const state = await graphState(window)
    const signature = JSON.stringify({
      query: state.query,
      nodePaths: state.nodePaths,
      edgeCount: state.edgeCount
    })
    stableSamples = state.query === expectedQuery && state.nodePaths.length > 0 && signature === previous
      ? stableSamples + 1
      : 0
    if (stableSamples >= 3) return state
    previous = signature
    await delay(200)
  }
  throw new Error(`Graph検索結果が安定しませんでした: ${JSON.stringify(await graphState(window))}`)
}

async function waitForSavedQuery(expectedQuery) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const settings = JSON.parse(await readFile(settingsPath, 'utf8'))
    if (settings.graphViewStates?.vault?.query === expectedQuery) return settings
    await delay(100)
  }
  throw new Error('Graph検索queryが隔離settingsへ保存されませんでした。')
}

async function capture(window, filename) {
  const image = await window.webContents.capturePage()
  const bytes = image.toPNG()
  await writeFile(resolve(outputRoot, filename), bytes)
  return {
    file: filename,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase(),
    ...pngDimensions(bytes)
  }
}

function assertFilteredState(state, label) {
  const projectPaths = [
    '10_projects/Project Alpha.md',
    '10_projects/Project Beta.md'
  ]
  if (state.query !== query || state.graphLabel !== 'Vault全体グラフ') {
    throw new Error(`${label}のGlobal Graph queryが一致しません: ${JSON.stringify(state)}`)
  }
  if (!projectPaths.every((path) => state.nodePaths.includes(path))) {
    throw new Error(`${label}で10_projects配下の2ノートを表示できません: ${JSON.stringify(state.nodePaths)}`)
  }
  const unexpected = state.nodePaths.filter(
    (path) => path !== '00_Home.md' && !path.startsWith('10_projects/')
  )
  if (unexpected.length > 0) {
    throw new Error(`${label}の検索結果に対象外ノートがあります: ${JSON.stringify(unexpected)}`)
  }
}

async function runWorker(phase) {
  const { app, BrowserWindow } = await import('electron')
  const originalLoadFile = BrowserWindow.prototype.loadFile
  let captureStarted = false

  process.env.TSUZUNE_HEADLESS_SMOKE = '1'
  app.setPath('userData', userData)
  app.commandLine.appendSwitch('disable-background-timer-throttling')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  app.commandLine.appendSwitch('force-device-scale-factor', '1')
  app.commandLine.appendSwitch(
    'host-resolver-rules',
    'MAP * 0.0.0.0, EXCLUDE localhost'
  )

  async function run(window) {
    window.setSkipTaskbar(true)
    window.setBounds({ x: -32_000, y: -32_000, ...viewport }, false)
    window.showInactive()
    await waitForEditor(window)

    if (phase === 'initial') {
      await ensureGlobalGraphControls(window)
      await fillSearch(window, query)
      const entered = await waitForStableGraph(window, query)
      const enteredScreenshot = await capture(window, '01-query-entered.png')
      const settingsAfterInput = await waitForSavedQuery(query)

      await clickButton(window, '編集')
      const graphClosed = await evaluate(
        window,
        `!document.querySelector('.wiki-graph-view') && Boolean(document.querySelector('.markdown-editor .cm-content'))`
      )
      if (!graphClosed) throw new Error('Global Graphを編集画面へ閉じられませんでした。')

      await ensureGlobalGraphControls(window)
      const reopened = await waitForStableGraph(window, query)
      const reopenedScreenshot = await capture(window, '02-graph-reopened.png')
      assertFilteredState(entered, 'query入力直後')
      assertFilteredState(reopened, 'Graph再表示後')
      if (JSON.stringify(entered.nodePaths) !== JSON.stringify(reopened.nodePaths)) {
        throw new Error('Graph再表示後に検索node集合が変化しました。')
      }
      await writeFile(
        resolve(outputRoot, 'phase-initial.json'),
        `${JSON.stringify({
          phase,
          processId: process.pid,
          graphClosed,
          entered,
          reopened,
          settingsGraphViewState: settingsAfterInput.graphViewStates.vault,
          screenshots: [enteredScreenshot, reopenedScreenshot]
        }, null, 2)}\n`,
        'utf8'
      )
    } else if (phase === 'restarted') {
      await ensureGlobalGraphControls(window)
      const restarted = await waitForStableGraph(window, query)
      const restartedScreenshot = await capture(window, '03-app-restarted.png')
      const settingsAfterRestart = await waitForSavedQuery(query)
      assertFilteredState(restarted, 'アプリ再起動後')
      await writeFile(
        resolve(outputRoot, 'phase-restarted.json'),
        `${JSON.stringify({
          phase,
          processId: process.pid,
          restarted,
          settingsGraphViewState: settingsAfterRestart.graphViewStates.vault,
          screenshots: [restartedScreenshot]
        }, null, 2)}\n`,
        'utf8'
      )
    } else {
      throw new Error(`不明なcapture phaseです: ${phase}`)
    }

    await evaluate(window, 'window.tsuzune.confirmClose(true); true')
    setTimeout(() => app.exit(0), 3_000).unref()
  }

  BrowserWindow.prototype.loadFile = function (...args) {
    const loaded = originalLoadFile.apply(this, args)
    if (!captureStarted) {
      captureStarted = true
      void loaded.then(() => run(this)).catch(async (error) => {
        await writeFile(
          resolve(outputRoot, `capture-error-${phase}.txt`),
          String(error?.stack || error),
          'utf8'
        )
        const image = await this.webContents.capturePage().catch(() => null)
        if (image) {
          await writeFile(resolve(outputRoot, `capture-error-${phase}.png`), image.toPNG())
        }
        console.error(error)
        app.exit(1)
      })
    }
    return loaded
  }

  await import('../out/main/index.js')
}

function runWorkerProcess(phase) {
  const electronExecutable = resolve(
    repoRoot,
    'node_modules/electron/dist/electron.exe'
  )
  const result = spawnSync(
    electronExecutable,
    [scriptPath, `--tsuzune-capture-user-data=${userData}`, `--capture-phase=${phase}`],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 90_000,
      env: {
        ...process.env,
        TSUZUNE_GRAPH_SEARCH_RESTART_PHASE: phase
      }
    }
  )
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error || result.status !== 0) {
    throw new Error(
      `capture phase ${phase} failed: ${result.error?.message || result.status}`
    )
  }
  const remaining = processesUsingCommandLineFragment(userData)
  if (remaining.length > 0) {
    throw new Error(`capture phase ${phase}のprocessが残っています: ${JSON.stringify(remaining)}`)
  }
}

async function artifactSummary(path) {
  const digest = await fileDigest(path)
  return {
    path: relative(repoRoot, path).replaceAll('\\', '/'),
    ...digest,
    ...(extname(path).toLowerCase() === '.png'
      ? pngDimensions(await readFile(path))
      : {})
  }
}

async function runController() {
  assertWithin(resolve(repoRoot, 'work'), workRoot)
  assertWithin(resolve(repoRoot, 'docs/reports/assets'), outputRoot)

  await rm(workRoot, { recursive: true, force: true })
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(userData, { recursive: true })
  await mkdir(outputRoot, { recursive: true })
  await cp(sourceFixture, vault, { recursive: true })
  await writeFile(
    settingsPath,
    `${JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2)}\n`,
    'utf8'
  )

  const protectionBefore = {
    sourceFixture: await treeDigest(sourceFixture),
    productSource: await selectedProductSourceDigest(),
    builtApplication: await treeDigest(resolve(repoRoot, 'out')),
    isolatedMarkdown: await treeDigest(vault, { extension: '.md' })
  }
  const repository = gitIdentity()

  try {
    stage('query入力とGraph再表示をcaptureします。')
    runWorkerProcess('initial')
    stage('別processでアプリ再起動後をcaptureします。')
    runWorkerProcess('restarted')
  } catch (error) {
    stopIsolatedProcesses()
    throw error
  }

  const protectionAfter = {
    sourceFixture: await treeDigest(sourceFixture),
    productSource: await selectedProductSourceDigest(),
    builtApplication: await treeDigest(resolve(repoRoot, 'out')),
    isolatedMarkdown: await treeDigest(vault, { extension: '.md' })
  }
  const initial = JSON.parse(await readFile(resolve(outputRoot, 'phase-initial.json'), 'utf8'))
  const restarted = JSON.parse(await readFile(resolve(outputRoot, 'phase-restarted.json'), 'utf8'))
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'))

  const assertions = {
    queryEntered: initial.entered.query === query,
    queryRestoredAfterGraphReopen: initial.reopened.query === query,
    queryRestoredAfterAppRestart: restarted.restarted.query === query,
    filteredNodeSetStable:
      JSON.stringify(initial.entered.nodePaths) === JSON.stringify(initial.reopened.nodePaths) &&
      JSON.stringify(initial.reopened.nodePaths) === JSON.stringify(restarted.restarted.nodePaths),
    settingsPersisted: settings.graphViewStates?.vault?.query === query,
    separateApplicationProcesses: initial.processId !== restarted.processId,
    sourceFixtureUnchanged:
      protectionBefore.sourceFixture.combinedSha256 ===
      protectionAfter.sourceFixture.combinedSha256,
    productSourceUnchanged:
      protectionBefore.productSource.combinedSha256 ===
      protectionAfter.productSource.combinedSha256,
    builtApplicationUnchanged:
      protectionBefore.builtApplication.combinedSha256 ===
      protectionAfter.builtApplication.combinedSha256,
    isolatedMarkdownUnchanged:
      protectionBefore.isolatedMarkdown.combinedSha256 ===
      protectionAfter.isolatedMarkdown.combinedSha256,
    noIsolatedProcessesRemaining: processesUsingCommandLineFragment(userData).length === 0
  }
  const completed = Object.values(assertions).every(Boolean)
  const observation = {
    capturedAt: new Date().toISOString(),
    query,
    repository,
    initial,
    restarted,
    persistedGraphViewState: settings.graphViewStates.vault,
    protection: { before: protectionBefore, after: protectionAfter },
    assertions
  }
  await writeFile(
    resolve(outputRoot, 'observation.json'),
    `${JSON.stringify(observation, null, 2)}\n`,
    'utf8'
  )

  const artifactPaths = [
    '01-query-entered.png',
    '02-graph-reopened.png',
    '03-app-restarted.png',
    'phase-initial.json',
    'phase-restarted.json',
    'observation.json'
  ].map((name) => resolve(outputRoot, name))
  const manifest = {
    capturedAt: observation.capturedAt,
    stage: 'GP0-3b Global Graph search persistence working-tree evidence',
    status: completed ? 'captured' : 'failed',
    comparisonStatus:
      'Compare with docs/reports/assets/graph-gp0-search-persistence/comparison.json',
    command: 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs',
    isolation: {
      sourceFixture: relative(repoRoot, sourceFixture).replaceAll('\\', '/'),
      copiedVault: relative(repoRoot, vault).replaceAll('\\', '/'),
      userData: relative(repoRoot, userData).replaceAll('\\', '/'),
      windowBounds: { x: -32_000, y: -32_000, ...viewport },
      network: 'host resolver blocked except localhost'
    },
    processIds: [initial.processId, restarted.processId],
    assertions,
    artifacts: await Promise.all(artifactPaths.map(artifactSummary)),
    next: 'Continue GP0-3b with the remaining camera, drag, menu, animation, and reset behaviors.'
  }
  await writeFile(
    resolve(outputRoot, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )

  if (!completed) {
    throw new Error(`capture assertions failed: ${JSON.stringify(assertions)}`)
  }
  process.stdout.write(`${JSON.stringify({
    status: manifest.status,
    output: relative(repoRoot, outputRoot).replaceAll('\\', '/'),
    processIds: manifest.processIds,
    assertions
  }, null, 2)}\n`)
}

if (workerPhase) {
  await runWorker(workerPhase)
} else {
  await runController()
}
