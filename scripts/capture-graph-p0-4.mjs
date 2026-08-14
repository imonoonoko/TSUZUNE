import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

const mode = process.env.TSUZUNE_GRAPH_CAPTURE_MODE || 'starter'
if (mode !== 'starter' && mode !== 'dense') {
  throw new Error(`不明なcapture modeです: ${mode}`)
}

const starterVaultInput = process.env.TSUZUNE_CAPTURE_VAULT?.trim()
if (!starterVaultInput) {
  throw new Error('TSUZUNE_CAPTURE_VAULTにStarter Vaultのパスが必要です。')
}

const starterVault = resolve(starterVaultInput)
const outputDirectory = resolve('docs/reports/assets/graph-p0-4')
const workDirectory = resolve('work')
const userDataDirectory = resolve(workDirectory, `graph-p0-4-userdata-${mode}`)
const denseVault = resolve(workDirectory, 'graph-p0-4-dense-vault')
const originalLoadFile = BrowserWindow.prototype.loadFile
let captureStarted = false

function assertWorkPath(path) {
  if (!path.startsWith(`${workDirectory}${sep}`)) {
    throw new Error(`作業用ディレクトリ外は削除できません: ${path}`)
  }
}

async function listMarkdown(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...(await listMarkdown(root, path)))
    } else if (entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.md')) {
      paths.push(path)
    }
  }
  return paths.sort((left, right) => left.localeCompare(right, 'ja'))
}

async function markdownDigest(root) {
  const files = await listMarkdown(root)
  const hash = createHash('sha256')
  for (const path of files) {
    const relativePath = relative(root, path).replaceAll('\\', '/')
    hash.update(relativePath)
    hash.update('\0')
    hash.update(await readFile(path))
    hash.update('\0')
  }
  return { fileCount: files.length, combinedSha256: hash.digest('hex').toUpperCase() }
}

async function createDenseFixture(root) {
  const fixtureDirectory = resolve(root, '90_P0-4-fixture')
  await mkdir(fixtureDirectory, { recursive: true })
  const noteNames = Array.from(
    { length: 60 },
    (_, index) => `密度ノート${String(index + 1).padStart(2, '0')}`
  )
  const centerLinks = noteNames
    .map((name) => `- [[90_P0-4-fixture/${name}]]`)
    .join('\n')
  await writeFile(
    resolve(fixtureDirectory, '密集グラフ.md'),
    `# 密集グラフ\n\nP0-4の表示上限確認用fixture。\n\n${centerLinks}\n`,
    'utf8'
  )

  for (const [index, name] of noteNames.entries()) {
    const crossLinks = Array.from({ length: 10 }, (_, offset) => {
      const target = noteNames[(index + offset + 1) % noteNames.length]
      return `- [[90_P0-4-fixture/${target}]]`
    }).join('\n')
    await writeFile(
      resolve(fixtureDirectory, `${name}.md`),
      `# ${name}\n\n- [[90_P0-4-fixture/密集グラフ]]\n${crossLinks}\n`,
      'utf8'
    )
  }
}

