import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const scriptPath = resolve(import.meta.filename)
const malformedQueryCase = process.env.TSUZUNE_GRAPH_MALFORMED_QUERY_CASE?.trim() ?? ''
const malformedQueryProbe = malformedQueryCase.length > 0
const malformedQuery = process.env.TSUZUNE_GRAPH_SEARCH_QUERY
if (malformedQueryProbe && malformedQuery === undefined) {
  throw new Error('TSUZUNE_GRAPH_SEARCH_QUERY を指定してください。')
}
if (malformedQueryProbe && !/^[a-z0-9-]+$/.test(malformedQueryCase)) {
  throw new Error('TSUZUNE_GRAPH_MALFORMED_QUERY_CASE は英小文字、数字、ハイフンで指定してください。')
}
const cameraProbe =
  process.argv.includes('--camera') || process.env.TSUZUNE_GRAPH_CAMERA_PROBE === '1'
const nodeDragProbe =
  process.argv.includes('--node-drag') || process.env.TSUZUNE_GRAPH_NODE_DRAG_PROBE === '1'
const workspaceTabProbe =
  process.argv.includes('--workspace-tab') ||
  process.env.TSUZUNE_GRAPH_WORKSPACE_TAB_PROBE === '1'
const attachmentNewTabProbe =
  process.argv.includes('--attachment-new-tab') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_NEW_TAB_PROBE === '1'
const attachmentNewWindowProbe =
  process.argv.includes('--attachment-new-window') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_NEW_WINDOW_PROBE === '1'
const attachmentMoveProbe =
  process.argv.includes('--attachment-move') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_MOVE_PROBE === '1'
const attachmentMoveScenario =
  process.argv.find((argument) => argument.startsWith('--move-scenario='))?.split('=')[1] ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_MOVE_SCENARIO ||
  'success'
if (!['cancel', 'success', 'collision'].includes(attachmentMoveScenario)) {
  throw new Error('--move-scenario は cancel、success、collision のいずれかを指定してください。')
}
const attachmentBookmarkProbe =
  process.argv.includes('--attachment-bookmark') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_BOOKMARK_PROBE === '1'
const attachmentBookmarkScenario =
  process.argv.find((argument) => argument.startsWith('--bookmark-scenario='))?.split('=')[1] ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_BOOKMARK_SCENARIO ||
  'create'
if (!['cancel', 'create', 'duplicate'].includes(attachmentBookmarkScenario)) {
  throw new Error('--bookmark-scenario は cancel、create、duplicate のいずれかを指定してください。')
}
const attachmentPathCopyProbe =
  process.argv.includes('--attachment-path-copy') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_PATH_COPY_PROBE === '1'
const attachmentPathCopyScenario =
  process.argv.find((argument) => argument.startsWith('--path-copy-scenario='))?.split('=')[1] ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_PATH_COPY_SCENARIO ||
  'vault'
if (!['url', 'vault', 'system'].includes(attachmentPathCopyScenario)) {
  throw new Error('--path-copy-scenario は url、vault、system のいずれかを指定してください。')
}
const attachmentLinkedViewProbe =
  process.argv.includes('--attachment-linked-view') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_LINKED_VIEW_PROBE === '1'
const attachmentDefaultAppProbe =
  process.argv.includes('--attachment-default-app') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_DEFAULT_APP_PROBE === '1'
const attachmentFolderRevealProbe =
  process.argv.includes('--attachment-folder-reveal') ||
  process.env.TSUZUNE_GRAPH_ATTACHMENT_FOLDER_REVEAL_PROBE === '1'
const attachmentExternalProbe = attachmentDefaultAppProbe || attachmentFolderRevealProbe
const nodeNewTabProbe =
  workspaceTabProbe ||
  process.argv.includes('--node-new-tab') ||
  process.env.TSUZUNE_GRAPH_NODE_NEW_TAB_PROBE === '1'
const nodeMenuProbe =
  nodeNewTabProbe || attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe || attachmentLinkedViewProbe || attachmentExternalProbe ||
  process.argv.includes('--node-menu') ||
  process.env.TSUZUNE_GRAPH_NODE_MENU_PROBE === '1'
if ([cameraProbe, nodeDragProbe, nodeMenuProbe && !nodeNewTabProbe && !attachmentNewTabProbe && !attachmentNewWindowProbe && !attachmentMoveProbe && !attachmentBookmarkProbe && !attachmentPathCopyProbe && !attachmentLinkedViewProbe && !attachmentExternalProbe, nodeNewTabProbe, attachmentNewTabProbe, attachmentNewWindowProbe, attachmentMoveProbe, attachmentBookmarkProbe, attachmentPathCopyProbe, attachmentLinkedViewProbe, attachmentExternalProbe, malformedQueryProbe].filter(Boolean).length > 1) {
  throw new Error('--camera、--node-drag、--node-menu、--node-new-tab、--attachment-new-tab、--attachment-new-window、--attachment-move、--attachment-bookmark、--attachment-path-copy、--attachment-linked-view、--attachment-default-app、--attachment-folder-reveal は同時に指定できません。')
}
const probeKind = malformedQueryProbe
  ? `malformed-query-${malformedQueryCase}`
  : attachmentFolderRevealProbe
  ? 'attachment-folder-reveal'
  : attachmentDefaultAppProbe
  ? 'attachment-default-app'
  : attachmentPathCopyProbe
  ? `attachment-path-copy-${attachmentPathCopyScenario}`
  : attachmentLinkedViewProbe
  ? 'attachment-linked-view'
  : attachmentBookmarkProbe
  ? `attachment-bookmark-${attachmentBookmarkScenario}`
  : attachmentMoveProbe
  ? `attachment-file-move-${attachmentMoveScenario}`
  : attachmentNewWindowProbe
  ? 'attachment-new-window'
  : attachmentNewTabProbe
  ? 'attachment-new-tab'
  : nodeNewTabProbe
  ? workspaceTabProbe
    ? 'workspace-tab'
    : 'node-new-tab'
  : nodeMenuProbe
  ? 'node-context-menu'
  : nodeDragProbe
    ? 'node-drag'
    : cameraProbe
      ? 'camera'
      : 'search'
const sourceFixture = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(
  repoRoot,
  malformedQueryProbe
    ? `work/graph-gp0-malformed-query-${malformedQueryCase}-working-tree`
    : attachmentFolderRevealProbe
    ? 'work/graph-gp0-attachment-folder-reveal-working-tree'
    : attachmentDefaultAppProbe
    ? 'work/graph-gp0-attachment-default-app-working-tree'
    : attachmentPathCopyProbe
    ? 'work/graph-gp0-attachment-path-copy-working-tree'
    : attachmentLinkedViewProbe
    ? 'work/graph-gp0-attachment-linked-view-working-tree'
    : attachmentBookmarkProbe
    ? `work/graph-gp0-attachment-bookmark-${attachmentBookmarkScenario}-working-tree`
    : attachmentMoveProbe
    ? `work/graph-gp0-attachment-file-move-${attachmentMoveScenario}-working-tree`
    : probeKind === 'attachment-new-window'
    ? 'work/graph-gp0-attachment-new-window-working-tree'
    : probeKind === 'attachment-new-tab'
    ? 'work/graph-gp0-attachment-new-tab-working-tree'
    : probeKind === 'workspace-tab'
    ? 'work/graph-gp0-workspace-tab-working-tree'
    : probeKind === 'node-new-tab'
    ? 'work/graph-gp0-node-new-tab-working-tree'
    : probeKind === 'node-context-menu'
    ? 'work/graph-gp0-node-context-menu-working-tree'
    : probeKind === 'node-drag'
      ? 'work/graph-gp0-node-drag-restart-working-tree'
    : cameraProbe
      ? 'work/graph-gp0-camera-restart-working-tree'
      : 'work/graph-gp0-3b-search-restart-working-tree'
)
const vault = resolve(workRoot, 'vault')
const userData = resolve(workRoot, 'userdata')
const outputRoot = resolve(
  repoRoot,
  malformedQueryProbe
    ? `docs/reports/assets/graph-gp0-malformed-query/${malformedQueryCase}/tsuzune-working-tree`
    : attachmentFolderRevealProbe
    ? 'docs/reports/assets/graph-gp0-attachment-folder-reveal/tsuzune-working-tree'
    : attachmentDefaultAppProbe
    ? 'docs/reports/assets/graph-gp0-attachment-default-app/tsuzune-working-tree'
    : attachmentPathCopyProbe
    ? `docs/reports/assets/graph-gp0-attachment-path-copy/${attachmentPathCopyScenario}/tsuzune-working-tree`
    : attachmentLinkedViewProbe
    ? 'docs/reports/assets/graph-gp0-attachment-linked-view/tsuzune-working-tree'
    : attachmentBookmarkProbe
    ? `docs/reports/assets/graph-gp0-attachment-bookmark/${attachmentBookmarkScenario}/tsuzune-working-tree`
    : attachmentMoveProbe
    ? `docs/reports/assets/graph-gp0-attachment-file-move/${attachmentMoveScenario}/tsuzune-working-tree`
    : probeKind === 'attachment-new-window'
    ? 'docs/reports/assets/graph-gp0-attachment-new-window/tsuzune-working-tree'
    : probeKind === 'attachment-new-tab'
    ? 'docs/reports/assets/graph-gp0-attachment-new-tab/tsuzune-working-tree'
    : probeKind === 'workspace-tab'
    ? 'docs/reports/assets/graph-gp0-workspace-tab/tsuzune-working-tree'
    : probeKind === 'node-new-tab'
    ? 'docs/reports/assets/graph-gp0-node-new-tab/tsuzune-working-tree'
    : probeKind === 'node-context-menu'
    ? 'docs/reports/assets/graph-gp0-node-context-menu/tsuzune-working-tree'
    : probeKind === 'node-drag'
      ? 'docs/reports/assets/graph-gp0-node-drag-persistence/tsuzune-working-tree'
    : cameraProbe
      ? 'docs/reports/assets/graph-gp0-camera-persistence/tsuzune-working-tree'
      : 'docs/reports/assets/graph-gp0-3b-search-restart-working-tree'
)
const settingsPath = resolve(userData, 'settings.json')
const query = malformedQueryProbe
  ? malformedQuery
  : cameraProbe || nodeDragProbe || nodeMenuProbe
    ? ''
    : 'path:"10_projects"'
const viewport = cameraProbe || nodeDragProbe || nodeMenuProbe
  ? { width: 1265, height: 768 }
  : { width: 1280, height: 800 }
const drag = { targetNodePath: '00_Home.md', deltaX: 96, deltaY: 64 }
const expectedCameraNodePaths = [
  '00_Home.md',
  '10_projects/Project Alpha.md',
  '10_projects/Project Beta.md',
  '20_knowledge/Distillation.md',
  '20_knowledge/Reference.md',
  '80_excluded/Hidden.md',
  '90_orphan/Orphan.md',
  'Missing Note.md'
].concat(
  attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe || attachmentLinkedViewProbe || attachmentExternalProbe
    ? ['attachments/diagram.svg']
    : []
).concat(
  attachmentMoveProbe && attachmentMoveScenario === 'collision'
    ? ['20_knowledge/diagram.svg']
    : []
).sort(ordinal)
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
  [vault, '<TSUZUNE_VAULT_ROOT>'],
  [userData, '<TSUZUNE_USER_DATA_ROOT>'],
  [workRoot, '<TSUZUNE_CAPTURE_ROOT>'],
  [repoRoot, '<REPO_ROOT>']
].sort(([left], [right]) => right.length - left.length)

const repositoryEvidence = (value) =>
  attachmentPathCopyProbe || attachmentLinkedViewProbe || attachmentExternalProbe
    ? sanitizeEvidence(value, pathCopyEvidenceReplacements)
    : value

function clipboardTextFingerprint(value) {
  return {
    bytes: Buffer.byteLength(value, 'utf8'),
    sha256: createHash('sha256').update(value, 'utf8').digest('hex').toUpperCase()
  }
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

async function optionalFileState(path) {
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) return { exists: false }
  return {
    exists: true,
    ...(await fileDigest(path)),
    birthtime: info.birthtime.toISOString(),
    mtime: info.mtime.toISOString()
  }
}

async function optionalJsonFileState(path) {
  const state = await optionalFileState(path)
  if (!state.exists) return { ...state, json: null, parseError: null }
  try {
    return {
      ...state,
      json: JSON.parse(await readFile(path, 'utf8')),
      parseError: null
    }
  } catch (error) {
    return {
      ...state,
      json: null,
      parseError: error instanceof Error ? error.message : String(error)
    }
  }
}

async function isolatedVaultContentDigest() {
  const files = (await listFiles(vault)).filter(
    (file) => file.relativePath !== '.tsuzune' && !file.relativePath.startsWith('.tsuzune/')
  )
  return digestFiles(files)
}

async function snapshotBookmarkPersistence(label) {
  return {
    label,
    capturedAt: new Date().toISOString(),
    vaultContent: await isolatedVaultContentDigest(),
    bookmarks: await optionalJsonFileState(resolve(vault, '.tsuzune/bookmarks.json'))
  }
}

function bookmarkPathCount(json, targetPath) {
  if (!Array.isArray(json)) return 0
  return json.filter((bookmark) => bookmark?.path === targetPath).length
}

async function attachmentMoveVaultState() {
  const homePath = resolve(vault, '00_Home.md')
  return {
    source: await optionalFileState(resolve(vault, 'attachments/diagram.svg')),
    destination: await optionalFileState(resolve(vault, '20_knowledge/diagram.svg')),
    numberedDestination: await optionalFileState(
      resolve(vault, '20_knowledge/diagram 1.svg')
    ),
    home: {
      ...(await optionalFileState(homePath)),
      content: await readFile(homePath, 'utf8')
    },
    files: (await listFiles(vault)).map((file) => file.relativePath)
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
    `(() => {
      const searchInput = document.querySelector('[aria-label="ファイルを検索…"]')
      const searchRegion = searchInput?.closest('aside')
      const visibleText = (element) => {
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return null
        const text = element.textContent?.replace(/\\s+/g, ' ').trim()
        return text || null
      }
      const targetButton = [...document.querySelectorAll('button.wiki-graph-node')]
        .find((node) => node.title === ${JSON.stringify(drag.targetNodePath)})
      const targetDot = targetButton?.querySelector('.wiki-graph-node-dot')
      const targetBounds = targetDot?.getBoundingClientRect() ?? null
      const leftMatch = targetButton?.style.left.match(/(-?[0-9]+(?:[.][0-9]+)?)px/)
      const topMatch = targetButton?.style.top.match(/(-?[0-9]+(?:[.][0-9]+)?)px/)
      return {
      query: searchInput?.value ?? null,
      graphLabel: document.querySelector('.wiki-graph-view')?.getAttribute('aria-label') ?? null,
      searchDiagnostics: {
        inputAriaInvalid: searchInput?.getAttribute('aria-invalid') ?? null,
        inputClasses: searchInput ? [...searchInput.classList].sort() : [],
        visibleErrorTexts: [...(searchRegion?.querySelectorAll('[role="alert"], .error, .mod-error') ?? [])]
          .map(visibleText)
          .filter(Boolean)
      },
      settingsPanelVisible: Boolean(document.querySelector('aside[aria-label="グラフ設定"]')),
      filterSectionVisible: Boolean(document.querySelector('[aria-label="ファイルを検索…"]')),
      nodePaths: [...document.querySelectorAll('button.wiki-graph-node')]
        .map((node) => node.title)
        .sort(),
      nodeDetails: [...document.querySelectorAll('button.wiki-graph-node')]
        .map((node) => ({
          path: node.title,
          ariaLabel: node.getAttribute('aria-label'),
          classes: [...node.classList].sort()
        }))
        .sort((left, right) => left.path.localeCompare(right.path)),
      edgeCount: Number(document.querySelector('canvas.wiki-graph-edges')?.dataset.edgeCount ?? 0),
      edgeSignature: (() => {
        if (!${JSON.stringify(attachmentExternalProbe)}) return null
        const canvas = document.querySelector('canvas.wiki-graph-edges')
        const fiberKey = canvas && Object.keys(canvas).find((key) => key.startsWith('__reactFiber$'))
        let fiber = fiberKey ? canvas[fiberKey] : null
        while (fiber) {
          const edges = fiber.memoizedProps?.graph?.edges
          if (Array.isArray(edges)) {
            return edges
              .map(({ sourcePath, targetPath }) => ({ sourcePath, targetPath }))
              .sort((left, right) =>
                left.sourcePath.localeCompare(right.sourcePath) ||
                left.targetPath.localeCompare(right.targetPath)
              )
          }
          fiber = fiber.return
        }
        return null
      })(),
      stageTransform: document.querySelector('.wiki-graph-stage')?.style.transform ?? '',
      tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => ({
        label: tab.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        selected: tab.getAttribute('aria-selected') === 'true'
      })),
      targetNode: targetButton && targetBounds
        ? {
            path: targetButton.title,
            x: leftMatch ? Number(leftMatch[1]) : null,
            y: topMatch ? Number(topMatch[1]) : null,
            clientX: targetBounds.left + targetBounds.width / 2,
            clientY: targetBounds.top + targetBounds.height / 2,
            dotWidth: targetBounds.width,
            dotHeight: targetBounds.height,
            styleLeft: targetButton.style.left,
            styleTop: targetButton.style.top
          }
        : null,
      canvasRect: (() => {
        const canvas = document.querySelector('[aria-label="グラフキャンバス"]')
        if (!canvas) return null
        const bounds = canvas.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      })(),
      dimensions: {
        innerWidth,
        innerHeight,
        devicePixelRatio
      }
    }})()`
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
    stableSamples = state.query === expectedQuery &&
      (malformedQueryProbe || state.nodePaths.length > 0) &&
      signature === previous
      ? stableSamples + 1
      : 0
    if (stableSamples >= 3) return state
    previous = signature
    await delay(200)
  }
  throw new Error(`Graph検索結果が安定しませんでした: ${JSON.stringify(await graphState(window))}`)
}

