import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { cp, mkdir, open, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const cameraProbe =
  process.argv.includes('--camera') || process.env.TSUZUNE_GRAPH_CAMERA_PROBE === '1'
const nodeDragProbe =
  process.argv.includes('--node-drag') || process.env.TSUZUNE_GRAPH_NODE_DRAG_PROBE === '1'
const attachmentNewTabProbe =
  process.argv.includes('--attachment-new-tab') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_NEW_TAB_PROBE === '1'
const attachmentNewWindowProbe =
  process.argv.includes('--attachment-new-window') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_NEW_WINDOW_PROBE === '1'
const attachmentMoveProbe =
  process.argv.includes('--attachment-move') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_MOVE_PROBE === '1'
const attachmentBookmarkProbe =
  process.argv.includes('--attachment-bookmark') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_BOOKMARK_PROBE === '1'
const attachmentPathCopyProbe =
  process.argv.includes('--attachment-path-copy') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_PATH_COPY_PROBE === '1'
const attachmentPathCopyScenario =
  process.argv.find((argument) => argument.startsWith('--path-copy-scenario='))?.split('=', 2)[1] ??
  process.env.TSUZUNE_GRAPH_ATTACHMENT_PATH_COPY_SCENARIO ??
  'vault'
if (attachmentPathCopyProbe && !['url', 'vault', 'system'].includes(attachmentPathCopyScenario)) {
  throw new Error('--path-copy-scenario は url、vault、system のいずれかです。')
}
const attachmentBookmarkScenario =
  process.argv.find((argument) => argument.startsWith('--bookmark-scenario='))?.split('=', 2)[1] ??
  process.env.TSUZUNE_GRAPH_ATTACHMENT_BOOKMARK_SCENARIO ??
  'create'
if (
  attachmentBookmarkProbe &&
  !['cancel', 'create', 'duplicate'].includes(attachmentBookmarkScenario)
) {
  throw new Error('--bookmark-scenario は cancel、create、duplicate のいずれかです。')
}
const attachmentMoveScenario =
  process.argv.find((argument) => argument.startsWith('--move-scenario='))?.split('=', 2)[1] ??
  process.env.TSUZUNE_GRAPH_ATTACHMENT_MOVE_SCENARIO ??
  'success'
if (
  attachmentMoveProbe &&
  !['cancel', 'success', 'collision'].includes(attachmentMoveScenario)
) {
  throw new Error('--move-scenario は cancel、success、collision のいずれかです。')
}
const nodeNewTabProbe =
  process.argv.includes('--node-new-tab') ||
  process.env.TSUZUNE_GRAPH_NODE_NEW_TAB_PROBE === '1'
const nodeMenuProbe =
  nodeNewTabProbe || attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe ||
  attachmentBookmarkProbe || attachmentPathCopyProbe ||
  process.argv.includes('--node-menu') ||
  process.env.TSUZUNE_GRAPH_NODE_MENU_PROBE === '1'
if (
  [
    cameraProbe,
    nodeDragProbe,
    nodeMenuProbe && !nodeNewTabProbe && !attachmentNewTabProbe && !attachmentNewWindowProbe && !attachmentMoveProbe && !attachmentBookmarkProbe && !attachmentPathCopyProbe,
    nodeNewTabProbe,
    attachmentNewTabProbe,
    attachmentNewWindowProbe,
    attachmentMoveProbe,
    attachmentBookmarkProbe,
    attachmentPathCopyProbe
  ].filter(Boolean).length > 1
) {
  throw new Error(
    '--camera、--node-drag、--node-menu、--node-new-tab、--attachment-new-tab、--attachment-new-window、--attachment-move、--attachment-bookmark、--attachment-path-copy は同時に指定できません。'
  )
}
const probeKind = attachmentPathCopyProbe
  ? `attachment-path-copy-${attachmentPathCopyScenario}`
  : attachmentBookmarkProbe
  ? `attachment-bookmark-${attachmentBookmarkScenario}`
  : attachmentMoveProbe
  ? `attachment-file-move-${attachmentMoveScenario}`
  : attachmentNewWindowProbe
  ? 'attachment-new-window'
  : attachmentNewTabProbe
  ? 'attachment-new-tab'
  : nodeNewTabProbe
  ? 'node-new-tab'
  : nodeMenuProbe
  ? 'node-context-menu'
  : nodeDragProbe
    ? 'node-drag'
    : cameraProbe
      ? 'camera'
      : 'search'
const fixtureDirectory = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(
  repoRoot,
  attachmentPathCopyProbe
    ? 'work/gp0-attachment-path-copy-capture'
    : `work/gp0-${probeKind}-capture`
)
const referenceWorkDirectory = resolve(workRoot, 'obsidian-1.13.4')
const vaultDirectory = resolve(referenceWorkDirectory, 'vault')
const userDataDirectory = resolve(referenceWorkDirectory, 'userdata')
const outputRoot = resolve(
  repoRoot,
  attachmentPathCopyProbe
    ? `docs/reports/assets/graph-gp0-attachment-path-copy/${attachmentPathCopyScenario}`
    : attachmentBookmarkProbe
    ? `docs/reports/assets/graph-gp0-attachment-bookmark/${attachmentBookmarkScenario}`
    : attachmentMoveProbe
    ? `docs/reports/assets/graph-gp0-attachment-file-move/${attachmentMoveScenario}`
    : probeKind === 'attachment-new-window'
    ? 'docs/reports/assets/graph-gp0-attachment-new-window'
    : probeKind === 'attachment-new-tab'
    ? 'docs/reports/assets/graph-gp0-attachment-new-tab'
    : probeKind === 'node-new-tab'
    ? 'docs/reports/assets/graph-gp0-node-new-tab'
    : probeKind === 'node-context-menu'
    ? 'docs/reports/assets/graph-gp0-node-context-menu'
    : probeKind === 'node-drag'
      ? 'docs/reports/assets/graph-gp0-node-drag-persistence'
    : cameraProbe
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
  search: cameraProbe || nodeDragProbe || nodeMenuProbe ? '' : 'path:"10_projects"',
  filteredNodeIds: attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe
    ? [
        '00_Home.md',
        '10_projects/Project Alpha.md',
        '10_projects/Project Beta.md',
        '20_knowledge/Distillation.md',
        '20_knowledge/Reference.md',
        ...(attachmentMoveProbe && attachmentMoveScenario === 'collision'
          ? ['20_knowledge/diagram.svg']
          : []),
        '80_excluded/Hidden.md',
        '90_orphan/Orphan.md',
        'Missing Note',
        'attachments/diagram.svg'
      ].sort()
    : cameraProbe || nodeDragProbe || nodeMenuProbe
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
  deviceScaleFactor: 1,
  attachmentPathCopy: {
    targetNodeId: 'attachments/diagram.svg',
    scenario: attachmentPathCopyScenario,
    submenuItems: ['Obsidian URL として', '保管庫フォルダから', 'システムルートから'],
    submenuChoice:
      attachmentPathCopyScenario === 'url'
        ? 'Obsidian URL として'
        : attachmentPathCopyScenario === 'system'
          ? 'システムルートから'
          : '保管庫フォルダから',
    clipboardText:
      attachmentPathCopyScenario === 'url'
        ? 'obsidian://open?vault=vault&file=attachments%2Fdiagram.svg'
        : attachmentPathCopyScenario === 'system'
          ? resolve(vaultDirectory, 'attachments/diagram.svg')
          : 'attachments/diagram.svg',
    menuItems: [
      'diagram.svg',
      '新規タブに開く',
      '新規ウィンドウで開く',
      'ファイルを移動…',
      'ブックマーク…',
      'パスをコピー',
      'リンクされたビューを開く',
      'デフォルトアプリで開く',
      'フォルダで表示',
      'ファイルエクスプローラでファイルを表示',
      'ファイルを削除'
    ]
  },
  drag: {
    targetNodeId:
      attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe
        ? 'attachments/diagram.svg'
        : '00_Home.md',
    deltaX: 96,
    deltaY: 64
  }
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

function sanitizeEvidence(value, replacements) {
  if (typeof value === 'string') {
    return replacements.reduce((sanitized, [source, token]) => {
      if (!source) return sanitized
      return sanitized
        .replaceAll(source, token)
        .replaceAll(source.replaceAll('\\', '/'), token)
    }, value)
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidence(item, replacements))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeEvidence(item, replacements)])
    )
  }
  return value
}

const pathCopyEvidenceReplacements = [
  [vaultDirectory, '<OBSIDIAN_VAULT_ROOT>'],
  [userDataDirectory, '<OBSIDIAN_USER_DATA_ROOT>'],
  [installerPath, '<OBSIDIAN_INSTALLER>'],
  [executablePath, '<OBSIDIAN_EXECUTABLE>'],
  [asarPath, '<OBSIDIAN_ASAR>'],
  [referenceRoot, '<OBSIDIAN_REFERENCE_ROOT>'],
  [referenceWorkDirectory, '<OBSIDIAN_WORK_ROOT>'],
  [repoRoot, '<REPO_ROOT>']
].sort(([left], [right]) => right.length - left.length)

const repositoryEvidence = (value) =>
  attachmentPathCopyProbe ? sanitizeEvidence(value, pathCopyEvidenceReplacements) : value

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

async function optionalJsonFileState(path) {
  try {
    const bytes = await readFile(path)
    const text = bytes.toString('utf8')
    let json = null
    let parseError = null
    try {
      json = JSON.parse(text)
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error)
    }
    return {
      exists: true,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase(),
      json,
      parseError
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, bytes: 0, sha256: null, json: null, parseError: null }
    throw error
  }
}

async function snapshotBookmarkPersistence(label) {
  return {
    label,
    capturedAt: new Date().toISOString(),
    vaultContent: await treeDigest(vaultDirectory, '.obsidian'),
    workspace: await optionalJsonFileState(resolve(vaultDirectory, '.obsidian/workspace.json')),
    bookmarks: await optionalJsonFileState(resolve(vaultDirectory, '.obsidian/bookmarks.json'))
  }
}