async function prepareCaptureEnvironment() {
  assertWorkPath(userDataDirectory)
  await rm(userDataDirectory, { recursive: true, force: true })
  await mkdir(userDataDirectory, { recursive: true })

  let vaultPath = starterVault
  let lastNotePath = '00_入口/プロジェクト地図.md'
  if (mode === 'dense') {
    assertWorkPath(denseVault)
    await rm(denseVault, { recursive: true, force: true })
    await cp(starterVault, denseVault, { recursive: true })
    await createDenseFixture(denseVault)
    vaultPath = denseVault
    lastNotePath = '90_P0-4-fixture/密集グラフ.md'
  }

  app.setPath('userData', userDataDirectory)
  await writeFile(
    resolve(userDataDirectory, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultPath, lastNotePath }, null, 2),
    'utf8'
  )
  return { vaultPath, lastNotePath }
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
const sourceBefore = await markdownDigest(starterVault)
const captureEnvironment = await prepareCaptureEnvironment()
const captureVaultBefore = await markdownDigest(captureEnvironment.vaultPath)

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitForRender(window) {
  await delay(250)
  await evaluate(
    window,
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
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
      if (!button) return false
      button.click()
      return true
    })()`
  )
  if (!clicked) {
    throw new Error(`ボタン「${label}」が見つかりませんでした。`)
  }
  await waitForRender(window)
}

async function fillSearch(window, value) {
  const appliedValue = await evaluate(
    window,
    `(() => {
      const input = document.querySelector('[aria-label="ファイルを検索…"]')
      if (!input) return null
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
  if (appliedValue !== value) {
    throw new Error(`絞り込み入力を設定できませんでした: ${appliedValue}`)
  }
  await waitForRender(window)
}

async function hoverNode(window, namePart) {
  const point = await evaluate(
    window,
    `(() => {
      const nodes = [...document.querySelectorAll('.wiki-graph-node:not(.is-current)')]
      const node = nodes.find((candidate) => candidate.textContent.includes(${JSON.stringify(namePart)})) || nodes[0]
      if (!node) return null
      const bounds = node.getBoundingClientRect()
      return { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) }
    })()`
  )
  if (!point) {
    throw new Error('hover対象のグラフノードが見つかりませんでした。')
  }
  window.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y })
  await waitForRender(window)
}

async function focusNode(window, namePart) {
  window.webContents.sendInputEvent({ type: 'mouseMove', x: 3, y: 3 })
  await waitForRender(window)
  const canvasFocused = await evaluate(
    window,
    `(() => {
      const canvas = document.querySelector('[aria-label="グラフキャンバス"]')
      if (!canvas) return false
      canvas.focus()
      return true
    })()`
  )
  if (!canvasFocused) {
    throw new Error('グラフキャンバスへfocusできませんでした。')
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' })
    await delay(30)
    const focused = await evaluate(
      window,
      `(() => {
        const active = document.activeElement
        return active?.classList.contains('wiki-graph-node')
          ? active.textContent.trim()
          : ''
      })()`
    )
    if (focused.includes(namePart)) {
      await evaluate(
        window,
        `document.activeElement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))`
      )
      await waitForRender(window)
      return
    }
  }
  throw new Error(`Tab操作で「${namePart}」へfocusできませんでした。`)
}

async function capture(window, name) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, name), image.toPNG())
}

async function graphState(window) {
  return evaluate(
    window,
    `(() => {
      const nodes = [...document.querySelectorAll('.wiki-graph-node')]
      const edgeCanvas = document.querySelector('canvas.wiki-graph-edges')
      const longNode = nodes.find((node) => {
        const label = node.querySelector('.wiki-graph-node-label')
        return label && label.scrollWidth > label.clientWidth
      })
      const longLabel = longNode?.querySelector('.wiki-graph-node-label')
      return {
      filter: document.querySelector('[aria-label="ファイルを検索…"]')?.value || '',
      nodeCount: nodes.length,
      edgeCount: Number(edgeCanvas?.dataset.edgeCount || 0),
      activePath: edgeCanvas?.dataset.activePath || '',
      focusedNode: document.activeElement?.classList.contains('wiki-graph-node')
        ? document.activeElement.textContent.trim()
        : '',
      longNode: longNode
        ? {
            text: longLabel?.textContent.trim() || longNode.textContent.trim(),
            title: longNode.title,
            clientWidth: longLabel?.clientWidth || 0,
            scrollWidth: longLabel?.scrollWidth || 0
          }
        : null,
      nodes: nodes
        .slice(0, 12)
        .map((node) => node.textContent.trim())
      }
    })()`
  )
}

async function captureStarter(window) {
  await capture(window, '01-starter-legend.png')
  const legend = await graphState(window)
  await hoverNode(window, 'ONOKO')
  await capture(window, '02-starter-hover.png')
  const hover = await graphState(window)
  await focusNode(window, 'TSUZUNE')
  await capture(window, '05-starter-focus.png')
  const focus = await graphState(window)

  if (
    legend.nodeCount < 2 ||
    legend.edgeCount < 1 ||
    !legend.longNode
  ) {
    throw new Error('Starter Vaultで凡例またはグラフノードを確認できませんでした。')
  }
  if (!hover.activePath.includes('ONOKO')) {
    throw new Error('hoverしたノードの接続が強調されませんでした。')
  }
  if (!focus.activePath.includes('TSUZUNE') || !focus.focusedNode.includes('TSUZUNE')) {
    throw new Error(
      `keyboard focusしたノードの接続が強調されませんでした: ${JSON.stringify(focus)}`
    )
  }
  return { legend, hover, focus }
}

