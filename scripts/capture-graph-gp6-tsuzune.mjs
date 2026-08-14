import { extractFile } from '@electron/asar'
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import {
  cp,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { release as osRelease } from 'node:os'
import { relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const fixtureDirectory = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(repoRoot, 'work/graph-gp6')
const captureWorkDirectory = resolve(workRoot, 'tsuzune-0.5.0')
const vaultDirectory = resolve(captureWorkDirectory, 'vault')
const userDataDirectory = resolve(captureWorkDirectory, 'userdata')
const emptyPathDirectory = resolve(captureWorkDirectory, 'empty-path')
const settingsPath = resolve(userDataDirectory, 'settings.json')
const stdoutPath = resolve(captureWorkDirectory, 'tsuzune-stdout.log')
const stderrPath = resolve(captureWorkDirectory, 'tsuzune-stderr.log')
const outputDirectory = resolve(
  repoRoot,
  'docs/reports/assets/graph-gp6/tsuzune-0.5.0'
)
const screenshotPath = resolve(outputDirectory, '01-global-baseline.png')
const environmentPath = resolve(outputDirectory, 'environment.json')
const observationPath = resolve(outputDirectory, '01-global-baseline.observation.json')
const manifestPath = resolve(outputDirectory, 'manifest.json')
const executablePath = resolve(
  'C:/Users/Humin/AppData/Local/Programs/tsuzune/TSUZUNE.exe'
)
const asarPath = resolve(
  'C:/Users/Humin/AppData/Local/Programs/tsuzune/resources/app.asar'
)

const expected = {
  version: '0.5.0',
  executableSha256: 'A19F02E525CACE50361D4C20AB9FF861CE44BE65E12942974D532805082B95BA',
  applicationAsarSha256: '82FED31F359D2072AD3138F9D8106D8AD9AA2BBFED4A7DB741CCD43ACE02D7D3',
  markdownCount: 7,
  installedDefaultGraph: {
    renderedNodeCount: 6,
    renderedDirectedEdgeCount: 11
  },
  viewport: { width: 1265, height: 768 },
  deviceScaleFactor: 1
}

const selectors = {
  noteActions: 'header.note-header .note-actions',
  graphSurface: '.wiki-graph-view[aria-label="Vault全体グラフ"]',
  scopeGroup: '[role="group"][aria-label="グラフの範囲"]',
  graphCanvas: '.wiki-graph-canvas[role="region"][aria-label="グラフキャンバス"]',
  nodes: 'button.wiki-graph-node',
  edges: 'svg[aria-hidden="true"] line[data-source-path][data-target-path]'
}

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

function assertWithin(directory, path) {
  if (path !== directory && !path.startsWith(`${directory}${sep}`)) {
    throw new Error(`作業ディレクトリ外は変更できません: ${path}`)
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex').toUpperCase()
}

async function fileDigest(path) {
  const fileStat = await stat(path)
  return { bytes: fileStat.size, sha256: await sha256(path) }
}

async function treeDigest(directory, ignoredTopLevelDirectory = null) {
  const files = []

  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const path = resolve(currentDirectory, entry.name)
      const relativePath = relative(directory, path).replaceAll('\\', '/')
      if (ignoredTopLevelDirectory && relativePath.split('/')[0] === ignoredTopLevelDirectory) {
        continue
      }
      if (entry.isDirectory()) {
        await visit(path)
      } else if (entry.isFile()) {
        files.push({ path, relativePath })
      }
    }
  }

  await visit(directory)
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'ja'))
  const combined = createHash('sha256')
  const entries = []
  for (const file of files) {
    const bytes = await readFile(file.path)
    const digest = createHash('sha256').update(bytes).digest('hex').toUpperCase()
    entries.push({ path: file.relativePath, bytes: bytes.length, sha256: digest })
    combined.update(file.relativePath)
    combined.update('\0')
    combined.update(bytes)
    combined.update('\0')
  }
  return {
    fileCount: entries.length,
    combinedSha256: combined.digest('hex').toUpperCase(),
    files: entries
  }
}

