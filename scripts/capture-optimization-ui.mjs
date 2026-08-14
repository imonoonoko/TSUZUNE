import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve('docs/reports/assets/optimization-2026-08-03')
const userDataDirectory = resolve('work/optimization-ui-userdata')
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
        (candidate) => candidate.textContent.trim() === ${JSON.stringify(label)}
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
  window.setSkipTaskbar(true)
  window.setSize(1440, 900, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, '.app-shell')

  const state = await evaluate(
    window,
    `(() => ({
      title: document.title,
      brand: document.querySelector('.brand-copy strong')?.textContent ?? null,
      brandMark: Boolean(document.querySelector('.brand-mark')),
      iconCount: document.querySelectorAll('.ui-icon').length,
      selectedNote: document.querySelector('.note-header strong')?.textContent ?? null,
      viewport: { width: innerWidth, height: innerHeight }
    }))()`
  )
  if (state.brand !== 'TSUZUNE' || !state.brandMark || state.iconCount < 8) {
    throw new Error(`ブランドUIを確認できませんでした: ${JSON.stringify(state)}`)
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
    moveDialog.title !== 'ノートを移動' ||
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

  const result = { ...state, moveDialog, previewImageReady }
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