async function waitForTargetNodeStability(window, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let previous = null
  let stableSamples = 0
  while (Date.now() < deadline) {
    const state = await graphState(window)
    const current = state.targetNode
    if (
      current &&
      previous &&
      Math.hypot(current.clientX - previous.clientX, current.clientY - previous.clientY) < 0.75
    ) {
      stableSamples += 1
      if (stableSamples >= 4) return state
    } else {
      stableSamples = 0
    }
    previous = current
    await delay(200)
  }
  throw new Error('TSUZUNEのdrag対象nodeが安定しませんでした。')
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

async function waitForSavedScale(expectedScale) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const settings = JSON.parse(await readFile(settingsPath, 'utf8'))
    if (Math.abs((settings.graphViewStates?.vault?.scale ?? 0) - expectedScale) < 1e-9) {
      return settings
    }
    await delay(100)
  }
  throw new Error('Graph zoomが隔離settingsへ保存されませんでした。')
}

async function applyCameraInput(window) {
  const result = await evaluate(
    window,
    `(() => {
      const canvas = document.querySelector('[aria-label="グラフキャンバス"]')
      if (!(canvas instanceof HTMLElement)) throw new Error('Graph canvasが見つかりません。')
      const bounds = canvas.getBoundingClientRect()
      const centerX = bounds.left + bounds.width / 2
      const centerY = bounds.top + bounds.height / 2
      canvas.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -120,
        clientX: centerX,
        clientY: centerY
      }))
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 42,
        button: 0,
        buttons: 1,
        clientX: centerX,
        clientY: centerY
      }))
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 42,
        button: 0,
        buttons: 1,
        clientX: centerX + 96,
        clientY: centerY + 64
      }))
      canvas.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 42,
        button: 0,
        buttons: 0,
        clientX: centerX + 96,
        clientY: centerY + 64
      }))
      return { centerX, centerY, drag: { x: 96, y: 64 }, wheelDeltaY: -120 }
    })()`
  )
  await delay(500)
  await waitForPaint(window)
  return result
}

async function beginNodeDragInput(window) {
  const target = await evaluate(
    window,
    `(() => {
      const button = [...document.querySelectorAll('button.wiki-graph-node')]
        .find((node) => node.title === ${JSON.stringify(drag.targetNodePath)})
      const dot = button?.querySelector('.wiki-graph-node-dot')
      const canvas = document.querySelector('[aria-label="グラフキャンバス"]')
      if (!(button instanceof HTMLButtonElement) || !(dot instanceof HTMLElement)) {
        throw new Error('drag対象nodeが見つかりません。')
      }
      if (!(canvas instanceof HTMLElement)) throw new Error('Graph canvasが見つかりません。')
      const targetBounds = dot.getBoundingClientRect()
      const canvasBounds = canvas.getBoundingClientRect()
      const startX = targetBounds.left + targetBounds.width / 2
      const startY = targetBounds.top + targetBounds.height / 2
      const endX = startX + ${drag.deltaX}
      const endY = startY + ${drag.deltaY}
      if (
        startX < canvasBounds.left ||
        startX > canvasBounds.right ||
        startY < canvasBounds.top ||
        startY > canvasBounds.bottom ||
        endX > canvasBounds.right ||
        endY > canvasBounds.bottom
      ) {
        throw new Error('drag経路がGraph canvas外です。')
      }
      return { startX, startY, endX, endY }
    })()`
  )
  const debug = window.webContents.debugger
  if (!debug.isAttached()) debug.attach('1.3')
  await debug.sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: target.startX,
    y: target.startY,
    button: 'none',
    buttons: 0
  })
  await debug.sendCommand('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: target.startX,
    y: target.startY,
    button: 'left',
    buttons: 1,
    clickCount: 1
  })
  for (let step = 1; step <= 4; step += 1) {
    await debug.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: target.startX + (drag.deltaX * step) / 4,
      y: target.startY + (drag.deltaY * step) / 4,
      button: 'left',
      buttons: 1
    })
    await delay(35)
  }
  await delay(200)
  return target
}

async function releaseNodeDragInput(window, target) {
  const debug = window.webContents.debugger
  try {
    await debug.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: target.endX,
      y: target.endY,
      button: 'left',
      buttons: 0,
      clickCount: 1
    })
  } finally {
    if (debug.isAttached()) debug.detach()
  }
}

async function openNodeContextMenu(window, targetNodePath = drag.targetNodePath) {
  const target = await evaluate(
    window,
    `(() => {
      const node = document.querySelector('.wiki-graph-node[title=${JSON.stringify(targetNodePath)}]')
      if (!(node instanceof HTMLButtonElement)) throw new Error('context menu対象nodeが見つかりません。')
      const bounds = node.querySelector('.wiki-graph-node-dot')?.getBoundingClientRect()
      const canvas = document.querySelector('.wiki-graph-canvas')?.getBoundingClientRect()
      if (!bounds || !canvas) throw new Error('Graph nodeまたはcanvasの座標を取得できません。')
      const x = bounds.left + bounds.width / 2
      const y = bounds.top + bounds.height / 2
      if (x < canvas.left || x > canvas.right || y < canvas.top || y > canvas.bottom) {
        throw new Error('context menu対象nodeがGraph canvas外です。')
      }
      return { x, y }
    })()`
  )
  const debug = window.webContents.debugger
  if (!debug.isAttached()) debug.attach('1.3')
  try {
    await debug.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: target.x, y: target.y, button: 'none', buttons: 0
    })
    await delay(250)
    await debug.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: target.x, y: target.y, button: 'right', buttons: 2, clickCount: 1
    })
    await delay(80)
    await debug.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: target.x, y: target.y, button: 'right', buttons: 0, clickCount: 1
    })
  } finally {
    if (debug.isAttached()) debug.detach()
  }
  const menu = await evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + 5000
      const check = () => {
        const menu = document.querySelector('.wiki-graph-context-menu')
        if (menu) {
          const bounds = menu.getBoundingClientRect()
          resolve({
            targetNodePath: ${JSON.stringify(targetNodePath)},
            bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
            items: [...menu.querySelectorAll('[role="menuitem"]')].map((item, index) => ({
              index,
              text: item.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
              disabled: item instanceof HTMLButtonElement ? item.disabled : item.getAttribute('aria-disabled') === 'true',
              classes: [...item.classList].sort()
            })),
            title: menu.querySelector('.wiki-graph-context-title')?.textContent?.trim() ?? null
          })
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error('node context menuが5秒以内に開きませんでした。'))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
  return { input: target, menu }
}

async function closeNodeContextMenu(window) {
  await evaluate(window, `(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return !document.querySelector('.wiki-graph-context-menu')
  })()`)
}

function expectedAttachmentMoveNodePaths(stageName) {
  const paths = [
    '00_Home.md',
    '10_projects/Project Alpha.md',
    '10_projects/Project Beta.md',
    '20_knowledge/Distillation.md',
    '20_knowledge/Reference.md',
    '80_excluded/Hidden.md',
    '90_orphan/Orphan.md',
    'Missing Note.md',
    'attachments/diagram.svg'
  ]
  if (attachmentMoveScenario === 'collision') {
    paths.push('20_knowledge/diagram.svg')
  }
  if (stageName === 'after' && attachmentMoveScenario === 'success') {
    paths.push('20_knowledge/diagram.svg')
  }
  if (stageName === 'after' && attachmentMoveScenario === 'collision') {
    paths.push('20_knowledge/diagram 1.svg')
  }
  return paths.sort(ordinal)
}

async function waitForAttachmentMoveGraph(window, stageName) {
  const expectedPaths = expectedAttachmentMoveNodePaths(stageName)
  const deadline = Date.now() + 15_000
  let previous = ''
  let stableSamples = 0
  while (Date.now() < deadline) {
    const state = await graphState(window)
    const oldAttachment = state.nodeDetails.find(
      (node) => node.path === 'attachments/diagram.svg'
    )
    const oldAttachmentResolved = oldAttachment?.ariaLabel?.includes('添付書類') === true
    const oldAttachmentExpectedResolved = stageName === 'before' || attachmentMoveScenario === 'cancel'
    const signature = JSON.stringify({
      nodePaths: state.nodePaths,
      nodeDetails: state.nodeDetails,
      edgeCount: state.edgeCount
    })
    stableSamples =
      JSON.stringify(state.nodePaths) === JSON.stringify(expectedPaths) &&
      oldAttachmentResolved === oldAttachmentExpectedResolved &&
      signature === previous
        ? stableSamples + 1
        : 0
    if (stableSamples >= 3) return state
    previous = signature
    await delay(200)
  }
  throw new Error(
    `添付移動${stageName}のGraph node集合が安定しませんでした: ${JSON.stringify({
      expectedPaths,
      actual: await graphState(window)
    })}`
  )
}