function bookmarkPathCount(json, targetPath) {
  if (Array.isArray(json)) {
    return json.reduce((count, value) => count + bookmarkPathCount(value, targetPath), 0)
  }
  if (!json || typeof json !== 'object') return 0
  const direct = json.path === targetPath ? 1 : 0
  return direct + Object.values(json).reduce(
    (count, value) => count + bookmarkPathCount(value, targetPath),
    0
  )
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
    const edgeEnd = (value) => typeof value === 'object' ? nodeId(value) : value
    const cacheLinks = (links, resolved) => Object.entries(links ?? {}).flatMap(
      ([source, targets]) => Object.entries(targets).map(([target, count]) => ({
        source,
        target,
        count,
        resolved
      }))
    ).sort((left, right) =>
      left.source.localeCompare(right.source) || left.target.localeCompare(right.target)
    )
    const input = document.querySelector('.graph-control-section.mod-filter input[type="search"]')
    const window = require('@electron/remote').getCurrentWindow()
    const interactiveBounds = view.renderer.interactiveEl?.getBoundingClientRect() ?? null
    const targetNode = view.renderer.nodes.find(
      (node) => nodeId(node) === ${JSON.stringify(expected.drag.targetNodeId)}
    )
    const targetNodeObservation = targetNode && interactiveBounds
      ? {
          id: nodeId(targetNode),
          x: targetNode.x,
          y: targetNode.y,
          fx: Number.isFinite(targetNode.fx) ? targetNode.fx : null,
          fy: Number.isFinite(targetNode.fy) ? targetNode.fy : null,
          fixed: Number.isFinite(targetNode.fx) && Number.isFinite(targetNode.fy),
          clientX:
            interactiveBounds.left +
            (view.renderer.panX + targetNode.x * view.renderer.scale) / devicePixelRatio,
          clientY:
            interactiveBounds.top +
            (view.renderer.panY + targetNode.y * view.renderer.scale) / devicePixelRatio
        }
      : null
    return {
      label: ${JSON.stringify(label)},
      capturedAt: new Date().toISOString(),
      processId: process.pid,
      vaultPath: app.vault.adapter.basePath,
      renderedTheme: document.body.classList.contains('theme-light') ? 'light' : 'dark',
      graphLeafCount: app.workspace.getLeavesOfType('graph').length,
      activeFile: app.workspace.getActiveFile()?.path ?? null,
      activeLeaf: app.workspace.activeLeaf
        ? {
            id: app.workspace.activeLeaf.id ?? null,
            viewType: app.workspace.activeLeaf.view?.getViewType?.() ?? null,
            filePath: app.workspace.activeLeaf.view?.file?.path ?? null
          }
        : null,
      tabHeaders: [...document.querySelectorAll('.workspace-tab-header')].map((header) => ({
        ariaLabel: header.getAttribute('aria-label'),
        title: header.getAttribute('title'),
        text: header.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        classes: [...header.classList].sort()
      })),
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
      renderedLinks: view.renderer.links.map((link) => ({
        source: edgeEnd(link.source),
        target: edgeEnd(link.target)
      })).sort((left, right) =>
        left.source.localeCompare(right.source) || left.target.localeCompare(right.target)
      ),
      metadataResolvedLinks: cacheLinks(app.metadataCache.resolvedLinks, true),
      metadataUnresolvedLinks: cacheLinks(app.metadataCache.unresolvedLinks, false),
      targetNode: targetNodeObservation,
      dragNodeId: view.renderer.dragNode ? nodeId(view.renderer.dragNode) : null,
      highlightedNodeId: view.renderer.highlightNode ? nodeId(view.renderer.highlightNode) : null,
      interactiveBounds: interactiveBounds
        ? {
            left: interactiveBounds.left,
            top: interactiveBounds.top,
            right: interactiveBounds.right,
            bottom: interactiveBounds.bottom,
            width: interactiveBounds.width,
            height: interactiveBounds.height
          }
        : null,
      graphOptionKeys: Object.keys(view.dataEngine.getOptions()).sort(),
      windowBounds: window.getBounds(),
      windowVisible: window.isVisible(),
      windowSkipTaskbarRequested: true
    }
  })()`)
}

async function waitForTargetNodeStability(cdp, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let previous = null
  let stableSamples = 0
  while (Date.now() < deadline) {
    const current = await cdp.evaluate(`(() => {
      const view = app.workspace.getLeavesOfType('graph')[0]?.view
      if (!view) return null
      const nodeId = ${nodeIdExpression()}
      const node = view.renderer.nodes.find(
        (candidate) => nodeId(candidate) === ${JSON.stringify(expected.drag.targetNodeId)}
      )
      return node ? { x: node.x, y: node.y } : null
    })()`)
    if (
      current &&
      previous &&
      Math.hypot(current.x - previous.x, current.y - previous.y) < 0.75
    ) {
      stableSamples += 1
      if (stableSamples >= 4) return current
    } else {
      stableSamples = 0
    }
    previous = current
    await delay(200)
  }
  throw new Error('Obsidianのdrag対象nodeが安定しませんでした。')
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
  if (!attachmentNewTabProbe && !attachmentNewWindowProbe && !attachmentMoveProbe && !attachmentBookmarkProbe && !attachmentPathCopyProbe) {
    await waitForRenderer(
      cdp,
      `JSON.stringify(app.workspace.getLeavesOfType('graph')[0]?.view.renderer.nodes.map(${nodeIdExpression()}).filter(Boolean).sort()) === ${JSON.stringify(JSON.stringify(expected.filteredNodeIds))}`
    )
  }
  await delay(500)
}

async function setGraphAttachmentsVisible(cdp) {
  await cdp.evaluate(`(() => {
    const sections = [...document.querySelectorAll('.graph-control-section')]
    if (sections.length === 0) throw new Error('Graph control sectionが見つかりません。')
    for (const section of sections) {
      if (section.classList.contains('is-collapsed')) section.querySelector('.tree-item-self')?.click()
    }
  })()`)
  await delay(200)
  await cdp.evaluate(`(() => {
    const settings = [...document.querySelectorAll('.graph-control-section .setting-item')]
    const setting = settings
      .find((item) => item.querySelector('.setting-item-name')?.textContent?.trim() === '添付書類')
    const checkbox = setting?.querySelector('input[type="checkbox"]')
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new Error('Graphの「添付書類」設定が見つかりません。')
    }
    if (!checkbox.checked) checkbox.click()
  })()`)
  await waitForRenderer(
    cdp,
    `app.workspace.getLeavesOfType('graph')[0]?.view.dataEngine.getOptions().showAttachments === true`
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

async function beginNodeDragInput(cdp) {
  const target = await cdp.evaluate(`(() => {
    const view = app.workspace.getLeavesOfType('graph')[0]?.view
    if (!view) throw new Error('Global Graphが開いていません。')
    const nodeId = ${nodeIdExpression()}
    const node = view.renderer.nodes.find(
      (candidate) => nodeId(candidate) === ${JSON.stringify(expected.drag.targetNodeId)}
    )
    if (!node) throw new Error('drag対象nodeが見つかりません。')
    const bounds = view.renderer.interactiveEl.getBoundingClientRect()
    const startX = bounds.left + (view.renderer.panX + node.x * view.renderer.scale) / devicePixelRatio
    const startY = bounds.top + (view.renderer.panY + node.y * view.renderer.scale) / devicePixelRatio
    if (
      startX < bounds.left ||
      startX > bounds.right ||
      startY < bounds.top ||
      startY > bounds.bottom ||
      startX + ${expected.drag.deltaX} > bounds.right ||
      startY + ${expected.drag.deltaY} > bounds.bottom
    ) {
      throw new Error('drag対象nodeがGraph canvas外です。')
    }
    const startHit = document.elementFromPoint(startX, startY)
    const endHit = document.elementFromPoint(
      startX + ${expected.drag.deltaX},
      startY + ${expected.drag.deltaY}
    )
    if (
      (startHit !== view.renderer.interactiveEl && !view.renderer.interactiveEl.contains(startHit)) ||
      (endHit !== view.renderer.interactiveEl && !view.renderer.interactiveEl.contains(endHit))
    ) {
      throw new Error('drag経路がGraph canvasの操作面にありません。')
    }
    return {
      startX,
      startY,
      endX: startX + ${expected.drag.deltaX},
      endY: startY + ${expected.drag.deltaY}
    }
  })()`)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: target.startX,
    y: target.startY,
    button: 'none',
    buttons: 0
  })
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: target.startX,
    y: target.startY,
    button: 'left',
    buttons: 1,
    clickCount: 1
  })
  for (let step = 1; step <= 4; step += 1) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: target.startX + (expected.drag.deltaX * step) / 4,
      y: target.startY + (expected.drag.deltaY * step) / 4,
      button: 'left',
      buttons: 1
    })
    await delay(35)
  }
  await delay(200)
  return target
}

async function releaseNodeDragInput(cdp, target) {
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: target.endX,
    y: target.endY,
    button: 'left',
    buttons: 0,
    clickCount: 1
  })
}

async function openNodeContextMenu(cdp) {
  const targetExpression = `(() => {
    const view = app.workspace.getLeavesOfType('graph')[0]?.view
    if (!view) throw new Error('Global Graphが開いていません。')
    const nodeId = ${nodeIdExpression()}
    const node = view.renderer.nodes.find(
      (candidate) => nodeId(candidate) === ${JSON.stringify(expected.drag.targetNodeId)}
    )
    if (!node) throw new Error('context menu対象nodeが見つかりません。')
    const bounds = view.renderer.interactiveEl.getBoundingClientRect()
    const x = bounds.left + (view.renderer.panX + node.x * view.renderer.scale) / devicePixelRatio
    const y = bounds.top + (view.renderer.panY + node.y * view.renderer.scale) / devicePixelRatio
    return {
      x,
      y,
      inside: x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom,
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2
    }
  })()`
  let hoverTarget = null
  let zoomedOut = false
  for (let attempt = 0; attempt < 10; attempt += 1) {
    hoverTarget = await cdp.evaluate(targetExpression)
    if (hoverTarget.inside) break
    zoomedOut = true
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: hoverTarget.centerX,
      y: hoverTarget.centerY,
      deltaX: 0,
      deltaY: 120
    })
    await delay(150)
  }
  if (!hoverTarget?.inside) throw new Error('context menu対象nodeをGraph canvas内へ収められません。')
  if (zoomedOut) {
    await delay(500)
    await waitForTargetNodeStability(cdp)
    hoverTarget = await cdp.evaluate(targetExpression)
    if (!hoverTarget.inside) throw new Error('context menu対象nodeがzoom安定後にGraph canvas外へ移動しました。')
  }
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: hoverTarget.x, y: hoverTarget.y, button: 'none', buttons: 0
  })
  await delay(50)
  const target = await cdp.evaluate(targetExpression)
  if (!target.inside) throw new Error('context menu対象nodeがhover後にGraph canvas外へ移動しました。')
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: target.x, y: target.y, button: 'none', buttons: 0
  })
  await delay(20)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: target.x, y: target.y, button: 'right', buttons: 2, clickCount: 1
  })
  await delay(20)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: target.x, y: target.y, button: 'right', buttons: 0, clickCount: 1
  })
  await waitForRenderer(cdp, `document.querySelector('.menu .menu-item') !== null`)
  await delay(150)
  return target
}

async function observeNodeContextMenu(cdp) {
  return cdp.evaluate(`(() => {
    const menu = [...document.querySelectorAll('.menu')].find((element) => {
      const style = getComputedStyle(element)
      const bounds = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0
    })
    if (!menu) throw new Error('表示中のnode context menuが見つかりません。')
    const bounds = menu.getBoundingClientRect()
    return {
      targetNodeId: ${JSON.stringify(expected.drag.targetNodeId)},
      bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      items: [...menu.querySelectorAll('.menu-item')].map((item, index) => ({
        index,
        text: item.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
        disabled:
          item.classList.contains('is-disabled') ||
          item.getAttribute('aria-disabled') === 'true' ||
          item.hasAttribute('disabled'),
        classes: [...item.classList].sort()
      })),
      separators: [...menu.children]
        .map((child, index) => child.classList.contains('menu-separator') ? index : null)
        .filter((index) => index !== null)
    }
  })()`)
}

async function activateAttachmentPathCopy(cdp) {
  const captureKey = '__tsuzuneGp0AttachmentPathCopyClipboardCapture'
  const beforeGraph = await observeGraph(cdp, 'before-attachment-path-copy')
  const clipboardSetup = await cdp.evaluate(`(() => {
    const clipboard = require('electron').clipboard
    const crypto = require('crypto')
    const fingerprint = () => {
      const formats = clipboard.availableFormats('clipboard').sort()
      const entries = formats.map((format) => {
        try {
          const bytes = clipboard.readBuffer(format, 'clipboard')
          return {
            format,
            bytes: bytes.length,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
          }
        } catch (error) {
          return { format, error: String(error?.message ?? error) }
        }
      })
      return {
        formats,
        entries,
        sha256: crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex').toUpperCase()
      }
    }
    if (globalThis[${JSON.stringify(captureKey)}]) {
      throw new Error('clipboard capture hookが既に存在します。')
    }
    const state = {
      clipboard,
      fingerprint,
      before: fingerprint(),
      calls: [],
      originalWriteText: clipboard.writeText,
      originalWrite: clipboard.write,
      navigatorClipboard: globalThis.navigator?.clipboard ?? null,
      originalNavigatorWriteText: globalThis.navigator?.clipboard?.writeText ?? null
    }
    clipboard.writeText = function (text, type) {
      state.calls.push({ api: 'writeText', text: String(text), type: type ?? 'clipboard' })
    }
    clipboard.write = function (data, type) {
      state.calls.push({
        api: 'write',
        text: typeof data?.text === 'string' ? data.text : null,
        type: type ?? 'clipboard',
        keys: data && typeof data === 'object' ? Object.keys(data).sort() : []
      })
    }
    if (state.navigatorClipboard && typeof state.originalNavigatorWriteText === 'function') {
      state.navigatorClipboard.writeText = async function (text) {
        state.calls.push({ api: 'navigator.writeText', text: String(text), type: 'clipboard' })
      }
    }
    globalThis[${JSON.stringify(captureKey)}] = state
    return {
      writeTextHooked: clipboard.writeText !== state.originalWriteText,
      writeHooked: clipboard.write !== state.originalWrite,
      navigatorWriteTextHooked:
        Boolean(state.navigatorClipboard) &&
        state.navigatorClipboard.writeText !== state.originalNavigatorWriteText
    }
  })()`)

  let actionError = null
  let menuClosed = false
  let afterGraph = null
  let parentActivation = null
  try {
    const menuTarget = await cdp.evaluate(`(() => {
      const item = [...document.querySelectorAll('.menu .menu-item')]
        .find((candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === 'パスをコピー')
      if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
        throw new Error('有効な「パスをコピー」が見つかりません。')
      }
      const bounds = item.getBoundingClientRect()
      return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    })()`)
    const menuClosedExpression = `(() => [...document.querySelectorAll('.menu')].every((menu) => {
      const style = getComputedStyle(menu)
      const bounds = menu.getBoundingClientRect()
      return style.display === 'none' || style.visibility === 'hidden' || bounds.width === 0 || bounds.height === 0
    }))()`
    const observeParentActivation = async () => cdp.evaluate(`(() => {
      const visibleMenus = [...document.querySelectorAll('.menu')].filter((menu) => {
        const style = getComputedStyle(menu)
        const bounds = menu.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0
      })
      const itemText = (item) => item.textContent?.replace(/\\s+/g, ' ').trim() ?? ''
      return {
        visibleMenuCount: visibleMenus.length,
        parentMenuVisible: visibleMenus.some((menu) =>
          [...menu.querySelectorAll('.menu-item')].some((item) => itemText(item) === 'パスをコピー')
        ),
        submenuVisible: visibleMenus.some((menu) =>
          [...menu.querySelectorAll('.menu-item')].some((item) =>
            itemText(item) === ${JSON.stringify(expected.attachmentPathCopy.submenuChoice)}
          )
        )
      }
    })()`)

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: menuTarget.x, y: menuTarget.y, button: 'none', buttons: 0
    })
    await delay(500)
    const afterHover = await observeParentActivation()
    const hoverScreenshot = await captureScreenshot(
      cdp,
      resolve(outputDirectory, '02-after-parent-hover.png')
    )

    for (let index = 0; index < 2; index += 1) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
      })
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
      })
      await delay(100)
    }
    await waitForRenderer(cdp, menuClosedExpression)
    await openNodeContextMenu(cdp)
    const clickTarget = await cdp.evaluate(`(() => {
      const item = [...document.querySelectorAll('.menu .menu-item')]
        .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === 'パスをコピー')
      if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
        throw new Error('click対象の「パスをコピー」が見つかりません。')
      }
      const bounds = item.getBoundingClientRect()
      return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    })()`)
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: clickTarget.x, y: clickTarget.y, button: 'left', buttons: 1, clickCount: 1
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: clickTarget.x, y: clickTarget.y, button: 'left', buttons: 0, clickCount: 1
    })
    await waitForRenderer(
      cdp,
      `${JSON.stringify(expected.attachmentPathCopy.submenuChoice)} && [...document.querySelectorAll('.menu .menu-item')].some((item) => item.textContent?.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(expected.attachmentPathCopy.submenuChoice)})`
    )
    const afterClick = await observeParentActivation()
    parentActivation = { afterHover, hoverScreenshot, afterClick }
    const submenu = await cdp.evaluate(`(() => {
      const visibleMenus = [...document.querySelectorAll('.menu')].filter((menu) => {
        const style = getComputedStyle(menu)
        const bounds = menu.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0
      })
      const menu = visibleMenus.find((candidate) =>
        [...candidate.querySelectorAll('.menu-item')].some((item) =>
          item.textContent?.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(expected.attachmentPathCopy.submenuChoice)}
        )
      )
      if (!menu) throw new Error('path copy submenuが見つかりません。')
      return [...menu.querySelectorAll('.menu-item')].map((item, index) => ({
        index,
        text: item.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
        disabled:
          item.classList.contains('is-disabled') ||
          item.getAttribute('aria-disabled') === 'true' ||
          item.hasAttribute('disabled')
      }))
    })()`)
    const submenuScreenshot = await captureScreenshot(
      cdp,
      resolve(outputDirectory, '03-after-parent-click.png')
    )
    const submenuTarget = await cdp.evaluate(`(() => {
      const item = [...document.querySelectorAll('.menu .menu-item')]
        .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(expected.attachmentPathCopy.submenuChoice)})
      if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
        throw new Error('有効なpath copy submenu項目が見つかりません。')
      }
      const bounds = item.getBoundingClientRect()
      return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    })()`)
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: submenuTarget.x, y: submenuTarget.y, button: 'none', buttons: 0
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: submenuTarget.x, y: submenuTarget.y, button: 'left', buttons: 1, clickCount: 1
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: submenuTarget.x, y: submenuTarget.y, button: 'left', buttons: 0, clickCount: 1
    })
    await delay(300)
    menuClosed = await cdp.evaluate(menuClosedExpression)
    afterGraph = await observeGraph(cdp, 'after-attachment-path-copy')
    afterGraph.pathCopySubmenu = submenu
    afterGraph.pathCopySubmenuScreenshot = submenuScreenshot
    afterGraph.pathCopyParentActivation = parentActivation
  } catch (error) {
    actionError = error
  }

  const clipboardCapture = await cdp.evaluate(`(() => {
    const state = globalThis[${JSON.stringify(captureKey)}]
    if (!state) throw new Error('clipboard capture hookが見つかりません。')
    const afterAction = state.fingerprint()
    state.clipboard.writeText = state.originalWriteText
    state.clipboard.write = state.originalWrite
    if (state.navigatorClipboard && typeof state.originalNavigatorWriteText === 'function') {
      state.navigatorClipboard.writeText = state.originalNavigatorWriteText
    }
    const afterRestore = state.fingerprint()
    const result = {
      calls: state.calls,
      clipboardUnchanged:
        state.before.sha256 === afterAction.sha256 &&
        state.before.sha256 === afterRestore.sha256,
      writeTextRestored: state.clipboard.writeText === state.originalWriteText,
      writeRestored: state.clipboard.write === state.originalWrite,
      navigatorWriteTextRestored:
        !state.navigatorClipboard ||
        state.navigatorClipboard.writeText === state.originalNavigatorWriteText
    }
    delete globalThis[${JSON.stringify(captureKey)}]
    return result
  })()`)
  if (actionError) throw actionError
  return { beforeGraph, afterGraph, clipboardSetup, clipboardCapture, menuClosed, parentActivation }
}

async function activateAttachmentMove(cdp) {
  const moveDialogInputSelector =
    '.modal-container input.prompt-input[placeholder="フォルダを入力…"]'
  const observeFiles = `(() => {
    const source = app.vault.getAbstractFileByPath('attachments/diagram.svg')
    const destination = app.vault.getAbstractFileByPath('20_knowledge/diagram.svg')
    const collisionDestination = app.vault.getAbstractFileByPath('20_knowledge/diagram 1.svg')
    const home = app.vault.getAbstractFileByPath('00_Home.md')
    return Promise.all([
      home ? app.vault.read(home) : Promise.resolve(null)
    ]).then(([homeContent]) => ({
      sourceExists: Boolean(source),
      destinationExists: Boolean(destination),
      collisionDestinationExists: Boolean(collisionDestination),
      homeContent,
      activeFile: app.workspace.getActiveFile()?.path ?? null,
      graphLeafCount: app.workspace.getLeavesOfType('graph').length
    }))
  })()`
  const before = await cdp.evaluate(observeFiles)
  await cdp.evaluate(`(() => {
    const item = [...document.querySelectorAll('.menu .menu-item')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === 'ファイルを移動…')
    if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
      throw new Error('有効な「ファイルを移動…」が見つかりません。')
    }
    item.click()
  })()`)
  await waitForRenderer(
    cdp,
    `document.querySelector(${JSON.stringify(moveDialogInputSelector)}) !== null`
  )
  await delay(250)
  const dialog = await cdp.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(moveDialogInputSelector)})
    const container = input?.closest('.modal-container')
    const modal = container?.querySelector('.modal') ?? container
    if (!(modal instanceof HTMLElement)) throw new Error('移動dialogが見つかりません。')
    const bounds = modal.getBoundingClientRect()
    return {
      text: modal.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
      classes: [...modal.classList].sort(),
      bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      inputs: [...modal.querySelectorAll('input')].map((input) => ({
        type: input.type,
        placeholder: input.placeholder,
        value: input.value,
        classes: [...input.classList].sort()
      })),
      buttons: [...modal.querySelectorAll('button')].map((button) => ({
        text: button.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
        ariaLabel: button.getAttribute('aria-label'),
        classes: [...button.classList].sort()
      })),
      suggestions: [...modal.querySelectorAll('.suggestion-item')]
        .filter((item) => item.getClientRects().length > 0)
        .map((item) => ({
          text: item.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
          classes: [...item.classList].sort()
        }))
    }
  })()`)
  if (attachmentMoveScenario === 'cancel') {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
    })
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
    })
    await waitForRenderer(
      cdp,
      `document.querySelector(${JSON.stringify(moveDialogInputSelector)}) === null`
    )
  } else {
    await cdp.evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(moveDialogInputSelector)})
      if (!(input instanceof HTMLInputElement)) throw new Error('移動先inputが見つかりません。')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '20_knowledge')
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.focus()
    })()`)
    await waitForRenderer(cdp, `(() => {
      const item = [...document.querySelectorAll('.suggestion-item')].find((candidate) =>
        candidate.textContent?.replace(/\\s+/g, ' ').trim() === '20_knowledge'
      )
      return item instanceof HTMLElement && item.getBoundingClientRect().height > 0
    })()`)
    await cdp.evaluate(`(() => {
      const item = [...document.querySelectorAll('.suggestion-item')].find((candidate) =>
        candidate.textContent?.replace(/\\s+/g, ' ').trim() === '20_knowledge' &&
        candidate.getBoundingClientRect().height > 0
      )
      if (!(item instanceof HTMLElement)) throw new Error('20_knowledge候補が見つかりません。')
      item.click()
    })()`)
    await delay(1_000)
    if (attachmentMoveScenario === 'success') {
      await waitForRenderer(
        cdp,
        `app.vault.getAbstractFileByPath('20_knowledge/diagram.svg') !== null && app.vault.getAbstractFileByPath('attachments/diagram.svg') === null`
      )
    }
  }
  const after = await cdp.evaluate(observeFiles)
  const notices = await cdp.evaluate(`(() => [...document.querySelectorAll('.notice')].map((notice) =>
    notice.textContent?.replace(/\\s+/g, ' ').trim() ?? ''
  ).filter(Boolean))()`)
  const dialogClosedAfterSelection = await cdp.evaluate(
    `document.querySelector(${JSON.stringify(moveDialogInputSelector)}) === null`
  )
  if (!dialogClosedAfterSelection) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
    })
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
    })
    await waitForRenderer(
      cdp,
      `document.querySelector(${JSON.stringify(moveDialogInputSelector)}) === null`
    )
  }
  return {
    scenario: attachmentMoveScenario,
    before,
    after,
    dialog,
    dialogClosedAfterSelection,
    dialogClosed: await cdp.evaluate(
      `document.querySelector(${JSON.stringify(moveDialogInputSelector)}) === null`
    ),
    notices,
    menuClosed: await cdp.evaluate(`document.querySelector('.menu .menu-item') === null`)
  }
}

async function observeBookmarkPlugin(cdp) {
  return cdp.evaluate(`(() => {
    const plugin = app.internalPlugins?.getPluginById?.('bookmarks') ?? null
    const instance = plugin?.instance ?? null
    const items = Array.isArray(instance?.items) ? instance.items : []
    return {
      enabled: plugin?.enabled ?? null,
      itemCount: items.length,
      items: items.map((item) => ({
        type: item?.type ?? null,
        path: item?.path ?? null,
        title: item?.title ?? null,
        ctime: item?.ctime ?? null,
        subpath: item?.subpath ?? null
      }))
    }
  })()`)
}

async function activateAttachmentBookmark(cdp, scenario) {
  const clickBookmarkAction = async () => {
    await cdp.evaluate(`(() => {
      const item = [...document.querySelectorAll('.menu .menu-item')]
        .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim().includes('ブックマーク'))
      if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
        throw new Error('有効なブックマーク操作が見つかりません。')
      }
      item.click()
    })()`)
    await waitForRenderer(cdp, `document.querySelector('.modal-container .modal') !== null`)
    await delay(200)
    return cdp.evaluate(`(() => {
      const modal = [...document.querySelectorAll('.modal-container .modal')]
        .find((candidate) => candidate.getClientRects().length > 0)
      if (!(modal instanceof HTMLElement)) throw new Error('ブックマークdialogが見つかりません。')
      const bounds = modal.getBoundingClientRect()
      return {
        text: modal.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
        classes: [...modal.classList].sort(),
        bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
        headings: [...modal.querySelectorAll('.modal-title, h1, h2, h3')]
          .map((element) => element.textContent?.replace(/\\s+/g, ' ').trim() ?? '')
          .filter(Boolean),
        inputs: [...modal.querySelectorAll('input')].map((input) => ({
          type: input.type,
          placeholder: input.placeholder,
          value: input.value,
          classes: [...input.classList].sort()
        })),
        buttons: [...modal.querySelectorAll('button')].map((button) => ({
          text: button.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
          ariaLabel: button.getAttribute('aria-label'),
          disabled: button.disabled || button.classList.contains('is-disabled'),
          classes: [...button.classList].sort()
        })),
        suggestions: [...modal.querySelectorAll('.suggestion-item')]
          .filter((item) => item.getClientRects().length > 0)
          .map((item) => item.textContent?.replace(/\\s+/g, ' ').trim() ?? '')
      }
    })()`)
  }

  const closeDialog = async (save) => {
    if (save) {
      await cdp.evaluate(`(() => {
        const modal = [...document.querySelectorAll('.modal-container .modal')]
          .find((candidate) => candidate.getClientRects().length > 0)
        const button = modal?.querySelector('button.mod-cta') ??
          [...(modal?.querySelectorAll('button') ?? [])].find((candidate) => !candidate.disabled)
        if (!(button instanceof HTMLButtonElement)) throw new Error('ブックマークdialogの確定buttonが見つかりません。')
        button.click()
      })()`)
    } else {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
      })
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
      })
    }
    await waitForRenderer(cdp, `document.querySelector('.modal-container .modal') === null`)
    await delay(500)
  }

  const before = await observeBookmarkPlugin(cdp)
  const firstDialog = await clickBookmarkAction()
  firstDialog.screenshot = await captureScreenshot(
    cdp,
    resolve(outputDirectory, '02-bookmark-dialog.png')
  )
  await closeDialog(scenario !== 'cancel')
  const afterFirst = await observeBookmarkPlugin(cdp)
  let secondDialog = null
  let afterSecond = null
  let secondMenu = null
  if (scenario === 'duplicate') {
    await openNodeContextMenu(cdp)
    secondMenu = await observeNodeContextMenu(cdp)
    secondMenu.screenshot = await captureScreenshot(
      cdp,
      resolve(outputDirectory, '03-duplicate-context-menu.png')
    )
    secondDialog = await clickBookmarkAction()
    secondDialog.screenshot = await captureScreenshot(
      cdp,
      resolve(outputDirectory, '04-duplicate-dialog.png')
    )
    await closeDialog(true)
    afterSecond = await observeBookmarkPlugin(cdp)
  }
  return {
    scenario,
    before,
    firstDialog,
    afterFirst,
    secondMenu,
    secondDialog,
    afterSecond,
    dialogClosed: await cdp.evaluate(`document.querySelector('.modal-container .modal') === null`),
    menuClosed: await cdp.evaluate(`document.querySelector('.menu .menu-item') === null`)
  }
}

async function activateNodeNewTab(cdp) {
  const before = await cdp.evaluate(`(() => ({
    markdownLeafCount: app.workspace.getLeavesOfType('markdown').length,
    graphLeafCount: app.workspace.getLeavesOfType('graph').length,
    activeFile: app.workspace.getActiveFile()?.path ?? null
  }))()`)
  await cdp.evaluate(`(() => {
    const item = [...document.querySelectorAll('.menu .menu-item')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === '新規タブに開く')
    if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
      throw new Error('有効な「新規タブに開く」が見つかりません。')
    }
    item.click()
  })()`)
  await waitForRenderer(
    cdp,
    `app.workspace.getLeavesOfType('markdown').length > ${before.markdownLeafCount}`
  )
  return cdp.evaluate(`(() => ({
    before: ${JSON.stringify(before)},
    after: {
      markdownLeafCount: app.workspace.getLeavesOfType('markdown').length,
      graphLeafCount: app.workspace.getLeavesOfType('graph').length,
      activeFile: app.workspace.getActiveFile()?.path ?? null,
      menuClosed: document.querySelector('.menu .menu-item') === null
    }
  }))()`)
}

async function activateAttachmentNewTab(cdp) {
  const observeLeaves = `(() => {
    return {
      graphLeafCount: app.workspace.getLeavesOfType('graph').length,
      activeFile: app.workspace.getActiveFile()?.path ?? null,
      activeLeaf: app.workspace.activeLeaf
        ? {
            id: app.workspace.activeLeaf.id ?? null,
            viewType: app.workspace.activeLeaf.view?.getViewType?.() ?? null,
            filePath: app.workspace.activeLeaf.view?.file?.path ?? null
          }
        : null,
      tabHeaders: [...document.querySelectorAll('.workspace-tab-header')].map((header) => ({
        ariaLabel: header.getAttribute('aria-label'),
        title: header.getAttribute('title'),
        text: header.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        classes: [...header.classList].sort()
      }))
    }
  })()`
  const before = await cdp.evaluate(observeLeaves)
  await cdp.evaluate(`(() => {
    const item = [...document.querySelectorAll('.menu .menu-item')]
      .find((candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === '新規タブに開く')
    if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
      throw new Error('有効な「新規タブに開く」が見つかりません。')
    }
    item.click()
  })()`)
  await waitForRenderer(
    cdp,
    `app.workspace.getActiveFile()?.path === ${JSON.stringify(expected.drag.targetNodeId)}`
  )
  await waitForRenderer(cdp, `(() => {
    let fileViewReady = false
    app.workspace.iterateAllLeaves((leaf) => {
      if (
        leaf.view?.file?.path === ${JSON.stringify(expected.drag.targetNodeId)} &&
        leaf.view?.getViewType?.() !== 'backlink'
      ) fileViewReady = true
    })
    return fileViewReady
  })()`)
  await delay(1_000)
  const after = await cdp.evaluate(observeLeaves)
  return {
    before,
    after: {
      ...after,
      addedTabHeaders: after.tabHeaders.filter(
        (header) => !before.tabHeaders.some((candidate) => candidate.ariaLabel === header.ariaLabel)
      ),
      menuClosed: await cdp.evaluate(`document.querySelector('.menu .menu-item') === null`)
    }
  }
}

async function activateAttachmentNewWindow(session) {
  const beforeTargets = await listCdpTargets(session.cdpPort)
  const beforeTargetIds = new Set(beforeTargets.map((target) => target.id))
  const before = await session.cdp.evaluate(`(() => ({
    browserWindowCount: require('@electron/remote').BrowserWindow.getAllWindows().length,
    graphLeafCount: app.workspace.getLeavesOfType('graph').length,
    activeFile: app.workspace.getActiveFile()?.path ?? null
  }))()`)
  await session.cdp.evaluate(`(() => {
    const item = [...document.querySelectorAll('.menu .menu-item')]
      .find((candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === '新規ウィンドウで開く')
    if (!(item instanceof HTMLElement) || item.classList.contains('is-disabled')) {
      throw new Error('有効な「新規ウィンドウで開く」が見つかりません。')
    }
    item.click()
  })()`)

  const newTarget = await waitForCdpTarget(
    session.cdpPort,
    (target) =>
      target.type === 'page' &&
      !beforeTargetIds.has(target.id)
  )
  const newCdp = await connectCdp(newTarget)
  try {
    await waitForRenderer(
      newCdp,
      `typeof app === 'object' && app.workspace.getActiveFile()?.path === ${JSON.stringify(expected.drag.targetNodeId)}`
    )
    const newWindow = await newCdp.evaluate(`(() => {
      const remote = require('@electron/remote')
      const window = remote.getCurrentWindow()
      window.setBounds({ x: -32000, y: -32000, width: ${expected.viewport.width}, height: ${expected.viewport.height} })
      window.setSkipTaskbar(true)
      if (window.isMinimized()) window.restore()
      return {
        id: window.id,
        bounds: window.getBounds(),
        visible: window.isVisible(),
        activeFile: app.workspace.getActiveFile()?.path ?? null,
        activeLeaf: app.workspace.activeLeaf
          ? {
              id: app.workspace.activeLeaf.id ?? null,
              viewType: app.workspace.activeLeaf.view?.getViewType?.() ?? null,
              filePath: app.workspace.activeLeaf.view?.file?.path ?? null
            }
          : null,
        graphLeafCount: app.workspace.getLeavesOfType('graph').length,
        tabHeaders: [...document.querySelectorAll('.workspace-tab-header')].map((header) => ({
          ariaLabel: header.getAttribute('aria-label'),
          title: header.getAttribute('title'),
          text: header.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          classes: [...header.classList].sort()
        }))
      }
    })()`)
    await delay(500)
    const screenshot = await captureScreenshot(
      newCdp,
      resolve(outputDirectory, '02-attachment-new-window.png')
    )
    const sourceAfter = await session.cdp.evaluate(`(() => ({
      browserWindowCount: require('@electron/remote').BrowserWindow.getAllWindows().length,
      graphLeafCount: app.workspace.getLeavesOfType('graph').length,
      activeFile: app.workspace.getActiveFile()?.path ?? null,
      menuClosed: document.querySelector('.menu .menu-item') === null
    }))()`)
    await newCdp.evaluate(`require('@electron/remote').getCurrentWindow().close()`)
    return { before, newWindow: { ...newWindow, screenshot }, sourceAfter }
  } finally {
    newCdp.socket.close()
  }
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
  if (attachmentMoveProbe && attachmentMoveScenario === 'collision') {
    await writeFile(
      resolve(vaultDirectory, '20_knowledge/diagram.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>collision sentinel</text></svg>\n',
      'utf8'
    )
  }
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
    if (attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe) {
      await first.whileChildAlive(setGraphAttachmentsVisible(first.cdp))
    }
    if (nodeDragProbe || nodeMenuProbe) {
      await first.whileChildAlive(waitForTargetNodeStability(first.cdp))
    }
    if (cameraProbe || nodeDragProbe || nodeMenuProbe) {
      observations.beforeEntry = await first.whileChildAlive(
        observeGraph(
          first.cdp,
          nodeMenuProbe
            ? 'before-node-context-menu'
            : nodeDragProbe
              ? 'before-node-drag'
              : 'before-camera-input'
        )
      )
      observations.beforeEntry.screenshot = await first.whileChildAlive(
        captureScreenshot(first.cdp, resolve(outputDirectory, '00-baseline.png'))
      )
    }
    if (cameraProbe) {
      await first.whileChildAlive(applyCameraInput(first.cdp))
    } else if (nodeDragProbe) {
      observations.dragInput = await first.whileChildAlive(beginNodeDragInput(first.cdp))
      try {
        observations.duringDrag = await first.whileChildAlive(
          observeGraph(first.cdp, 'during-node-drag')
        )
        observations.duringDrag.screenshot = await first.whileChildAlive(
          captureScreenshot(first.cdp, resolve(outputDirectory, '01-during-node-drag.png'))
        )
      } finally {
        await first.whileChildAlive(releaseNodeDragInput(first.cdp, observations.dragInput))
      }
      observations.afterReleaseImmediate = await first.whileChildAlive(
        observeGraph(first.cdp, 'after-node-release-immediate')
      )
      await first.whileChildAlive(delay(250))
      observations.afterRelease250ms = await first.whileChildAlive(
        observeGraph(first.cdp, 'after-node-release-250ms')
      )
      await first.whileChildAlive(waitForTargetNodeStability(first.cdp))
    }
    observations.afterEntry = await first.whileChildAlive(
      observeGraph(first.cdp, nodeDragProbe ? 'after-node-release-settled' : 'after-entry')
    )
    if (attachmentBookmarkProbe) {
      observations.bookmarkPersistence = {
        beforeAction: await snapshotBookmarkPersistence('before-action')
      }
      observations.bookmarkPluginBeforeAction = await first.whileChildAlive(
        observeBookmarkPlugin(first.cdp)
      )
    }
    if (nodeMenuProbe) {
      observations.menuInput = await first.whileChildAlive(openNodeContextMenu(first.cdp))
      observations.nodeContextMenu = await first.whileChildAlive(
        observeNodeContextMenu(first.cdp)
      )
      observations.nodeContextMenu.screenshot = await first.whileChildAlive(
        captureScreenshot(first.cdp, resolve(outputDirectory, '01-node-context-menu.png'))
      )
      if (nodeNewTabProbe) {
        observations.nodeNewTab = await first.whileChildAlive(
          activateNodeNewTab(first.cdp)
        )
        observations.nodeNewTab.screenshot = await first.whileChildAlive(
          captureScreenshot(first.cdp, resolve(outputDirectory, '02-note-new-tab.png'))
        )
      } else if (attachmentNewTabProbe) {
        observations.attachmentNewTab = await first.whileChildAlive(
          activateAttachmentNewTab(first.cdp)
        )
        observations.attachmentNewTab.screenshot = await first.whileChildAlive(
          captureScreenshot(first.cdp, resolve(outputDirectory, '02-attachment-new-tab.png'))
        )
      } else if (attachmentNewWindowProbe) {
        observations.attachmentNewWindow = await first.whileChildAlive(
          activateAttachmentNewWindow(first)
        )
      } else if (attachmentMoveProbe) {
        observations.attachmentMove = await first.whileChildAlive(
          activateAttachmentMove(first.cdp)
        )
        observations.attachmentMove.screenshot = await first.whileChildAlive(
          captureScreenshot(first.cdp, resolve(outputDirectory, '02-after-file-move-action.png'))
        )
      } else if (attachmentBookmarkProbe) {
        observations.attachmentBookmark = await first.whileChildAlive(
          activateAttachmentBookmark(first.cdp, attachmentBookmarkScenario)
        )
        observations.attachmentBookmark.screenshot = await first.whileChildAlive(
          captureScreenshot(
            first.cdp,
            resolve(
              outputDirectory,
              attachmentBookmarkScenario === 'duplicate'
                ? '05-after-bookmark-action.png'
                : '03-after-bookmark-action.png'
            )
          )
        )
        observations.bookmarkPersistence.afterAction = await snapshotBookmarkPersistence('after-action')
      } else if (attachmentPathCopyProbe) {
        observations.attachmentPathCopy = await first.whileChildAlive(
          activateAttachmentPathCopy(first.cdp)
        )
        observations.attachmentPathCopy.screenshot = await first.whileChildAlive(
          captureScreenshot(first.cdp, resolve(outputDirectory, '04-after-path-copy.png'))
        )
      } else {
        await first.whileChildAlive(first.cdp.send('Input.dispatchKeyEvent', {
          type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
        }))
        await first.whileChildAlive(first.cdp.send('Input.dispatchKeyEvent', {
          type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
        }))
        await first.whileChildAlive(
          waitForRenderer(first.cdp, `document.querySelector('.menu .menu-item') === null`)
        )
      }
    }
    if (!attachmentNewTabProbe && !attachmentNewWindowProbe && !attachmentMoveProbe && !attachmentBookmarkProbe && !attachmentPathCopyProbe) {
      observations.afterEntry.screenshot = await first.whileChildAlive(
        captureScreenshot(
          first.cdp,
          resolve(
            outputDirectory,
            nodeNewTabProbe
              ? '02-note-new-tab.png'
              : nodeMenuProbe
              ? '00-baseline.png'
              : nodeDragProbe
              ? '02-after-node-release.png'
              : cameraProbe
                ? '01-after-camera-input.png'
                : '01-after-entry.png'
          )
        )
      )
    }

    await first.whileChildAlive(first.cdp.evaluate(`(() => {
      const leaf = app.workspace.getLeavesOfType('graph')[0]
      if (!leaf) throw new Error('閉じるGlobal Graphがありません。')
      leaf.detach()
    })()`))
    await first.whileChildAlive(waitForRenderer(first.cdp, `app.workspace.getLeavesOfType('graph').length === 0`))
    await first.whileChildAlive(openGlobalGraph(first.cdp))
    if (nodeDragProbe) await first.whileChildAlive(waitForTargetNodeStability(first.cdp))
    observations.afterGraphReopen = await first.whileChildAlive(
      observeGraph(first.cdp, 'after-graph-reopen')
    )
    observations.afterGraphReopen.screenshot = await first.whileChildAlive(
      captureScreenshot(
        first.cdp,
        resolve(
          outputDirectory,
          attachmentPathCopyProbe
            ? '05-after-graph-reopen.png'
            : attachmentBookmarkProbe
            ? attachmentBookmarkScenario === 'duplicate'
              ? '06-after-graph-reopen.png'
              : '04-after-graph-reopen.png'
            : nodeDragProbe
              ? '03-after-graph-reopen.png'
              : '02-after-graph-reopen.png'
        )
      )
    )
    if (attachmentBookmarkProbe) {
      observations.bookmarkPluginAfterGraphReopen = await first.whileChildAlive(
        observeBookmarkPlugin(first.cdp)
      )
      observations.bookmarkPersistence.afterGraphReopen = await snapshotBookmarkPersistence(
        'after-graph-reopen'
      )
    }
    const firstExit = await first.stop()
    if (attachmentBookmarkProbe) {
      observations.bookmarkPersistence.afterFirstProcessExit = await snapshotBookmarkPersistence(
        'after-first-process-exit'
      )
    }

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
    if (nodeDragProbe) await second.whileChildAlive(waitForTargetNodeStability(second.cdp))
    observations.afterAppRestart = await second.whileChildAlive(
      observeGraph(second.cdp, 'after-app-restart')
    )
    observations.afterAppRestart.graphLeafCountAtRestart = graphLeafCountAtRestart
    observations.afterAppRestart.screenshot = await second.whileChildAlive(
      captureScreenshot(
        second.cdp,
        resolve(
          outputDirectory,
          attachmentPathCopyProbe
            ? '06-after-app-restart.png'
            : attachmentBookmarkProbe
            ? attachmentBookmarkScenario === 'duplicate'
              ? '07-after-app-restart.png'
              : '05-after-app-restart.png'
            : nodeDragProbe
              ? '04-after-app-restart.png'
              : '03-after-app-restart.png'
        )
      )
    )
    if (attachmentBookmarkProbe) {
      observations.bookmarkPluginAfterAppRestart = await second.whileChildAlive(
        observeBookmarkPlugin(second.cdp)
      )
      observations.bookmarkPersistence.afterAppRestart = await snapshotBookmarkPersistence(
        'after-app-restart'
      )
    }
    const secondExit = await second.stop()
    if (attachmentBookmarkProbe) {
      observations.bookmarkPersistence.afterSecondProcessExit = await snapshotBookmarkPersistence(
        'after-second-process-exit'
      )
    }

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
  const nodeDistance = (left, right) =>
    left && right ? Math.hypot(left.x - right.x, left.y - right.y) : Number.POSITIVE_INFINITY
  const nodeDragContract = nodeDragProbe
    ? {
        targetNodeId: expected.drag.targetNodeId,
        requestedDeltaCssPx: { x: expected.drag.deltaX, y: expected.drag.deltaY },
        baseline: observations.beforeEntry.targetNode,
        duringHold: observations.duringDrag.targetNode,
        afterReleaseImmediate: observations.afterReleaseImmediate.targetNode,
        afterRelease250ms: observations.afterRelease250ms.targetNode,
        afterReleaseSettled: observations.afterEntry.targetNode,
        afterGraphReopen: observations.afterGraphReopen.targetNode,
        afterAppRestart: observations.afterAppRestart.targetNode,
        appliedDeltaCssPx: {
          x:
            observations.duringDrag.targetNode.clientX -
            observations.beforeEntry.targetNode.clientX,
          y:
            observations.duringDrag.targetNode.clientY -
            observations.beforeEntry.targetNode.clientY
        },
        heldFixed:
          observations.duringDrag.targetNode.fixed &&
          observations.duringDrag.dragNodeId === expected.drag.targetNodeId &&
          Math.hypot(
            observations.duringDrag.targetNode.x - observations.duringDrag.targetNode.fx,
            observations.duringDrag.targetNode.y - observations.duringDrag.targetNode.fy
          ) < 1,
        releasedImmediately:
          !observations.afterReleaseImmediate.targetNode.fixed &&
          observations.afterReleaseImmediate.dragNodeId === null,
        movedAfterRelease:
          nodeDistance(
            observations.duringDrag.targetNode,
            observations.afterEntry.targetNode
          ) > 2,
        unpinnedAfterGraphReopen: !observations.afterGraphReopen.targetNode.fixed,
        unpinnedAfterAppRestart: !observations.afterAppRestart.targetNode.fixed,
        nodePositionAbsentFromGraphOptions: !observations.afterEntry.graphOptionKeys.some((key) =>
          /node.*position|position.*node|pinned/i.test(key)
        )
      }
    : null
  const expectedAfterActionNodeIds =
    attachmentMoveProbe && attachmentMoveScenario === 'success'
      ? [...expected.filteredNodeIds, '20_knowledge/diagram.svg'].sort()
      : attachmentMoveProbe && attachmentMoveScenario === 'collision'
        ? [...expected.filteredNodeIds, '20_knowledge/diagram 1.svg'].sort()
      : expected.filteredNodeIds
  const exactNodeIds = (observation, nodeIds = expected.filteredNodeIds) =>
    JSON.stringify(observation.renderedNodeIds) === JSON.stringify(nodeIds)
  const bookmarkCounts = attachmentBookmarkProbe
    ? Object.fromEntries(
        Object.entries(observations.bookmarkPersistence).map(([key, snapshot]) => [
          key,
          bookmarkPathCount(snapshot.bookmarks.json, expected.drag.targetNodeId)
        ])
      )
    : null
  const sameCamera = (left, right) =>
    ['targetScale', 'scale', 'panX', 'panY', 'graphOptionsScale'].every(
      (key) => Math.abs(left[key] - right[key]) < 0.000001
    )
  const attachmentPathCopyContract = attachmentPathCopyProbe
    ? {
        targetNodeId: expected.attachmentPathCopy.targetNodeId,
        menuItems: observations.nodeContextMenu.items.map((item) => item.text),
        clipboardPlainTextCalls: observations.attachmentPathCopy.clipboardCapture.calls.filter(
          (call) => typeof call.text === 'string'
        ),
        graphBefore: observations.attachmentPathCopy.beforeGraph,
        graphAfter: observations.attachmentPathCopy.afterGraph,
        afterGraphReopen: observations.afterGraphReopen,
        afterAppRestart: observations.afterAppRestart,
        userClipboard: {
          unchanged:
            observations.attachmentPathCopy.clipboardCapture.clipboardUnchanged === true
        }
      }
    : null
  const assertions = {
    queryAccepted: observations.afterEntry.graphOptionsSearch === expected.search,
    queryVisibleAfterEntry: observations.afterEntry.searchInputValue === expected.search,
    filteredNodesAfterEntry: exactNodeIds(observations.afterEntry),
    queryPersistedAfterGraphReopen:
      observations.afterGraphReopen.graphOptionsSearch === expected.search &&
      observations.afterGraphReopen.searchInputValue === expected.search,
    filteredNodesAfterGraphReopen: exactNodeIds(
      observations.afterGraphReopen,
      expectedAfterActionNodeIds
    ),
    firstProcessExitedBeforeRestart: observations.sessions[0].exited !== null,
    secondProcessStarted: observations.sessions[1].startedAt > observations.sessions[0].exited.at,
    queryPersistedAfterAppRestart:
      observations.afterAppRestart.graphOptionsSearch === expected.search &&
      observations.afterAppRestart.searchInputValue === expected.search,
    filteredNodesAfterAppRestart: exactNodeIds(
      observations.afterAppRestart,
      expectedAfterActionNodeIds
    ),
    ...(nodeMenuProbe
      ? {
          nodeContextMenuOpened: observations.nodeContextMenu.items.length > 0,
          nodeContextMenuItemsHaveText: observations.nodeContextMenu.items.every(
            (item) => item.text.length > 0
          ),
          ...(nodeNewTabProbe
            ? {
                newTabCreated:
                  observations.nodeNewTab.after.markdownLeafCount ===
                  observations.nodeNewTab.before.markdownLeafCount + 1,
                newTabActivated:
                  observations.nodeNewTab.after.activeFile === expected.drag.targetNodeId,
                graphKeptOpenInBackground:
                  observations.nodeNewTab.after.graphLeafCount ===
                  observations.nodeNewTab.before.graphLeafCount,
                nodeContextMenuClosedAfterAction:
                  observations.nodeNewTab.after.menuClosed === true
              }
            : attachmentPathCopyProbe
              ? {
                  attachmentPathCopyTargetExact:
                    observations.nodeContextMenu.targetNodeId ===
                    expected.attachmentPathCopy.targetNodeId,
                  attachmentPathCopyMenuOrderExact:
                    JSON.stringify(observations.nodeContextMenu.items.map((item) => item.text)) ===
                    JSON.stringify(expected.attachmentPathCopy.menuItems),
                  attachmentPathCopyMenuItemEnabled:
                    observations.nodeContextMenu.items.find(
                      (item) => item.text === 'パスをコピー'
                    )?.disabled === false,
                  attachmentPathCopySubmenuOrderExact:
                    JSON.stringify(
                      observations.attachmentPathCopy.afterGraph.pathCopySubmenu.map(
                        (item) => item.text
                      )
                    ) === JSON.stringify(expected.attachmentPathCopy.submenuItems),
                  attachmentPathCopySubmenuItemsEnabled:
                    observations.attachmentPathCopy.afterGraph.pathCopySubmenu.every(
                      (item) => item.disabled === false
                    ),
                  attachmentPathCopyHoverOpensSubmenu:
                    observations.attachmentPathCopy.parentActivation.afterHover.visibleMenuCount === 2 &&
                    observations.attachmentPathCopy.parentActivation.afterHover.parentMenuVisible === true &&
                    observations.attachmentPathCopy.parentActivation.afterHover.submenuVisible === true,
                  attachmentPathCopyClickOpensSubmenu:
                    observations.attachmentPathCopy.parentActivation.afterClick.visibleMenuCount === 2 &&
                    observations.attachmentPathCopy.parentActivation.afterClick.parentMenuVisible === true &&
                    observations.attachmentPathCopy.parentActivation.afterClick.submenuVisible === true,
                  attachmentPathCopyPlainTextExact:
                    attachmentPathCopyContract.clipboardPlainTextCalls.length === 1 &&
                    attachmentPathCopyContract.clipboardPlainTextCalls[0].api ===
                      'navigator.writeText' &&
                    attachmentPathCopyContract.clipboardPlainTextCalls[0].text ===
                      expected.attachmentPathCopy.clipboardText &&
                    attachmentPathCopyContract.clipboardPlainTextCalls[0].type === 'clipboard',
                  attachmentPathCopyMenuClosed:
                    observations.attachmentPathCopy.menuClosed === true,
                  attachmentPathCopyQueryKept:
                    observations.attachmentPathCopy.beforeGraph.graphOptionsSearch ===
                      observations.attachmentPathCopy.afterGraph.graphOptionsSearch &&
                    observations.attachmentPathCopy.beforeGraph.searchInputValue ===
                      observations.attachmentPathCopy.afterGraph.searchInputValue,
                  attachmentPathCopyCameraKept: sameCamera(
                    observations.attachmentPathCopy.beforeGraph.camera,
                    observations.attachmentPathCopy.afterGraph.camera
                  ),
                  attachmentPathCopyNodesKept:
                    JSON.stringify(observations.attachmentPathCopy.beforeGraph.renderedNodeIds) ===
                      JSON.stringify(observations.attachmentPathCopy.afterGraph.renderedNodeIds) &&
                    JSON.stringify(observations.attachmentPathCopy.beforeGraph.renderedLinks) ===
                      JSON.stringify(observations.attachmentPathCopy.afterGraph.renderedLinks) &&
                    observations.attachmentPathCopy.afterGraph.targetNode?.id ===
                      expected.attachmentPathCopy.targetNodeId,
                  attachmentPathCopyTabsKept:
                    JSON.stringify(observations.attachmentPathCopy.beforeGraph.activeLeaf) ===
                      JSON.stringify(observations.attachmentPathCopy.afterGraph.activeLeaf) &&
                    JSON.stringify(observations.attachmentPathCopy.beforeGraph.tabHeaders) ===
                      JSON.stringify(observations.attachmentPathCopy.afterGraph.tabHeaders),
                  userClipboardUntouched:
                    observations.attachmentPathCopy.clipboardCapture.clipboardUnchanged === true,
                  clipboardHooksRestored:
                    observations.attachmentPathCopy.clipboardCapture.writeTextRestored === true &&
                    observations.attachmentPathCopy.clipboardCapture.writeRestored === true &&
                    observations.attachmentPathCopy.clipboardCapture.navigatorWriteTextRestored === true
                }
              : attachmentNewTabProbe
              ? {
                  attachmentTabCreated:
                    observations.attachmentNewTab.after.activeLeaf?.id !==
                      observations.attachmentNewTab.before.activeLeaf?.id &&
                    observations.attachmentNewTab.after.addedTabHeaders.length === 1,
                  attachmentTabActivated:
                    observations.attachmentNewTab.after.activeFile === expected.drag.targetNodeId &&
                    observations.attachmentNewTab.after.activeLeaf?.filePath ===
                      expected.drag.targetNodeId,
                  attachmentViewCreated:
                    observations.attachmentNewTab.after.activeLeaf?.viewType === 'image',
                  graphKeptOpenInBackground:
                    observations.attachmentNewTab.after.graphLeafCount ===
                      observations.attachmentNewTab.before.graphLeafCount &&
                    observations.attachmentNewTab.after.tabHeaders.some(
                      (header) => header.ariaLabel === 'グラフビュー'
                    ),
                  nodeContextMenuClosedAfterAction:
                    observations.attachmentNewTab.after.menuClosed === true
                }
              : attachmentNewWindowProbe
                ? {
                    attachmentWindowCreated:
                      observations.attachmentNewWindow.sourceAfter.browserWindowCount ===
                      observations.attachmentNewWindow.before.browserWindowCount + 1,
                    attachmentWindowActivated:
                      observations.attachmentNewWindow.newWindow.activeFile ===
                        expected.drag.targetNodeId &&
                      observations.attachmentNewWindow.newWindow.activeLeaf?.filePath ===
                        expected.drag.targetNodeId,
                    attachmentViewCreated:
                      observations.attachmentNewWindow.newWindow.activeLeaf?.viewType === 'image',
                    sourceGraphKeptOpen:
                      observations.attachmentNewWindow.sourceAfter.graphLeafCount ===
                      observations.attachmentNewWindow.before.graphLeafCount,
                    nodeContextMenuClosedAfterAction:
                      observations.attachmentNewWindow.sourceAfter.menuClosed === true
                  }
                : attachmentMoveProbe
                  ? {
                      attachmentMoveDialogOpened:
                        observations.attachmentMove.dialog.text.length > 0,
                      attachmentMoveDialogClosed:
                        observations.attachmentMove.dialogClosed === true,
                      nodeContextMenuClosedAfterAction:
                        observations.attachmentMove.menuClosed === true,
                      attachmentMoveOutcomeSafe:
                        attachmentMoveScenario === 'success'
                          ? observations.attachmentMove.before.sourceExists === true &&
                            observations.attachmentMove.before.destinationExists === false &&
                            observations.attachmentMove.after.sourceExists === false &&
                            observations.attachmentMove.after.destinationExists === true
                          : attachmentMoveScenario === 'collision'
                            ? observations.attachmentMove.before.sourceExists === true &&
                              observations.attachmentMove.before.destinationExists === true &&
                              observations.attachmentMove.before.collisionDestinationExists === false &&
                              observations.attachmentMove.after.sourceExists === false &&
                              observations.attachmentMove.after.destinationExists === true &&
                              observations.attachmentMove.after.collisionDestinationExists === true &&
                              observations.attachmentMove.after.homeContent ===
                                observations.attachmentMove.before.homeContent
                            : observations.attachmentMove.before.sourceExists === true &&
                              observations.attachmentMove.after.sourceExists === true &&
                              observations.attachmentMove.after.destinationExists ===
                                observations.attachmentMove.before.destinationExists &&
                              observations.attachmentMove.after.homeContent ===
                                observations.attachmentMove.before.homeContent,
                      attachmentMoveLinkTextPreserved:
                        observations.attachmentMove.after.homeContent ===
                        observations.attachmentMove.before.homeContent,
                      movedAttachmentLinkBecameUnresolved:
                        attachmentMoveScenario === 'cancel' ||
                        observations.afterGraphReopen.metadataUnresolvedLinks.some(
                          (link) =>
                            link.source === '00_Home.md' &&
                            link.target === 'attachments/diagram.svg' &&
                            link.count === 1
                        ),
                      movedAttachmentDestinationIsOrphan:
                        attachmentMoveScenario === 'cancel' ||
                        observations.afterGraphReopen.renderedLinks.every((link) => {
                          const destination =
                            attachmentMoveScenario === 'collision'
                              ? '20_knowledge/diagram 1.svg'
                              : '20_knowledge/diagram.svg'
                          return link.source !== destination && link.target !== destination
                        }),
                      collisionDestinationPreserved:
                        attachmentMoveScenario !== 'collision' ||
                        protectedBefore.files.find(
                          (file) => file.path === '20_knowledge/diagram.svg'
                        )?.sha256 === protectedAfter.files.find(
                          (file) => file.path === '20_knowledge/diagram.svg'
                        )?.sha256,
                      movedAttachmentBytesPreserved:
                        attachmentMoveScenario === 'cancel' ||
                        protectedBefore.files.find(
                          (file) => file.path === 'attachments/diagram.svg'
                        )?.sha256 === protectedAfter.files.find(
                          (file) => file.path === (
                            attachmentMoveScenario === 'collision'
                              ? '20_knowledge/diagram 1.svg'
                              : '20_knowledge/diagram.svg'
                          )
                        )?.sha256
                    }
                  : attachmentBookmarkProbe
                    ? {
                        attachmentBookmarkDialogOpened:
                          observations.attachmentBookmark.firstDialog.text.length > 0,
                        attachmentBookmarkDialogClosed:
                          observations.attachmentBookmark.dialogClosed === true,
                        nodeContextMenuClosedAfterAction:
                          observations.attachmentBookmark.menuClosed === true,
                        attachmentBookmarkOutcome:
                          attachmentBookmarkScenario === 'cancel'
                            ? bookmarkCounts.beforeAction === bookmarkCounts.afterSecondProcessExit
                            : bookmarkCounts.beforeAction === 0 &&
                              bookmarkCounts.afterSecondProcessExit === 1,
                        attachmentBookmarkPersistsAfterGraphReopen:
                          bookmarkCounts.afterGraphReopen ===
                          (attachmentBookmarkScenario === 'cancel' ? bookmarkCounts.beforeAction : 1),
                        attachmentBookmarkPersistsAfterAppRestart:
                          bookmarkCounts.afterAppRestart ===
                          (attachmentBookmarkScenario === 'cancel' ? bookmarkCounts.beforeAction : 1),
                        duplicateBookmarkIsNotDuplicated:
                          attachmentBookmarkScenario !== 'duplicate' ||
                          bookmarkCounts.afterSecondProcessExit === 1,
                        workspaceStateCaptured:
                          observations.bookmarkPersistence.afterSecondProcessExit.workspace.exists === true
                      }
                    : {})
        }
      : {}),
    ...(cameraProbe
      ? {
          cameraInputChanged: cameraChanged,
          zoomPersistedAfterGraphReopen: cameraContract.zoomPersistedAfterGraphReopen,
          panResetAfterGraphReopen: cameraContract.panResetAfterGraphReopen,
          zoomPersistedAfterAppRestart: cameraContract.zoomPersistedAfterAppRestart,
          panResetAfterAppRestart: cameraContract.panResetAfterAppRestart
        }
      : nodeDragProbe
        ? {
            nodeDragApplied:
              Math.abs(nodeDragContract.appliedDeltaCssPx.x - expected.drag.deltaX) < 3 &&
              Math.abs(nodeDragContract.appliedDeltaCssPx.y - expected.drag.deltaY) < 3,
            nodeFixedDuringHold: nodeDragContract.heldFixed,
            nodeReleasedOnPointerUp: nodeDragContract.releasedImmediately,
            nodeMovedAfterRelease: nodeDragContract.movedAfterRelease,
            nodeUnpinnedAfterGraphReopen: nodeDragContract.unpinnedAfterGraphReopen,
            nodeUnpinnedAfterAppRestart: nodeDragContract.unpinnedAfterAppRestart,
            nodePositionNotPersistedInGraphOptions:
              nodeDragContract.nodePositionAbsentFromGraphOptions
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
    isolatedVaultProtectedFilesExpected:
      attachmentMoveProbe && attachmentMoveScenario !== 'cancel'
        ? protectedBefore.combinedSha256 !== protectedAfter.combinedSha256
        : protectedBefore.combinedSha256 === protectedAfter.combinedSha256,
    protocolRestored
  }
  const manifest = {
    capturedAt: new Date().toISOString(),
    stage: attachmentPathCopyProbe
      ? 'GP0-3b-l Obsidian Global Graph attachment path-copy probe'
      : attachmentBookmarkProbe
      ? 'GP0-3b-k Obsidian Global Graph attachment bookmark probe'
      : attachmentMoveProbe
      ? 'GP0-3b-j Obsidian Global Graph attachment file-move probe'
      : attachmentNewWindowProbe
      ? 'GP0-3b-i Obsidian Global Graph attachment new-window probe'
      : attachmentNewTabProbe
      ? 'GP0-3b-h Obsidian Global Graph attachment new-tab probe'
      : nodeNewTabProbe
      ? 'GP0-3b-f Obsidian Global Graph node new-tab probe'
      : nodeMenuProbe
      ? 'GP0-3b-e Obsidian Global Graph node context menu probe'
      : nodeDragProbe
      ? 'GP0-3b-d Obsidian Global Graph node drag lifecycle probe'
      : cameraProbe
        ? 'GP0-3b-c Obsidian Global Graph camera persistence probe'
        : 'GP0-3b Obsidian Global Graph search persistence probe',
    status: Object.values(assertions).every(Boolean) ? 'reference-captured' : 'failed',
    scope: {
      product: 'Obsidian Desktop',
      version: expected.version,
      query: expected.search,
      cameraProbe,
      nodeDragProbe,
      nodeMenuProbe,
      nodeNewTabProbe,
      attachmentNewTabProbe,
      attachmentNewWindowProbe,
      attachmentMoveProbe,
      attachmentMoveScenario: attachmentMoveProbe ? attachmentMoveScenario : null,
      attachmentBookmarkProbe,
      attachmentBookmarkScenario: attachmentBookmarkProbe ? attachmentBookmarkScenario : null,
      attachmentPathCopyProbe,
      attachmentPathCopyScenario: attachmentPathCopyProbe ? attachmentPathCopyScenario : null,
      lifecycle: ['entry', 'graph-close-reopen', 'full-app-restart'],
      fixture: relative(repoRoot, fixtureDirectory).replaceAll('\\', '/'),
      isolatedVault: relative(repoRoot, vaultDirectory).replaceAll('\\', '/'),
      observation: relative(repoRoot, observationPath).replaceAll('\\', '/')
    },
    evidenceBoundary: {
      established: [
        'Fixed Obsidian Desktop 1.13.4 runtime and recorded binary hashes',
        'Chromium CDP Input.dispatchMouseEvent/Input.dispatchKeyEvent against an offscreen Electron window',
        'Fresh isolated Vault and user-data directory for each scenario',
        'Graph close/reopen and a distinct second Obsidian process restart',
        `Light theme at ${expected.viewport.width}x${expected.viewport.height}, deviceScaleFactor ${expected.deviceScaleFactor}`,
        ...(attachmentPathCopyProbe
          ? ['Electron clipboard write API intercepted into an in-renderer test buffer; user clipboard fingerprint unchanged']
          : [])
      ],
      notEstablished: [
        'Physical mouse or keyboard input',
        'Visible on-screen interaction',
        'Touch or pen input',
        'Screen reader or Windows High Contrast behavior',
        'Multi-DPI or pixel-identical rendering parity',
        ...(attachmentPathCopyProbe
          ? ['Physical OS clipboard write/paste roundtrip (the write API was deliberately intercepted)']
          : [])
      ]
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
    nodeDragContract,
    nodeContextMenu: observations.nodeContextMenu ?? null,
    nodeNewTab: observations.nodeNewTab ?? null,
    attachmentNewTab: observations.attachmentNewTab ?? null,
    attachmentNewWindow: observations.attachmentNewWindow ?? null,
    attachmentMove: observations.attachmentMove ?? null,
    attachmentBookmark: observations.attachmentBookmark ?? null,
    attachmentPathCopy: observations.attachmentPathCopy ?? null,
    attachmentPathCopyContract,
    bookmarkCounts,
    bookmarkPersistence: observations.bookmarkPersistence ?? null,
    protection: {
      sourceBefore,
      sourceAfter,
      isolatedVaultBefore: protectedBefore,
      isolatedVaultAfter: protectedAfter,
      protocolBefore,
      protocolRestored
    }
  }
  await writeFile(
    observationPath,
    `${JSON.stringify(repositoryEvidence({ expected, ...observations }), null, 2)}\n`,
    'utf8'
  )
  await writeFile(
    manifestPath,
    `${JSON.stringify(repositoryEvidence(manifest), null, 2)}\n`,
    'utf8'
  )

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
        nodeDragContract,
        nodeContextMenu: observations.nodeContextMenu ?? null,
        nodeNewTab: observations.nodeNewTab ?? null,
        attachmentNewTab: observations.attachmentNewTab ?? null,
        attachmentBookmark: observations.attachmentBookmark ?? null,
        attachmentPathCopyContract,
        bookmarkCounts,
        observation: manifest.scope.observation,
        sourceUnchanged: assertions.sourceUnchanged,
        isolatedVaultProtectedFilesExpected: assertions.isolatedVaultProtectedFilesExpected,
        protocolRestored: assertions.protocolRestored
      },
      null,
      2
    )
  )
}

await main()
