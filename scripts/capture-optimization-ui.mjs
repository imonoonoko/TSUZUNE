import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve(
  process.env.TSUZUNE_CAPTURE_OUTPUT ?? 'docs/reports/assets/optimization-2026-08-03'
)
const userDataDirectory = resolve('work/optimization-ui-userdata')
const captureNightWorkshop = process.env.TSUZUNE_CAPTURE_NIGHT === '1'
const originalLoadFile = BrowserWindow.prototype.loadFile
let captureStarted = false

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitFor(window, selector) {
  await evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000
      const timer = setInterval(() => {
        if (document.querySelector(${JSON.stringify(selector)})) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() > deadline) {
          clearInterval(timer)
          reject(new Error(${JSON.stringify(`${selector}を待機できませんでした。`)}))
        }
      }, 100)
    })`
  )
  await delay(300)
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
  await delay(350)
}

async function capture(window, name) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, name), image.toPNG())
}

async function prepare() {
  await mkdir(userDataDirectory, { recursive: true })
  await mkdir(outputDirectory, { recursive: true })
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

async function runCapture(window) {
  let outline = null
  let compactLayout = null
  let narrowLayout = null
  window.setSkipTaskbar(true)
  window.setSize(1440, 900, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, '.app-shell')

  const state = await evaluate(
    window,
    `(() => ({
      title: document.title,
      legacyHeader: Boolean(document.querySelector('.app-header')),
      iconCount: document.querySelectorAll('.ui-icon').length,
      selectedNote: document.querySelector('.note-header strong')?.textContent ?? null,
      railActions: [...document.querySelectorAll('.activity-rail-button')]
        .map((button) => button.getAttribute('aria-label')),
      appActions: [...document.querySelectorAll('.activity-rail-footer button')]
        .map((button) => button.getAttribute('aria-label')),
      railFooterVisible: (() => {
        const footer = document.querySelector('.activity-rail-footer')
        const bounds = footer?.getBoundingClientRect()
        return Boolean(bounds && bounds.bottom <= innerHeight)
      })(),
      duplicateToolbar: Boolean(document.querySelector('.tree-toolbar')),
      searchHiddenInFileView: !document.querySelector('input[placeholder="内容を検索"]'),
      viewport: { width: innerWidth, height: innerHeight }
    }))()`
  )
  const expectedRailActions = [
    'ファイル',
    '内容を検索',
    'ノートを開く',
    '新規ノート',
    '新規フォルダ',
    '今日のノート',
    'アイデアを追加',
    'グラフビュー',
    'ブックマーク',
    '操作'
  ]
  const expectedAppActions = ['Google / 同期', '設定']
  if (
    state.legacyHeader || state.iconCount < 8 ||
    expectedRailActions.some((label) => !state.railActions.includes(label)) ||
    expectedAppActions.some((label) => !state.appActions.includes(label)) ||
    !state.appActions.some((label) => label?.startsWith('Vaultを切り替える:')) ||
    !state.railFooterVisible || state.duplicateToolbar || !state.searchHiddenInFileView
  ) {
    throw new Error(`workspace shellを確認できませんでした: ${JSON.stringify(state)}`)
  }
  await capture(window, '01-editor-shell.png')

  await clickButton(window, '移動')
  await waitFor(window, '[role="dialog"][aria-modal="true"]')
  const moveDialog = await evaluate(
    window,
    `(() => ({
      title: document.querySelector('[role="dialog"] h2')?.textContent ?? null,
      focused: document.activeElement?.tagName ?? null,
      backgroundInert: Boolean(document.querySelector('.workspace[inert]'))
    }))()`
  )
  if (
    moveDialog.title !== 'ファイルを移動' ||
    moveDialog.focused !== 'SELECT' ||
    !moveDialog.backgroundInert
  ) {
    throw new Error(`移動ダイアログの状態が不正です: ${JSON.stringify(moveDialog)}`)
  }
  await capture(window, '02-move-dialog.png')

  await evaluate(
    window,
    `document.querySelector('[role="dialog"]')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )`
  )
  await clickButton(window, 'プレビュー')
  await waitFor(window, '.markdown-preview')
  await waitFor(window, '.markdown-preview img[data-vault-image-ready="true"]')
  const previewImageReady = await evaluate(
    window,
    `Boolean(document.querySelector('.markdown-preview img[data-vault-image-ready="true"]'))`
  )
  await capture(window, '03-preview.png')

  if (captureNightWorkshop) {
    await evaluate(window, `document.querySelector('#context-tab-outline')?.click()`)
    await waitFor(window, '.outline-item')
    outline = await evaluate(
      window,
      `(() => ({
        selected: document.querySelector('#context-tab-outline')?.getAttribute('aria-selected'),
        count: document.querySelectorAll('.outline-item').length,
        first: document.querySelector('.outline-item')?.textContent?.trim() ?? null
      }))()`
    )
    if (outline.selected !== 'true' || outline.count < 1) {
      throw new Error(`アウトラインを確認できませんでした: ${JSON.stringify(outline)}`)
    }
    await capture(window, '09-outline-preview.png')

    window.setSize(900, 768, false)
    await delay(350)
    compactLayout = await evaluate(
      window,
      `(() => ({
        viewportWidth: innerWidth,
        narrowMatches: matchMedia('(max-width: 720px)').matches,
        leftExpanded: document.querySelector('[aria-controls="left-sidebar-content"]')?.getAttribute('aria-expanded'),
        rightExpanded: document.querySelector('[aria-controls="right-sidebar-content"]')?.getAttribute('aria-expanded'),
        railFooterVisible: document.querySelector('.activity-rail-footer')
          ?.getBoundingClientRect().bottom <= innerHeight,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }))()`
    )
    if (
      compactLayout.leftExpanded !== 'true' || compactLayout.rightExpanded !== 'false' ||
      !compactLayout.railFooterVisible || compactLayout.overflow
    ) {
      throw new Error(`900pxレイアウトが不正です: ${JSON.stringify(compactLayout)}`)
    }
    await capture(window, '04-preview-900.png')

    window.setSize(720, 768, false)
    await delay(350)
    narrowLayout = await evaluate(
      window,
      `(() => ({
        viewportWidth: innerWidth,
        narrowMatches: matchMedia('(max-width: 720px)').matches,
        leftExpanded: document.querySelector('[aria-controls="left-sidebar-content"]')?.getAttribute('aria-expanded'),
        rightExpanded: document.querySelector('[aria-controls="right-sidebar-content"]')?.getAttribute('aria-expanded'),
        rail: Boolean(document.querySelector('.activity-rail')),
        railFooterVisible: document.querySelector('.activity-rail-footer')
          ?.getBoundingClientRect().bottom <= innerHeight,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }))()`
    )
    if (
      narrowLayout.leftExpanded !== 'false' || narrowLayout.rightExpanded !== 'false' ||
      !narrowLayout.rail || !narrowLayout.railFooterVisible || narrowLayout.overflow
    ) {
      throw new Error(`720pxレイアウトが不正です: ${JSON.stringify(narrowLayout)}`)
    }
    await capture(window, '05-preview-720.png')

    window.setSize(1440, 900, false)
    await delay(350)
    await clickButton(window, 'グラフビュー')
    await waitFor(window, '.wiki-graph-view')
    await capture(window, '06-vault-graph.png')

    await clickButton(window, 'ノートを開く')
    await waitFor(window, '.quick-switcher-modal')
    await capture(window, '07-quick-switcher.png')
    await evaluate(
      window,
      `document.querySelector('.quick-switcher-modal')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )`
    )
    await delay(200)

    await clickButton(window, '操作')
    await waitFor(window, '.command-palette-modal')
    await capture(window, '08-command-palette.png')
  }

  const result = { ...state, moveDialog, previewImageReady, outline, compactLayout, narrowLayout }
  await writeFile(
    resolve(outputDirectory, 'capture-result.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  )
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
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
        await writeFile(
          resolve(outputDirectory, 'capture-error.txt'),
          String(error?.stack || error),
          'utf8'
        )
        console.error(error)
        app.exit(1)
        process.exit(1)
      })
  }
  return loaded
}

await import('../out/main/index.js')
