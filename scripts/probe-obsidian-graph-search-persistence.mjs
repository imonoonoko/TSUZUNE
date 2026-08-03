import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { cp, mkdir, open, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const cameraProbe =
  process.argv.includes('--camera') || process.env.TSUZUNE_GRAPH_CAMERA_PROBE === '1'
const fixtureDirectory = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(repoRoot, cameraProbe ? 'work/gp0-camera' : 'work/gp0-search')
const referenceWorkDirectory = resolve(workRoot, 'obsidian-1.13.4')
const vaultDirectory = resolve(referenceWorkDirectory, 'vault')
const userDataDirectory = resolve(referenceWorkDirectory, 'userdata')
const outputRoot = resolve(
  repoRoot,
  cameraProbe
    ? 'docs/reports/assets/graph-gp0-camera-persistence'
    : 'docs/reports/assets/graph-gp0-search-persistence'
)
const outputDirectory = resolve(outputRoot, 'obsidian-1.13.4')
const observationPath = resolve(outputDirectory, 'observation.json')
const manifestPath = resolve(outputRoot, 'manifest.json')
const registryBackupPath = resolve(referenceWorkDirectory, 'obsidian-protocol-before.reg')
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
  search: cameraProbe ? '' : 'path:"10_projects"',
  filteredNodeIds: cameraProbe
    ? [
        '00_Home.md',
        '10_projects/Project Alpha.md',
        '10_projects/Project Beta.md',
        '20_knowledge/Distillation.md',
        '20_knowledge/Reference.md',
        '80_excluded/Hidden.md',
        '90_orphan/Orphan.md',
        'Missing Note'
      ]
    : ['10_projects/Project Alpha.md', '10_projects/Project Beta.md'],
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
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push({ path, relativePath })
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
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.once('error', rejectPort)
    server.listen(0, '127.0.0.1', () => {
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

async function listCdpTargets(cdpPort) {
  return (await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()).map((target) => ({
    ...target,
    summary: { title: target.title, type: target.type, url: target.url }
  }))
}

async function waitForCdpTarget(cdpPort, predicate, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastTargets = []
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const targets = await listCdpTargets(cdpPort)
      lastTargets = targets.map(({ summary }) => summary)
      const target = targets.find(predicate)
      if (target) return target
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
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

function nodeIdExpression() {
  return `(node) => node.id ?? node.path ?? node.text ?? node.label ?? node.file?.path ?? null`
}

async function observeGraph(cdp, label) {
  return cdp.evaluate(`(() => {
    const leaf = app.workspace.getLeavesOfType('graph')[0]
    if (!leaf) throw new Error('Global Graphが開いていません。')
    const view = leaf.view
    const nodeId = ${nodeIdExpression()}
    const input = document.querySelector('.graph-control-section.mod-filter input[type="search"]')
    const window = require('@electron/remote').getCurrentWindow()
    return {
      label: ${JSON.stringify(label)},
      capturedAt: new Date().toISOString(),
      processId: process.pid,
      vaultPath: app.vault.adapter.basePath,
      renderedTheme: document.body.classList.contains('theme-light') ? 'light' : 'dark',
      graphLeafCount: app.workspace.getLeavesOfType('graph').length,
      searchInputValue: input?.value ?? null,
      graphOptionsSearch: view.dataEngine.getOptions().search,
      camera: {
        targetScale: view.renderer.targetScale,
        scale: view.renderer.scale,
        panX: view.renderer.panX,
        panY: view.renderer.panY,
        width: view.renderer.width,
        height: view.renderer.height,
        devicePixelRatio,
        panOffsetX: view.renderer.panX - view.renderer.width * devicePixelRatio / 2,
        panOffsetY: view.renderer.panY - view.renderer.height * devicePixelRatio / 2,
        graphOptionsScale: view.dataEngine.getOptions().scale
      },
      renderedNodeIds: view.renderer.nodes.map(nodeId).filter(Boolean).sort(),
      renderedNodeCount: view.renderer.nodes.length,
      renderedLinkCount: view.renderer.links.length,
      windowBounds: window.getBounds(),
      windowVisible: window.isVisible(),
      windowSkipTaskbarRequested: true
    }
  })()`)
}

async function captureScreenshot(cdp, path) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  })
  const bytes = Buffer.from(result.data, 'base64')
  await writeFile(path, bytes)
  return {
    path: relative(repoRoot, path).replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase()
  }
}

async function openGlobalGraph(cdp) {
  await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.side-dock-ribbon-action')]
      .find((element) => element.getAttribute('aria-label') === 'グラフビューを開く')
    if (!button) throw new Error('グラフビュー入口が見つかりません。')
    button.click()
  })()`)
  await waitForRenderer(
    cdp,
    `app.workspace.getLeavesOfType('graph').length === 1 && document.querySelector('canvas') !== null`
  )
  await delay(1_200)
}

async function setGraphSearch(cdp, query) {
  await cdp.evaluate(`(() => {
    const section = document.querySelector('.graph-control-section.mod-filter')
    if (!section) throw new Error('Graph filter sectionが見つかりません。')
    if (section.classList.contains('is-collapsed')) section.querySelector('.tree-item-self').click()
    const input = section.querySelector('input[type="search"]')
    if (!input) throw new Error('Graph search inputが見つかりません。')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(query)})
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await waitForRenderer(
    cdp,
    `app.workspace.getLeavesOfType('graph')[0]?.view.dataEngine.getOptions().search === ${JSON.stringify(query)}`
  )
  await waitForRenderer(
    cdp,
    `JSON.stringify(app.workspace.getLeavesOfType('graph')[0]?.view.renderer.nodes.map(${nodeIdExpression()}).filter(Boolean).sort()) === ${JSON.stringify(JSON.stringify(expected.filteredNodeIds))}`
  )
  await delay(500)
}