async function selectCdpPort() {
  const configured = process.env.TSUZUNE_GP6_CDP_PORT
  const requestedPort = configured === undefined ? 0 : Number(configured)
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65_535) {
    throw new Error(`CDP portが不正です: ${configured}`)
  }

  return new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.once('error', rejectPort)
    server.listen(requestedPort, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close((error) => {
        if (error) rejectPort(error)
        else if (port === null) rejectPort(new Error('空きCDP portを取得できませんでした。'))
        else resolvePort(port)
      })
    })
  })
}

async function waitForCdpTarget(cdpPort, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastTargets = []
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
      lastTargets = targets.map(({ title, type, url }) => ({ title, type, url }))
      const target = targets.find(
        (candidate) =>
          candidate.type === 'page' && candidate.url.endsWith('/out/renderer/index.html')
      )
      if (target) return target
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await delay(100)
  }
  throw new Error(
    `TSUZUNEのCDP targetを待機できませんでした。lastError=${lastError ?? 'none'} targets=${JSON.stringify(lastTargets)}`
  )
}

async function waitForMainInspectorTarget(inspectorPort, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastTargets = []
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${inspectorPort}/json/list`)).json()
      lastTargets = targets.map(({ title, type, url }) => ({ title, type, url }))
      const target = targets.find((candidate) => candidate.type === 'node')
      if (target) return target
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await delay(100)
  }
  throw new Error(
    `TSUZUNE main inspector targetを待機できませんでした。lastError=${lastError ?? 'none'} targets=${JSON.stringify(lastTargets)}`
  )
}

async function connectCdp(target, enablePage = true) {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true })
    socket.addEventListener('error', rejectOpen, { once: true })
  })

  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const operation = pending.get(message.id)
    pending.delete(message.id)
    clearTimeout(operation.timeout)
    if (message.error) operation.reject(new Error(JSON.stringify(message.error)))
    else operation.resolve(message.result)
  })
  socket.addEventListener('close', () => {
    for (const operation of pending.values()) {
      clearTimeout(operation.timeout)
      operation.reject(new Error('CDP socketが閉じられました。'))
    }
    pending.clear()
  })

  function send(method, params = {}) {
    return new Promise((resolveSend, rejectSend) => {
      const id = nextId++
      const timeout = setTimeout(() => {
        pending.delete(id)
        rejectSend(new Error(`CDP commandが10秒以内に完了しませんでした: ${method}`))
      }, 10_000)
      pending.set(id, { resolve: resolveSend, reject: rejectSend, timeout })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result.value
  }

  await send('Runtime.enable')
  if (enablePage) await send('Page.enable')
  return { socket, send, evaluate }
}

async function waitForRenderer(cdp, expression, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  while (Date.now() < deadline) {
    if (await cdp.evaluate(expression)) return
    await delay(100)
  }
  throw new Error(`Renderer状態を待機できませんでした: ${expression}`)
}

async function waitForStableGraph(cdp, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let previous = null
  let stableSamples = 0
  while (Date.now() < deadline) {
    const current = await cdp.evaluate(`JSON.stringify(
      [...document.querySelectorAll('.wiki-graph-node')]
        .map((node) => [node.title, node.style.left, node.style.top])
        .sort((left, right) => left[0].localeCompare(right[0]))
    )`)
    const nodeCount = JSON.parse(current).length
    stableSamples = nodeCount > 0 && current === previous
      ? stableSamples + 1
      : 0
    if (stableSamples >= 3) return
    previous = current
    await delay(200)
  }
  throw new Error('TSUZUNE Global GraphのForce layoutが安定しませんでした。')
}

function pngDimensions(bytes) {
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('PNG captureを読み取れません。')
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

async function main() {
  assertWithin(resolve(repoRoot, 'work'), captureWorkDirectory)
  assertWithin(resolve(repoRoot, 'docs/reports/assets'), outputDirectory)

  await rm(captureWorkDirectory, { recursive: true, force: true })
  await rm(outputDirectory, { recursive: true, force: true })
  const installedExecutable = await fileDigest(executablePath)
  const installedAsar = await fileDigest(asarPath)
  if (installedExecutable.sha256 !== expected.executableSha256) {
    throw new Error(`固定したTSUZUNE.exeのhashと一致しません: ${installedExecutable.sha256}`)
  }
  if (installedAsar.sha256 !== expected.applicationAsarSha256) {
    throw new Error(`固定したapp.asarのhashと一致しません: ${installedAsar.sha256}`)
  }
  const installedPackage = JSON.parse(extractFile(asarPath, 'package.json').toString('utf8'))
  if (installedPackage.name !== 'tsuzune' || installedPackage.version !== expected.version) {
    throw new Error(
      `installed TSUZUNEの版が一致しません: ${installedPackage.name}@${installedPackage.version}`
    )
  }

  await Promise.all([
    mkdir(vaultDirectory, { recursive: true }),
    mkdir(userDataDirectory, { recursive: true }),
    mkdir(emptyPathDirectory, { recursive: true }),
    mkdir(outputDirectory, { recursive: true })
  ])
  await cp(fixtureDirectory, vaultDirectory, { recursive: true, force: false })
  await writeFile(
    settingsPath,
    `${JSON.stringify(
      {
        lastVaultPath: vaultDirectory,
        lastNotePath: '00_Home.md',
        userIgnoreFilters: []
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  const sourceBefore = await treeDigest(fixtureDirectory)
  const isolatedVaultBefore = await treeDigest(vaultDirectory, '.tsuzune')
  const settingsBefore = await fileDigest(settingsPath)
  const cdpPort = await selectCdpPort()
  let mainInspectorPort = await selectCdpPort()
  while (mainInspectorPort === cdpPort) mainInspectorPort = await selectCdpPort()
  const stdoutFile = await open(stdoutPath, 'w')
  const stderrFile = await open(stderrPath, 'w')
  const args = [
    '--start-minimized',
    '--window-position=-32000,-32000',
    `--remote-debugging-port=${cdpPort}`,
    `--inspect=127.0.0.1:${mainInspectorPort}`,
    '--remote-debugging-address=127.0.0.1',
    '--remote-allow-origins=*',
    '--force-device-scale-factor=1',
    `--window-size=${expected.viewport.width},${expected.viewport.height}`,
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion',
    '--no-first-run',
    '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    `--user-data-dir=${userDataDirectory}`
  ]
  const childEnvironment = {
    ...process.env,
    PATH: emptyPathDirectory,
    TSUZUNE_HEADLESS_SMOKE: '1'
  }
  delete childEnvironment.TSUZUNE_HEADLESS_SMOKE_READY_FILE
  delete childEnvironment.ELECTRON_RENDERER_URL
  delete childEnvironment.GH_TOKEN
  delete childEnvironment.GITHUB_TOKEN

  const child = spawn(executablePath, args, {
    windowsHide: true,
    env: childEnvironment,
    stdio: ['ignore', stdoutFile.fd, stderrFile.fd]
  })
  let shuttingDown = false
  let childSpawnError = null
  let childExit = null
  let rejectUnexpectedStop
  const unexpectedChildStop = new Promise((_, reject) => {
    rejectUnexpectedStop = reject
  })
  child.once('error', (error) => {
    childSpawnError = error
    rejectUnexpectedStop(new Error(`TSUZUNEを起動できませんでした: ${error.message}`))
  })
  child.once('exit', (code, signal) => {
    childExit = { code, signal }
    if (!shuttingDown) {
      rejectUnexpectedStop(
        new Error(`TSUZUNEが途中終了しました: code=${code} signal=${signal ?? 'none'}`)
      )
    }
  })
  const whileChildAlive = (operation) => Promise.race([operation, unexpectedChildStop])

  let appCdp = null
  let mainCdp = null
  let baseline = null
  let environment = null
  let screenshot = null
  let nativeCapture = null
  try {
    const target = await whileChildAlive(waitForCdpTarget(cdpPort))
    appCdp = await whileChildAlive(connectCdp(target))
    const mainTarget = await whileChildAlive(waitForMainInspectorTarget(mainInspectorPort))
    mainCdp = await whileChildAlive(connectCdp(mainTarget, false))
    console.log('[gp6-tsuzune] CDP connected')
    await whileChildAlive(
      appCdp.send('Emulation.setDeviceMetricsOverride', {
        width: expected.viewport.width,
        height: expected.viewport.height,
        deviceScaleFactor: expected.deviceScaleFactor,
        mobile: false
      })
    )
    await whileChildAlive(
      appCdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: 'light' }]
      })
    )
    console.log('[gp6-tsuzune] viewport configured')

    await whileChildAlive(
      waitForRenderer(
        appCdp,
        `document.querySelector(${JSON.stringify(selectors.noteActions)}) !== null && window.tsuzune !== undefined`
      )
    )
    console.log('[gp6-tsuzune] renderer ready')
    const vaultState = await whileChildAlive(appCdp.evaluate(`(async () => {
      const [settings, snapshot] = await Promise.all([
        window.tsuzune.getSettings(),
        window.tsuzune.getSnapshot()
      ])
      if (!settings.ok) throw new Error(settings.error.message)
      if (!snapshot.ok) throw new Error(snapshot.error.message)
      return {
        activeVaultPath: snapshot.value.rootPath,
        activeVaultMatched:
          snapshot.value.rootPath.toLowerCase() === ${JSON.stringify(vaultDirectory.toLowerCase())},
        markdownFiles: snapshot.value.notes.map((note) => note.path).sort(),
        attachmentFiles: (snapshot.value.attachments ?? []).map((file) => file.path).sort(),
        settings: settings.value
      }
    })()`))
    if (!vaultState.activeVaultMatched) {
      throw new Error(`隔離Vaultがactiveではありません: ${vaultState.activeVaultPath}`)
    }
    console.log('[gp6-tsuzune] isolated Vault confirmed')

    await whileChildAlive(appCdp.evaluate(`(() => {
      const actions = document.querySelector(${JSON.stringify(selectors.noteActions)})
      const button = [...actions.querySelectorAll('button')]
        .find((candidate) => candidate.textContent.trim() === 'グラフ')
      if (!button) throw new Error('installed TSUZUNE 0.5.0のGraph入口が見つかりません。')
      button.click()
    })()`))
    await whileChildAlive(
      waitForRenderer(
        appCdp,
        `document.querySelector('.wiki-graph-view[aria-label="ローカルグラフ"]') !== null`
      )
    )
    console.log('[gp6-tsuzune] local graph opened')
    await whileChildAlive(appCdp.evaluate(`(() => {
      const group = document.querySelector(${JSON.stringify(selectors.scopeGroup)})
      const button = [...group.querySelectorAll('button')]
        .find((candidate) => candidate.textContent.trim() === 'Vault全体')
      if (!button) throw new Error('installed TSUZUNE 0.5.0のVault全体scopeが見つかりません。')
      button.click()
    })()`))
    await whileChildAlive(
      waitForRenderer(
        appCdp,
        `document.querySelector(${JSON.stringify(selectors.graphSurface)}) !== null && document.querySelectorAll(${JSON.stringify(selectors.nodes)}).length > 0`
      )
    )
    console.log('[gp6-tsuzune] global graph opened')
    await whileChildAlive(waitForStableGraph(appCdp))
    console.log('[gp6-tsuzune] graph stable')

    baseline = await whileChildAlive(appCdp.evaluate(`(async () => {
      const graphView = document.querySelector(${JSON.stringify(selectors.graphSurface)})
      const graphCanvas = document.querySelector(${JSON.stringify(selectors.graphCanvas)})
      const edgeSvg = graphCanvas.querySelector('svg[aria-hidden="true"]')
      const edgeLines = [...graphCanvas.querySelectorAll(${JSON.stringify(selectors.edges)})]
      const filterInput = graphView.querySelector('[aria-label="グラフを絞り込み"]')
      const orphanCheckbox = [...graphView.querySelectorAll('label')]
        .find((label) => label.textContent.includes('孤立ノートを表示'))
        ?.querySelector('input[type="checkbox"]')
      const rect = (element) => {
        if (!element) return null
        const bounds = element.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      }
      const settings = await window.tsuzune.getSettings()
      if (!settings.ok) throw new Error(settings.error.message)
      return {
        capturedAt: new Date().toISOString(),
        title: document.title,
        url: location.href,
        userAgent: navigator.userAgent,
        renderedTheme: matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'unknown',
        visibilityState: document.visibilityState,
        dimensions: {
          inner: { width: innerWidth, height: innerHeight },
          outer: { width: outerWidth, height: outerHeight },
          devicePixelRatio,
          graphView: rect(graphView),
          graphCanvas: rect(graphCanvas),
          edgeSvg: rect(edgeSvg)
        },
        installedSelectorContract: ${JSON.stringify(selectors)},
        settings: settings.value,
        graphControls: {
          filterQuery: filterInput?.value ?? null,
          includeOrphans: orphanCheckbox?.checked ?? null,
          zoomStatus: graphView.querySelector('[aria-live="polite"]')?.textContent.trim() ?? null
        },
        scopeControls: [...document.querySelectorAll(${JSON.stringify(selectors.scopeGroup)} + ' button')].map((button) => ({
          text: button.textContent.trim(),
          pressed: button.getAttribute('aria-pressed') === 'true',
          rect: rect(button)
        })),
        buttons: [...graphView.querySelectorAll('button')].map((button) => ({
          text: button.textContent.trim(),
          ariaLabel: button.getAttribute('aria-label'),
          className: button.className,
          rect: rect(button)
        })),
        renderer: {
          nodeCount: document.querySelectorAll(${JSON.stringify(selectors.nodes)}).length,
          directedEdgeCount: edgeLines.length,
          stageTransform: document.querySelector('.wiki-graph-stage')?.style.transform ?? '',
          edgeSvg: edgeSvg ? {
            viewBox: edgeSvg.getAttribute('viewBox'),
            preserveAspectRatio: edgeSvg.getAttribute('preserveAspectRatio'),
            clientWidth: edgeSvg.clientWidth,
            clientHeight: edgeSvg.clientHeight
          } : null,
          edges: edgeLines.map((line) => ({
            sourcePath: line.dataset.sourcePath,
            targetPath: line.dataset.targetPath,
            x1: line.getAttribute('x1'),
            y1: line.getAttribute('y1'),
            x2: line.getAttribute('x2'),
            y2: line.getAttribute('y2'),
            stroke: line.getAttribute('stroke'),
            markerEnd: line.getAttribute('marker-end')
          })),
          nodes: [...document.querySelectorAll(${JSON.stringify(selectors.nodes)})]
            .map((node) => ({
              path: node.title,
              label: node.textContent.trim(),
              ariaLabel: node.getAttribute('aria-label'),
              className: node.className,
              rect: rect(node),
              position: { left: node.style.left, top: node.style.top }
            }))
            .sort((left, right) => left.path.localeCompare(right.path))
        }
      }
    })()`))
    baseline.vault = vaultState
    console.log('[gp6-tsuzune] graph observed')

    nativeCapture = await whileChildAlive(mainCdp.evaluate(`(async () => {
      const loadElectron = typeof require === 'function'
        ? require
        : process.mainModule?.require
          ? process.mainModule.require.bind(process.mainModule)
          : process.getBuiltinModule('module').createRequire(process.execPath)
      const { BrowserWindow } = loadElectron('electron')
      const window = BrowserWindow.getAllWindows().find((candidate) => candidate.getTitle() === 'TSUZUNE')
      if (!window) throw new Error('TSUZUNE BrowserWindowが見つかりません。')
      window.setPosition(-32000, -32000, false)
      window.setContentSize(${expected.viewport.width}, ${expected.viewport.height}, false)
      const image = await window.webContents.capturePage(
        { x: 0, y: 0, width: ${expected.viewport.width}, height: ${expected.viewport.height} },
        { stayHidden: true, stayAwake: true }
      )
      return {
        base64: image.toPNG().toString('base64'),
        imageSize: image.getSize(),
        visible: window.isVisible(),
        bounds: window.getBounds(),
        contentBounds: window.getContentBounds()
      }
    })()`))
    screenshot = Buffer.from(nativeCapture.base64, 'base64')
    await writeFile(screenshotPath, screenshot)
    console.log('[gp6-tsuzune] screenshot captured')

    environment = {
      product: 'TSUZUNE',
      version: installedPackage.version,
      electronUserAgent: baseline.userAgent,
      windows: {
        release: osRelease(),
        platform: process.platform,
        architecture: process.arch
      },
      artifacts: {
        executable: { path: executablePath, ...installedExecutable },
        applicationAsar: { path: asarPath, ...installedAsar }
      },
      launch: {
        executable: executablePath,
        arguments: args,
        pid: child.pid,
        cdpAddress: '127.0.0.1',
        cdpPort,
        mainInspectorPort,
        chromiumHeadless: false,
        applicationHiddenWindowMode: true,
        readyFileConfigured: false,
        requestedWindowBounds: {
          left: -32_000,
          top: -32_000,
          width: expected.viewport.width,
          height: expected.viewport.height
        },
        observedWindowSize: baseline.dimensions.outer,
        nativeCapture: {
          method: 'BrowserWindow.webContents.capturePage',
          imageSize: nativeCapture.imageSize,
          windowVisible: nativeCapture.visible,
          windowBounds: nativeCapture.bounds,
          contentBounds: nativeCapture.contentBounds
        },
        userData: userDataDirectory,
        networkIsolation: 'host resolver blocked; updater token sources removed'
      }
    }
  } finally {
    shuttingDown = true
    try {
      if (appCdp) {
        await Promise.race([
          appCdp.evaluate(`(() => {
            window.tsuzune.confirmClose(true)
            return true
          })()`).catch(() => undefined),
          delay(2_000)
        ])
        appCdp.socket.close()
      }
      if (mainCdp) mainCdp.socket.close()
    } catch {
      // The application may already be shutting down.
    }
    const quitDeadline = Date.now() + 8_000
    while (!childSpawnError && childExit === null && Date.now() < quitDeadline) await delay(100)
    if (!childSpawnError && childExit === null && child.pid) {
      const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true
      })
      if (killed.status !== 0 && childExit === null) {
        throw new Error(`TSUZUNE process treeを終了できませんでした: ${killed.stderr || killed.stdout}`)
      }
      const killDeadline = Date.now() + 10_000
      while (childExit === null && Date.now() < killDeadline) await delay(100)
    }
    if (!childSpawnError && childExit === null) {
      throw new Error('TSUZUNE process treeの完全終了を確認できませんでした。')
    }
    await Promise.allSettled([stdoutFile.close(), stderrFile.close()])
  }

  let remainingIsolatedProcesses = processesUsingCommandLineFragment(userDataDirectory)
  for (const process of remainingIsolatedProcesses) {
    spawnSync('taskkill.exe', ['/PID', String(process.processId), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true
    })
  }
  if (remainingIsolatedProcesses.length > 0) await delay(500)
  remainingIsolatedProcesses = processesUsingCommandLineFragment(userDataDirectory)
  if (remainingIsolatedProcesses.length > 0) {
    throw new Error(
      `隔離profileを使うprocessが残っています: ${JSON.stringify(remainingIsolatedProcesses)}`
    )
  }

  const sourceAfter = await treeDigest(fixtureDirectory)
  const isolatedVaultAfter = await treeDigest(vaultDirectory, '.tsuzune')
  const settingsAfter = await fileDigest(settingsPath)
  const screenshotSize = pngDimensions(screenshot)
  baseline.summary = {
    markdownCount: baseline.vault.markdownFiles.length,
    renderedNodeCount: baseline.renderer.nodeCount,
    renderedDirectedEdgeCount: baseline.renderer.directedEdgeCount,
    screenshot: {
      path: relative(repoRoot, screenshotPath).replaceAll('\\', '/'),
      bytes: screenshot.length,
      sha256: createHash('sha256').update(screenshot).digest('hex').toUpperCase(),
      ...screenshotSize
    }
  }
  baseline.expected = expected
  baseline.assertions = {
    viewportMatched:
      screenshotSize.width === expected.viewport.width &&
      screenshotSize.height === expected.viewport.height &&
      baseline.dimensions.devicePixelRatio === expected.deviceScaleFactor,
    renderedThemeMatched: baseline.renderedTheme === 'light',
    activeVaultMatched: baseline.vault.activeVaultMatched,
    markdownCountMatched: baseline.vault.markdownFiles.length === expected.markdownCount,
    graphSurfaceCaptured:
      baseline.renderer.nodeCount > 0 &&
      baseline.renderer.directedEdgeCount > 0 &&
      baseline.renderer.edgeSvg !== null,
    installedDefaultGraphMatched:
      baseline.renderer.nodeCount === expected.installedDefaultGraph.renderedNodeCount &&
      baseline.renderer.directedEdgeCount ===
        expected.installedDefaultGraph.renderedDirectedEdgeCount,
    installedDefaultOrphansMatched: baseline.graphControls.includeOrphans === false,
    installedDefaultScopeCaptured:
      baseline.scopeControls.some(
        (control) => control.text === 'Vault全体' && control.pressed
      )
  }

  const protection = {
    sourceBefore,
    sourceAfter,
    sourceUnchanged: sourceBefore.combinedSha256 === sourceAfter.combinedSha256,
    isolatedVaultIgnoredTopLevelDirectory: '.tsuzune',
    isolatedVaultBefore,
    isolatedVaultAfter,
    isolatedVaultProtectedFilesUnchanged:
      isolatedVaultBefore.combinedSha256 === isolatedVaultAfter.combinedSha256,
    isolatedSettingsBefore: settingsBefore,
    isolatedSettingsAfter: settingsAfter,
    isolationConfigured: {
      userDataDirectory,
      activeVaultPath: baseline.vault.activeVaultPath,
      activeVaultMatched: baseline.vault.activeVaultMatched,
      remainingProcessesUsingIsolatedUserData: remainingIsolatedProcesses
    }
  }
  const completed =
    Object.values(baseline.assertions).every(Boolean) &&
    protection.sourceUnchanged &&
    protection.isolatedVaultProtectedFilesUnchanged
  const manifest = {
    capturedAt: new Date().toISOString(),
    stage: 'GP6 TSUZUNE Global baseline candidate',
    status: completed ? 'candidate-captured' : 'failed',
    comparisonStatus: 'not-compared',
    candidate: {
      product: 'TSUZUNE',
      version: expected.version,
      fixture: relative(repoRoot, fixtureDirectory).replaceAll('\\', '/'),
      workVault: relative(repoRoot, vaultDirectory).replaceAll('\\', '/'),
      screenshot: relative(repoRoot, screenshotPath).replaceAll('\\', '/'),
      environment: relative(repoRoot, environmentPath).replaceAll('\\', '/'),
      observation: relative(repoRoot, observationPath).replaceAll('\\', '/')
    },
    protection,
    next: 'Compare this candidate with the fixed Obsidian 1.13.4 GP6 baseline before changing product code.'
  }

  await writeFile(environmentPath, `${JSON.stringify(environment, null, 2)}\n`, 'utf8')
  await writeFile(observationPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  if (!completed) throw new Error('TSUZUNE Global baselineの構造または保護assertionが一致しません。')
  console.log(
    JSON.stringify(
      {
        status: manifest.status,
        screenshot: manifest.candidate.screenshot,
        observation: manifest.candidate.observation,
        sourceUnchanged: protection.sourceUnchanged,
        isolatedVaultProtectedFilesUnchanged:
          protection.isolatedVaultProtectedFilesUnchanged
      },
      null,
      2
    )
  )
}

await main()
