import { createHash } from 'node:crypto'
import { app, BrowserWindow } from 'electron'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const vault = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve(
  repoRoot,
  'docs/reports/assets/shell-settings-2026-08-27'
)
const userDataDirectory = resolve(repoRoot, `work/shell-settings-ui-${process.pid}`)
const originalLoadFile = BrowserWindow.prototype.loadFile
let checkStarted = false

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

function assert(condition, message, state = null) {
  if (!condition) {
    throw new Error(`${message}${state ? `: ${JSON.stringify(state)}` : ''}`)
  }
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitFor(window, expression) {
  await evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000
      const timer = setInterval(() => {
        if (${expression}) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() > deadline) {
          clearInterval(timer)
          reject(new Error(${JSON.stringify(`待機条件を満たせませんでした: ${expression}`)}))
        }
      }, 100)
    })`
  )
  await delay(250)
}

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
    hash.update(relative(root, path).replaceAll('\\', '/')).update('\0')
    hash.update(await readFile(path)).update('\0')
  }
  return { fileCount: paths.length, sha256: hash.digest('hex') }
}

async function capture(window, name) {
  const image = await window.webContents.capturePage()
  const path = resolve(outputDirectory, name)
  await writeFile(path, image.toPNG())
  return relative(repoRoot, path).replaceAll('\\', '/')
}

async function setWindowSize(window, width, height) {
  window.setMinimumSize(0, 0)
  window.setSize(width, height, false)
  await delay(350)
}

async function inspectWorkspace(window, label) {
  const state = await evaluate(
    window,
    `(() => {
      const rect = (element) => {
        if (!element) return null
        const bounds = element.getBoundingClientRect()
        return {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        }
      }
      const footer = document.querySelector('.activity-rail-footer')
      return {
        viewport: { width: innerWidth, height: innerHeight },
        hasLegacyHeader: Boolean(document.querySelector('.app-header')),
        documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        workspace: rect(document.querySelector('.workspace')),
        rail: rect(document.querySelector('.activity-rail')),
        railFooter: rect(footer),
        appActions: [...(footer?.querySelectorAll('button') ?? [])]
          .map((button) => button.getAttribute('aria-label')),
        visibleFooterButtons: [...(footer?.querySelectorAll('button') ?? [])]
          .filter((button) => {
            const bounds = button.getBoundingClientRect()
            return bounds.width > 0 && bounds.height > 0 && bounds.bottom <= innerHeight
          })
          .map((button) => button.getAttribute('aria-label'))
      }
    })()`
  )

  const expected = ['Google / 同期', '設定']
  assert(!state.hasLegacyHeader, `${label}: 旧上部ヘッダーが残っています`, state)
  assert(!state.documentOverflowX, `${label}: 画面全体に横スクロールがあります`, state)
  assert(state.workspace && state.workspace.bottom <= state.viewport.height + 1, `${label}: workspaceが画面外です`, state)
  assert(state.rail && state.rail.bottom <= state.viewport.height + 1, `${label}: Activity Railが画面外です`, state)
  assert(state.railFooter && state.railFooter.bottom <= state.viewport.height + 1, `${label}: アプリ操作が画面外です`, state)
  assert(
    expected.every((name) => state.appActions.includes(name)),
    `${label}: Activity Railのアプリ操作が不足しています`,
    state
  )
  assert(
    state.appActions.some((name) => name?.startsWith('Vaultを切り替える:')),
    `${label}: Vault切替がActivity Railにありません`,
    state
  )
  assert(
    state.appActions.every((name) => state.visibleFooterButtons.includes(name)),
    `${label}: Activity Rail下部に見えない操作があります`,
    state
  )
  return state
}

async function openSettings(window, categoryLabel) {
  const opened = await evaluate(
    window,
    `(() => {
      const button = document.querySelector('.activity-rail-footer button[aria-label="設定"]')
      if (!button) return false
      button.focus()
      button.click()
      return true
    })()`
  )
  assert(opened, '設定ボタンを開けませんでした')
  await waitFor(window, `document.querySelector('.app-settings-modal') !== null`)

  if (categoryLabel !== 'ファイルとリンク') {
    const changed = await evaluate(
      window,
      `(() => {
        const button = [...document.querySelectorAll('.app-settings-navigation button')]
          .find((candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(categoryLabel)})
        if (!button) return false
        button.click()
        return true
      })()`
    )
    assert(changed, `設定カテゴリ「${categoryLabel}」を選べませんでした`)
    await delay(150)
  }
}

async function inspectSettings(window, label, categoryLabel) {
  const state = await evaluate(
    window,
    `(() => {
      const rect = (element) => {
        if (!element) return null
        const bounds = element.getBoundingClientRect()
        return {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        }
      }
      const dialog = document.querySelector('.app-settings-modal')
      const footer = document.querySelector('.app-settings-actions')
      const content = document.querySelector('.app-settings-content')
      const navigation = document.querySelector('.app-settings-navigation')
      const textarea = document.querySelector('.app-settings-content textarea')
      const selected = document.querySelector('.app-settings-navigation button[aria-current="page"]')
      return {
        viewport: { width: innerWidth, height: innerHeight },
        dialog: rect(dialog),
        footer: rect(footer),
        selectedCategory: selected?.getAttribute('aria-label') ?? null,
        navigationDirection: navigation ? getComputedStyle(navigation).flexDirection : null,
        dialogOverflowX: dialog ? dialog.scrollWidth > dialog.clientWidth : null,
        contentOverflowX: content ? content.scrollWidth > content.clientWidth : null,
        dialogBackground: dialog ? getComputedStyle(dialog).backgroundColor : null,
        contentBackground: content ? getComputedStyle(content).backgroundColor : null,
        textareaBackground: textarea ? getComputedStyle(textarea).backgroundColor : null,
        saveVisible: (() => {
          const button = [...(footer?.querySelectorAll('button') ?? [])]
            .find((candidate) => candidate.textContent.trim() === '設定を保存')
          const bounds = button?.getBoundingClientRect()
          return Boolean(bounds && bounds.width > 0 && bounds.height > 0 && bounds.bottom <= innerHeight)
        })()
      }
    })()`
  )

  const withinViewport = (bounds) => Boolean(
    bounds && bounds.left >= -1 && bounds.top >= -1 &&
      bounds.right <= state.viewport.width + 1 && bounds.bottom <= state.viewport.height + 1
  )
  assert(withinViewport(state.dialog), `${label}: 設定ダイアログが画面外です`, state)
  assert(withinViewport(state.footer), `${label}: 設定の固定操作部が画面外です`, state)
  assert(state.selectedCategory === categoryLabel, `${label}: 設定カテゴリの選択状態が不正です`, state)
  assert(!state.dialogOverflowX && !state.contentOverflowX, `${label}: 設定に横スクロールがあります`, state)
  assert(state.saveVisible, `${label}: 設定を保存ボタンが見えません`, state)
  assert(state.dialogBackground !== 'rgb(255, 255, 255)', `${label}: 設定が白背景です`, state)
  assert(state.contentBackground !== 'rgb(255, 255, 255)', `${label}: 設定内容が白背景です`, state)
  assert(state.textareaBackground !== 'rgb(255, 255, 255)', `${label}: 設定入力が白背景です`, state)
  return state
}

async function verifySettingsDraftFeedback(window, label) {
  window.focus()
  window.webContents.focus()
  await delay(50)
  let focusedTextarea = false
  for (let index = 0; index < 12 && !focusedTextarea; index += 1) {
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'TAB' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'TAB' })
    await delay(25)
    focusedTextarea = await evaluate(
      window,
      `document.activeElement?.matches('.app-settings-content textarea') ?? false`
    )
  }
  const result = await evaluate(
    window,
    `(async () => {
      const textarea = document.querySelector('.app-settings-content textarea')
      if (!textarea) return { supported: false }

      const focusedStyle = getComputedStyle(textarea)
      const focusVisible = focusedStyle.outlineStyle !== 'none' &&
        Number.parseFloat(focusedStyle.outlineWidth) > 0
      const originalValue = textarea.value
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set
      if (!valueSetter) return { supported: true, focusVisible, draftChanged: false, restored: false }

      valueSetter.call(textarea, originalValue + '\\n__tsuzune_ux_probe__')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 100))
      const draftChanged = document.querySelector('.app-settings-feedback')?.textContent
        ?.includes('未保存の変更') ?? false

      valueSetter.call(textarea, originalValue)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 100))
      return {
        supported: true,
        documentFocused: document.hasFocus(),
        focused: document.activeElement === textarea,
        matchesFocus: textarea.matches(':focus'),
        focusVisible,
        matchesFocusVisible: textarea.matches(':focus-visible'),
        outlineStyle: focusedStyle.outlineStyle,
        outlineWidth: focusedStyle.outlineWidth,
        draftChanged,
        restored: textarea.value === originalValue &&
          !document.querySelector('.app-settings-feedback')
      }
    })()`
  )
  if (result.supported) {
    assert(result.focused, `${label}: 設定入力へTabで移動できません`, result)
    assert(result.focusVisible, `${label}: 設定入力のkeyboard focusが見えません`, result)
    assert(result.draftChanged, `${label}: 未保存の変更が表示されません`, result)
    assert(result.restored, `${label}: 検証用draftを元に戻せませんでした`, result)
  }
  return result
}

async function verifyKeyboardBoundary(window) {
  const result = await evaluate(
    window,
    `(async () => {
      const dialog = document.querySelector('.app-settings-modal')
      const close = dialog?.querySelector('button[aria-label="設定を閉じる"]')
      const save = [...(dialog?.querySelectorAll('button') ?? [])]
        .find((button) => button.textContent.trim() === '設定を保存')
      if (!dialog || !close || !save) return { ready: false }

      close.focus()
      close.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab', shiftKey: true, bubbles: true, cancelable: true
      }))
      const shiftTabWrapped = document.activeElement === save

      save.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab', bubbles: true, cancelable: true
      }))
      const tabWrapped = document.activeElement === close

      dialog.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true
      }))
      await new Promise((resolve) => setTimeout(resolve, 0))
      return {
        ready: true,
        shiftTabWrapped,
        tabWrapped,
        closed: !document.querySelector('.app-settings-modal'),
        focusRestored: document.activeElement?.getAttribute('aria-label') === '設定'
      }
    })()`
  )
  assert(
    result.ready && result.shiftTabWrapped && result.tabWrapped && result.closed && result.focusRestored,
    '設定ダイアログのキーボード境界が不正です',
    result
  )
  return result
}

async function runCheck(window) {
  window.setSkipTaskbar(true)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, `document.querySelector('.workspace') !== null`)

  const before = await markdownDigest(vault)
  const scenarios = []
  const definitions = [
    { width: 1440, height: 900, category: 'ファイルとリンク' },
    { width: 900, height: 768, category: 'テンプレート' },
    { width: 720, height: 768, category: 'AIとレビュー' }
  ]

  for (const definition of definitions) {
    const label = `${definition.width}px`
    await setWindowSize(window, definition.width, definition.height)
    const workspace = await inspectWorkspace(window, label)
    const workspaceImage = await capture(window, `${definition.width}-workspace.png`)
    await openSettings(window, definition.category)
    const settings = await inspectSettings(window, label, definition.category)
    const draftFeedback = await verifySettingsDraftFeedback(window, label)
    const settingsImage = await capture(window, `${definition.width}-settings.png`)
    const keyboard = await verifyKeyboardBoundary(window)
    scenarios.push({
      ...definition,
      workspace,
      settings,
      draftFeedback,
      keyboard,
      screenshots: [workspaceImage, settingsImage]
    })
  }

  const after = await markdownDigest(vault)
  const result = {
    checkedAt: new Date().toISOString(),
    isolatedVault: vault,
    isolatedUserData: userDataDirectory,
    fixture: { before, after, unchanged: before.sha256 === after.sha256 },
    scenarios,
    overall: before.sha256 === after.sha256 ? 'PASS' : 'FAIL'
  }
  assert(result.overall === 'PASS', '隔離VaultのMarkdownが変化しました', result.fixture)
  await rm(resolve(outputDirectory, 'error.txt'), { force: true })
  await writeFile(
    resolve(outputDirectory, 'result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify(result, null, 2))
}

async function prepare() {
  await Promise.all([
    mkdir(userDataDirectory, { recursive: true }),
    mkdir(outputDirectory, { recursive: true })
  ])
  app.setPath('userData', userDataDirectory)
  await writeFile(
    resolve(userDataDirectory, 'settings.json'),
    `${JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2)}\n`,
    'utf8'
  )
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
await prepare()

BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!checkStarted) {
    checkStarted = true
    void loaded
      .then(() => runCheck(this))
      .then(() => app.exit(0))
      .catch(async (error) => {
        await writeFile(
          resolve(outputDirectory, 'error.txt'),
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