async function observeMoveDialog(window) {
  return evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const dialog = document.querySelector('[role="dialog"][aria-labelledby="move-dialog-title"]')
      if (dialog instanceof HTMLFormElement) {
        const select = dialog.querySelector('select[name="directory"]')
        const active = document.activeElement
        resolve({
          title: dialog.querySelector('#move-dialog-title')?.textContent?.trim() ?? null,
          description: dialog.querySelector('#move-dialog-description')?.textContent?.trim() ?? null,
          selectedDirectory: select instanceof HTMLSelectElement ? select.value : null,
          directories: select instanceof HTMLSelectElement
            ? [...select.options].map((option) => ({ text: option.text, value: option.value }))
            : [],
          buttons: [...dialog.querySelectorAll('button')].map((button) => ({
            text: button.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
            type: button.type,
            disabled: button.disabled
          })),
          activeElement: active instanceof HTMLElement
            ? { tagName: active.tagName, name: active.getAttribute('name'), text: active.textContent?.trim() ?? '' }
            : null
        })
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('ファイル移動dialogが5秒以内に開きませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
}

async function waitForAttachmentMoveOutcome(window) {
  const deadline = Date.now() + 15_000
  let latest = null
  while (Date.now() < deadline) {
    const files = await attachmentMoveVaultState()
    const ui = await evaluate(window, `({
      dialogOpen: Boolean(document.querySelector('[role="dialog"][aria-labelledby="move-dialog-title"]')),
      contextMenuOpen: Boolean(document.querySelector('.wiki-graph-context-menu')),
      message: document.querySelector('.message-banner[role="status"] span')?.textContent?.trim() ?? null,
      globalGraphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]'))
    })`)
    latest = { files, ui }
    const complete = attachmentMoveScenario === 'cancel'
      ? files.source.exists && !files.destination.exists && !ui.dialogOpen
      : attachmentMoveScenario === 'success'
        ? !files.source.exists && files.destination.exists && !ui.dialogOpen
        : !files.source.exists && files.destination.exists && files.numberedDestination.exists && !ui.dialogOpen
    if (complete) return latest
    await delay(100)
  }
  throw new Error(`添付移動${attachmentMoveScenario}の完了を確認できませんでした: ${JSON.stringify(latest)}`)
}

async function activateAttachmentMove(window) {
  const before = await attachmentMoveVaultState()
  await evaluate(window, `(() => {
    const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === 'ファイルを移動…')
    if (!(item instanceof HTMLButtonElement) || item.disabled) {
      throw new Error('有効な「ファイルを移動…」が見つかりません。')
    }
    item.click()
  })()`)
  const dialog = await observeMoveDialog(window)
  await evaluate(window, `new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })`)
  const dialogScreenshot = await capture(window, '02-move-dialog.png')

  await evaluate(window, `(() => {
    const dialog = document.querySelector('[role="dialog"][aria-labelledby="move-dialog-title"]')
    if (!(dialog instanceof HTMLFormElement)) throw new Error('ファイル移動dialogが見つかりません。')
    if (${JSON.stringify(attachmentMoveScenario)} === 'cancel') {
      const cancel = [...dialog.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'キャンセル'
      )
      if (!(cancel instanceof HTMLButtonElement)) throw new Error('キャンセルbuttonが見つかりません。')
      cancel.click()
      return
    }
    const select = dialog.querySelector('select[name="directory"]')
    if (!(select instanceof HTMLSelectElement)) throw new Error('移動先selectが見つかりません。')
    select.value = '20_knowledge'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    const submit = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '移動'
    )
    if (!(submit instanceof HTMLButtonElement)) throw new Error('移動buttonが見つかりません。')
    submit.click()
  })()`)

  const outcome = await waitForAttachmentMoveOutcome(window)
  const graphAfterAction = await waitForAttachmentMoveGraph(window, 'after')
  await delay(200)
  const actionScreenshot = await capture(
    window,
    `03-after-${attachmentMoveScenario}.png`
  )
  return {
    scenario: attachmentMoveScenario,
    before,
    dialog,
    after: outcome.files,
    uiAfterAction: outcome.ui,
    graphAfterAction,
    screenshots: [dialogScreenshot, actionScreenshot]
  }
}

async function observeBookmarkDialog(window) {
  return evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const dialog = document.querySelector('[role="dialog"][aria-labelledby="bookmark-dialog-title"]')
      if (dialog instanceof HTMLFormElement) {
        const active = document.activeElement
        resolve({
          title: dialog.querySelector('#bookmark-dialog-title')?.textContent?.trim() ?? null,
          description: dialog.querySelector('p')?.textContent?.trim() ?? null,
          inputs: [...dialog.querySelectorAll('input')].map((input) => ({
            name: input.name,
            value: input.value,
            placeholder: input.placeholder,
            disabled: input.disabled
          })),
          buttons: [...dialog.querySelectorAll('button')].map((button) => ({
            text: button.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
            type: button.type,
            disabled: button.disabled
          })),
          activeElement: active instanceof HTMLElement
            ? { tagName: active.tagName, name: active.getAttribute('name') }
            : null
        })
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('ブックマークdialogが5秒以内に開きませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
}

async function clickBookmarkMenuAction(window) {
  return evaluate(window, `(() => {
    const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim().includes('ブックマーク'))
    if (!(item instanceof HTMLButtonElement) || item.disabled) {
      throw new Error('有効なブックマーク操作が見つかりません。')
    }
    const text = item.textContent?.replace(/\\s+/g, ' ').trim() ?? ''
    item.click()
    return text
  })()`)
}

async function closeBookmarkDialog(window, save) {
  await evaluate(window, `(() => {
    const dialog = document.querySelector('[role="dialog"][aria-labelledby="bookmark-dialog-title"]')
    if (!(dialog instanceof HTMLFormElement)) throw new Error('ブックマークdialogが見つかりません。')
    const button = [...dialog.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === ${JSON.stringify(save ? '保存' : 'キャンセル')}
    )
    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      throw new Error('ブックマークdialogの操作buttonが見つかりません。')
    }
    button.click()
  })()`)
}

async function waitForBookmarkOutcome(window, expectedCount) {
  const deadline = Date.now() + 15_000
  let latest = null
  while (Date.now() < deadline) {
    const persistence = await snapshotBookmarkPersistence('poll')
    const ui = await evaluate(window, `({
      dialogOpen: Boolean(document.querySelector('[role="dialog"][aria-labelledby="bookmark-dialog-title"]')),
      contextMenuOpen: Boolean(document.querySelector('.wiki-graph-context-menu')),
      globalGraphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]'))
    })`)
    const count = bookmarkPathCount(persistence.bookmarks.json, 'attachments/diagram.svg')
    latest = { persistence, ui, count }
    if (!ui.dialogOpen && !ui.contextMenuOpen && count === expectedCount) return latest
    await delay(100)
  }
  throw new Error(`ブックマーク操作の完了を確認できませんでした: ${JSON.stringify(latest)}`)
}

async function activateAttachmentBookmark(window) {
  const beforeAction = await snapshotBookmarkPersistence('before-action')
  const beforeCount = bookmarkPathCount(beforeAction.bookmarks.json, 'attachments/diagram.svg')
  const firstMenuAction = await clickBookmarkMenuAction(window)
  const firstDialog = await observeBookmarkDialog(window)
  await waitForPaint(window)
  firstDialog.screenshot = await capture(window, '02-bookmark-dialog.png')
  await closeBookmarkDialog(window, attachmentBookmarkScenario !== 'cancel')
  const firstOutcome = await waitForBookmarkOutcome(
    window,
    attachmentBookmarkScenario === 'cancel' ? beforeCount : 1
  )

  let secondMenu = null
  let secondMenuInput = null
  let secondMenuAction = null
  let secondDialog = null
  if (attachmentBookmarkScenario === 'duplicate') {
    await waitForTargetNodeStability(window)
    const opened = await openNodeContextMenu(window, 'attachments/diagram.svg')
    secondMenuInput = opened.input
    secondMenu = opened.menu
    secondMenu.screenshot = await capture(window, '03-duplicate-node-context-menu.png')
    secondMenuAction = await clickBookmarkMenuAction(window)
    secondDialog = await observeBookmarkDialog(window)
    await waitForPaint(window)
    secondDialog.screenshot = await capture(window, '04-duplicate-bookmark-dialog.png')
    await closeBookmarkDialog(window, true)
    await waitForBookmarkOutcome(window, 1)
  }

  const afterAction = await snapshotBookmarkPersistence('after-action')
  const uiAfterAction = await evaluate(window, `({
    dialogOpen: Boolean(document.querySelector('[role="dialog"][aria-labelledby="bookmark-dialog-title"]')),
    contextMenuOpen: Boolean(document.querySelector('.wiki-graph-context-menu')),
    globalGraphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]'))
  })`)
  const actionScreenshot = await capture(
    window,
    attachmentBookmarkScenario === 'duplicate'
      ? '05-after-bookmark-action.png'
      : '03-after-bookmark-action.png'
  )
  return {
    scenario: attachmentBookmarkScenario,
    firstMenuAction,
    firstDialog,
    firstOutcome,
    secondMenuInput,
    secondMenu,
    secondMenuAction,
    secondDialog,
    uiAfterAction,
    persistence: { beforeAction, afterAction },
    screenshots: [
      firstDialog.screenshot,
      secondMenu?.screenshot ?? null,
      secondDialog?.screenshot ?? null,
      actionScreenshot
    ].filter(Boolean)
  }
}

function expectedAttachmentPathCopyText() {
  const relativePath = 'attachments/diagram.svg'
  if (attachmentPathCopyScenario === 'url') {
    return `obsidian://open?vault=${encodeURIComponent('vault')}&file=${encodeURIComponent(relativePath)}`
  }
  if (attachmentPathCopyScenario === 'system') {
    return resolve(vault, relativePath)
  }
  return relativePath
}

async function activateAttachmentPathCopy(window, clipboardCapture) {
  const labelByScenario = {
    url: 'Obsidian URL として',
    vault: '保管庫フォルダから',
    system: 'システムルートから'
  }
  const graphBeforeAction = await graphState(window)
  await evaluate(window, `(() => {
    const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
      .find((candidate) => candidate.getAttribute('aria-label') === 'パスをコピー')
    if (!(item instanceof HTMLButtonElement) || item.disabled) {
      throw new Error('有効な「パスをコピー」が見つかりません。')
    }
    item.click()
  })()`)
  const submenu = await evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const main = document.querySelector('.wiki-graph-context-menu')
      const parent = main?.querySelector('[role="menuitem"][aria-label="パスをコピー"]')
      const submenu = main?.querySelector('[role="menu"][aria-label="パスをコピー"]')
      if (main instanceof HTMLElement && parent instanceof HTMLButtonElement && submenu instanceof HTMLElement) {
        const mainBounds = main.getBoundingClientRect()
        const parentBounds = parent.getBoundingClientRect()
        const submenuBounds = submenu.getBoundingClientRect()
        resolve({
          mainMenuStillOpen: true,
          parentAriaExpanded: parent.getAttribute('aria-expanded'),
          mainBounds: { left: mainBounds.left, right: mainBounds.right, top: mainBounds.top, bottom: mainBounds.bottom, width: mainBounds.width, height: mainBounds.height },
          parentBounds: { left: parentBounds.left, right: parentBounds.right, top: parentBounds.top, bottom: parentBounds.bottom, width: parentBounds.width, height: parentBounds.height },
          submenuBounds: { left: submenuBounds.left, right: submenuBounds.right, top: submenuBounds.top, bottom: submenuBounds.bottom, width: submenuBounds.width, height: submenuBounds.height },
          placement: submenuBounds.right <= parentBounds.left + 2
            ? 'left'
            : submenuBounds.left >= parentBounds.right - 2
              ? 'right'
              : 'overlap',
          fullyInsideViewport:
            submenuBounds.left >= 0 && submenuBounds.top >= 0 &&
            submenuBounds.right <= innerWidth && submenuBounds.bottom <= innerHeight,
          items: [...submenu.querySelectorAll('[role="menuitem"]')].map((item, index) => ({
            index,
            text: item.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
            disabled: item instanceof HTMLButtonElement ? item.disabled : item.getAttribute('aria-disabled') === 'true'
          }))
        })
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('パスをコピーsubmenuが5秒以内に開きませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
  await waitForPaint(window)
  submenu.screenshot = await capture(window, '02-path-copy-submenu.png')

  await evaluate(window, `(() => {
    const label = ${JSON.stringify(labelByScenario[attachmentPathCopyScenario])}
    const item = [...document.querySelectorAll('[role="menu"][aria-label="パスをコピー"] [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === label)
    if (!(item instanceof HTMLButtonElement) || item.disabled) {
      throw new Error('有効なパスコピー形式が見つかりません: ' + label)
    }
    item.click()
  })()`)

  const deadline = Date.now() + 5_000
  let uiAfterAction = null
  while (Date.now() < deadline) {
    uiAfterAction = await evaluate(window, `({
      contextMenuOpen: Boolean(document.querySelector('.wiki-graph-context-menu')),
      submenuOpen: Boolean(document.querySelector('[role="menu"][aria-label="パスをコピー"]')),
      globalGraphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]'))
    })`)
    if (clipboardCapture.writes.length === 1 && !uiAfterAction.contextMenuOpen) break
    await delay(50)
  }
  const graphAfterAction = await graphState(window)
  const actionScreenshot = await capture(window, '03-after-path-copy.png')
  return {
    scenario: attachmentPathCopyScenario,
    expectedText: expectedAttachmentPathCopyText(),
    submenu,
    writes: [...clipboardCapture.writes],
    uiAfterAction,
    graphBeforeAction,
    graphAfterAction,
    screenshots: [submenu.screenshot, actionScreenshot]
  }
}

async function activateAttachmentDefaultApp(window, shellOpenPathCapture) {
  const graphBeforeAction = await graphState(window)
  await evaluate(window, `(() => {
    const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === 'デフォルトアプリで開く')
    if (!(item instanceof HTMLButtonElement) || item.disabled) {
      throw new Error('有効な「デフォルトアプリで開く」が見つかりません。')
    }
    item.click()
  })()`)

  const deadline = Date.now() + 5_000
  let uiAfterAction = null
  while (Date.now() < deadline) {
    uiAfterAction = await evaluate(window, `({
      contextMenuOpen: Boolean(document.querySelector('.wiki-graph-context-menu')),
      globalGraphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]'))
    })`)
    if (shellOpenPathCapture.calls.length === 1 && !uiAfterAction.contextMenuOpen) break
    if (shellOpenPathCapture.calls.length > 1) {
      throw new Error('shell.openPathが複数回呼ばれました。')
    }
    await delay(50)
  }
  if (shellOpenPathCapture.calls.length !== 1 || uiAfterAction?.contextMenuOpen !== false) {
    throw new Error('外部open request 1回とmenu closeを5秒以内に確認できませんでした。')
  }

  const graphAfterAction = await graphState(window)
  const screenshot = await capture(window, '02-after-default-app-request.png')
  return {
    actionLabel: 'デフォルトアプリで開く',
    expectedPath: resolve(vault, 'attachments/diagram.svg'),
    apiSeam: 'electron.shell.openPath',
    calls: [...shellOpenPathCapture.calls],
    uiAfterAction,
    graphBeforeAction,
    graphAfterAction,
    screenshots: [screenshot]
  }
}

async function activateAttachmentFolderReveal(window, shellShowItemInFolderCapture) {
  const graphBeforeAction = await graphState(window)
  await evaluate(window, `(() => {
    const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === 'フォルダで表示')
    if (!(item instanceof HTMLButtonElement) || item.disabled) {
      throw new Error('有効な「フォルダで表示」が見つかりません。')
    }
    item.click()
  })()`)

  const deadline = Date.now() + 5_000
  let uiAfterAction = null
  while (Date.now() < deadline) {
    uiAfterAction = await evaluate(window, `({
      contextMenuOpen: Boolean(document.querySelector('.wiki-graph-context-menu')),
      globalGraphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]'))
    })`)
    if (shellShowItemInFolderCapture.calls.length === 1 && !uiAfterAction.contextMenuOpen) break
    if (shellShowItemInFolderCapture.calls.length > 1) {
      throw new Error('shell.showItemInFolderが複数回呼ばれました。')
    }
    await delay(50)
  }
  if (shellShowItemInFolderCapture.calls.length !== 1 || uiAfterAction?.contextMenuOpen !== false) {
    throw new Error('folder reveal request 1回とmenu closeを5秒以内に確認できませんでした。')
  }

  const graphAfterAction = await graphState(window)
  const screenshot = await capture(window, '02-after-folder-reveal-request.png')
  return {
    actionLabel: 'フォルダで表示',
    expectedPath: resolve(vault, 'attachments/diagram.svg'),
    apiSeam: 'electron.shell.showItemInFolder',
    calls: [...shellShowItemInFolderCapture.calls],
    uiAfterAction,
    graphBeforeAction,
    graphAfterAction,
    screenshots: [screenshot]
  }
}

async function activateAttachmentLinkedView(window) {
  const beforeGraph = await graphState(window)
  const hover = await evaluate(window, `new Promise((resolve, reject) => {
    const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim().startsWith('リンクされたビューを開く'))
    if (!(item instanceof HTMLButtonElement) || item.disabled) {
      reject(new Error('有効な「リンクされたビューを開く」が見つかりません。'))
      return
    }
    item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    const deadline = performance.now() + 5000
    const check = () => {
      const menus = [...document.querySelectorAll('.wiki-graph-context-menu [role="menu"], .wiki-graph-context-menu')]
        .filter((menu) => menu instanceof HTMLElement && menu.getBoundingClientRect().width > 0)
      const submenu = document.querySelector('.wiki-graph-context-menu [role="menu"][aria-label="リンクされたビュー"]')
      if (submenu instanceof HTMLElement) {
        resolve({
          visibleMenuCount: menus.length,
          parentMenuVisible: Boolean(document.querySelector('.wiki-graph-context-menu')),
          items: [...submenu.querySelectorAll('[role="menuitem"]')].map((candidate, index) => ({
            index,
            text: candidate.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
            disabled: candidate instanceof HTMLButtonElement ? candidate.disabled : candidate.getAttribute('aria-disabled') === 'true'
          }))
        })
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('リンクされたビューsubmenuが5秒以内に開きませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
  const hoverScreenshot = await capture(window, '02-after-linked-view-hover.png')
  await evaluate(window, `(() => {
    const parent = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim().startsWith('リンクされたビューを開く'))
    if (!(parent instanceof HTMLButtonElement)) throw new Error('リンクされたビュー親項目が見つかりません。')
    parent.click()
  })()`)
  const submenu = await evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const menu = document.querySelector('.wiki-graph-context-menu [role="menu"][aria-label="リンクされたビュー"]')
      if (menu instanceof HTMLElement) {
        const bounds = menu.getBoundingClientRect()
        resolve({
          bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
          items: [...menu.querySelectorAll('[role="menuitem"]')].map((candidate, index) => ({
            index,
            text: candidate.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
            disabled: candidate instanceof HTMLButtonElement ? candidate.disabled : candidate.getAttribute('aria-disabled') === 'true'
          }))
        })
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('リンクされたビューsubmenuが5秒以内に開きませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
  const submenuScreenshot = await capture(window, '03-after-linked-view-click.png')
  const firstEnabled = submenu.items.find((item) => !item.disabled)
  if (!firstEnabled) throw new Error('リンクされたビューsubmenuに有効な操作がありません。')
  await evaluate(window, `(() => {
    const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menu"][aria-label="リンクされたビュー"] [role="menuitem"]')]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(firstEnabled.text)})
    if (!(item instanceof HTMLButtonElement) || item.disabled) throw new Error('バックリンク操作が見つかりません。')
    item.click()
  })()`)
  const after = await evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const region = document.querySelector('[aria-label="バックリンクビュー"]')
      if (region instanceof HTMLElement) {
        resolve({
          menuClosed: !document.querySelector('.wiki-graph-context-menu'),
          graphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]')),
          linkedViewVisible: true,
          linkedPath: [...document.querySelectorAll('.note-footer span')].at(-1)?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
          backlinks: [...region.querySelectorAll('.linked-view-list .related-link')].map((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() ?? ''),
          tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => ({ label: tab.textContent?.replace(/\\s+/g, ' ').trim() ?? '', selected: tab.getAttribute('aria-selected') === 'true' }))
        })
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('バックリンクビューが5秒以内に開きませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
  await waitForPaint(window)
  const afterScreenshot = await capture(window, '04-after-linked-view-action.png')
  await activateGlobalGraphTab(window)
  const graphAfter = await graphState(window)
  return {
    beforeGraph,
    afterHover: hover,
    hoverScreenshot,
    submenu,
    submenuScreenshot,
    firstEnabled,
    after,
    graphAfter,
    screenshot: afterScreenshot
  }
}

async function activateNodeNewTab(window, expectedKind = 'note') {
  const before = await evaluate(
    window,
    `({ tabCount: document.querySelectorAll('[role="tab"]').length })`
  )
  await evaluate(
    window,
    `(() => {
      const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
        .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === '新規タブに開く')
      if (!(item instanceof HTMLButtonElement) || item.disabled) {
        throw new Error('有効な「新規タブに開く」が見つかりません。')
      }
      item.click()
    })()`
  )
  return evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + 5000
      const check = () => {
        const tabs = [...document.querySelectorAll('[role="tab"]')]
        const active = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')
        const editorVisible = Boolean(
          document.querySelector('.cm-editor') ||
          document.querySelector('[aria-label="Markdown編集欄"]')
        )
        const attachmentVisible = Boolean(
          document.querySelector('[aria-label="添付ファイルプレビュー"]')
        )
        const graphClosed = !document.querySelector('.wiki-graph-view')
        const expectedVisible = ${JSON.stringify(expectedKind)} === 'attachment'
          ? attachmentVisible
          : editorVisible
        if (tabs.length > ${before.tabCount} && active && expectedVisible && graphClosed) {
          resolve({
            beforeTabCount: ${before.tabCount},
            afterTabCount: tabs.length,
            activeTab: active.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
            tabLabels: tabs.map((tab) => tab.textContent?.replace(/\\s+/g, ' ').trim() ?? ''),
            editorVisible,
            attachmentVisible,
            graphClosed,
            contextMenuClosed: !document.querySelector('.wiki-graph-context-menu')
          })
          return
        }
        if (performance.now() >= deadline) {
          reject(new Error('新規タブの生成を5秒以内に確認できませんでした。'))
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })`
  )
}

async function activateAttachmentNewWindow(window, BrowserWindow) {
  const beforeWindowCount = BrowserWindow.getAllWindows().length
  await evaluate(
    window,
    `(() => {
      const item = [...document.querySelectorAll('.wiki-graph-context-menu [role="menuitem"]')]
        .find((candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === '新規ウィンドウで開く')
      if (!(item instanceof HTMLButtonElement) || item.disabled) {
        throw new Error('有効な「新規ウィンドウで開く」が見つかりません。')
      }
      item.click()
    })()`
  )

  const deadline = Date.now() + 5_000
  let attachmentWindow = null
  while (Date.now() < deadline) {
    attachmentWindow = BrowserWindow.getAllWindows().find(
      (candidate) => candidate !== window && !candidate.isDestroyed()
    ) ?? null
    if (attachmentWindow) break
    await delay(50)
  }
  if (!attachmentWindow) {
    throw new Error('添付の新規ウィンドウを5秒以内に確認できませんでした。')
  }
  attachmentWindow.setSkipTaskbar(true)
  attachmentWindow.setBounds({ x: -32_000, y: -32_000, ...viewport }, false)
  attachmentWindow.showInactive()

  const previewDeadline = Date.now() + 5_000
  let preview = null
  while (Date.now() < previewDeadline) {
    preview = await evaluate(
      attachmentWindow,
      `(() => {
        const image = document.querySelector('.preview img')
        const path = document.querySelector('.path')
        return image instanceof HTMLImageElement && image.complete
          ? {
              title: document.title,
              imageAlt: image.alt,
              path: path?.textContent?.trim() ?? null,
              previewVisible: true
            }
          : null
      })()`
    )
    if (preview) break
    await delay(50)
  }
  if (!preview) {
    throw new Error('添付の内部プレビューを5秒以内に確認できませんでした。')
  }
  const screenshot = await capture(
    attachmentWindow,
    '02-attachment-new-window.png'
  )
  const source = await evaluate(
    window,
    `({
      graphVisible: Boolean(document.querySelector('.wiki-graph-view')),
      contextMenuClosed: !document.querySelector('.wiki-graph-context-menu')
    })`
  )
  const afterWindowCount = BrowserWindow.getAllWindows().length
  attachmentWindow.close()
  return {
    beforeWindowCount,
    afterWindowCount,
    preview,
    source,
    screenshot
  }
}

async function activateGlobalGraphTab(window) {
  await evaluate(window, `(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find(
      (candidate) => candidate.textContent?.replace(/\\s+/g, ' ').trim() === 'グラフビュー'
    )
    if (!(tab instanceof HTMLButtonElement)) {
      throw new Error('Global Graphタブが見つかりません。')
    }
    tab.click()
  })()`)
  return evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const tabs = [...document.querySelectorAll('[role="tab"]')]
      const active = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')
      const graphVisible = Boolean(
        document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]')
      )
      if (active?.textContent?.replace(/\\s+/g, ' ').trim() === 'グラフビュー' && graphVisible) {
        resolve({
          activeTab: 'グラフビュー',
          graphVisible,
          tabLabels: tabs.map((tab) => tab.textContent?.replace(/\\s+/g, ' ').trim() ?? '')
        })
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('Global Graphタブへ5秒以内に戻れませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
}

async function setGraphAttachmentsVisible(window, visible) {
  await evaluate(window, `(() => {
    const filterButton = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('フィルタ')
    )
    if (!(filterButton instanceof HTMLButtonElement)) {
      throw new Error('Graphフィルタ入口が見つかりません。')
    }
    if (filterButton.getAttribute('aria-expanded') !== 'true') filterButton.click()
  })()`)
  await evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const checkbox = [...document.querySelectorAll('input[type="checkbox"]')].find((input) =>
        input.parentElement?.textContent?.includes('添付書類')
      )
      if (checkbox instanceof HTMLInputElement) {
        if (checkbox.checked !== ${visible}) checkbox.click()
        resolve(true)
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('添付書類フィルタが5秒以内に見つかりませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
  await evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      const attachmentVisible = Boolean(
        document.querySelector('.wiki-graph-node[title="attachments/diagram.svg"]')
      )
      if (attachmentVisible === ${visible}) {
        resolve(true)
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('添付nodeの表示状態が5秒以内に切り替わりませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
  await evaluate(window, `(() => {
    const filterButton = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('フィルタ') && button.getAttribute('aria-expanded') === 'true'
    )
    if (filterButton instanceof HTMLButtonElement) filterButton.click()
  })()`)
  await delay(150)
}

async function activateFirstNoteTab(window) {
  await evaluate(window, `(() => {
    const tab = document.querySelector('[role="tab"]')
    if (!(tab instanceof HTMLButtonElement)) throw new Error('戻り先タブが見つかりません。')
    tab.click()
  })()`)
  await evaluate(window, `new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000
    const check = () => {
      if (document.querySelector('.cm-editor') || document.querySelector('[aria-label="Markdown編集欄"]')) {
        resolve(true)
        return
      }
      if (performance.now() >= deadline) {
        reject(new Error('ノートタブへ5秒以内に戻れませんでした。'))
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })`)
}

function cameraFromState(state) {
  const match = state.stageTransform.match(
    /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/
  )
  if (!match) throw new Error(`Graph camera transformを解析できません: ${state.stageTransform}`)
  return {
    panX: Number(match[1]),
    panY: Number(match[2]),
    scale: Number(match[3])
  }
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
  if (malformedQueryProbe) return
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
  const { app, BrowserWindow, clipboard, shell } = await import('electron')
  const originalLoadFile = BrowserWindow.prototype.loadFile
  let captureStarted = false
  const clipboardCapture = {
    writes: [],
    beforeFingerprint: null,
    unchanged: false,
    hookInstalled: false,
    hookRestored: false
  }
  const originalClipboardWriteText = clipboard.writeText
  const originalClipboardWriteTextDescriptor = Object.getOwnPropertyDescriptor(
    clipboard,
    'writeText'
  )
  const shellOpenPathCapture = {
    calls: [],
    hookInstalled: false,
    hookRestored: false,
    identityVerifiedBeforeAction: false
  }
  const originalShellOpenPath = shell.openPath
  const originalShellOpenPathDescriptor = Object.getOwnPropertyDescriptor(shell, 'openPath')
  const shellOpenPathStub = async (path) => {
    shellOpenPathCapture.calls.push({ path })
    return ''
  }
  const shellShowItemInFolderCapture = {
    calls: [],
    hookInstalled: false,
    hookRestored: false,
    identityVerifiedBeforeAction: false
  }
  const originalShellShowItemInFolder = shell.showItemInFolder
  const originalShellShowItemInFolderDescriptor = Object.getOwnPropertyDescriptor(
    shell,
    'showItemInFolder'
  )
  const shellShowItemInFolderStub = (path) => {
    shellShowItemInFolderCapture.calls.push({ path })
  }
  function restoreClipboardHook() {
    if (!attachmentPathCopyProbe || phase !== 'initial' || clipboardCapture.hookRestored) return
    const afterActionFingerprint = clipboardTextFingerprint(clipboard.readText())
    if (originalClipboardWriteTextDescriptor) {
      Object.defineProperty(clipboard, 'writeText', originalClipboardWriteTextDescriptor)
    } else {
      delete clipboard.writeText
    }
    clipboardCapture.hookRestored = clipboard.writeText === originalClipboardWriteText
    const afterHookRestoreFingerprint = clipboardTextFingerprint(clipboard.readText())
    clipboardCapture.unchanged =
      JSON.stringify(clipboardCapture.beforeFingerprint) ===
        JSON.stringify(afterActionFingerprint) &&
      JSON.stringify(clipboardCapture.beforeFingerprint) ===
        JSON.stringify(afterHookRestoreFingerprint)
  }
  function restoreShellOpenPathHook() {
    if (!attachmentDefaultAppProbe || shellOpenPathCapture.hookRestored) return
    if (originalShellOpenPathDescriptor) {
      Object.defineProperty(shell, 'openPath', originalShellOpenPathDescriptor)
    } else {
      delete shell.openPath
    }
    shellOpenPathCapture.hookRestored = shell.openPath === originalShellOpenPath
  }
  function restoreShellShowItemInFolderHook() {
    if (!attachmentFolderRevealProbe || shellShowItemInFolderCapture.hookRestored) return
    if (originalShellShowItemInFolderDescriptor) {
      Object.defineProperty(
        shell,
        'showItemInFolder',
        originalShellShowItemInFolderDescriptor
      )
    } else {
      delete shell.showItemInFolder
    }
    shellShowItemInFolderCapture.hookRestored =
      shell.showItemInFolder === originalShellShowItemInFolder
  }

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
  if (attachmentPathCopyProbe && phase === 'initial') {
    Object.defineProperty(clipboard, 'writeText', {
      configurable: true,
      writable: true,
      value(text, type) {
        clipboardCapture.writes.push({
          text,
          type: type ?? null
        })
      }
    })
    clipboardCapture.hookInstalled = clipboard.writeText !== originalClipboardWriteText
  }
  if (attachmentDefaultAppProbe) {
    Object.defineProperty(shell, 'openPath', {
      configurable: true,
      writable: true,
      value: shellOpenPathStub
    })
    shellOpenPathCapture.hookInstalled = shell.openPath === shellOpenPathStub
    if (!shellOpenPathCapture.hookInstalled) {
      throw new Error('shell.openPathのfail-closed hookを設置できませんでした。')
    }
  }
  if (attachmentFolderRevealProbe) {
    Object.defineProperty(shell, 'showItemInFolder', {
      configurable: true,
      writable: true,
      value: shellShowItemInFolderStub
    })
    shellShowItemInFolderCapture.hookInstalled =
      shell.showItemInFolder === shellShowItemInFolderStub
    if (!shellShowItemInFolderCapture.hookInstalled) {
      throw new Error('shell.showItemInFolderのfail-closed hookを設置できませんでした。')
    }
  }

  async function run(window) {
    window.setSkipTaskbar(true)
    window.setBounds({ x: -32_000, y: -32_000, ...viewport }, false)
    window.showInactive()
    await waitForEditor(window)
    if (attachmentPathCopyProbe && phase === 'initial') {
      clipboardCapture.beforeFingerprint = clipboardTextFingerprint(clipboard.readText())
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rendererViewport = await evaluate(
        window,
        '({ width: window.innerWidth, height: window.innerHeight })'
      )
      if (rendererViewport.width === viewport.width && rendererViewport.height === viewport.height) {
        break
      }
      const frame = window.getBounds()
      window.setBounds(
        {
          x: -32_000,
          y: -32_000,
          width: frame.width + viewport.width - rendererViewport.width,
          height: frame.height + viewport.height - rendererViewport.height
        },
        false
      )
      await delay(200)
    }
    const windowGeometry = {
      frame: window.getBounds(),
      electronContentBounds: window.getContentBounds(),
      rendererViewport: await evaluate(
        window,
        '({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio })'
      )
    }

    if (phase === 'initial') {
      await ensureGlobalGraphControls(window)
      await fillSearch(window, query)
      if (attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe || attachmentLinkedViewProbe || attachmentExternalProbe) {
        await setGraphAttachmentsVisible(window, true)
        await ensureGlobalGraphControls(window)
        await fillSearch(window, query)
      }
      let baseline = await waitForStableGraph(window, query)
      if (attachmentMoveProbe) baseline = await waitForAttachmentMoveGraph(window, 'before')
      if (nodeDragProbe || nodeMenuProbe) baseline = await waitForTargetNodeStability(window)
      const baselineScreenshot = (cameraProbe || nodeDragProbe || nodeMenuProbe) && !attachmentExternalProbe
        ? await capture(window, '00-baseline.png')
        : null
      let input = null
      let duringDrag = null
      let afterReleaseImmediate = null
      let afterRelease250ms = null
      let nodeContextMenu = null
      let nodeNewTab = null
      let graphWorkspaceTab = null
      let attachmentContextMenu = null
      let attachmentNewTab = null
      let attachmentNewWindow = null
      let attachmentMove = null
      let attachmentBookmark = null
      let attachmentPathCopy = null
      let attachmentLinkedView = null
      let attachmentDefaultApp = null
      if (cameraProbe) {
        input = await applyCameraInput(window)
      } else if (nodeDragProbe) {
        input = await beginNodeDragInput(window)
        try {
          duringDrag = await graphState(window)
          await capture(window, '01-during-node-drag.png')
        } finally {
          await releaseNodeDragInput(window, input)
        }
        afterReleaseImmediate = await graphState(window)
        await delay(250)
        afterRelease250ms = await graphState(window)
        await waitForTargetNodeStability(window)
      }
      if (nodeMenuProbe) {
        const openedMenu = await openNodeContextMenu(
          window,
          attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe || attachmentLinkedViewProbe || attachmentExternalProbe
            ? 'attachments/diagram.svg'
            : drag.targetNodePath
        )
        input = openedMenu.input
        nodeContextMenu = openedMenu.menu
        if (attachmentNewTabProbe || attachmentNewWindowProbe || attachmentMoveProbe || attachmentBookmarkProbe || attachmentPathCopyProbe || attachmentLinkedViewProbe || attachmentExternalProbe) {
          attachmentContextMenu = openedMenu.menu
        }
      }
      const entered = cameraProbe || nodeDragProbe || nodeMenuProbe ? await graphState(window) : baseline
      const enteredScreenshot = await capture(
        window,
        nodeMenuProbe
          ? '01-node-context-menu.png'
          : nodeDragProbe
          ? '02-after-node-release.png'
          : cameraProbe
            ? '01-after-camera-input.png'
            : '01-query-entered.png'
      )
      let nodeNewTabScreenshot = null
      let graphWorkspaceTabScreenshot = null
      let attachmentContextMenuScreenshot = null
      let attachmentNewTabScreenshot = null
      if (nodeNewTabProbe) {
        nodeNewTab = await activateNodeNewTab(window)
        await delay(250)
        nodeNewTabScreenshot = await capture(window, '02-note-new-tab.png')
        if (workspaceTabProbe) {
          graphWorkspaceTab = await activateGlobalGraphTab(window)
          await delay(250)
          graphWorkspaceTabScreenshot = await capture(
            window,
            '03-returned-global-graph.png'
          )
        } else {
          await ensureGlobalGraphControls(window)
          await setGraphAttachmentsVisible(window, true)
          const openedAttachmentMenu = await openNodeContextMenu(
            window,
            'attachments/diagram.svg'
          )
          attachmentContextMenu = openedAttachmentMenu.menu
          attachmentContextMenuScreenshot = await capture(
            window,
            '03-attachment-context-menu.png'
          )
          attachmentNewTab = await activateNodeNewTab(window, 'attachment')
          await delay(250)
          attachmentNewTabScreenshot = await capture(
            window,
            '04-attachment-new-tab.png'
          )
          await activateFirstNoteTab(window)
          await ensureGlobalGraphControls(window)
          await setGraphAttachmentsVisible(window, false)
        }
      } else if (attachmentNewTabProbe) {
        attachmentNewTab = await activateNodeNewTab(window, 'attachment')
        await delay(250)
        attachmentNewTabScreenshot = await capture(window, '02-attachment-new-tab.png')
        graphWorkspaceTab = await activateGlobalGraphTab(window)
        await delay(250)
        graphWorkspaceTabScreenshot = await capture(window, '03-returned-global-graph.png')
      } else if (attachmentNewWindowProbe) {
        attachmentNewWindow = await activateAttachmentNewWindow(window, BrowserWindow)
      } else if (attachmentMoveProbe) {
        attachmentMove = await activateAttachmentMove(window)
      } else if (attachmentBookmarkProbe) {
        attachmentBookmark = await activateAttachmentBookmark(window)
      } else if (attachmentPathCopyProbe) {
        attachmentPathCopy = await activateAttachmentPathCopy(window, clipboardCapture)
        restoreClipboardHook()
        attachmentPathCopy.clipboard = {
          hookInstalled: clipboardCapture.hookInstalled,
          hookRestored: clipboardCapture.hookRestored,
          unchanged: clipboardCapture.unchanged
        }
      } else if (attachmentLinkedViewProbe) {
        attachmentLinkedView = await activateAttachmentLinkedView(window)
      } else if (attachmentExternalProbe) {
        if (attachmentFolderRevealProbe) {
          shellShowItemInFolderCapture.identityVerifiedBeforeAction =
            shellShowItemInFolderCapture.hookInstalled &&
            shell.showItemInFolder === shellShowItemInFolderStub
          if (!shellShowItemInFolderCapture.identityVerifiedBeforeAction) {
            throw new Error('shell.showItemInFolder hook identityをaction直前に確認できませんでした。')
          }
          attachmentDefaultApp = await activateAttachmentFolderReveal(
            window,
            shellShowItemInFolderCapture
          )
        } else {
          shellOpenPathCapture.identityVerifiedBeforeAction =
            shellOpenPathCapture.hookInstalled && shell.openPath === shellOpenPathStub
          if (!shellOpenPathCapture.identityVerifiedBeforeAction) {
            throw new Error('shell.openPath hook identityをaction直前に確認できませんでした。')
          }
          attachmentDefaultApp = await activateAttachmentDefaultApp(window, shellOpenPathCapture)
        }
      }
      const settingsAfterInput = cameraProbe
        ? await waitForSavedScale(cameraFromState(entered).scale)
        : await waitForSavedQuery(query)

      if (nodeMenuProbe && !nodeNewTabProbe && !attachmentMoveProbe && !attachmentBookmarkProbe && !attachmentLinkedViewProbe) {
        await closeNodeContextMenu(window)
      }

      let graphClosed
      if (attachmentLinkedViewProbe) {
        await activateFirstNoteTab(window)
        graphClosed = !(await evaluate(window, `Boolean(document.querySelector('.wiki-graph-view'))`))
        await activateGlobalGraphTab(window)
      } else {
        await clickButton(window, '編集')
        graphClosed = await evaluate(
          window,
          `!document.querySelector('.wiki-graph-view') && Boolean(document.querySelector('.markdown-editor .cm-content'))`
        )
        if (!graphClosed) throw new Error('Global Graphを編集画面へ閉じられませんでした。')
      }

      await ensureGlobalGraphControls(window)
      let reopened = await waitForStableGraph(window, query)
      if (attachmentMoveProbe) reopened = await waitForAttachmentMoveGraph(window, 'after')
      if (nodeDragProbe || nodeMenuProbe) reopened = await waitForTargetNodeStability(window)
      if (attachmentBookmarkProbe) {
        attachmentBookmark.persistence.afterGraphReopen = await snapshotBookmarkPersistence(
          'after-graph-reopen'
        )
      }
      const reopenedScreenshot = attachmentExternalProbe
        ? null
        : await capture(
        window,
        attachmentPathCopyProbe
          ? '04-after-graph-reopen.png'
          : attachmentLinkedViewProbe
          ? '05-after-graph-reopen.png'
          : attachmentBookmarkProbe
          ? attachmentBookmarkScenario === 'duplicate'
            ? '06-after-graph-reopen.png'
            : '04-after-graph-reopen.png'
          : attachmentMoveProbe
          ? '04-after-graph-reopen.png'
          : nodeMenuProbe
          ? '02-after-graph-reopen.png'
          : nodeDragProbe
          ? '03-after-graph-reopen.png'
          : cameraProbe
            ? '02-after-graph-reopen.png'
            : '02-graph-reopened.png'
      )
      if (!cameraProbe && !nodeDragProbe && !nodeMenuProbe) {
        assertFilteredState(entered, 'query入力直後')
        assertFilteredState(reopened, 'Graph再表示後')
      }
      const graphBeforeReopen = attachmentMoveProbe
        ? attachmentMove.graphAfterAction
        : attachmentLinkedViewProbe
        ? attachmentLinkedView.graphAfter
        : attachmentExternalProbe
        ? attachmentDefaultApp.graphAfterAction
        : entered
      if (JSON.stringify(graphBeforeReopen.nodePaths) !== JSON.stringify(reopened.nodePaths)) {
        throw new Error('Graph再表示後に検索node集合が変化しました。')
      }
      if (attachmentExternalProbe) {
        if (attachmentFolderRevealProbe) {
          attachmentDefaultApp.callCountAfterGraphReopen =
            shellShowItemInFolderCapture.calls.length
          restoreShellShowItemInFolderHook()
          attachmentDefaultApp.shell = {
            hookInstalled: shellShowItemInFolderCapture.hookInstalled,
            identityVerifiedBeforeAction:
              shellShowItemInFolderCapture.identityVerifiedBeforeAction,
            hookRestored: shellShowItemInFolderCapture.hookRestored
          }
        } else {
          attachmentDefaultApp.callCountAfterGraphReopen = shellOpenPathCapture.calls.length
          restoreShellOpenPathHook()
          attachmentDefaultApp.shell = {
            hookInstalled: shellOpenPathCapture.hookInstalled,
            identityVerifiedBeforeAction: shellOpenPathCapture.identityVerifiedBeforeAction,
            hookRestored: shellOpenPathCapture.hookRestored
          }
        }
      }
      await writeFile(
        resolve(outputRoot, 'phase-initial.json'),
        `${JSON.stringify(repositoryEvidence({
          phase,
          processId: process.pid,
          windowGeometry,
          graphClosed,
          baseline,
          input,
          duringDrag,
          afterReleaseImmediate,
          afterRelease250ms,
          nodeContextMenu,
          nodeNewTab,
          graphWorkspaceTab,
          attachmentContextMenu,
          attachmentNewTab,
          attachmentNewWindow,
          attachmentMove,
          attachmentBookmark,
          attachmentPathCopy,
          attachmentLinkedView,
          attachmentDefaultApp,
          attachmentFolderReveal: attachmentFolderRevealProbe ? attachmentDefaultApp : null,
          entered,
          reopened,
          settingsGraphViewState: settingsAfterInput.graphViewStates.vault,
          screenshots: [
            baselineScreenshot,
            enteredScreenshot,
            nodeNewTabScreenshot,
            graphWorkspaceTabScreenshot,
            attachmentContextMenuScreenshot,
            attachmentNewTabScreenshot,
            attachmentNewWindow?.screenshot ?? null,
            ...(attachmentMove?.screenshots ?? []),
            ...(attachmentBookmark?.screenshots ?? []),
            ...(attachmentPathCopy?.screenshots ?? []),
            ...(attachmentLinkedView?.screenshots ?? []),
            ...(attachmentDefaultApp?.screenshots ?? []),
            reopenedScreenshot
          ].filter(Boolean)
        }), null, 2)}\n`,
        'utf8'
      )
    } else if (phase === 'restarted') {
      await ensureGlobalGraphControls(window)
      let restarted = await waitForStableGraph(window, query)
      if (attachmentMoveProbe) restarted = await waitForAttachmentMoveGraph(window, 'after')
      if (nodeDragProbe || nodeMenuProbe) restarted = await waitForTargetNodeStability(window)
      const bookmarkPersistenceAfterAppRestart = attachmentBookmarkProbe
        ? await snapshotBookmarkPersistence('after-app-restart')
        : null
      const restartedScreenshot = attachmentExternalProbe
        ? null
        : await capture(
        window,
        attachmentPathCopyProbe
          ? '05-after-app-restart.png'
          : attachmentLinkedViewProbe
          ? '06-after-app-restart.png'
          : attachmentBookmarkProbe
          ? attachmentBookmarkScenario === 'duplicate'
            ? '07-after-app-restart.png'
            : '05-after-app-restart.png'
          : attachmentMoveProbe
          ? '05-after-app-restart.png'
          : nodeMenuProbe
          ? '03-after-app-restart.png'
          : nodeDragProbe
          ? '04-after-app-restart.png'
          : cameraProbe
            ? '03-after-app-restart.png'
            : '03-app-restarted.png'
      )
      const settingsAfterRestart = cameraProbe
        ? await waitForSavedScale(cameraFromState(restarted).scale)
        : await waitForSavedQuery(query)
      if (!cameraProbe && !nodeDragProbe && !nodeMenuProbe) assertFilteredState(restarted, 'アプリ再起動後')
      let attachmentDefaultAppShell = null
      if (attachmentExternalProbe) {
        const capture = attachmentFolderRevealProbe
          ? shellShowItemInFolderCapture
          : shellOpenPathCapture
        const calls = [...capture.calls]
        if (attachmentFolderRevealProbe) {
          restoreShellShowItemInFolderHook()
        } else {
          restoreShellOpenPathHook()
        }
        attachmentDefaultAppShell = {
          calls,
          callCountAfterAppRestart: calls.length,
          hookInstalled: capture.hookInstalled,
          hookRestored: capture.hookRestored
        }
      }
      await writeFile(
        resolve(outputRoot, 'phase-restarted.json'),
        `${JSON.stringify(repositoryEvidence({
          phase,
          processId: process.pid,
          windowGeometry,
          restarted,
          bookmarkPersistenceAfterAppRestart,
          attachmentDefaultAppShell,
          attachmentFolderRevealShell: attachmentFolderRevealProbe
            ? attachmentDefaultAppShell
            : null,
          settingsGraphViewState: settingsAfterRestart.graphViewStates.vault,
          screenshots: [restartedScreenshot].filter(Boolean)
        }), null, 2)}\n`,
        'utf8'
      )
    } else {
      throw new Error(`不明なcapture phaseです: ${phase}`)
    }

    await evaluate(window, 'window.tsuzune.confirmClose(true); true')
    if (attachmentExternalProbe) {
      app.exit(0)
      return
    }
    setTimeout(() => app.exit(0), 3_000).unref()
  }

  BrowserWindow.prototype.loadFile = function (...args) {
    const loaded = originalLoadFile.apply(this, args)
    if (!captureStarted) {
      captureStarted = true
      void loaded.then(async () => {
        try {
          await run(this)
        } finally {
          restoreClipboardHook()
          restoreShellOpenPathHook()
          restoreShellShowItemInFolderHook()
        }
      }).catch(async (error) => {
        restoreClipboardHook()
        restoreShellOpenPathHook()
        restoreShellShowItemInFolderHook()
        await writeFile(
          resolve(outputRoot, `capture-error-${phase}.txt`),
          repositoryEvidence(String(error?.stack || error)),
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

  try {
    await import('../out/main/index.js')
  } catch (error) {
    restoreClipboardHook()
    restoreShellOpenPathHook()
    restoreShellShowItemInFolderHook()
    throw error
  }
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
        TSUZUNE_GRAPH_CAMERA_PROBE: cameraProbe ? '1' : '',
        TSUZUNE_GRAPH_NODE_DRAG_PROBE: nodeDragProbe ? '1' : '',
        TSUZUNE_GRAPH_NODE_MENU_PROBE: nodeMenuProbe ? '1' : '',
        TSUZUNE_GRAPH_NODE_NEW_TAB_PROBE: nodeNewTabProbe ? '1' : '',
        TSUZUNE_GRAPH_WORKSPACE_TAB_PROBE: workspaceTabProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_NEW_TAB_PROBE: attachmentNewTabProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_NEW_WINDOW_PROBE: attachmentNewWindowProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_MOVE_PROBE: attachmentMoveProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_MOVE_SCENARIO: attachmentMoveScenario,
        TSUZUNE_GRAPH_ATTACHMENT_BOOKMARK_PROBE: attachmentBookmarkProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_BOOKMARK_SCENARIO: attachmentBookmarkScenario,
        TSUZUNE_GRAPH_ATTACHMENT_PATH_COPY_PROBE: attachmentPathCopyProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_PATH_COPY_SCENARIO: attachmentPathCopyScenario,
        TSUZUNE_GRAPH_ATTACHMENT_LINKED_VIEW_PROBE: attachmentLinkedViewProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_DEFAULT_APP_PROBE: attachmentDefaultAppProbe ? '1' : '',
        TSUZUNE_GRAPH_ATTACHMENT_FOLDER_REVEAL_PROBE: attachmentFolderRevealProbe ? '1' : '',
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
  if (attachmentMoveProbe && attachmentMoveScenario === 'collision') {
    await writeFile(
      resolve(vault, '20_knowledge/diagram.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><text x="8" y="45">collision sentinel</text></svg>\n',
      'utf8'
    )
  }
  await writeFile(
    settingsPath,
    `${JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2)}\n`,
    'utf8'
  )

  const protectionBefore = {
    sourceFixture: await treeDigest(sourceFixture),
    productSource: await selectedProductSourceDigest(),
    builtApplication: await treeDigest(resolve(repoRoot, 'out')),
    isolatedMarkdown: await treeDigest(vault, { extension: '.md' }),
    isolatedVaultContent: await isolatedVaultContentDigest(),
    isolatedVault: await treeDigest(vault)
  }
  const repository = gitIdentity()
  let bookmarkPersistenceAfterFirstProcessExit = null
  let bookmarkPersistenceAfterSecondProcessExit = null

  try {
    stage(
      nodeDragProbe
        ? 'node drag入力とGraph再表示をcaptureします。'
        : attachmentFolderRevealProbe
          ? '添付のフォルダ表示requestとGraph再表示をcaptureします。'
        : attachmentDefaultAppProbe
          ? '添付のデフォルトアプリopen requestとGraph再表示をcaptureします。'
        : attachmentLinkedViewProbe
          ? '添付リンクされたビューとGraph再表示をcaptureします。'
        : attachmentPathCopyProbe
          ? `添付パスコピー（${attachmentPathCopyScenario}）とGraph再表示をcaptureします。`
        : attachmentBookmarkProbe
          ? `添付ブックマーク（${attachmentBookmarkScenario}）とGraph再表示をcaptureします。`
        : attachmentMoveProbe
          ? `添付ファイル移動（${attachmentMoveScenario}）とGraph再表示をcaptureします。`
        : nodeMenuProbe
          ? 'node context menuとGraph再表示をcaptureします。'
        : cameraProbe
          ? 'camera入力とGraph再表示をcaptureします。'
          : 'query入力とGraph再表示をcaptureします。'
    )
    runWorkerProcess('initial')
    if (attachmentBookmarkProbe) {
      bookmarkPersistenceAfterFirstProcessExit = await snapshotBookmarkPersistence(
        'after-first-process-exit'
      )
    }
    stage('別processでアプリ再起動後をcaptureします。')
    runWorkerProcess('restarted')
    if (attachmentBookmarkProbe) {
      bookmarkPersistenceAfterSecondProcessExit = await snapshotBookmarkPersistence(
        'after-second-process-exit'
      )
    }
  } catch (error) {
    stopIsolatedProcesses()
    throw error
  }

  const protectionAfter = {
    sourceFixture: await treeDigest(sourceFixture),
    productSource: await selectedProductSourceDigest(),
    builtApplication: await treeDigest(resolve(repoRoot, 'out')),
    isolatedMarkdown: await treeDigest(vault, { extension: '.md' }),
    isolatedVaultContent: await isolatedVaultContentDigest(),
    isolatedVault: await treeDigest(vault)
  }
  const initial = JSON.parse(await readFile(resolve(outputRoot, 'phase-initial.json'), 'utf8'))
  const restarted = JSON.parse(await readFile(resolve(outputRoot, 'phase-restarted.json'), 'utf8'))
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'))
  const cameraContract = cameraProbe
    ? {
        baseline: cameraFromState(initial.baseline),
        afterInput: cameraFromState(initial.entered),
        afterGraphReopen: cameraFromState(initial.reopened),
        afterAppRestart: cameraFromState(restarted.restarted)
      }
    : null
  const nodeClientDistance = (left, right) =>
    left && right
      ? Math.hypot(left.clientX - right.clientX, left.clientY - right.clientY)
      : Number.POSITIVE_INFINITY
  const nodeDragContract = nodeDragProbe
    ? {
        targetNodePath: drag.targetNodePath,
        requestedDeltaCssPx: { x: drag.deltaX, y: drag.deltaY },
        baseline: initial.baseline.targetNode,
        duringHold: initial.duringDrag.targetNode,
        afterReleaseImmediate: initial.afterReleaseImmediate.targetNode,
        afterRelease250ms: initial.afterRelease250ms.targetNode,
        afterReleaseSettled: initial.entered.targetNode,
        afterGraphReopen: initial.reopened.targetNode,
        afterAppRestart: restarted.restarted.targetNode,
        appliedDeltaCssPx: {
          x: initial.duringDrag.targetNode.clientX - initial.baseline.targetNode.clientX,
          y: initial.duringDrag.targetNode.clientY - initial.baseline.targetNode.clientY
        },
        heldAtPointer:
          Math.hypot(
            initial.duringDrag.targetNode.clientX - initial.input.endX,
            initial.duringDrag.targetNode.clientY - initial.input.endY
          ) < 3,
        movedAfterRelease:
          nodeClientDistance(initial.duringDrag.targetNode, initial.entered.targetNode) > 2,
        resetNearBaselineAfterGraphReopen:
          nodeClientDistance(initial.baseline.targetNode, initial.reopened.targetNode) < 3,
        resetNearBaselineAfterAppRestart:
          nodeClientDistance(initial.baseline.targetNode, restarted.restarted.targetNode) < 3,
        nodePositionAbsentFromSettings: !Object.keys(settings.graphViewStates?.vault ?? {}).some(
          (key) => /node.*position|position.*node|pinned/i.test(key)
        )
      }
    : null
  const nodeMenuContract = nodeMenuProbe ? initial.nodeContextMenu : null
  const nodeNewTabContract = nodeNewTabProbe ? initial.nodeNewTab : null
  const attachmentNewTabContract = nodeNewTabProbe || attachmentNewTabProbe
    ? initial.attachmentNewTab
    : null
  const attachmentNewWindowContract = attachmentNewWindowProbe
    ? initial.attachmentNewWindow
    : null
  const attachmentMoveContract = attachmentMoveProbe ? initial.attachmentMove : null
  const attachmentBookmarkContract = attachmentBookmarkProbe ? initial.attachmentBookmark : null
  const attachmentPathCopyContract = attachmentPathCopyProbe ? initial.attachmentPathCopy : null
  const attachmentLinkedViewContract = attachmentLinkedViewProbe
    ? initial.attachmentLinkedView
    : null
  const attachmentDefaultAppContract = attachmentDefaultAppProbe
    ? initial.attachmentDefaultApp
    : null
  const attachmentFolderRevealContract = attachmentFolderRevealProbe
    ? initial.attachmentFolderReveal ?? initial.attachmentDefaultApp
    : null
  const attachmentExternalContract = attachmentFolderRevealProbe
    ? attachmentFolderRevealContract
    : attachmentDefaultAppContract
  const attachmentExternalRestartShell = attachmentFolderRevealProbe
    ? restarted.attachmentFolderRevealShell ?? restarted.attachmentDefaultAppShell
    : restarted.attachmentDefaultAppShell
  const bookmarkPersistence = attachmentBookmarkProbe
    ? {
        ...attachmentBookmarkContract.persistence,
        afterFirstProcessExit: bookmarkPersistenceAfterFirstProcessExit,
        afterAppRestart: restarted.bookmarkPersistenceAfterAppRestart,
        afterSecondProcessExit: bookmarkPersistenceAfterSecondProcessExit
      }
    : null
  const bookmarkCounts = attachmentBookmarkProbe
    ? Object.fromEntries(
        Object.entries(bookmarkPersistence).map(([key, snapshot]) => [
          key,
          bookmarkPathCount(snapshot.bookmarks.json, 'attachments/diagram.svg')
        ])
      )
    : null
  const postActionGraph =
    attachmentMoveContract?.graphAfterAction ??
    attachmentPathCopyContract?.graphAfterAction ??
    attachmentDefaultAppContract?.graphAfterAction ??
    attachmentFolderRevealContract?.graphAfterAction ??
    attachmentLinkedViewContract?.graphAfter ??
    initial.entered
  const sameDigest = (left, right) =>
    left?.exists === true &&
    right?.exists === true &&
    left.bytes === right.bytes &&
    left.sha256 === right.sha256
  const attachmentNodeIsResolved = (state, path) =>
    state?.nodeDetails?.find((node) => node.path === path)?.ariaLabel?.includes('添付書類') === true
  const graphSurfaceSignature = (state) =>
    JSON.stringify({
      query: state?.query,
      stageTransform: state?.stageTransform,
      nodePaths: state?.nodePaths,
      edgeCount: state?.edgeCount,
      edgeSignature: state?.edgeSignature,
      tabs: state?.tabs
    })
  const graphCoreSignature = (state) =>
    JSON.stringify({
      query: state?.query,
      stageTransform: state?.stageTransform,
      nodePaths: state?.nodePaths,
      edgeCount: state?.edgeCount,
      edgeSignature: state?.edgeSignature
    })

  const sharedAssertions = {
    contentViewportStable: [
      initial.windowGeometry.rendererViewport,
      restarted.windowGeometry.rendererViewport
    ].every(
      (bounds) =>
        bounds.width === viewport.width &&
        bounds.height === viewport.height &&
        bounds.devicePixelRatio === 1
    ),
    filteredNodeSetStable:
      JSON.stringify(postActionGraph.nodePaths) === JSON.stringify(initial.reopened.nodePaths) &&
      JSON.stringify(initial.reopened.nodePaths) === JSON.stringify(restarted.restarted.nodePaths),
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
    isolatedVaultContentUnchanged:
      protectionBefore.isolatedVaultContent.combinedSha256 ===
      protectionAfter.isolatedVaultContent.combinedSha256,
    isolatedVaultChangedOnlyWhenMoving:
      attachmentBookmarkProbe ||
      ((protectionBefore.isolatedVault.combinedSha256 ===
        protectionAfter.isolatedVault.combinedSha256) ===
        (attachmentMoveScenario === 'cancel' || !attachmentMoveProbe)),
    noIsolatedProcessesRemaining: processesUsingCommandLineFragment(userData).length === 0
  }
  const assertions = nodeDragProbe
    ? {
        exactNodeSetAtEveryCheckpoint: [
          initial.baseline,
          initial.duringDrag,
          initial.afterReleaseImmediate,
          initial.afterRelease250ms,
          initial.entered,
          initial.reopened,
          restarted.restarted
        ].every(
          (state) => JSON.stringify(state.nodePaths) === JSON.stringify(expectedCameraNodePaths)
        ),
        nodeDragApplied:
          Math.abs(nodeDragContract.appliedDeltaCssPx.x - drag.deltaX) < 3 &&
          Math.abs(nodeDragContract.appliedDeltaCssPx.y - drag.deltaY) < 3,
        nodeHeldAtPointer: nodeDragContract.heldAtPointer,
        nodeMovedAfterRelease: nodeDragContract.movedAfterRelease,
        nodeResetNearBaselineAfterGraphReopen:
          nodeDragContract.resetNearBaselineAfterGraphReopen,
        nodeResetNearBaselineAfterAppRestart:
          nodeDragContract.resetNearBaselineAfterAppRestart,
        nodePositionNotPersistedInSettings: nodeDragContract.nodePositionAbsentFromSettings,
        ...sharedAssertions
      }
    : attachmentExternalProbe
      ? {
          exactNodeSetAtEveryCheckpoint: [
            initial.baseline,
            initial.entered,
            attachmentExternalContract.graphBeforeAction,
            attachmentExternalContract.graphAfterAction,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) => JSON.stringify(state.nodePaths) === JSON.stringify(expectedCameraNodePaths)
          ),
          attachmentContextMenuOpened: Boolean(initial.attachmentContextMenu?.items?.length),
          externalActionMenuOrderExact: (() => {
            const items = initial.attachmentContextMenu?.items ?? []
            const linkedViewIndex = items.findIndex((item) =>
              item.text.startsWith('リンクされたビューを開く')
            )
            const actionIndex = items.findIndex((item) =>
              item.text === (attachmentFolderRevealProbe ? 'フォルダで表示' : 'デフォルトアプリで開く')
            )
            const defaultAppIndex = items.findIndex((item) =>
              item.text === 'デフォルトアプリで開く'
            )
            const deleteIndex = items.findIndex((item) => item.text === 'ファイルを削除')
            return (
              linkedViewIndex >= 0 &&
              (attachmentFolderRevealProbe
                ? defaultAppIndex === linkedViewIndex + 1 && actionIndex === defaultAppIndex + 1
                : actionIndex === linkedViewIndex + 1) &&
              deleteIndex === actionIndex + 1
            )
          })(),
          externalActionMenuItemEnabled:
            initial.attachmentContextMenu?.items?.some(
              (item) => item.text === (attachmentFolderRevealProbe ? 'フォルダで表示' : 'デフォルトアプリで開く') && item.disabled === false
            ) === true,
          externalActionRequestExact:
            attachmentExternalContract.calls?.length === 1 &&
            attachmentExternalContract.calls[0]?.path ===
              attachmentExternalContract.expectedPath,
          initialHookInstalledVerifiedAndRestored:
            attachmentExternalContract.shell?.hookInstalled === true &&
            attachmentExternalContract.shell?.identityVerifiedBeforeAction === true &&
            attachmentExternalContract.shell?.hookRestored === true,
          actionClosedMenu:
            attachmentExternalContract.uiAfterAction?.contextMenuOpen === false,
          globalGraphRemainedVisible:
            attachmentExternalContract.uiAfterAction?.globalGraphVisible === true,
          noReplayAfterGraphReopen:
            attachmentExternalContract.callCountAfterGraphReopen === 1,
          restartedHookInstalledAndRestored:
            attachmentExternalRestartShell?.hookInstalled === true &&
            attachmentExternalRestartShell?.hookRestored === true,
          noReplayAfterAppRestart:
            attachmentExternalRestartShell?.callCountAfterAppRestart === 0 &&
            attachmentExternalRestartShell?.calls?.length === 0,
          edgeSignatureCapturedAtEveryCheckpoint: [
            attachmentExternalContract.graphBeforeAction,
            attachmentExternalContract.graphAfterAction,
            initial.reopened,
            restarted.restarted
          ].every((state) => Array.isArray(state.edgeSignature) && state.edgeSignature.length > 0),
          queryCameraNodesEdgesTabsPreservedAcrossActionReopenAndRestart: [
            attachmentExternalContract.graphAfterAction,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) =>
              graphSurfaceSignature(state) ===
              graphSurfaceSignature(attachmentExternalContract.graphBeforeAction)
          ),
          ...sharedAssertions
        }
    : attachmentLinkedViewProbe
      ? {
          exactNodeSetAtEveryCheckpoint: [
            initial.baseline,
            initial.entered,
            attachmentLinkedViewContract.beforeGraph,
            attachmentLinkedViewContract.graphAfter,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) => JSON.stringify(state.nodePaths) === JSON.stringify(expectedCameraNodePaths)
          ),
          attachmentContextMenuOpened: Boolean(initial.attachmentContextMenu?.items?.length),
          linkedViewMenuItemRecorded:
            initial.attachmentContextMenu?.items?.some(
              (item) => item.text.startsWith('リンクされたビューを開く') && item.disabled === false
            ) === true,
          parentHoverKeptMenusOpen:
            attachmentLinkedViewContract.afterHover?.parentMenuVisible === true &&
            attachmentLinkedViewContract.afterHover?.visibleMenuCount >= 2,
          submenuItemsExact:
            JSON.stringify(
              attachmentLinkedViewContract.submenu?.items?.map((item) => item.text)
            ) === JSON.stringify(['バックリンクを開く']),
          submenuItemsEnabled:
            attachmentLinkedViewContract.submenu?.items?.every((item) => !item.disabled) === true,
          firstActionIsBacklinks:
            attachmentLinkedViewContract.firstEnabled?.text === 'バックリンクを開く',
          linkedViewOpened:
            attachmentLinkedViewContract.after?.linkedViewVisible === true &&
            attachmentLinkedViewContract.after?.linkedPath?.includes('attachments/diagram.svg') === true,
          linkedViewShowsBacklinks:
            (attachmentLinkedViewContract.after?.backlinks?.length ?? 0) > 0,
          actionClosedMenus: attachmentLinkedViewContract.after?.menuClosed === true,
          graphTabRetained:
            attachmentLinkedViewContract.after?.tabs?.some(
              (tab) => tab.label === 'グラフビュー'
            ) === true,
          graphSurfacePreservedImmediately:
            graphCoreSignature(attachmentLinkedViewContract.beforeGraph) ===
            graphCoreSignature(attachmentLinkedViewContract.graphAfter),
          queryCameraNodesLinksTabsPreservedAcrossReopenAndRestart: [
            attachmentLinkedViewContract.graphAfter,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) =>
              graphCoreSignature(state) ===
              graphCoreSignature(attachmentLinkedViewContract.graphAfter)
          ),
          ...sharedAssertions
        }
    : attachmentPathCopyProbe
      ? {
          exactNodeSetAtEveryCheckpoint: [
            initial.baseline,
            initial.entered,
            attachmentPathCopyContract.graphBeforeAction,
            attachmentPathCopyContract.graphAfterAction,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) => JSON.stringify(state.nodePaths) === JSON.stringify(expectedCameraNodePaths)
          ),
          attachmentContextMenuOpened: Boolean(initial.attachmentContextMenu?.items?.length),
          pathCopyImmediatelyAfterBookmark: (() => {
            const items = initial.attachmentContextMenu?.items ?? []
            const bookmarkIndex = items.findIndex((item) => item.text.includes('ブックマーク'))
            const pathCopyIndex = items.findIndex((item) => item.text.startsWith('パスをコピー'))
            return bookmarkIndex >= 0 && pathCopyIndex === bookmarkIndex + 1
          })(),
          parentClickKeptMainMenuOpen:
            attachmentPathCopyContract.submenu?.mainMenuStillOpen === true &&
            attachmentPathCopyContract.submenu?.parentAriaExpanded === 'true',
          submenuItemsExact:
            JSON.stringify(
              attachmentPathCopyContract.submenu?.items?.map((item) => item.text)
            ) ===
            JSON.stringify([
              'Obsidian URL として',
              '保管庫フォルダから',
              'システムルートから'
            ]),
          submenuEnabled:
            attachmentPathCopyContract.submenu?.items?.every((item) => !item.disabled) === true,
          submenuPlacementMatchesCapturedPosition:
            attachmentPathCopyContract.submenu?.placement === 'right' &&
            attachmentPathCopyContract.submenu?.fullyInsideViewport === true,
          exactPlainTextCopied:
            attachmentPathCopyContract.writes?.length === 1 &&
            attachmentPathCopyContract.writes[0]?.text ===
              attachmentPathCopyContract.expectedText &&
            attachmentPathCopyContract.writes[0]?.type === null,
          clipboardHookInstalledAndRestored:
            attachmentPathCopyContract.clipboard?.hookInstalled === true &&
            attachmentPathCopyContract.clipboard?.hookRestored === true,
          userClipboardUnchanged:
            attachmentPathCopyContract.clipboard?.unchanged === true,
          childSelectionClosedMenus:
            attachmentPathCopyContract.uiAfterAction?.contextMenuOpen === false &&
            attachmentPathCopyContract.uiAfterAction?.submenuOpen === false,
          globalGraphRemainedVisible:
            attachmentPathCopyContract.uiAfterAction?.globalGraphVisible === true,
          graphSurfacePreservedImmediately:
            graphSurfaceSignature(attachmentPathCopyContract.graphBeforeAction) ===
            graphSurfaceSignature(attachmentPathCopyContract.graphAfterAction),
          queryCameraNodesLinksTabsPreservedAcrossReopenAndRestart: [
            attachmentPathCopyContract.graphBeforeAction,
            attachmentPathCopyContract.graphAfterAction,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) =>
              graphSurfaceSignature(state) ===
              graphSurfaceSignature(attachmentPathCopyContract.graphBeforeAction)
          ),
          ...sharedAssertions
        }
    : attachmentMoveProbe
      ? {
          exactNodeSetBeforeAction:
            JSON.stringify(initial.baseline.nodePaths) ===
              JSON.stringify(expectedAttachmentMoveNodePaths('before')) &&
            JSON.stringify(initial.entered.nodePaths) ===
              JSON.stringify(expectedAttachmentMoveNodePaths('before')),
          exactNodeSetAfterActionAndRestart: [
            attachmentMoveContract.graphAfterAction,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) =>
              JSON.stringify(state.nodePaths) ===
              JSON.stringify(expectedAttachmentMoveNodePaths('after'))
          ),
          attachmentEdgeCountStable: [
            initial.entered,
            attachmentMoveContract.graphAfterAction,
            initial.reopened,
            restarted.restarted
          ].every((state) => state.edgeCount === initial.baseline.edgeCount),
          attachmentContextMenuOpened: Boolean(initial.attachmentContextMenu?.items?.length),
          moveMenuItemInExpectedOrder:
            initial.attachmentContextMenu?.items?.findIndex(
              (item) => item.text === 'ファイルを移動…'
            ) === 2,
          moveDialogRecorded:
            attachmentMoveContract.dialog?.title === 'ファイルを移動' &&
            attachmentMoveContract.dialog?.description === 'attachments/diagram.svg' &&
            attachmentMoveContract.dialog?.directories?.some(
              (directory) => directory.value === '20_knowledge'
            ) === true &&
            attachmentMoveContract.dialog?.buttons?.some(
              (button) => button.text === 'キャンセル'
            ) === true &&
            attachmentMoveContract.dialog?.buttons?.some(
              (button) => button.text === '移動'
            ) === true,
          dialogAndContextMenuClosed:
            attachmentMoveContract.uiAfterAction?.dialogOpen === false &&
            attachmentMoveContract.uiAfterAction?.contextMenuOpen === false,
          globalGraphRemainedVisible:
            attachmentMoveContract.uiAfterAction?.globalGraphVisible === true,
          homeEmbedUnchanged:
            attachmentMoveContract.before.home.content ===
            attachmentMoveContract.after.home.content,
          sourceAndDestinationMatchScenario:
            attachmentMoveScenario === 'cancel'
              ? sameDigest(
                  attachmentMoveContract.before.source,
                  attachmentMoveContract.after.source
                ) &&
                attachmentMoveContract.after.destination.exists === false &&
                attachmentMoveContract.after.numberedDestination.exists === false
              : attachmentMoveScenario === 'success'
                ? attachmentMoveContract.after.source.exists === false &&
                  sameDigest(
                    attachmentMoveContract.before.source,
                    attachmentMoveContract.after.destination
                  ) &&
                  attachmentMoveContract.after.numberedDestination.exists === false
                : attachmentMoveContract.after.source.exists === false &&
                  sameDigest(
                    attachmentMoveContract.before.destination,
                    attachmentMoveContract.after.destination
                  ) &&
                  sameDigest(
                    attachmentMoveContract.before.source,
                    attachmentMoveContract.after.numberedDestination
                  ),
          oldAttachmentResolutionMatchesScenario:
            attachmentNodeIsResolved(initial.baseline, 'attachments/diagram.svg') &&
            (attachmentMoveScenario === 'cancel'
              ? [
                  attachmentMoveContract.graphAfterAction,
                  initial.reopened,
                  restarted.restarted
                ].every((state) =>
                  attachmentNodeIsResolved(state, 'attachments/diagram.svg')
                )
              : [
                  attachmentMoveContract.graphAfterAction,
                  initial.reopened,
                  restarted.restarted
                ].every((state) =>
                  !attachmentNodeIsResolved(state, 'attachments/diagram.svg')
                )),
          movedAttachmentsResolved:
            attachmentMoveScenario === 'cancel'
              ? true
              : [
                  attachmentMoveContract.graphAfterAction,
                  initial.reopened,
                  restarted.restarted
                ].every((state) =>
                  attachmentNodeIsResolved(
                    state,
                    attachmentMoveScenario === 'collision'
                      ? '20_knowledge/diagram 1.svg'
                      : '20_knowledge/diagram.svg'
                  )
                ),
          ...sharedAssertions
        }
    : attachmentBookmarkProbe
      ? {
          exactNodeSetAtEveryCheckpoint: [
            initial.baseline,
            initial.entered,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) => JSON.stringify(state.nodePaths) === JSON.stringify(expectedCameraNodePaths)
          ),
          attachmentContextMenuOpened: Boolean(initial.attachmentContextMenu?.items?.length),
          bookmarkMenuItemRecorded:
            initial.attachmentContextMenu?.items?.some(
              (item) => item.text === 'ブックマーク…'
            ) === true,
          bookmarkDialogRecorded:
            attachmentBookmarkContract.firstDialog?.title === 'ブックマークを追加' &&
            attachmentBookmarkContract.firstDialog?.description === 'attachments/diagram.svg' &&
            attachmentBookmarkContract.firstDialog?.buttons?.some(
              (button) => button.text === 'キャンセル'
            ) === true &&
            attachmentBookmarkContract.firstDialog?.buttons?.some(
              (button) => button.text === '保存'
            ) === true,
          dialogAndContextMenuClosed:
            attachmentBookmarkContract.uiAfterAction?.dialogOpen === false &&
            attachmentBookmarkContract.uiAfterAction?.contextMenuOpen === false,
          globalGraphRemainedVisible:
            attachmentBookmarkContract.uiAfterAction?.globalGraphVisible === true,
          bookmarkCountsMatchScenario:
            bookmarkCounts.beforeAction === 0 &&
            Object.entries(bookmarkCounts).every(([stageName, count]) =>
              stageName === 'beforeAction'
                ? count === 0
                : count === (attachmentBookmarkScenario === 'cancel' ? 0 : 1)
            ),
          bookmarksJsonMatchesScenario:
            attachmentBookmarkScenario === 'cancel'
              ? Object.values(bookmarkPersistence).every(
                  (snapshot) => snapshot.bookmarks.exists === false
                )
              : Object.entries(bookmarkPersistence).every(([stageName, snapshot]) =>
                  stageName === 'beforeAction'
                    ? snapshot.bookmarks.exists === false
                    : snapshot.bookmarks.exists === true &&
                      snapshot.bookmarks.parseError === null &&
                      Array.isArray(snapshot.bookmarks.json)
                ),
          bookmarkPersistsAfterGraphReopen:
            bookmarkCounts.afterGraphReopen ===
            (attachmentBookmarkScenario === 'cancel' ? 0 : 1),
          bookmarkPersistsAfterFirstProcessExit:
            bookmarkCounts.afterFirstProcessExit ===
            (attachmentBookmarkScenario === 'cancel' ? 0 : 1),
          bookmarkPersistsAfterAppRestart:
            bookmarkCounts.afterAppRestart ===
            (attachmentBookmarkScenario === 'cancel' ? 0 : 1),
          bookmarkPersistsAfterSecondProcessExit:
            bookmarkCounts.afterSecondProcessExit ===
            (attachmentBookmarkScenario === 'cancel' ? 0 : 1),
          duplicateBookmarkRemainsSingle:
            attachmentBookmarkScenario !== 'duplicate' ||
            (attachmentBookmarkContract.secondMenu?.items?.some(
              (item) => item.text === 'ブックマークを編集'
            ) === true &&
              attachmentBookmarkContract.secondDialog?.title === 'ブックマークを編集' &&
              bookmarkCounts.afterSecondProcessExit === 1),
          bookmarkFileStableAfterAction:
            attachmentBookmarkScenario === 'cancel' ||
            [
              bookmarkPersistence.afterAction,
              bookmarkPersistence.afterGraphReopen,
              bookmarkPersistence.afterFirstProcessExit,
              bookmarkPersistence.afterAppRestart,
              bookmarkPersistence.afterSecondProcessExit
            ].every(
              (snapshot) =>
                snapshot.bookmarks.sha256 ===
                bookmarkPersistence.afterAction.bookmarks.sha256
            ),
          vaultContentDigestStableAtEveryCheckpoint:
            Object.values(bookmarkPersistence).every(
              (snapshot) =>
                snapshot.vaultContent.combinedSha256 ===
                bookmarkPersistence.beforeAction.vaultContent.combinedSha256
            ),
          ...sharedAssertions
        }
    : nodeMenuProbe
      ? {
          exactNodeSetAtEveryCheckpoint: [
            initial.baseline,
            initial.entered,
            initial.reopened,
            restarted.restarted
          ].every(
            (state) => JSON.stringify(state.nodePaths) === JSON.stringify(expectedCameraNodePaths)
          ),
          nodeContextMenuOpened: Boolean(nodeMenuContract?.items?.length),
          nodeContextMenuItemsHaveText: nodeMenuContract?.items?.every(
            (item) => item.text.length > 0
          ),
          ...(nodeNewTabProbe
            ? {
                newTabCreated:
                  nodeNewTabContract?.afterTabCount >
                  nodeNewTabContract?.beforeTabCount,
                newTabActivated: Boolean(nodeNewTabContract?.activeTab),
                newTabEditorVisible: nodeNewTabContract?.editorVisible === true,
                graphClosedAfterNewTabAction:
                  nodeNewTabContract?.graphClosed === true,
                nodeContextMenuClosedAfterAction:
                  nodeNewTabContract?.contextMenuClosed === true,
                ...(workspaceTabProbe
                  ? {
                      globalGraphTabRetained:
                        nodeNewTabContract?.tabLabels?.includes('グラフビュー') === true,
                      returnedToGlobalGraphTab:
                        initial.graphWorkspaceTab?.activeTab === 'グラフビュー',
                      globalGraphVisibleAfterReturn:
                        initial.graphWorkspaceTab?.graphVisible === true
                    }
                  : {
                      attachmentContextMenuOpened:
                        Boolean(initial.attachmentContextMenu?.items?.length),
                      attachmentNewTabCreated:
                        attachmentNewTabContract?.afterTabCount >
                        attachmentNewTabContract?.beforeTabCount,
                      attachmentNewTabActivated:
                        attachmentNewTabContract?.attachmentVisible === true,
                      attachmentGraphClosedAfterAction:
                        attachmentNewTabContract?.graphClosed === true
                    })
              }
            : attachmentNewTabProbe
              ? {
                  attachmentContextMenuOpened:
                    Boolean(initial.attachmentContextMenu?.items?.length),
                  attachmentNewTabCreated:
                    attachmentNewTabContract?.afterTabCount >
                    attachmentNewTabContract?.beforeTabCount,
                  attachmentNewTabActivated:
                    attachmentNewTabContract?.attachmentVisible === true,
                  attachmentGraphClosedAfterAction:
                    attachmentNewTabContract?.graphClosed === true,
                  attachmentContextMenuClosedAfterAction:
                    attachmentNewTabContract?.contextMenuClosed === true,
                  globalGraphTabRetained:
                    attachmentNewTabContract?.tabLabels?.includes('グラフビュー') === true,
                  returnedToGlobalGraphTab:
                    initial.graphWorkspaceTab?.activeTab === 'グラフビュー',
                  globalGraphVisibleAfterReturn:
                    initial.graphWorkspaceTab?.graphVisible === true
                }
              : attachmentNewWindowProbe
                ? {
                    attachmentContextMenuOpened:
                      Boolean(initial.attachmentContextMenu?.items?.length),
                    attachmentWindowCreated:
                      attachmentNewWindowContract?.afterWindowCount >
                      attachmentNewWindowContract?.beforeWindowCount,
                    attachmentWindowActivated:
                      attachmentNewWindowContract?.preview?.previewVisible === true &&
                      attachmentNewWindowContract?.preview?.path === 'attachments/diagram.svg',
                    sourceGraphKeptOpen:
                      attachmentNewWindowContract?.source?.graphVisible === true,
                    attachmentContextMenuClosedAfterAction:
                      attachmentNewWindowContract?.source?.contextMenuClosed === true
                  }
              : {}),
          ...sharedAssertions
        }
    : cameraProbe
      ? {
        exactNodeSetAtEveryCheckpoint: [
          initial.baseline,
          initial.entered,
          initial.reopened,
          restarted.restarted
        ].every(
          (state) => JSON.stringify(state.nodePaths) === JSON.stringify(expectedCameraNodePaths)
        ),
        cameraInputApplied:
          Math.abs(cameraContract.afterInput.scale - 1.5) < 1e-9 &&
          Math.abs(cameraContract.afterInput.panX - 96) < 1 &&
          Math.abs(cameraContract.afterInput.panY - 64) < 1,
        zoomRestoredAfterGraphReopen:
          Math.abs(cameraContract.afterGraphReopen.scale - cameraContract.afterInput.scale) < 1e-9,
        panResetAfterGraphReopen:
          Math.abs(cameraContract.afterGraphReopen.panX) < 1 &&
          Math.abs(cameraContract.afterGraphReopen.panY) < 1,
        zoomRestoredAfterAppRestart:
          Math.abs(cameraContract.afterAppRestart.scale - cameraContract.afterInput.scale) < 1e-9,
        panResetAfterAppRestart:
          Math.abs(cameraContract.afterAppRestart.panX) < 1 &&
          Math.abs(cameraContract.afterAppRestart.panY) < 1,
        settingsPersisted:
          Math.abs((settings.graphViewStates?.vault?.scale ?? 0) - cameraContract.afterInput.scale) < 1e-9,
        ...sharedAssertions
        }
      : {
          queryEntered: initial.entered.query === query,
          queryRestoredAfterGraphReopen: initial.reopened.query === query,
          queryRestoredAfterAppRestart: restarted.restarted.query === query,
          settingsPersisted: settings.graphViewStates?.vault?.query === query,
          ...sharedAssertions
        }
  const completed = Object.values(assertions).every(Boolean)
  const observation = {
    capturedAt: new Date().toISOString(),
    query,
    malformedQueryCase: malformedQueryProbe ? malformedQueryCase : null,
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
    attachmentLinkedViewProbe,
    attachmentDefaultAppProbe,
    attachmentFolderRevealProbe,
    cameraContract,
    nodeDragContract,
    nodeMenuContract,
    nodeNewTabContract,
    attachmentNewTabContract,
    attachmentNewWindowContract,
    attachmentMoveContract,
    attachmentBookmarkContract,
    attachmentPathCopyContract,
    attachmentLinkedViewContract,
    attachmentDefaultAppContract,
    attachmentFolderRevealContract,
    bookmarkCounts,
    bookmarkPersistence,
    repository,
    initial,
    restarted,
    persistedGraphViewState: settings.graphViewStates.vault,
    protection: { before: protectionBefore, after: protectionAfter },
    assertions
  }
  await writeFile(
    resolve(outputRoot, 'observation.json'),
    `${JSON.stringify(repositoryEvidence(observation), null, 2)}\n`,
    'utf8'
  )

  const artifactPaths = [
    ...(attachmentFolderRevealProbe
      ? [
          '01-node-context-menu.png',
          '02-after-folder-reveal-request.png'
        ]
      : attachmentDefaultAppProbe
      ? [
          '01-node-context-menu.png',
          '02-after-default-app-request.png'
        ]
      : attachmentLinkedViewProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-after-linked-view-hover.png',
          '03-after-linked-view-click.png',
          '04-after-linked-view-action.png',
          '05-after-graph-reopen.png',
          '06-after-app-restart.png'
        ]
      : attachmentPathCopyProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-path-copy-submenu.png',
          '03-after-path-copy.png',
          '04-after-graph-reopen.png',
          '05-after-app-restart.png'
        ]
      : attachmentBookmarkProbe
      ? attachmentBookmarkScenario === 'duplicate'
        ? [
            '00-baseline.png',
            '01-node-context-menu.png',
            '02-bookmark-dialog.png',
            '03-duplicate-node-context-menu.png',
            '04-duplicate-bookmark-dialog.png',
            '05-after-bookmark-action.png',
            '06-after-graph-reopen.png',
            '07-after-app-restart.png'
          ]
        : [
            '00-baseline.png',
            '01-node-context-menu.png',
            '02-bookmark-dialog.png',
            '03-after-bookmark-action.png',
            '04-after-graph-reopen.png',
            '05-after-app-restart.png'
          ]
      : attachmentMoveProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-move-dialog.png',
          `03-after-${attachmentMoveScenario}.png`,
          '04-after-graph-reopen.png',
          '05-after-app-restart.png'
        ]
      : nodeDragProbe
      ? [
          '00-baseline.png',
          '01-during-node-drag.png',
          '02-after-node-release.png',
          '03-after-graph-reopen.png',
          '04-after-app-restart.png'
        ]
      : attachmentNewWindowProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-attachment-new-window.png',
          '02-after-graph-reopen.png',
          '03-after-app-restart.png'
        ]
      : attachmentNewTabProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-attachment-new-tab.png',
          '03-returned-global-graph.png',
          '02-after-graph-reopen.png',
          '03-after-app-restart.png'
        ]
      : workspaceTabProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-note-new-tab.png',
          '03-returned-global-graph.png',
          '02-after-graph-reopen.png',
          '03-after-app-restart.png'
        ]
      : nodeNewTabProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-note-new-tab.png',
          '03-attachment-context-menu.png',
          '04-attachment-new-tab.png',
          '02-after-graph-reopen.png',
          '03-after-app-restart.png'
        ]
      : nodeMenuProbe
      ? [
          '00-baseline.png',
          '01-node-context-menu.png',
          '02-after-graph-reopen.png',
          '03-after-app-restart.png'
        ]
      : cameraProbe
      ? [
          '00-baseline.png',
          '01-after-camera-input.png',
          '02-after-graph-reopen.png',
          '03-after-app-restart.png'
        ]
      : ['01-query-entered.png', '02-graph-reopened.png', '03-app-restarted.png']),
    'phase-initial.json',
    'phase-restarted.json',
    'observation.json'
  ].map((name) => resolve(outputRoot, name))
  const manifest = {
    capturedAt: observation.capturedAt,
    stage: malformedQueryProbe
      ? `CP0-T02 Global Graph malformed query working-tree evidence (${malformedQueryCase})`
      : attachmentFolderRevealProbe
      ? 'GP0-3b-o Global Graph attachment folder-reveal working-tree evidence'
      : attachmentDefaultAppProbe
      ? 'GP0-3b-n Global Graph attachment default-app working-tree evidence'
      : attachmentLinkedViewProbe
      ? 'GP0-3b-m Global Graph attachment linked-view working-tree evidence'
      : attachmentPathCopyProbe
      ? `GP0-3b-l Global Graph attachment path copy (${attachmentPathCopyScenario}) working-tree evidence`
      : attachmentBookmarkProbe
      ? `GP0-3b-k Global Graph attachment bookmark (${attachmentBookmarkScenario}) working-tree evidence`
      : attachmentMoveProbe
      ? `GP0-3b-j Global Graph attachment file move (${attachmentMoveScenario}) working-tree evidence`
      : nodeDragProbe
      ? 'GP0-3b-d Global Graph node drag lifecycle working-tree evidence'
      : attachmentNewWindowProbe
        ? 'GP0-3b-i Global Graph attachment new-window working-tree evidence'
      : attachmentNewTabProbe
        ? 'GP0-3b-h Global Graph attachment new-tab working-tree evidence'
      : workspaceTabProbe
        ? 'GP0-3b-g Global Graph workspace tab working-tree evidence'
      : nodeNewTabProbe
        ? 'GP0-3b-f Global Graph node new-tab working-tree evidence'
      : nodeMenuProbe
        ? 'GP0-3b-e Global Graph node context menu working-tree evidence'
      : cameraProbe
        ? 'GP0-3b-c Global Graph camera persistence working-tree evidence'
        : 'GP0-3b Global Graph search persistence working-tree evidence',
    status: completed ? 'captured' : 'failed',
    attachmentDefaultApp: attachmentDefaultAppProbe
      ? {
          actionLabel: attachmentDefaultAppContract.actionLabel,
          targetPath: 'attachments/diagram.svg',
          menuItemCount: initial.attachmentContextMenu?.items?.length ?? 0,
          menuItems: initial.attachmentContextMenu?.items ?? [],
          apiSeam: attachmentDefaultAppContract.apiSeam,
          expectedPath: attachmentDefaultAppContract.expectedPath,
          calls: attachmentDefaultAppContract.calls,
          menuClosed: attachmentDefaultAppContract.uiAfterAction?.contextMenuOpen === false,
          callCountAfterGraphReopen:
            attachmentDefaultAppContract.callCountAfterGraphReopen,
          initialHook: attachmentDefaultAppContract.shell,
          restartedHook: restarted.attachmentDefaultAppShell
        }
      : null,
    attachmentFolderReveal: attachmentFolderRevealProbe
      ? {
          actionLabel: attachmentExternalContract.actionLabel,
          targetPath: 'attachments/diagram.svg',
          menuItemCount: initial.attachmentContextMenu?.items?.length ?? 0,
          menuItems: initial.attachmentContextMenu?.items ?? [],
          apiSeam: attachmentExternalContract.apiSeam,
          expectedPath: attachmentExternalContract.expectedPath,
          calls: attachmentExternalContract.calls,
          menuClosed: attachmentExternalContract.uiAfterAction?.contextMenuOpen === false,
          callCountAfterGraphReopen:
            attachmentExternalContract.callCountAfterGraphReopen,
          initialHook: attachmentExternalContract.shell,
          restartedHook: attachmentExternalRestartShell
        }
      : null,
    comparisonStatus: malformedQueryProbe
      ? `Compare with docs/reports/assets/graph-gp0-malformed-query/${malformedQueryCase}/obsidian-1.13.4/observation.json`
      : attachmentFolderRevealProbe
      ? 'Compare with docs/reports/assets/graph-gp0-attachment-folder-reveal/obsidian-1.13.4/observation.json'
      : attachmentDefaultAppProbe
      ? 'Compare with docs/reports/assets/graph-gp0-attachment-default-app/obsidian-1.13.4/observation.json'
      : attachmentLinkedViewProbe
      ? 'Compare with docs/reports/assets/graph-gp0-attachment-linked-view/obsidian-1.13.4/observation.json'
      : attachmentPathCopyProbe
      ? `Compare with docs/reports/assets/graph-gp0-attachment-path-copy/${attachmentPathCopyScenario}/obsidian-1.13.4/observation.json`
      : attachmentBookmarkProbe
      ? `Compare with docs/reports/assets/graph-gp0-attachment-bookmark/${attachmentBookmarkScenario}/obsidian-1.13.4/observation.json`
      : attachmentMoveProbe
      ? `Compare with docs/reports/assets/graph-gp0-attachment-file-move/${attachmentMoveScenario}/obsidian-1.13.4/observation.json`
      : nodeDragProbe
      ? 'Compare with docs/reports/assets/graph-gp0-node-drag-persistence/comparison.json'
      : attachmentNewWindowProbe
        ? 'Compare with docs/reports/assets/graph-gp0-attachment-new-window/comparison.json'
      : attachmentNewTabProbe
        ? 'Compare with docs/reports/assets/graph-gp0-attachment-new-tab/comparison.json'
      : workspaceTabProbe
        ? 'Compare with docs/reports/assets/graph-gp0-workspace-tab/comparison.json'
      : nodeNewTabProbe
        ? 'Compare with docs/reports/assets/graph-gp0-node-new-tab/comparison.json'
      : nodeMenuProbe
        ? 'Compare with docs/reports/assets/graph-gp0-node-context-menu/comparison.json'
      : cameraProbe
        ? 'Compare with docs/reports/assets/graph-gp0-camera-persistence/comparison.json'
        : 'Compare with docs/reports/assets/graph-gp0-search-persistence/comparison.json',
    command: attachmentFolderRevealProbe
      ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-folder-reveal'
      : attachmentDefaultAppProbe
      ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-default-app'
      : attachmentLinkedViewProbe
      ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-linked-view'
      : attachmentPathCopyProbe
      ? `npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-path-copy --path-copy-scenario=${attachmentPathCopyScenario}`
      : attachmentBookmarkProbe
      ? `npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-bookmark --bookmark-scenario=${attachmentBookmarkScenario}`
      : attachmentMoveProbe
      ? `npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-move --move-scenario=${attachmentMoveScenario}`
      : nodeDragProbe
      ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --node-drag'
      : attachmentNewWindowProbe
        ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-new-window'
      : attachmentNewTabProbe
        ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --attachment-new-tab'
      : workspaceTabProbe
        ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --workspace-tab'
      : nodeNewTabProbe
        ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --node-new-tab'
      : nodeMenuProbe
        ? 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs --node-menu'
      : cameraProbe
        ? '$env:TSUZUNE_GRAPH_CAMERA_PROBE=1; npm run build; node scripts/capture-graph-gp0-3b-search-restart.mjs'
        : 'npm run build && node scripts/capture-graph-gp0-3b-search-restart.mjs',
    isolation: {
      sourceFixture: relative(repoRoot, sourceFixture).replaceAll('\\', '/'),
      copiedVault: relative(repoRoot, vault).replaceAll('\\', '/'),
      userData: relative(repoRoot, userData).replaceAll('\\', '/'),
      requestedContentViewport: viewport,
      offscreenOrigin: { x: -32_000, y: -32_000 },
      observedWindowGeometry: {
        initial: initial.windowGeometry,
        restarted: restarted.windowGeometry
      },
      network: 'host resolver blocked except localhost'
    },
    evidenceBoundary: attachmentFolderRevealProbe
      ? {
          established: [
            'Fresh isolated fixture Vault and userData profile',
            'Public TSUZUNE attachment context-menu action was used exactly once',
            'electron.shell.showItemInFolder was replaced before the main-process import and restored in both processes',
            'The exact sanitized filesystem path and call count were recorded without launching Windows Explorer',
            'Graph query, camera transform, node paths, directed edge signature, and tabs were compared after the action, Graph reopen, and an additional TSUZUNE-only restart',
            'Source fixture, isolated Vault content, product source, and built application were hashed before and after capture'
          ],
          notEstablished: [
            'A real Windows Explorer launch or shell association',
            'Physical mouse or keyboard input',
            'Visible onscreen foreground-window interaction',
            'Touch or pen input',
            'Screen reader or Windows High Contrast acceptance',
            'Multi-DPI or pixel-identical parity',
            'Obsidian restart behavior, because the fixed reference intentionally did not start a second process'
          ],
          apiSeam: 'electron.shell.showItemInFolder',
          externalApplicationLaunched: false
        }
      : attachmentDefaultAppProbe
      ? {
          established: [
            'Fresh isolated fixture Vault and userData profile',
            'Public TSUZUNE attachment context-menu action was used exactly once',
            'electron.shell.openPath was replaced before the main-process import and restored in both processes',
            'The exact sanitized filesystem path and call count were recorded without launching an OS application',
            'Graph query, camera transform, node paths, directed edge signature, and tabs were compared after the action, Graph reopen, and an additional TSUZUNE-only restart',
            'Source fixture, isolated Vault content, product source, and built application were hashed before and after capture'
          ],
          notEstablished: [
            'A real default application launch or OS file association',
            'Physical mouse or keyboard input',
            'Visible onscreen foreground-window interaction',
            'Touch or pen input',
            'Screen reader or Windows High Contrast acceptance',
            'Multi-DPI or pixel-identical parity',
            'Obsidian restart non-replay, because the fixed reference intentionally did not start a second process'
          ],
          apiSeam: 'electron.shell.openPath',
          externalApplicationLaunched: false
        }
      : attachmentLinkedViewProbe
      ? {
          established: [
            'Fresh isolated fixture Vault and userData profile',
            'Public TSUZUNE graph node context menu and linked-view submenu were used',
            'Parent menu remained open while the linked-view submenu was visible',
            'The enabled backlink action opened a backlink view for the selected attachment',
            'The Global Graph tab was retained and its query, camera, nodes, edges, and tabs were compared after reopening and restart',
            'Source fixture and isolated Vault were hashed before and after the capture'
          ],
          notEstablished: [
            'Physical mouse or keyboard input',
            'Visible onscreen foreground-window interaction',
            'Touch or pen input',
            'Screen reader or Windows High Contrast acceptance',
            'Multi-DPI or pixel-identical parity',
            'Backlink ordering beyond the captured fixture'
          ]
        }
      : attachmentPathCopyProbe
      ? {
          established: [
            'Fresh isolated fixture Vault and userData profile',
            'Public TSUZUNE graph node context menu and three-item path-copy submenu were used',
            'Parent click retained the main menu; child selection closed both menus',
            'Electron clipboard.writeText was intercepted inside the capture process and restored before exit',
            'Clipboard equality was checked in memory; only the unchanged boolean was recorded',
            'Graph query, camera transform, rendered node paths, rendered edge count, and workspace tabs were compared immediately, after Graph reopen, and after a distinct-process restart',
            'Source fixture and isolated Vault were hashed before and after the capture'
          ],
          notEstablished: [
            'Physical mouse or keyboard input',
            'Visible onscreen foreground-window interaction',
            'Touch or pen input',
            'Screen reader or Windows High Contrast acceptance',
            'Multi-DPI or pixel-identical parity',
            'A real OS clipboard write and paste round-trip',
            'Semantic edge identities beyond the public canvas edge-count signal'
          ],
          submenuPlacement: attachmentPathCopyContract.submenu?.placement ?? null,
          submenuFullyInsideViewport:
            attachmentPathCopyContract.submenu?.fullyInsideViewport ?? null,
          fixedReferencePlacement: 'left at the captured right-edge position'
        }
      : attachmentBookmarkProbe
      ? {
          established: [
            'Fresh isolated fixture Vault and userData profile',
            'Public TSUZUNE graph node context menu and bookmark dialog were used',
            'Synthetic CDP mouse input opened the node menu; DOM button activation exercised public UI handlers',
            'Global Graph was closed and reopened before capture',
            'A distinct Electron process reopened the same isolated Vault',
            'Vault content and .tsuzune/bookmarks.json were hashed at each checkpoint'
          ],
          notEstablished: [
            'Physical mouse or keyboard input',
            'Visible onscreen foreground-window interaction',
            'Touch or pen input',
            'Screen reader or Windows High Contrast acceptance',
            'Multi-DPI or pixel-identical parity'
          ]
        }
      : null,
    processIds: [initial.processId, restarted.processId],
    assertions,
    artifacts: await Promise.all(artifactPaths.map(artifactSummary)),
    next: attachmentFolderRevealProbe
      ? 'Build the fixed Obsidian/TSUZUNE GP0-3b-o comparison without widening scope to file-explorer or folder-selection behavior.'
      : attachmentDefaultAppProbe
      ? 'Build the fixed Obsidian/TSUZUNE GP0-3b-n comparison without widening scope to folder reveal.'
      : attachmentLinkedViewProbe
      ? 'Compare the linked-view submenu and backlink workspace behavior with the fixed Obsidian 1.13.4 evidence.'
      : attachmentPathCopyProbe
      ? `Compare the ${attachmentPathCopyScenario} path format and adaptive submenu placement with the fixed Obsidian 1.13.4 evidence.`
      : attachmentBookmarkProbe
      ? `Compare the ${attachmentBookmarkScenario} scenario with the fixed Obsidian 1.13.4 evidence.`
      : attachmentMoveProbe
      ? `Compare the ${attachmentMoveScenario} scenario with the fixed Obsidian 1.13.4 evidence.`
      : nodeDragProbe
      ? 'Document the observed Obsidian/TSUZUNE node drag lifecycle contract before the next parity slice.'
      : attachmentNewWindowProbe
        ? 'Document the observed Obsidian/TSUZUNE attachment new-window behavior.'
      : attachmentNewTabProbe
        ? 'Document the observed Obsidian/TSUZUNE attachment new-tab behavior.'
      : workspaceTabProbe
        ? 'Document the observed Obsidian/TSUZUNE Global Graph workspace tab behavior.'
      : nodeNewTabProbe
        ? 'Document the observed Obsidian/TSUZUNE node new-tab behavior before the next parity slice.'
      : nodeMenuProbe
        ? 'Document the observed Obsidian/TSUZUNE node context menu differences before the next parity slice.'
      : cameraProbe
        ? 'Document the observed Obsidian/TSUZUNE camera persistence contract before the next parity slice.'
        : 'Continue GP0-3b with the remaining camera, drag, menu, animation, and reset behaviors.'
  }
  await writeFile(
    resolve(outputRoot, 'manifest.json'),
    `${JSON.stringify(repositoryEvidence(manifest), null, 2)}\n`,
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
