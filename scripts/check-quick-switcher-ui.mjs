import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve('docs/reports/assets/quick-switcher-2026-08-17')
const userDataDirectory = resolve('work/quick-switcher-ui-userdata')
const originalLoadFile = BrowserWindow.prototype.loadFile
let checkStarted = false

async function markdownDigest(root) {
  const paths = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) paths.push(path)
    }
  }
  await visit(root)
  paths.sort((left, right) => relative(root, left).localeCompare(relative(root, right), 'ja'))
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(relative(root, path).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(path))
    hash.update('\0')
  }
  return { fileCount: paths.length, sha256: hash.digest('hex') }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitFor(window, selector) {
  await evaluate(window, `new Promise((resolve, reject) => {
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
  })`)
  await delay(300)
}

async function setViewportSize(window, width, height) {
  window.setSize(width, height, false)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await delay(150)
    const viewport = await evaluate(window, `({ width: innerWidth, height: innerHeight })`)
    if (viewport.width === width && viewport.height === height) return
    const [outerWidth, outerHeight] = window.getSize()
    window.setSize(
      outerWidth + width - viewport.width,
      outerHeight + height - viewport.height,
      false
    )
  }
}

function assertState(condition, message, state) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(state)}`)
}

async function dispatchShortcut(window, key, modifiers = {}) {
  await evaluate(window, `(() => {
    const target = document.activeElement || document.body
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)},
      bubbles: true,
      cancelable: true,
      ctrlKey: ${Boolean(modifiers.ctrlKey)},
      metaKey: ${Boolean(modifiers.metaKey)}
    }))
    return true
  })()`)
  await delay(350)
}

async function state(window) {
  return evaluate(window, `(() => {
    const dialog = document.querySelector('.quick-switcher-modal')
    const workspace = document.querySelector('.workspace')
    const input = dialog?.querySelector('input[role="combobox"]')
    const options = [...(dialog?.querySelectorAll('[role="option"]') ?? [])]
    const selected = options.filter((option) => option.getAttribute('aria-selected') === 'true')
    const bounds = dialog?.getBoundingClientRect()
    return {
      dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
      dialogVisible: Boolean(dialog),
      inputFocused: document.activeElement === input,
      listbox: Boolean(dialog?.querySelector('[role="listbox"]')),
      optionCount: options.length,
      selectedCount: selected.length,
      selectedText: selected[0]?.textContent?.trim() ?? null,
      query: input?.value ?? null,
      workspaceInert: Boolean(workspace?.inert),
      activeElement: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? null,
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      dialogWidth: bounds?.width ?? null,
      dialogRight: bounds?.right ?? null,
      listWidth: dialog?.querySelector('[role="listbox"]')?.getBoundingClientRect().width ?? null,
      listScrollWidth: dialog?.querySelector('[role="listbox"]')?.scrollWidth ?? null
    }
  })()`)
}

async function capture(window, filename) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, filename), image.toPNG())
}

async function runCheck(window) {
  const markdownBefore = await markdownDigest(vault)
  window.setSkipTaskbar(true)
  window.setMinimumSize(0, 0)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, '.workspace')
  await setViewportSize(window, 1440, 900)

  const openerFocused = await evaluate(window, `(() => {
    const button = document.querySelector('button[title="ノートを開く（Ctrl+O）"]')
    if (!(button instanceof HTMLButtonElement)) return false
    button.focus()
    return document.activeElement === button
  })()`)
  assertState(openerFocused, 'Quick Switcherの起点ボタンへフォーカスできません', await state(window))
  await dispatchShortcut(window, 'o', { ctrlKey: true })
  const opened = await state(window)
  assertState(
    opened.dialogCount === 1 && opened.dialogVisible && opened.inputFocused && opened.listbox &&
      opened.selectedCount === 1 && opened.workspaceInert &&
      opened.viewport.width === 1440 && opened.viewport.height === 900,
    'Ctrl+OでQuick Switcherのモーダル状態を正しく開けません',
    opened
  )
  assertState(opened.documentWidth <= opened.viewport.width, '初期表示で横overflowが発生しました', opened)
  await capture(window, '01-wide-initial.png')

  await evaluate(window, `(() => {
    const input = document.querySelector('.quick-switcher-modal input[role="combobox"]')
    if (!(input instanceof HTMLInputElement)) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, 'Project')
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Project' }))
    return true
  })()`)
  await delay(350)
  const filtered = await state(window)
  assertState(
    filtered.query === 'Project' && filtered.optionCount > 0 && filtered.selectedCount === 1 &&
      /Project/i.test(filtered.selectedText ?? ''),
    'タイトル検索で候補を絞り込めません',
    filtered
  )
  await capture(window, '02-wide-filtered.png')

  await setViewportSize(window, 720, 768)
  const narrow = await state(window)
  assertState(
    narrow.dialogVisible && narrow.viewport.width === 720 && narrow.viewport.height === 768 &&
      narrow.dialogWidth !== null && narrow.dialogRight <= narrow.viewport.width + 1 &&
      narrow.documentWidth <= narrow.viewport.width &&
      narrow.listWidth !== null && narrow.listScrollWidth !== null && narrow.listScrollWidth <= narrow.listWidth + 1,
    '狭いviewportでQuick Switcherの横overflowが発生しました',
    narrow
  )
  await capture(window, '03-narrow-filtered.png')

  await dispatchShortcut(window, 'Escape')
  const closed = await state(window)
  assertState(
    !closed.dialogVisible && !closed.workspaceInert && closed.activeElement === '開く',
    'Escapeで閉じた後に起点フォーカスを復元できません',
    closed
  )

  const markdownAfter = await markdownDigest(vault)
  assertState(
    markdownBefore.sha256 === markdownAfter.sha256,
    '表示検証中にfixture Markdownが変更されました',
    { markdownBefore, markdownAfter }
  )
  const result = {
    result: 'pass',
    isolatedVault: vault,
    markdownBefore,
    markdownAfter,
    opened,
    filtered,
    narrow,
    closed
  }
  await writeFile(resolve(outputDirectory, 'capture-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result, null, 2))
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
await mkdir(userDataDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
await rm(resolve(outputDirectory, 'capture-error.txt'), { force: true })
app.setPath('userData', userDataDirectory)
await writeFile(resolve(userDataDirectory, 'settings.json'), JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2), 'utf8')

BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!checkStarted) {
    checkStarted = true
    void loaded.then(() => runCheck(this)).then(() => app.exit(0)).catch(async (error) => {
      await writeFile(resolve(outputDirectory, 'capture-error.txt'), String(error?.stack || error), 'utf8')
      console.error(error)
      app.exit(1)
    })
  }
  return loaded
}

await import('../out/main/index.js')
