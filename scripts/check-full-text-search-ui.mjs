import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve('docs/reports/assets/full-text-search-2026-08-18')
const userDataDirectory = resolve('work/full-text-search-ui-userdata')
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
  await delay(250)
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
      ctrlKey: ${Boolean(modifiers.ctrlKey)}, metaKey: ${Boolean(modifiers.metaKey)},
      shiftKey: ${Boolean(modifiers.shiftKey)}
    }))
    return true
  })()`)
  await delay(300)
}

async function enterSearchQuery(window, value) {
  await evaluate(window, `(() => {
    const input = document.querySelector('input[placeholder="内容を検索"]')
    if (!(input instanceof HTMLInputElement)) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)}
    }))
    return true
  })()`)
  await delay(350)
}

async function searchState(window) {
  return evaluate(window, `(() => {
    const input = document.querySelector('input[placeholder="内容を検索"]')
    const results = [...document.querySelectorAll('.search-result')]
    const first = results[0]
    const marks = [...(first?.querySelectorAll('mark.search-match') ?? [])]
    const markStyle = marks[0] ? getComputedStyle(marks[0]) : null
    return {
      leftExpanded: document.querySelector('button[aria-controls="left-sidebar-content"]')
        ?.getAttribute('aria-expanded') ?? null,
      focused: document.activeElement === input,
      query: input instanceof HTMLInputElement ? input.value : null,
      keyshortcuts: input?.getAttribute('aria-keyshortcuts') ?? null,
      help: document.querySelector('.search-help')?.textContent?.replace(/\\s+/gu, ' ').trim() ?? null,
      resultCount: results.length,
      name: first?.querySelector('strong')?.textContent?.trim() ?? null,
      path: first?.querySelector('span')?.textContent?.trim() ?? null,
      metadata: [...(first?.querySelectorAll('small') ?? [])]
        .map((element) => element.textContent?.trim() ?? ''),
      markTexts: marks.map((mark) => mark.textContent ?? ''),
      markTagNames: marks.map((mark) => mark.tagName),
      markFontWeight: markStyle?.fontWeight ?? null,
      markTextDecoration: markStyle?.textDecorationLine ?? null,
      markBackground: markStyle?.backgroundColor ?? null
    }
  })()`)
}

async function sidebarLayoutState(window) {
  return evaluate(window, `(() => {
    const toolbar = document.querySelector('.tree-toolbar')
    const tree = document.querySelector('.file-tree')
    const firstRow = tree?.querySelector('.tree-row')
    const entryToolbar = document.querySelector('.entry-toolbar')
    if (!toolbar || !tree || !firstRow || !entryToolbar) return null

    const rect = (element) => {
      const box = element.getBoundingClientRect()
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left,
        width: box.width, height: box.height }
    }
    const toolbarButtons = [...toolbar.querySelectorAll('button')].map(rect)
    const toolbarContentBottom = Math.max(rect(toolbar).bottom, ...toolbarButtons.map((box) => box.bottom))
    const treeBox = rect(tree)
    const firstRowBox = rect(firstRow)
    const entryToolbarBox = rect(entryToolbar)
    return {
      toolbar: rect(toolbar),
      toolbarButtons,
      toolbarContentBottom,
      tree: treeBox,
      firstRow: firstRowBox,
      entryToolbar: entryToolbarBox,
      treeScrollable: tree.scrollHeight > tree.clientHeight,
      toolbarOverlapsTree: toolbarContentBottom > treeBox.top + 0.5,
      toolbarOverlapsFirstRow: toolbarContentBottom > firstRowBox.top + 0.5,
      treeOverlapsEntryToolbar: treeBox.bottom > entryToolbarBox.top + 0.5
    }
  })()`)
}

async function runCheck(window) {
  window.setSkipTaskbar(true)
  window.setSize(1265, 792, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, '.workspace')

  const digestBefore = await markdownDigest(vault)
  await evaluate(window, `(() => {
    const button = document.querySelector('button[aria-controls="left-sidebar-content"]')
    if (button?.getAttribute('aria-expanded') === 'false') button.click()
    const tree = document.querySelector('.file-tree')
    if (!tree) return false
    for (let index = 0; index < 48; index += 1) {
      const row = document.createElement('div')
      row.className = 'tree-row tree-note layout-fixture-row'
      row.setAttribute('aria-hidden', 'true')
      row.textContent = \`Layout fixture \${index + 1}\`
      tree.append(row)
    }
    return true
  })()`)
  await delay(250)
  const layout = await sidebarLayoutState(window)
  assertState(layout, '左サイドバーのlayout要素を取得できません', layout)
  assertState(
    layout.treeScrollable && !layout.toolbarOverlapsTree &&
      !layout.toolbarOverlapsFirstRow && !layout.treeOverlapsEntryToolbar,
    '大量行で左サイドバーの操作・ツリー・下部操作が重なります', layout
  )
  const layoutImage = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, '00-sidebar-layout.png'), layoutImage.toPNG())

  await evaluate(window, `(() => {
    const button = document.querySelector('button[aria-controls="left-sidebar-content"]')
    if (button?.getAttribute('aria-expanded') === 'true') button.click()
    document.querySelector('.note-editor textarea')?.focus()
    return button?.getAttribute('aria-expanded')
  })()`)
  await delay(250)

  const closed = await searchState(window)
  assertState(closed.leftExpanded === 'false', '受入前に左サイドバーを閉じられません', closed)

  await dispatchShortcut(window, 'f', { ctrlKey: true, shiftKey: true })
  const opened = await searchState(window)
  assertState(
    opened.leftExpanded === 'true' && opened.focused &&
      opened.keyshortcuts === 'Control+Shift+F Meta+Shift+F Control+K Meta+K',
    'Ctrl+Shift+Fで内容検索を開いてfocusできません', opened
  )
  assertState(
    opened.help === '条件: tag: / path: / file: 除外: -語 語句: "複数語"',
    '検索operatorヘルプが正しくありません', opened
  )

  const query = '"Project Alpha" tag:#project/active -nonexistent'
  await enterSearchQuery(window, query)
  await waitFor(window, '.search-result mark.search-match')
  const searched = await searchState(window)
  assertState(
    searched.query === query && searched.resultCount === 1 &&
      searched.name === 'Project Alpha' && searched.path === '10_projects/Project Alpha.md' &&
      searched.metadata.some((value) => value.startsWith('最終更新:')) &&
      searched.metadata.some((value) => value.includes('Project Alpha')),
    '演算子付き検索の結果表示が不完全です', searched
  )
  assertState(
    JSON.stringify(searched.markTexts) === JSON.stringify(['Project Alpha']) &&
      searched.markTagNames.every((tagName) => tagName === 'MARK') &&
      Number(searched.markFontWeight) >= 700 && searched.markTextDecoration.includes('underline'),
    '肯定フレーズを意味的かつ非色依存で強調できません', searched
  )

  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, '01-full-text-search.png'), image.toPNG())

  const digestAfter = await markdownDigest(vault)
  const result = {
    result: 'pass',
    isolatedVault: vault,
    isolatedUserData: userDataDirectory,
    query,
    digestBefore,
    digestAfter,
    markdownDigestUnchanged: digestBefore === digestAfter,
    layout,
    closed,
    opened,
    searched
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
await writeFile(
  resolve(userDataDirectory, 'settings.json'),
  JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2),
  'utf8'
)

BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!checkStarted) {
    checkStarted = true
    void loaded
      .then(() => runCheck(this))
      .then(() => app.exit(0))
      .catch(async (error) => {
        await writeFile(resolve(outputDirectory, 'capture-error.txt'), String(error?.stack || error), 'utf8')
        console.error(error)
        app.exit(1)
      })
  }
  return loaded
}

await import('../out/main/index.js')
