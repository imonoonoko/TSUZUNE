import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve('docs/reports/assets/graph-gp1')
const workDirectory = resolve('work')
const userDataDirectory = resolve(workDirectory, 'graph-gp1-userdata')
const originalLoadFile = BrowserWindow.prototype.loadFile
let captureStarted = false

function assertWorkPath(path) {
  if (!path.startsWith(`${workDirectory}${sep}`)) {
    throw new Error(`作業用ディレクトリ外は削除できません: ${path}`)
  }
}

async function markdownFiles(directory = vault) {
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...(await markdownFiles(path)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      paths.push(path)
    }
  }
  return paths.sort((left, right) => left.localeCompare(right, 'ja'))
}

async function markdownDigest() {
  const paths = await markdownFiles()
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(relative(vault, path).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(path))
    hash.update('\0')
  }
  return {
    fileCount: paths.length,
    relativePaths: paths.map((path) => relative(vault, path).replaceAll('\\', '/')),
    combinedSha256: hash.digest('hex').toUpperCase()
  }
}

async function prepare() {
  assertWorkPath(userDataDirectory)
  await rm(userDataDirectory, { recursive: true, force: true })
  await mkdir(userDataDirectory, { recursive: true })
  app.setPath('userData', userDataDirectory)
  await writeFile(
    resolve(userDataDirectory, 'settings.json'),
    JSON.stringify(
      {
        lastVaultPath: vault,
        lastNotePath: '00_Home.md'
      },
      null,
      2
    ),
    'utf8'
  )
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitForRender(window) {
  await delay(900)
  await waitForPaint(window)
}

async function waitForPaint(window) {
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

async function clickButtonNow(window, label) {
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
}

async function pressGraphKey(window, key) {
  const pressed = await evaluate(
    window,
    `(() => {
      const canvas = document.querySelector('[aria-label="グラフキャンバス"]')
      if (!canvas) return false
      canvas.focus()
      canvas.dispatchEvent(new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)},
        bubbles: true,
        cancelable: true
      }))
      return true
    })()`
  )
  if (!pressed) {
    throw new Error(`グラフキャンバスへキー「${key}」を送れませんでした。`)
  }
  await waitForRender(window)
}

async function setSlider(window, label, value) {
  const applied = await evaluate(
    window,
    `(() => {
      const input = document.querySelector('[aria-label=${JSON.stringify(label)}]')
      if (!input) return null
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set
      setter.call(input, ${JSON.stringify(String(value))})
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      return input.value
    })()`
  )
  if (applied !== String(value)) {
    throw new Error(`${label}を${value}へ変更できませんでした: ${applied}`)
  }
  await waitForRender(window)
}

async function graphState(window) {
  return evaluate(
    window,
    `(() => {
      const canvas = document.querySelector('.wiki-graph-canvas')
      const canvasRect = canvas?.getBoundingClientRect()
      return ({
      viewport: canvasRect ? {
        left: canvasRect.left,
        top: canvasRect.top,
        right: canvasRect.right,
        bottom: canvasRect.bottom
      } : null,
      sliders: Object.fromEntries(
        ['中心力', '反発力', 'リンクする力', 'リンク距離'].map((label) => [
          label,
          document.querySelector('[aria-label="' + label + '"]')?.value || null
        ])
      ),
      nodes: [...document.querySelectorAll('.wiki-graph-node')].map((node) => ({
        path: node.title,
        left: node.offsetLeft,
        top: node.offsetTop,
        screen: (() => {
          const rect = node.getBoundingClientRect()
          return {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + Math.min(rect.height, 16) / 2
          }
        })(),
        marker: (() => {
          const dot = node.querySelector('.wiki-graph-node-dot')
          const style = dot ? getComputedStyle(dot) : null
          return style ? {
            width: Number.parseFloat(style.width),
            height: Number.parseFloat(style.height),
            borderRadius: style.borderRadius
          } : null
        })()
      })),
      edgeCount: Number(
        document.querySelector('canvas.wiki-graph-edges')?.dataset.edgeCount ?? 0
      )
    })})()`
  )
}

async function capture(window, name) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, name), image.toPNG())
}

