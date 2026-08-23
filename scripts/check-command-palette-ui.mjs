import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve('docs/reports/assets/command-palette-2026-08-17')
const userDataDirectory = resolve('work/command-palette-ui-userdata')
const originalLoadFile = BrowserWindow.prototype.loadFile
let checkStarted = false

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

async function markdownDigest(root) {
  const files = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(path)
    }
  }
  await visit(root)
  files.sort()
  const hash = createHash('sha256')
  for (const path of files) {
    hash.update(relative(root, path).replaceAll('\\', '/')).update('\0')
    hash.update(await readFile(path)).update('\0')
  }
  return hash.digest('hex')
}

function assertState(condition, message, state) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(state)}`)
}

async function dispatchShortcut(window, key, modifiers = {}) {
  await evaluate(window, `(() => {
    const target = document.activeElement || document.body
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)}, bubbles: true, cancelable: true,
      ctrlKey: ${Boolean(modifiers.ctrlKey)}, metaKey: ${Boolean(modifiers.metaKey)}
    }))
    return true
  })()`)
  await delay(350)
}

async function paletteState(window) {
  return evaluate(window, `(() => {
    const dialog = document.querySelector('.command-palette-modal')
    const input = dialog?.querySelector('input[role="combobox"]')
    const options = [...(dialog?.querySelectorAll('[role="option"]') ?? [])]
    const selected = options.filter((option) => option.getAttribute('aria-selected') === 'true')
    const workspace = document.querySelector('.workspace')
    const bounds = dialog?.getBoundingClientRect()
    const list = dialog?.querySelector('[role="listbox"]')
    return {
      dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
      visible: Boolean(dialog), focused: document.activeElement === input,
      optionCount: options.length, selectedCount: selected.length,
      selectedId: selected[0]?.getAttribute('data-command-id') ?? null,
      labels: options.map((option) => option.querySelector('.command-palette-option-label')?.textContent?.trim() ?? ''),
      activeText: selected[0]?.textContent?.trim() ?? null,
      disabledCount: options.filter((option) => option.getAttribute('aria-disabled') === 'true').length,
      shortcutVisible: Boolean(dialog?.querySelector('.command-palette-option-shortcut')),
      stateVisible: Boolean(dialog?.querySelector('.command-palette-option-state')),
      query: input?.value ?? null,
      inert: Boolean(workspace?.inert),
      activeElement: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? null,
      viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
      dialogRight: bounds?.right ?? null, listWidth: list?.getBoundingClientRect().width ?? null,
      listScrollWidth: list?.scrollWidth ?? null
    }
  })()`)
}

async function capture(window, filename) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, filename), image.toPNG())
}

async function focusPaletteButton(window, selector = 'button[title="操作を実行（Ctrl+P）"]') {
  return evaluate(window, `(() => {
    const button = document.querySelector(${JSON.stringify(selector)})
    if (!(button instanceof HTMLButtonElement)) return false
    button.focus()
    return document.activeElement === button
  })()`)
}

async function enterQuery(window, value) {
  await evaluate(window, `(() => {
    const input = document.querySelector('.command-palette-modal input[role="combobox"]')
    if (!(input instanceof HTMLInputElement)) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }))
    return true
  })()`)
  await delay(350)
}

async function runCheck(window) {
  window.setSkipTaskbar(true)
  window.setSize(1440, 900, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, '.workspace')

  const digestBefore = await markdownDigest(vault)
  assertState(await focusPaletteButton(window), 'Command Palette起点ボタンへfocusできません', await paletteState(window))
  await dispatchShortcut(window, 'p', { ctrlKey: true })
  const opened = await paletteState(window)
  assertState(
    opened.dialogCount === 1 && opened.visible && opened.focused && opened.optionCount === 12 &&
      opened.selectedCount === 1 && opened.inert && opened.shortcutVisible && opened.stateVisible,
    'Ctrl+Pの初期Command Palette状態が正しくありません', opened
  )
  assertState(opened.documentWidth <= opened.viewport.width, '初期表示で横overflowが発生しました', opened)
  await capture(window, '01-wide-initial.png')

  await enterQuery(window, 'sidebar')
  const filtered = await paletteState(window)
  assertState(
    filtered.query === 'sidebar' && filtered.optionCount === 2 && filtered.selectedCount === 1 &&
      filtered.selectedId === 'toggle-left-sidebar' && filtered.labels.every((label) => label.includes('サイドバー')),
    'sidebar検索で候補を正しく絞り込めません', filtered
  )
  await capture(window, '02-wide-sidebar-filtered.png')

  await dispatchShortcut(window, 'Enter')
  const toggled = await evaluate(window, `(() => ({
    dialogVisible: Boolean(document.querySelector('.command-palette-modal')),
    inert: Boolean(document.querySelector('.workspace')?.inert),
    leftExpanded: document.querySelector('button[aria-controls="left-sidebar-content"]')?.getAttribute('aria-expanded') ?? null
  }))()`)
  assertState(!toggled.dialogVisible && !toggled.inert && toggled.leftExpanded === 'false', 'Enterで左sidebarを閉じられません', toggled)

  assertState(await focusPaletteButton(window, 'button[aria-controls="left-sidebar-content"]'), '再open前の起点focusを設定できません', toggled)
  await dispatchShortcut(window, 'p', { ctrlKey: true })
  const reopened = await paletteState(window)
  assertState(reopened.visible && reopened.inert, 'Command Paletteを再openできません', reopened)
  await dispatchShortcut(window, 'Escape')
  const escaped = await paletteState(window)
  assertState(!escaped.visible && !escaped.inert && escaped.activeElement === '左サイドバーを開く', 'Escape後に起点focusを復元できません', escaped)

  window.setSize(760, 768, false)
  await delay(300)
  assertState(await focusPaletteButton(window, 'button[aria-controls="left-sidebar-content"]'), '狭いviewportで起点focusを設定できません', escaped)
  await dispatchShortcut(window, 'p', { ctrlKey: true })
  await enterQuery(window, 'sidebar')
  const narrow = await paletteState(window)
  assertState(
    narrow.visible && narrow.dialogRight <= narrow.viewport.width + 1 && narrow.documentWidth <= narrow.viewport.width &&
      narrow.listWidth !== null && narrow.listScrollWidth !== null && narrow.listScrollWidth <= narrow.listWidth + 1,
    '狭いviewportでCommand Paletteの横overflowが発生しました', narrow
  )
  await capture(window, '03-narrow-sidebar-filtered.png')
  await dispatchShortcut(window, 'Escape')

  const digestAfter = await markdownDigest(vault)
  const result = {
    result: 'pass', isolatedVault: vault, windowSizeTargets: ['1440x900', '760x768 (main-window minimum)'],
    digestBefore, digestAfter, markdownDigestUnchanged: digestBefore === digestAfter,
    opened, filtered, toggled, reopened, escaped, narrow,
    disabled: { status: 'not-tested', reason: 'fixture starts with a selected note, so no disabled command is safely exposed in the production palette flow' }
  }
  assertState(result.markdownDigestUnchanged, 'fixture Markdown digestが変化しました', result)
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