async function captureDense(window) {
  await capture(window, '03-dense-limit.png')
  const dense = await graphState(window)
  await clickButton(window, 'グラフ設定を開く')
  await clickButton(window, 'フィルタを開く')
  await fillSearch(window, '密度ノート59')
  await clickButton(window, 'グラフ設定を閉じる')
  await capture(window, '04-dense-filter.png')
  const filtered = await graphState(window)

  if (
    dense.nodeCount < 50 ||
    dense.edgeCount < 50
  ) {
    throw new Error(`大規模fixtureの全ノード表示が期待値と一致しません: ${JSON.stringify(dense)}`)
  }
  if (filtered.nodeCount !== 2 || filtered.edgeCount < 1) {
    throw new Error(`絞り込み後の表示が期待値と一致しません: ${JSON.stringify(filtered)}`)
  }
  return { dense, filtered }
}

async function captureGraphReport(window) {
  await mkdir(outputDirectory, { recursive: true })
  await evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000
      const timer = setInterval(() => {
        const graphButton = [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === 'ローカルグラフ')
        if (graphButton) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() > deadline) {
          clearInterval(timer)
          reject(new Error('TSUZUNEの起動を待機できませんでした。'))
        }
      }, 100)
    })`
  )
  await clickButton(window, '編集')
  await clickButton(window, 'ローカルグラフ')

  const states = mode === 'starter' ? await captureStarter(window) : await captureDense(window)
  const sourceAfter = await markdownDigest(starterVault)
  const captureVaultAfter = await markdownDigest(captureEnvironment.vaultPath)
  if (
    sourceBefore.fileCount !== sourceAfter.fileCount ||
    sourceBefore.combinedSha256 !== sourceAfter.combinedSha256
  ) {
    throw new Error('Graph dogfood中にStarter VaultのMarkdownが変化しました。')
  }
  if (
    captureVaultBefore.fileCount !== captureVaultAfter.fileCount ||
    captureVaultBefore.combinedSha256 !== captureVaultAfter.combinedSha256
  ) {
    throw new Error('Graph dogfood中に撮影対象VaultのMarkdownが変化しました。')
  }

  const result = {
    mode,
    vault: mode === 'starter' ? 'Starter Vault' : 'Starter Vault copy with dense fixture',
    lastNotePath: captureEnvironment.lastNotePath,
    sourceBefore,
    sourceAfter,
    captureVaultBefore,
    captureVaultAfter,
    markdownUnchanged: true,
    states
  }
  await writeFile(
    resolve(outputDirectory, `capture-${mode}-result.json`),
    JSON.stringify(result, null, 2),
    'utf8'
  )
  await Promise.all([
    rm(resolve(outputDirectory, `capture-${mode}-error.txt`), { force: true }),
    rm(resolve(outputDirectory, `capture-${mode}-error.png`), { force: true })
  ])
  console.log(JSON.stringify(result, null, 2))
}

BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!captureStarted) {
    captureStarted = true
    void loaded
      .then(() => captureGraphReport(this))
      .then(() => app.exit(0))
      .catch(async (error) => {
        await mkdir(outputDirectory, { recursive: true })
        const rendererText = await this.webContents
          .executeJavaScript('document.body?.innerText || ""', true)
          .catch(() => '')
        await writeFile(
          resolve(outputDirectory, `capture-${mode}-error.txt`),
          `${String(error?.stack || error)}\n\nURL: ${this.webContents.getURL()}\n\n${rendererText}`,
          'utf8'
        )
        const errorImage = await this.webContents.capturePage()
        await writeFile(
          resolve(outputDirectory, `capture-${mode}-error.png`),
          errorImage.toPNG()
        )
        console.error(error)
        app.exit(1)
      })
  }
  return loaded
}

await import('../out/main/index.js')
