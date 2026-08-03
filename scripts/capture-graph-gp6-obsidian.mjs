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
import { release as osRelease, tmpdir } from 'node:os'
import { basename, relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const fixtureDirectory = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(repoRoot, 'work/graph-gp6')
const referenceWorkDirectory = resolve(workRoot, 'obsidian-1.13.4')
const vaultDirectory = resolve(referenceWorkDirectory, 'vault')
const userDataDirectory = resolve(referenceWorkDirectory, 'userdata')
const outputRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp6')
const outputDirectory = resolve(outputRoot, 'obsidian-1.13.4')
const screenshotPath = resolve(outputDirectory, '01-global-baseline.png')
const environmentPath = resolve(outputDirectory, 'environment.json')
const observationPath = resolve(outputDirectory, '01-global-baseline.observation.json')
const manifestPath = resolve(outputRoot, 'manifest.json')
const registryBackupPath = resolve(referenceWorkDirectory, 'obsidian-protocol-before.reg')
const stdoutPath = resolve(referenceWorkDirectory, 'obsidian-stdout.log')
const stderrPath = resolve(referenceWorkDirectory, 'obsidian-stderr.log')
const referenceRoot = resolve(
  process.env.TSUZUNE_OBSIDIAN_REFERENCE_ROOT ??
    resolve(tmpdir(), 'tsuzune-obsidian-reference-1.13.4')
)
const installerPath = resolve(referenceRoot, 'Obsidian-1.13.4.exe')
const runtimeDirectory = resolve(referenceRoot, 'runtime-gp6-x64')
const executablePath = resolve(runtimeDirectory, 'Obsidian.exe')
const asarPath = resolve(runtimeDirectory, 'resources/obsidian.asar')

const expected = {
  version: '1.13.4',
  installerSha256: '8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0',
  asarSha256: '51218495AD940A8515B202D380BDE638BE6570A198E121F7CA6D484A8A158917',
  markdownCount: 7,
  renderedNodeCount: 8,
  renderedLinkCount: 12,
  directedWikiEdgeCount: 12,
  renderedUndirectedPairCount: 8,
  viewport: { width: 1265, height: 768 },
  deviceScaleFactor: 1
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

function assertWithin(directory, path) {
  if (path !== directory && !path.startsWith(`${directory}${sep}`)) {
    throw new Error(`作業ディレクトリ外は変更できません: ${path}`)
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex').toUpperCase()
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

function queryObsidianProtocol() {
  const result = spawnSync('reg.exe', ['query', 'HKCU\\Software\\Classes\\obsidian', '/s'], {
    encoding: 'utf8',
    windowsHide: true
  })
  return {
    exists: result.status === 0,
    text: result.status === 0 ? result.stdout.replaceAll('\r\n', '\n').trim() : ''
  }
}

function exportObsidianProtocol(protocolBefore) {
  if (!protocolBefore.exists) return
  const result = spawnSync(
    'reg.exe',
    ['export', 'HKCU\\Software\\Classes\\obsidian', registryBackupPath, '/y'],
    { encoding: 'utf8', windowsHide: true }
  )
  if (result.status !== 0) {
    throw new Error(`obsidian:// 登録を退避できませんでした: ${result.stderr || result.stdout}`)
  }
}

function deleteObsidianProtocol() {
  if (!queryObsidianProtocol().exists) return
  const result = spawnSync('reg.exe', ['delete', 'HKCU\\Software\\Classes\\obsidian', '/f'], {
    encoding: 'utf8',
    windowsHide: true
  })
  if (result.status !== 0) {
    throw new Error(`obsidian:// 登録を削除できませんでした: ${result.stderr || result.stdout}`)
  }
}

function restoreObsidianProtocol(protocolBefore) {
  deleteObsidianProtocol()
  if (!protocolBefore.exists) return
  const result = spawnSync('reg.exe', ['import', registryBackupPath], {
    encoding: 'utf8',
    windowsHide: true
  })
  if (result.status !== 0) {
    throw new Error(`obsidian:// 登録を復元できませんでした: ${result.stderr || result.stdout}`)
  }
}

async function selectCdpPort() {
  const configured = process.env.TSUZUNE_OBSIDIAN_CDP_PORT
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

async function waitForCdpTarget(cdpPort, predicate, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastTargets = []
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
      lastTargets = targets.map(({ title, type, url }) => ({ title, type, url }))
      const target = targets.find(predicate)
      if (target) return target
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      // The debug endpoint is not ready yet.
    }
    await delay(100)
  }
  throw new Error(
    `ObsidianのCDP targetを待機できませんでした。lastError=${lastError ?? 'none'} targets=${JSON.stringify(lastTargets)}`
  )
}

async function connectCdp(target) {
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
    if (message.error) operation.reject(new Error(JSON.stringify(message.error)))
    else operation.resolve(message.result)
  })

  function send(method, params = {}) {
    return new Promise((resolveSend, rejectSend) => {
      const id = nextId++
      pending.set(id, { resolve: resolveSend, reject: rejectSend })
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
  await send('Page.enable')
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

function pngDimensions(bytes) {
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('PNG captureを読み取れません。')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function expandAndObserveSections(cdp) {
  const sectionCount = await cdp.evaluate(
    `document.querySelectorAll('.graph-control-section').length`
  )
  const observations = []
  for (let index = 0; index < sectionCount; index += 1) {
    const wasCollapsed = await cdp.evaluate(
      `document.querySelectorAll('.graph-control-section')[${index}].classList.contains('is-collapsed')`
    )
    if (wasCollapsed) {
      await cdp.evaluate(
        `document.querySelectorAll('.graph-control-section')[${index}].querySelector('.tree-item-self').click()`
      )
      await delay(100)
    }

    observations.push(
      await cdp.evaluate(`(() => {
        const section = document.querySelectorAll('.graph-control-section')[${index}]
        const rect = (element) => {
          const bounds = element.getBoundingClientRect()
          return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        }
        return {
          className: section.className,
          label: section.querySelector('.tree-item-inner')?.textContent.trim() ?? '',
          rect: rect(section),
          controls: [...section.querySelectorAll('.setting-item')].map((item) => {
            const checkbox = item.querySelector('.checkbox-container')
            const input = item.querySelector('input')
            const button = item.querySelector('button')
            return {
              name: item.querySelector('.setting-item-name')?.textContent.trim() ?? '',
              description: item.querySelector('.setting-item-description')?.textContent.trim() ?? '',
              type: input?.type ?? (checkbox ? 'checkbox' : button ? 'button' : 'other'),
              value: input?.value ?? button?.textContent.trim() ?? null,
              checked: checkbox ? checkbox.classList.contains('is-enabled') : null,
              min: input?.min || null,
              max: input?.max || null,
              step: input?.step || null,
              rect: rect(item)
            }
          })
        }
      })()`)
    )

    if (wasCollapsed) {
      await cdp.evaluate(
        `document.querySelectorAll('.graph-control-section')[${index}].querySelector('.tree-item-self').click()`
      )
      await delay(100)
    }
  }
  return observations
}

async function main() {
  assertWithin(resolve(repoRoot, 'work'), referenceWorkDirectory)
  assertWithin(resolve(repoRoot, 'docs/reports/assets'), outputDirectory)
  assertWithin(outputRoot, manifestPath)
  await rm(manifestPath, { force: true })
  const cdpPort = await selectCdpPort()

  if ((await sha256(installerPath)) !== expected.installerSha256) {
    throw new Error('公式Obsidian 1.13.4 installerのSHA-256が一致しません。')
  }
  if ((await sha256(asarPath)) !== expected.asarSha256) {
    throw new Error('公式Obsidian 1.13.4 obsidian.asarのSHA-256が一致しません。')
  }

  await rm(referenceWorkDirectory, { recursive: true, force: true })
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(vaultDirectory, { recursive: true })
  await mkdir(userDataDirectory, { recursive: true })
  await mkdir(outputDirectory, { recursive: true })
  await cp(fixtureDirectory, vaultDirectory, { recursive: true, force: false })

  const sourceBefore = await treeDigest(fixtureDirectory)
  const protectedBefore = await treeDigest(vaultDirectory, '.obsidian')
  const protocolBefore = queryObsidianProtocol()
  exportObsidianProtocol(protocolBefore)

  const stdoutFile = await open(stdoutPath, 'w')
  const stderrFile = await open(stderrPath, 'w')
  const args = [
    '--start-minimized',
    '--window-position=-32000,-32000',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-debugging-address=127.0.0.1',
    '--remote-allow-origins=*',
    '--force-device-scale-factor=1',
    `--window-size=${expected.viewport.width},${expected.viewport.height}`,
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--no-first-run',
    '--host-resolver-rules=MAP * 0.0.0.0',
    `--user-data-dir=${userDataDirectory}`
  ]
  const child = spawn(executablePath, args, {
    windowsHide: true,
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
    rejectUnexpectedStop(new Error(`Obsidianを起動できませんでした: ${error.message}`))
  })
  child.once('exit', (code, signal) => {
    childExit = { code, signal }
    if (!shuttingDown) {
      rejectUnexpectedStop(
        new Error(`Obsidianが途中終了しました: code=${code} signal=${signal ?? 'none'}`)
      )
    }
  })
  const whileChildAlive = (operation) => Promise.race([operation, unexpectedChildStop])

  let appCdp = null
  let completed = false
  let registryRestored = false
  let starterIsolation = null
  try {
    const starterTarget = await whileChildAlive(
      waitForCdpTarget(cdpPort, (target) => target.url.endsWith('/starter.html'))
    )
    const starterCdp = await whileChildAlive(connectCdp(starterTarget))
    starterIsolation = await whileChildAlive(starterCdp.evaluate(`(() => {
      const remote = require('@electron/remote')
      const actualUserData = remote.app.getPath('userData')
      const expectedUserData = ${JSON.stringify(userDataDirectory)}
      if (actualUserData.toLowerCase() !== expectedUserData.toLowerCase()) {
        throw new Error('隔離userDataが一致しません: ' + actualUserData)
      }
      const currentWindow = remote.getCurrentWindow()
      currentWindow.setBounds({
        x: -32000,
        y: -32000,
        width: ${expected.viewport.width},
        height: ${expected.viewport.height}
      })
      currentWindow.setSkipTaskbar(true)
      if (currentWindow.isMinimized()) currentWindow.restore()
      return { userData: actualUserData, bounds: currentWindow.getBounds() }
    })()`))
    const opened = await whileChildAlive(starterCdp.evaluate(`(() => {
      const result = require('electron').ipcRenderer.sendSync(
        'vault-open',
        ${JSON.stringify(vaultDirectory)},
        false
      )
      if (result === true) window.close()
      return result
    })()`))
    starterCdp.socket.close()
    if (opened !== true) throw new Error(`隔離Vaultを開けませんでした: ${opened}`)

    const appTarget = await whileChildAlive(
      waitForCdpTarget(cdpPort, (target) => target.url.endsWith('/index.html'))
    )
    appCdp = await whileChildAlive(connectCdp(appTarget))
    await whileChildAlive(
      waitForRenderer(
        appCdp,
        `typeof app === 'object' && app.vault.getMarkdownFiles().length === ${expected.markdownCount}`
      )
    )
    await whileChildAlive(appCdp.evaluate(`(() => {
      const currentWindow = require('@electron/remote').getCurrentWindow()
      currentWindow.setBounds({
        x: -32000,
        y: -32000,
        width: ${expected.viewport.width},
        height: ${expected.viewport.height}
      })
      currentWindow.setSkipTaskbar(true)
      if (currentWindow.isMinimized()) currentWindow.restore()
      return currentWindow.getBounds()
    })()`))
    await whileChildAlive(delay(250))

    await whileChildAlive(appCdp.evaluate(`(async () => {
      const home = app.vault.getAbstractFileByPath('00_Home.md')
      if (!home) throw new Error('00_Home.md が見つかりません。')
      await app.workspace.getLeaf(false).openFile(home)
      if (document.body.classList.contains('theme-dark')) {
        app.commands.executeCommandById('theme:toggle-light-dark')
      }
    })()`))
    await whileChildAlive(
      waitForRenderer(appCdp, `document.body.classList.contains('theme-light')`)
    )
    await whileChildAlive(appCdp.evaluate(`(() => {
      const graphButton = [...document.querySelectorAll('.side-dock-ribbon-action')]
        .find((element) => element.getAttribute('aria-label') === 'グラフビューを開く')
      if (!graphButton) throw new Error('グラフビュー入口が見つかりません。')
      graphButton.click()
    })()`))
    await whileChildAlive(
      waitForRenderer(
        appCdp,
        `app.workspace.getLeavesOfType('graph').length === 1 && document.querySelector('canvas') !== null`
      )
    )
    await whileChildAlive(
      waitForRenderer(
        appCdp,
        `app.workspace.getLeavesOfType('graph')[0].view.renderer.nodes.length === ${expected.renderedNodeCount}`
      )
    )
    await whileChildAlive(delay(4_000))

    const baseline = await whileChildAlive(appCdp.evaluate(`(() => {
      const graphView = app.workspace.getLeavesOfType('graph')[0].view
      const renderer = graphView.renderer
      const dataEngine = graphView.dataEngine
      const rect = (element) => {
        const bounds = element.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      }
      const primitiveValues = (object) => Object.fromEntries(
        Object.entries(object ?? {}).filter(([, value]) =>
          value === null || ['string', 'number', 'boolean'].includes(typeof value)
        )
      )
      const nodeId = (node) =>
        node.id ?? node.path ?? node.text ?? node.label ?? node.file?.path ?? null
      const edgeEnd = (value) => typeof value === 'object' ? nodeId(value) : value
      const resolvedEdges = []
      for (const [source, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
        for (const [target, count] of Object.entries(targets)) {
          if (!source.toLowerCase().endsWith('.md') || !target.toLowerCase().endsWith('.md')) {
            continue
          }
          resolvedEdges.push({ source, target, count, resolved: true })
        }
      }
      const unresolvedEdges = []
      for (const [source, targets] of Object.entries(app.metadataCache.unresolvedLinks)) {
        for (const [target, count] of Object.entries(targets)) {
          unresolvedEdges.push({ source, target, count, resolved: false })
        }
      }
      const controlPanel = document.querySelector('.graph-controls')
      const canvas = document.querySelector('canvas')
      return {
        capturedAt: new Date().toISOString(),
        title: document.title,
        vaultPath: app.vault.adapter.basePath,
        selectedBeforeGraph: '00_Home.md',
        renderedTheme: document.body.classList.contains('theme-light') ? 'light' : 'dark',
        bodyClass: document.body.className,
        dimensions: {
          inner: { width: innerWidth, height: innerHeight },
          outer: { width: outerWidth, height: outerHeight },
          devicePixelRatio,
          windowBounds: require('@electron/remote').getCurrentWindow().getBounds(),
          canvas: canvas ? rect(canvas) : null,
          controlPanel: controlPanel ? rect(controlPanel) : null
        },
        graphOptions: dataEngine.getOptions(),
        sections: [...document.querySelectorAll('.graph-control-section')].map((section) => ({
          className: section.className,
          label: section.querySelector('.tree-item-inner')?.textContent.trim() ?? '',
          collapsed: section.classList.contains('is-collapsed'),
          rect: rect(section)
        })),
        buttons: [...document.querySelectorAll('.graph-controls-button')].map((button) => ({
          className: button.className,
          ariaLabel: button.getAttribute('aria-label'),
          title: button.getAttribute('data-tooltip-position'),
          rect: rect(button)
        })),
        markdownFiles: app.vault.getMarkdownFiles().map((file) => file.path).sort(),
        resolvedEdges: resolvedEdges.sort((left, right) =>
          (left.source + left.target).localeCompare(right.source + right.target)
        ),
        unresolvedEdges: unresolvedEdges.sort((left, right) =>
          (left.source + left.target).localeCompare(right.source + right.target)
        ),
        renderer: {
          nodeCount: renderer.nodes.length,
          linkCount: renderer.links.length,
          scale: renderer.scale,
          panX: renderer.panX,
          panY: renderer.panY,
          width: renderer.width,
          height: renderer.height,
          idleFrames: renderer.idleFrames,
          nodes: renderer.nodes.map((node) => ({
            id: nodeId(node),
            keys: Object.keys(node),
            values: primitiveValues(node)
          })),
          links: renderer.links.map((link) => ({
            source: edgeEnd(link.source),
            target: edgeEnd(link.target),
            keys: Object.keys(link),
            values: primitiveValues(link)
          }))
        }
      }
    })()`))

    const screenshotResult = await whileChildAlive(
      appCdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false
      })
    )
    const screenshot = Buffer.from(screenshotResult.data, 'base64')
    const screenshotSize = pngDimensions(screenshot)
    await writeFile(screenshotPath, screenshot)
    baseline.controlsBySection = await whileChildAlive(expandAndObserveSections(appCdp))

    const environment = await whileChildAlive(appCdp.evaluate(`(() => ({
      product: 'Obsidian Desktop',
      obsidianVersion: require('@electron/remote').app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      userAgent: navigator.userAgent,
      navigatorLanguage: navigator.language,
      appLocale: require('@electron/remote').app.getLocale(),
      systemLocale: require('@electron/remote').app.getSystemLocale(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: process.platform,
      architecture: process.arch,
      userData: require('@electron/remote').app.getPath('userData'),
      windowVisible: require('@electron/remote').getCurrentWindow().isVisible(),
      themePreference: app.vault.getConfig('theme'),
      cssTheme: app.vault.getConfig('cssTheme'),
      accentColor: app.vault.getConfig('accentColor'),
      renderedTheme: document.body.classList.contains('theme-light') ? 'light' : 'dark'
    }))()`))
    environment.windows = {
      release: osRelease(),
      platform: process.platform,
      architecture: process.arch
    }
    environment.artifacts = {
      installer: {
        path: installerPath,
        bytes: (await stat(installerPath)).size,
        sha256: await sha256(installerPath)
      },
      executable: {
        path: executablePath,
        bytes: (await stat(executablePath)).size,
        sha256: await sha256(executablePath)
      },
      obsidianAsar: {
        path: asarPath,
        bytes: (await stat(asarPath)).size,
        sha256: await sha256(asarPath)
      }
    }
    environment.launch = {
      executable: executablePath,
      arguments: args,
      pid: child.pid,
      cdpPort,
      starterIsolation,
      networkIsolation: 'host-resolver-rules=MAP * 0.0.0.0'
    }

    const directedEdges = [...baseline.resolvedEdges, ...baseline.unresolvedEdges]
    const undirectedPairs = new Set(
      directedEdges.map(({ source, target }) => [source, target].sort().join('\0'))
    )
    baseline.summary = {
      markdownCount: baseline.markdownFiles.length,
      renderedNodeCount: baseline.renderer.nodeCount,
      renderedLinkCount: baseline.renderer.linkCount,
      directedWikiEdgeCount: directedEdges.length,
      renderedUndirectedPairCount: undirectedPairs.size,
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
        screenshotSize.height === expected.viewport.height,
      markdownCountMatched: baseline.markdownFiles.length === expected.markdownCount,
      renderedNodeCountMatched: baseline.renderer.nodeCount === expected.renderedNodeCount,
      renderedLinkCountMatched: baseline.renderer.linkCount === expected.renderedLinkCount,
      directedWikiEdgeCountMatched:
        directedEdges.length === expected.directedWikiEdgeCount,
      renderedUndirectedPairCountMatched:
        undirectedPairs.size === expected.renderedUndirectedPairCount,
      defaultFiltersMatched:
        baseline.graphOptions.showTags === false &&
        baseline.graphOptions.showAttachments === false &&
        baseline.graphOptions.hideUnresolved === false &&
        baseline.graphOptions.showOrphans === true
    }

    await writeFile(environmentPath, `${JSON.stringify(environment, null, 2)}\n`, 'utf8')
    await writeFile(observationPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    completed = Object.values(baseline.assertions).every(Boolean)
    if (childSpawnError || childExit !== null) {
      throw new Error('Obsidianが基準採取の完了前に停止しました。')
    }
  } finally {
    shuttingDown = true
    try {
      if (appCdp) {
        await Promise.race([
          appCdp.evaluate(`require('@electron/remote').app.quit()`).catch(() => undefined),
          delay(2_000)
        ])
        appCdp.socket.close()
      }
    } catch {
      // The application may already be shutting down.
    }
    const quitDeadline = Date.now() + 10_000
    while (!childSpawnError && childExit === null && Date.now() < quitDeadline) await delay(100)
    if (!childSpawnError && childExit === null && child.pid) {
      const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true
      })
      if (killed.status !== 0 && childExit === null) {
        throw new Error(`Obsidian process treeを終了できませんでした: ${killed.stderr || killed.stdout}`)
      }
      const killDeadline = Date.now() + 10_000
      while (childExit === null && Date.now() < killDeadline) await delay(100)
    }
    if (!childSpawnError && childExit === null) {
      throw new Error('Obsidian process treeの完全終了を確認できませんでした。')
    }
    await Promise.allSettled([stdoutFile.close(), stderrFile.close()])
    restoreObsidianProtocol(protocolBefore)
    const protocolAfter = queryObsidianProtocol()
    registryRestored =
      protocolAfter.exists === protocolBefore.exists && protocolAfter.text === protocolBefore.text
  }

  const sourceAfter = await treeDigest(fixtureDirectory)
  const protectedAfter = await treeDigest(vaultDirectory, '.obsidian')
  const manifest = {
    capturedAt: new Date().toISOString(),
    stage: 'GP6-0 Global baseline reference',
    status: completed && registryRestored ? 'reference-captured' : 'failed',
    comparisonStatus: 'not-compared',
    reference: {
      product: 'Obsidian Desktop',
      version: expected.version,
      fixture: relative(repoRoot, fixtureDirectory).replaceAll('\\', '/'),
      workVault: relative(repoRoot, vaultDirectory).replaceAll('\\', '/'),
      screenshot: relative(repoRoot, screenshotPath).replaceAll('\\', '/'),
      environment: relative(repoRoot, environmentPath).replaceAll('\\', '/'),
      observation: relative(repoRoot, observationPath).replaceAll('\\', '/')
    },
    protection: {
      sourceBefore,
      sourceAfter,
      sourceUnchanged: sourceBefore.combinedSha256 === sourceAfter.combinedSha256,
      isolatedVaultBefore: protectedBefore,
      isolatedVaultAfter: protectedAfter,
      isolatedVaultProtectedFilesUnchanged:
        protectedBefore.combinedSha256 === protectedAfter.combinedSha256,
      protocolBefore,
      protocolRestored: registryRestored
    },
    next: 'Capture the same GP6-0 baseline in TSUZUNE, then compare before changing product code.'
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  if (!completed) throw new Error('Obsidian baselineの構造assertionが一致しません。')
  if (!manifest.protection.sourceUnchanged || !manifest.protection.isolatedVaultProtectedFilesUnchanged) {
    throw new Error('Fixtureまたは隔離Vaultの保護対象ファイルが変更されました。')
  }
  if (!registryRestored) throw new Error('obsidian:// 登録を開始前の値へ復元できませんでした。')

  console.log(
    JSON.stringify(
      {
        status: manifest.status,
        screenshot: manifest.reference.screenshot,
        observation: manifest.reference.observation,
        sourceUnchanged: manifest.protection.sourceUnchanged,
        isolatedVaultProtectedFilesUnchanged:
          manifest.protection.isolatedVaultProtectedFilesUnchanged,
        protocolRestored: manifest.protection.protocolRestored
      },
      null,
      2
    )
  )
}

await main()