async function runCapture(window) {
  window.setSkipTaskbar(true)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await mkdir(outputDirectory, { recursive: true })
  await evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000
      const timer = setInterval(() => {
        const graph = [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === 'ローカルグラフ')
        if (graph) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() > deadline) {
          clearInterval(timer)
          reject(new Error('TSUZUNEの起動を待機できませんでした。'))
        }
      }, 100)
    })`
  )
  await clickButton(window, 'ローカルグラフ')
  await delay(1500)
  await clickButton(window, 'グラフ設定を開く')
  await clickButton(window, '力の強さを開く')

  const before = await markdownDigest()
  const defaultState = await graphState(window)
  await capture(window, '01-force-defaults.png')
  await setSlider(window, '中心力', 1)
  const centerMaximum = await graphState(window)
  await capture(window, '02-center-force-maximum.png')
  await clickButton(window, 'グラフ設定を閉じる')
  await clickButton(window, 'グラフビュー')
  await delay(4000)
  await pressGraphKey(window, '0')
  const vaultFit = await graphState(window)
  await capture(window, '03-vault-force-fit.png')
  const markdownPaths = new Set(before.relativePaths)
  const visibleMarkdownCount = vaultFit.nodes.filter((node) =>
    markdownPaths.has(node.path)
  ).length

  await clickButtonNow(
    window,
    'グラフのタイムラプスアニメーションを開始'
  )
  await waitForPaint(window)
  const timelineStart = await graphState(window)
  await capture(window, '04-timeline-start.png')
  await delay(320)
  await waitForPaint(window)
  const timelineMiddle = await graphState(window)
  await capture(window, '05-timeline-middle.png')
  await delay(1500)
  await waitForPaint(window)
  const timelineEnd = await graphState(window)
  await capture(window, '06-timeline-end.png')
  const after = await markdownDigest()
  const savedSettings = JSON.parse(
    await readFile(resolve(userDataDirectory, 'settings.json'), 'utf8')
  )

  if (defaultState.nodes.length < 2 || defaultState.edgeCount < 1) {
    throw new Error(`比較Fixtureのグラフが不足しています: ${JSON.stringify(defaultState)}`)
  }
  if (
    Math.abs(Number(defaultState.sliders['中心力']) - 0.5187132489703118) > 1e-12 ||
    defaultState.sliders['反発力'] !== '10' ||
    defaultState.sliders['リンクする力'] !== '1' ||
    defaultState.sliders['リンク距離'] !== '250'
  ) {
    throw new Error(`Force既定値が一致しません: ${JSON.stringify(defaultState.sliders)}`)
  }
  if (centerMaximum.sliders['中心力'] !== '1') {
    throw new Error('中心力の変更が画面へ反映されませんでした。')
  }
  const moved = defaultState.nodes.some((node) => {
    const next = centerMaximum.nodes.find((candidate) => candidate.path === node.path)
    return next && (Math.abs(next.left - node.left) > 0.01 || Math.abs(next.top - node.top) > 0.01)
  })
  if (!moved) {
    throw new Error('中心力を変更してもノード配置が変化しませんでした。')
  }
  if (visibleMarkdownCount !== before.fileCount) {
    throw new Error(
      `グラフビューで全Markdownを表示できませんでした: ${visibleMarkdownCount}/${before.fileCount}`
    )
  }
  if (
    !vaultFit.viewport ||
    vaultFit.nodes.some(
      (node) =>
        node.screen.centerX < vaultFit.viewport.left ||
        node.screen.centerX > vaultFit.viewport.right ||
        node.screen.centerY < vaultFit.viewport.top ||
        node.screen.centerY > vaultFit.viewport.bottom
    )
  ) {
    throw new Error(`0キーでのフィット後に画面外のノードがあります: ${JSON.stringify(vaultFit)}`)
  }
  if (
    vaultFit.nodes.some(
      (node) =>
        !node.marker ||
        node.marker.width !== node.marker.height ||
        node.marker.borderRadius !== '50%'
    )
  ) {
    throw new Error(`円形ノードを確認できませんでした: ${JSON.stringify(vaultFit.nodes)}`)
  }
  if (savedSettings.graphForces?.centerForce !== 1) {
    throw new Error(`中心力が保存されませんでした: ${JSON.stringify(savedSettings)}`)
  }
  const timelineMarkdownCount = (state) =>
    state.nodes.filter((node) => markdownPaths.has(node.path)).length
  const timelineCounts = {
    start: timelineMarkdownCount(timelineStart),
    middle: timelineMarkdownCount(timelineMiddle),
    end: timelineMarkdownCount(timelineEnd)
  }
  if (timelineCounts.start !== 0) {
    throw new Error(
      `タイムラプス開始時にノートが残っています: ${JSON.stringify(timelineCounts)}`
    )
  }
  if (
    timelineCounts.middle <= timelineCounts.start ||
    timelineCounts.middle >= before.fileCount
  ) {
    throw new Error(
      `タイムラプス途中の増分表示を確認できませんでした: ${JSON.stringify(timelineCounts)}`
    )
  }
  if (
    timelineCounts.end !== before.fileCount ||
    timelineEnd.edgeCount !== vaultFit.edgeCount
  ) {
    throw new Error(
      `タイムラプス終了時に全グラフへ戻りませんでした: ${JSON.stringify({
        timelineCounts,
        expectedEdgeCount: vaultFit.edgeCount,
        actualEdgeCount: timelineEnd.edgeCount
      })}`
    )
  }
  if (
    before.fileCount !== after.fileCount ||
    before.combinedSha256 !== after.combinedSha256
  ) {
    throw new Error('Graph操作中に比較FixtureのMarkdownが変化しました。')
  }

  const result = {
    vault: 'fixtures/obsidian-graph-parity-vault',
    before,
    after,
    markdownUnchanged: true,
    forceSettingsSaved: savedSettings.graphForces,
    defaultState,
    centerMaximum,
    vaultFit,
    timeline: {
      counts: timelineCounts,
      start: timelineStart,
      middle: timelineMiddle,
      end: timelineEnd
    },
    positionsChanged: moved
  }
  await writeFile(
    resolve(outputDirectory, 'capture-result.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  )
  console.log(JSON.stringify(result, null, 2))
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
await prepare()

BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!captureStarted) {
    captureStarted = true
    void loaded
      .then(() => runCapture(this))
      .then(() => app.exit(0))
      .catch(async (error) => {
        await mkdir(outputDirectory, { recursive: true })
        await writeFile(
          resolve(outputDirectory, 'capture-error.txt'),
          String(error?.stack || error),
          'utf8'
        )
        console.error(error)
        app.exit(1)
      })
  }
  return loaded
}

await import('../out/main/index.js')