async function applyCameraInput(cdp) {
  const canvas = await cdp.evaluate(`(() => {
    const element = app.workspace.getLeavesOfType('graph')[0]?.view.renderer.interactiveEl
    if (!element) throw new Error('Graph canvasが見つかりません。')
    const bounds = element.getBoundingClientRect()
    return {
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2
    }
  })()`)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: canvas.centerX,
    y: canvas.centerY,
    deltaX: 0,
    deltaY: -120
  })
  await delay(350)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: canvas.centerX,
    y: canvas.centerY,
    button: 'left',
    buttons: 1,
    clickCount: 1
  })
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: canvas.centerX + 96,
    y: canvas.centerY + 64,
    button: 'left',
    buttons: 1
  })
  await delay(150)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: canvas.centerX + 96,
    y: canvas.centerY + 64,
    button: 'left',
    buttons: 0,
    clickCount: 1
  })
  const targetScale = await cdp.evaluate(
    `app.workspace.getLeavesOfType('graph')[0].view.renderer.targetScale`
  )
  await waitForRenderer(
    cdp,
    `Math.abs(app.internalPlugins.getPluginById('graph').instance.options.scale - ${targetScale}) < 0.000001`
  )
  await delay(500)
}

async function launchSession(sessionNumber) {
  const cdpPort = await selectCdpPort()
  const stdoutPath = resolve(referenceWorkDirectory, `session-${sessionNumber}-stdout.log`)
  const stderrPath = resolve(referenceWorkDirectory, `session-${sessionNumber}-stderr.log`)
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
  let phase = 'spawned'
  let childExit = null
  let childSpawnError = null
  let rejectUnexpectedStop
  const unexpectedChildStop = new Promise((_, reject) => {
    rejectUnexpectedStop = reject
  })
  child.once('error', (error) => {
    childSpawnError = error
    rejectUnexpectedStop(new Error(`Obsidianを起動できませんでした: ${error.message}`))
  })
  child.once('exit', (code, signal) => {
    childExit = { code, signal, at: new Date().toISOString() }
    if (!shuttingDown) {
      rejectUnexpectedStop(
        new Error(
          `Obsidianが途中終了しました: phase=${phase} code=${code} signal=${signal ?? 'none'}`
        )
      )
    }
  })
  const whileChildAlive = (operation) => Promise.race([operation, unexpectedChildStop])

  let cdp = null
  let starterUsed = false
  try {
    const firstTarget = await whileChildAlive(
      waitForCdpTarget(
        cdpPort,
        (target) => target.url.endsWith('/starter.html') || target.url.endsWith('/index.html')
      )
    )
    phase = `target:${firstTarget.url.endsWith('/starter.html') ? 'starter' : 'index'}`
    if (firstTarget.url.endsWith('/starter.html')) {
      starterUsed = true
      const starterCdp = await whileChildAlive(connectCdp(firstTarget))
      await whileChildAlive(starterCdp.evaluate(`(() => {
        const remote = require('@electron/remote')
        const actualUserData = remote.app.getPath('userData')
        const expectedUserData = ${JSON.stringify(userDataDirectory)}
        if (actualUserData.toLowerCase() !== expectedUserData.toLowerCase()) {
          throw new Error('隔離userDataが一致しません: ' + actualUserData)
        }
        const window = remote.getCurrentWindow()
        window.setBounds({ x: -32000, y: -32000, width: ${expected.viewport.width}, height: ${expected.viewport.height} })
        window.setSkipTaskbar(true)
        if (window.isMinimized()) window.restore()
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
      phase = `vault-open:${String(opened)}`
      starterCdp.socket.close()
      if (opened !== true) throw new Error(`隔離Vaultを開けませんでした: ${opened}`)
    }

    const appTarget = firstTarget.url.endsWith('/index.html')
      ? firstTarget
      : await whileChildAlive(waitForCdpTarget(cdpPort, (target) => target.url.endsWith('/index.html')))
    cdp = await whileChildAlive(connectCdp(appTarget))
    phase = 'app-cdp-connected'
    await whileChildAlive(
      waitForRenderer(
        cdp,
        `typeof app === 'object' && app.vault.getMarkdownFiles().length === ${expected.markdownCount}`
      )
    )
    phase = 'vault-ready'
    const isolation = await whileChildAlive(cdp.evaluate(`(() => {
      const remote = require('@electron/remote')
      const actualUserData = remote.app.getPath('userData')
      const actualVault = app.vault.adapter.basePath
      if (actualUserData.toLowerCase() !== ${JSON.stringify(userDataDirectory)}.toLowerCase()) {
        throw new Error('隔離userDataが一致しません: ' + actualUserData)
      }
      if (actualVault.toLowerCase() !== ${JSON.stringify(vaultDirectory)}.toLowerCase()) {
        throw new Error('隔離Vaultが一致しません: ' + actualVault)
      }
      const window = remote.getCurrentWindow()
      window.setBounds({ x: -32000, y: -32000, width: ${expected.viewport.width}, height: ${expected.viewport.height} })
      window.setSkipTaskbar(true)
      if (window.isMinimized()) window.restore()
      return {
        userData: actualUserData,
        vault: actualVault,
        bounds: window.getBounds(),
        skipTaskbarRequested: true
      }
    })()`))
    await whileChildAlive(delay(250))
    phase = 'ready'
    return {
      sessionNumber,
      child,
      cdp,
      cdpPort,
      args,
      isolation,
      starterUsed,
      startedAt: new Date().toISOString(),
      getExit: () => childExit,
      whileChildAlive,
      async stop() {
        shuttingDown = true
        try {
          await Promise.race([
            cdp.evaluate(`require('@electron/remote').app.quit()`).catch(() => undefined),
            delay(2_000)
          ])
          cdp.socket.close()
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
        return childExit
      }
    }
  } catch (error) {
    shuttingDown = true
    if (cdp) cdp.socket.close()
    if (!childSpawnError && childExit === null && child.pid) {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true
      })
    }
    await Promise.allSettled([stdoutFile.close(), stderrFile.close()])
    throw error
  }
}

async function main() {
  assertWithin(resolve(repoRoot, 'work'), referenceWorkDirectory)
  assertWithin(resolve(repoRoot, 'docs/reports/assets'), outputDirectory)
  assertWithin(outputRoot, manifestPath)

  if ((await sha256(installerPath)) !== expected.installerSha256) {
    throw new Error('公式Obsidian 1.13.4 installerのSHA-256が一致しません。')
  }
  if ((await sha256(asarPath)) !== expected.asarSha256) {
    throw new Error('公式Obsidian 1.13.4 obsidian.asarのSHA-256が一致しません。')
  }

  await rm(referenceWorkDirectory, { recursive: true, force: true })
  await rm(outputDirectory, { recursive: true, force: true })
  await rm(manifestPath, { force: true })
  await rm(resolve(outputRoot, 'comparison.json'), { force: true })
  await mkdir(vaultDirectory, { recursive: true })
  await mkdir(userDataDirectory, { recursive: true })
  await mkdir(outputDirectory, { recursive: true })
  await cp(fixtureDirectory, vaultDirectory, { recursive: true, force: false })
  const isolatedVaultId = createHash('md5').update(vaultDirectory).digest('hex').slice(0, 16)
  await writeFile(
    resolve(userDataDirectory, 'obsidian.json'),
    `${JSON.stringify({
      vaults: {
        [isolatedVaultId]: { path: vaultDirectory, ts: Date.now(), open: true }
      }
    })}\n`,
    'utf8'
  )

  const sourceBefore = await treeDigest(fixtureDirectory)
  const protectedBefore = await treeDigest(vaultDirectory, '.obsidian')
  const protocolBefore = queryObsidianProtocol()
  exportObsidianProtocol(protocolBefore)

  const observations = {}
  const sessions = []
  let protocolRestored = false
  try {
    const first = await launchSession(1)
    sessions.push(first)
    await first.whileChildAlive(first.cdp.evaluate(`(async () => {
      const home = app.vault.getAbstractFileByPath('00_Home.md')
      if (!home) throw new Error('00_Home.md が見つかりません。')
      await app.workspace.getLeaf(false).openFile(home)
      if (document.body.classList.contains('theme-dark')) {
        app.commands.executeCommandById('theme:toggle-light-dark')
      }
    })()`))
    await first.whileChildAlive(waitForRenderer(first.cdp, `document.body.classList.contains('theme-light')`))
    if ((await first.cdp.evaluate(`app.workspace.getLeavesOfType('graph').length`)) === 0) {
      await first.whileChildAlive(openGlobalGraph(first.cdp))
    }
    await first.whileChildAlive(setGraphSearch(first.cdp, expected.search))
    if (cameraProbe) {
      observations.beforeEntry = await first.whileChildAlive(
        observeGraph(first.cdp, 'before-camera-input')
      )
      observations.beforeEntry.screenshot = await first.whileChildAlive(
        captureScreenshot(first.cdp, resolve(outputDirectory, '00-baseline.png'))
      )
      await first.whileChildAlive(applyCameraInput(first.cdp))
    }
    observations.afterEntry = await first.whileChildAlive(observeGraph(first.cdp, 'after-entry'))
    observations.afterEntry.screenshot = await first.whileChildAlive(
      captureScreenshot(
        first.cdp,
        resolve(outputDirectory, cameraProbe ? '01-after-camera-input.png' : '01-after-entry.png')
      )
    )

    await first.whileChildAlive(first.cdp.evaluate(`(() => {
      const leaf = app.workspace.getLeavesOfType('graph')[0]
      if (!leaf) throw new Error('閉じるGlobal Graphがありません。')
      leaf.detach()
    })()`))
    await first.whileChildAlive(waitForRenderer(first.cdp, `app.workspace.getLeavesOfType('graph').length === 0`))
    await first.whileChildAlive(openGlobalGraph(first.cdp))
    observations.afterGraphReopen = await first.whileChildAlive(
      observeGraph(first.cdp, 'after-graph-reopen')
    )
    observations.afterGraphReopen.screenshot = await first.whileChildAlive(
      captureScreenshot(first.cdp, resolve(outputDirectory, '02-after-graph-reopen.png'))
    )
    const firstExit = await first.stop()

    const second = await launchSession(2)
    sessions.push(second)
    await second.whileChildAlive(second.cdp.evaluate(`(() => {
      if (document.body.classList.contains('theme-dark')) {
        app.commands.executeCommandById('theme:toggle-light-dark')
      }
    })()`))
    await second.whileChildAlive(
      waitForRenderer(second.cdp, `document.body.classList.contains('theme-light')`)
    )
    const graphLeafCountAtRestart = await second.whileChildAlive(
      second.cdp.evaluate(`app.workspace.getLeavesOfType('graph').length`)
    )
    if (graphLeafCountAtRestart === 0) await second.whileChildAlive(openGlobalGraph(second.cdp))
    else await second.whileChildAlive(delay(1_200))
    observations.afterAppRestart = await second.whileChildAlive(
      observeGraph(second.cdp, 'after-app-restart')
    )
    observations.afterAppRestart.graphLeafCountAtRestart = graphLeafCountAtRestart
    observations.afterAppRestart.screenshot = await second.whileChildAlive(
      captureScreenshot(second.cdp, resolve(outputDirectory, '03-after-app-restart.png'))
    )
    const secondExit = await second.stop()

    observations.sessions = [
      {
        sessionNumber: first.sessionNumber,
        pid: first.child.pid,
        cdpPort: first.cdpPort,
        startedAt: first.startedAt,
        exited: firstExit,
        starterUsed: first.starterUsed,
        isolation: first.isolation
      },
      {
        sessionNumber: second.sessionNumber,
        pid: second.child.pid,
        cdpPort: second.cdpPort,
        startedAt: second.startedAt,
        exited: secondExit,
        starterUsed: second.starterUsed,
        isolation: second.isolation
      }
    ]
  } finally {
    for (const session of sessions) {
      if (session.getExit() === null) await session.stop().catch(() => undefined)
    }
    restoreObsidianProtocol(protocolBefore)
    const protocolAfter = queryObsidianProtocol()
    protocolRestored =
      protocolAfter.exists === protocolBefore.exists && protocolAfter.text === protocolBefore.text
  }

  const sourceAfter = await treeDigest(fixtureDirectory)
  const protectedAfter = await treeDigest(vaultDirectory, '.obsidian')
  const cameraChanged = cameraProbe
    ? observations.beforeEntry.camera.targetScale !== observations.afterEntry.camera.targetScale ||
      observations.beforeEntry.camera.panOffsetX !== observations.afterEntry.camera.panOffsetX ||
      observations.beforeEntry.camera.panOffsetY !== observations.afterEntry.camera.panOffsetY
    : null
  const cameraContract = cameraProbe
    ? {
        afterInput: observations.afterEntry.camera,
        afterGraphReopen: observations.afterGraphReopen.camera,
        afterAppRestart: observations.afterAppRestart.camera,
        zoomPersistedAfterGraphReopen:
          Math.abs(
            observations.afterEntry.camera.targetScale -
              observations.afterGraphReopen.camera.targetScale
          ) < 0.000001,
        panResetAfterGraphReopen:
          Math.abs(observations.afterGraphReopen.camera.panOffsetX) < 1 &&
          Math.abs(observations.afterGraphReopen.camera.panOffsetY) < 1,
        zoomPersistedAfterAppRestart:
          Math.abs(
            observations.afterEntry.camera.targetScale -
              observations.afterAppRestart.camera.targetScale
          ) < 0.000001,
        panResetAfterAppRestart:
          Math.abs(observations.afterAppRestart.camera.panOffsetX) < 1 &&
          Math.abs(observations.afterAppRestart.camera.panOffsetY) < 1
      }
    : null
  const exactNodeIds = (observation) =>
    JSON.stringify(observation.renderedNodeIds) === JSON.stringify(expected.filteredNodeIds)
  const assertions = {
    queryAccepted: observations.afterEntry.graphOptionsSearch === expected.search,
    queryVisibleAfterEntry: observations.afterEntry.searchInputValue === expected.search,
    filteredNodesAfterEntry: exactNodeIds(observations.afterEntry),
    queryPersistedAfterGraphReopen:
      observations.afterGraphReopen.graphOptionsSearch === expected.search &&
      observations.afterGraphReopen.searchInputValue === expected.search,
    filteredNodesAfterGraphReopen: exactNodeIds(observations.afterGraphReopen),
    firstProcessExitedBeforeRestart: observations.sessions[0].exited !== null,
    secondProcessStarted: observations.sessions[1].startedAt > observations.sessions[0].exited.at,
    queryPersistedAfterAppRestart:
      observations.afterAppRestart.graphOptionsSearch === expected.search &&
      observations.afterAppRestart.searchInputValue === expected.search,
    filteredNodesAfterAppRestart: exactNodeIds(observations.afterAppRestart),
    ...(cameraProbe
      ? {
          cameraInputChanged: cameraChanged,
          zoomPersistedAfterGraphReopen: cameraContract.zoomPersistedAfterGraphReopen,
          panResetAfterGraphReopen: cameraContract.panResetAfterGraphReopen,
          zoomPersistedAfterAppRestart: cameraContract.zoomPersistedAfterAppRestart,
          panResetAfterAppRestart: cameraContract.panResetAfterAppRestart
        }
      : {}),
    lightThemeEveryObservation: [
      observations.afterEntry,
      observations.afterGraphReopen,
      observations.afterAppRestart
    ].every((observation) => observation.renderedTheme === 'light'),
    isolatedUserDataEverySession: observations.sessions.every(
      (session) => session.isolation.userData.toLowerCase() === userDataDirectory.toLowerCase()
    ),
    isolatedVaultEverySession: observations.sessions.every(
      (session) => session.isolation.vault.toLowerCase() === vaultDirectory.toLowerCase()
    ),
    offscreenEverySession: observations.sessions.every(
      (session) => session.isolation.bounds.x === -32000 && session.isolation.bounds.y === -32000
    ),
    sourceUnchanged: sourceBefore.combinedSha256 === sourceAfter.combinedSha256,
    isolatedVaultProtectedFilesUnchanged:
      protectedBefore.combinedSha256 === protectedAfter.combinedSha256,
    protocolRestored
  }
  const manifest = {
    capturedAt: new Date().toISOString(),
    stage: cameraProbe
      ? 'GP0-3b-c Obsidian Global Graph camera persistence probe'
      : 'GP0-3b Obsidian Global Graph search persistence probe',
    status: Object.values(assertions).every(Boolean) ? 'reference-captured' : 'failed',
    scope: {
      product: 'Obsidian Desktop',
      version: expected.version,
      query: expected.search,
      cameraProbe,
      lifecycle: ['entry', 'graph-close-reopen', 'full-app-restart'],
      fixture: relative(repoRoot, fixtureDirectory).replaceAll('\\', '/'),
      isolatedVault: relative(repoRoot, vaultDirectory).replaceAll('\\', '/'),
      observation: relative(repoRoot, observationPath).replaceAll('\\', '/')
    },
    runtime: {
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
    },
    assertions,
    cameraContract,
    protection: {
      sourceBefore,
      sourceAfter,
      isolatedVaultBefore: protectedBefore,
      isolatedVaultAfter: protectedAfter,
      protocolBefore,
      protocolRestored
    }
  }
  await writeFile(observationPath, `${JSON.stringify({ expected, ...observations }, null, 2)}\n`, 'utf8')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  if (manifest.status !== 'reference-captured') {
    throw new Error(`Obsidian Graph search persistence assertionが一致しません: ${JSON.stringify(assertions)}`)
  }

  console.log(
    JSON.stringify(
      {
        status: manifest.status,
        query: expected.search,
        afterGraphReopen: observations.afterGraphReopen.graphOptionsSearch,
        afterAppRestart: observations.afterAppRestart.graphOptionsSearch,
        filteredNodeIds: observations.afterAppRestart.renderedNodeIds,
        cameraContract,
        observation: manifest.scope.observation,
        sourceUnchanged: assertions.sourceUnchanged,
        isolatedVaultProtectedFilesUnchanged: assertions.isolatedVaultProtectedFilesUnchanged,
        protocolRestored: assertions.protocolRestored
      },
      null,
      2
    )
  )
}

await main()
