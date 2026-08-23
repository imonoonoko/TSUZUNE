import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { cp, mkdir, open, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const a5Only = process.argv.includes('--a5-only')
const r5Only = process.argv.includes('--r5-only')
const phaseBSurrogate = process.argv.includes('--phase-b-surrogate')
const sourceFixture = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const workRoot = resolve(repoRoot, `work/daily-workspace-phase-a-${process.pid}`)
const vault = resolve(workRoot, 'vault')
const userData = resolve(workRoot, 'userdata')
const output = resolve(repoRoot, phaseBSurrogate
  ? 'docs/reports/assets/daily-workspace-phase-b-2026-08-22'
  : r5Only
  ? 'docs/reports/assets/workspace-tabs-r5-2026-08-22'
  : a5Only
    ? 'docs/reports/assets/daily-workspace-phase-a5-rerun-2026-08-22'
    : 'docs/reports/assets/daily-workspace-phase-a-2026-08-22')
const executable = resolve(process.env.LOCALAPPDATA, 'Programs/tsuzune/TSUZUNE.exe')
const settingsPath = resolve(userData, 'settings.json')
const stdoutPath = resolve(workRoot, 'stdout.log')
const stderrPath = resolve(workRoot, 'stderr.log')
const longNoteRelative = `${'日'.repeat(117)}.md`
const longNotePath = resolve(vault, longNoteRelative)
const homePath = resolve(vault, '00_Home.md')
const phaseResultPath = resolve(output, phaseBSurrogate
  ? 'phase-b-surrogate-result.json'
  : r5Only ? 'r5-result.json' : a5Only ? 'a5-result.json' : 'phase-a-result.json')

const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

async function rmWithRetry(path) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true })
      return
    } catch (error) {
      if (attempt === 29 || !['EBUSY', 'EPERM'].includes(error?.code)) throw error
      await wait(250)
    }
  }
}

function assertWithin(parent, child) {
  if (child !== parent && !child.startsWith(`${parent}${sep}`)) {
    throw new Error(`対象外pathです: ${child}`)
  }
}

function assert(condition, message, state = null) {
  if (!condition) throw new Error(`${message}${state ? `: ${JSON.stringify(state)}` : ''}`)
}

async function freePort() {
  return new Promise((done, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => error ? reject(error) : done(address.port))
    })
  })
}

async function waitForTarget(port, predicate, timeout = 20_000) {
  const deadline = Date.now() + timeout
  let last = []
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      last = targets.map(({ type, title, url }) => ({ type, title, url }))
      const target = targets.find(predicate)
      if (target) return target
    } catch {
      // The endpoint is not ready yet.
    }
    await wait(100)
  }
  throw new Error(`CDP target timeout: ${JSON.stringify(last)}`)
}

async function connect(target, page = true) {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let id = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const operation = pending.get(message.id)
    if (!operation) return
    pending.delete(message.id)
    clearTimeout(operation.timer)
    if (message.error) operation.reject(new Error(JSON.stringify(message.error)))
    else operation.resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((done, reject) => {
    const operationId = id++
    const timer = setTimeout(() => {
      pending.delete(operationId)
      reject(new Error(`CDP timeout: ${method}`))
    }, 15_000)
    pending.set(operationId, { resolve: done, reject, timer })
    socket.send(JSON.stringify({ id: operationId, method, params }))
  })
  const evaluate = async (expression) => {
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
  if (page) await send('Page.enable')
  return { socket, send, evaluate }
}

async function waitFor(cdp, expression, timeout = 15_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await cdp.evaluate(expression)) return
    await wait(100)
  }
  throw new Error(`Renderer wait timeout: ${expression}`)
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
  files.sort((left, right) => relative(root, left).localeCompare(relative(root, right), 'ja'))
  const hash = createHash('sha256')
  for (const path of files) {
    hash.update(relative(root, path).replaceAll('\\', '/')).update('\0')
    hash.update(await readFile(path)).update('\0')
  }
  return { fileCount: files.length, sha256: hash.digest('hex') }
}

async function fileDigest(path) {
  const details = await stat(path)
  return {
    bytes: details.size,
    sha256: createHash('sha256').update(await readFile(path)).digest('hex')
  }
}

async function capture(cdp, name) {
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  })
  const path = resolve(output, name)
  await writeFile(path, Buffer.from(screenshot.data, 'base64'))
  return relative(repoRoot, path).replaceAll('\\', '/')
}

async function captureWindow(mainCdp, name) {
  const data = await mainCdp.evaluate(`(async () => {
    const loadElectron = typeof require === 'function'
      ? require
      : process.getBuiltinModule('module').createRequire(process.execPath)
    const { BrowserWindow } = loadElectron('electron')
    const target = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'TSUZUNE')
    if (!target) throw new Error('TSUZUNE window not found')
    return (await target.capturePage()).toPNG().toString('base64')
  })()`)
  const path = resolve(output, name)
  await writeFile(path, Buffer.from(data, 'base64'))
  return relative(repoRoot, path).replaceAll('\\', '/')
}

async function setViewport(appCdp, mainCdp, width, height, deviceScaleFactor = 1) {
  const native = await mainCdp.evaluate(`(() => {
    const loadElectron = typeof require === 'function'
      ? require
      : process.getBuiltinModule('module').createRequire(process.execPath)
    const { BrowserWindow } = loadElectron('electron')
    const target = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'TSUZUNE')
    if (!target) throw new Error('TSUZUNE window not found')
    target.setSkipTaskbar(true)
    target.setMinimumSize(0, 0)
    target.setPosition(-32000, -32000, false)
    target.setBounds({ x: -32000, y: -32000, width: ${width}, height: ${height} }, false)
    return { visible: target.isVisible(), bounds: target.getBounds(), content: target.getContentBounds() }
  })()`)
  await appCdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor, mobile: false
  })
  await wait(250)
  const viewport = await appCdp.evaluate(`({ width: innerWidth, height: innerHeight, devicePixelRatio })`)
  return { ...native, viewport }
}

async function scenarioPhaseBSurrogate(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 720, 768, 2)
  await setSidebars(appCdp, true, true)

  await appCdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' })
  await appCdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' })
  const primary = await appCdp.evaluate(`(() => {
    const button = document.querySelector('.note-empty .primary-button')
    button?.focus()
    const box = button?.getBoundingClientRect()
    const style = button ? getComputedStyle(button) : null
    return {
      text: button?.textContent.trim() ?? null,
      focused: document.activeElement === button,
      focusVisible: button?.matches(':focus-visible') ?? false,
      outline: style ? { style: style.outlineStyle, width: style.outlineWidth } : null,
      withinViewport: Boolean(box && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight)
    }
  })()`)

  await press(appCdp, 'p', { ctrlKey: true })
  const disabled = await appCdp.evaluate(`(() => {
    const items = [...document.querySelectorAll('.command-palette-option[aria-disabled="true"]')]
    return items.map((item) => ({
      label: item.querySelector('.command-palette-option-label')?.textContent.trim() ?? null,
      reason: item.querySelector('.command-palette-option-disabled')?.textContent.trim() ?? null,
      ariaDisabled: item.getAttribute('aria-disabled')
    }))
  })()`)
  await press(appCdp, 'Escape')

  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === '00_Home.md')
    if (!row) throw new Error('Home tree row not found')
    row.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.note-header span')?.textContent === '00_Home.md'`)

  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === '00_Home.md')
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 220 }))
  })()`)
  await waitFor(appCdp, `document.querySelector('.file-tree-context-menu') !== null`)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.file-tree-context-menu button')].find((item) => item.textContent.trim() === '新しいタブで開く')
    if (!button) throw new Error('open-in-new-tab action not found')
    button.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.workspace-tabs [role="tab"][aria-selected="true"]') !== null`)

  const layout = await layoutState(appCdp)
  const current = await appCdp.evaluate(`(() => ({
    forcedColors: matchMedia('(forced-colors: active)').matches,
    devicePixelRatio,
    selectedTabs: [...document.querySelectorAll('.workspace-tabs [role="tab"][aria-selected="true"]')].length
  }))()`)

  await press(appCdp, 'o', { ctrlKey: true })
  const quickSwitcher = await appCdp.evaluate(`(() => {
    const dialog = document.querySelector('.quick-switcher-modal')
    const input = dialog?.querySelector('input[role="combobox"]')
    const selected = dialog?.querySelector('[role="option"][aria-selected="true"]')
    const box = dialog?.getBoundingClientRect()
    const style = selected ? getComputedStyle(selected) : null
    return {
      inputFocused: document.activeElement === input,
      selectedSemantics: selected?.getAttribute('aria-selected') ?? null,
      selectedOutline: style ? { style: style.outlineStyle, width: style.outlineWidth } : null,
      withinViewport: Boolean(box && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight)
    }
  })()`)
  await press(appCdp, 'Escape')

  await appCdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' })
  await appCdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' })
  const focus = await appCdp.evaluate(`(() => {
    const button = document.querySelector('button[aria-controls="left-sidebar-content"]')
    button?.focus()
    const style = button ? getComputedStyle(button) : null
    return {
      label: button?.getAttribute('aria-label') ?? null,
      focused: document.activeElement === button,
      focusVisible: button?.matches(':focus-visible') ?? false,
      outline: style ? { style: style.outlineStyle, width: style.outlineWidth } : null
    }
  })()`)

  const screenshot = await capture(appCdp, 'b3-b4-surrogate.png')

  const pass = current.forcedColors && current.devicePixelRatio === 2 && current.selectedTabs === 1 &&
    layout.documentWidth <= layout.viewport.width && layout.bodyWidth <= layout.viewport.width && layout.allControlsReachable &&
    quickSwitcher.inputFocused && quickSwitcher.selectedSemantics === 'true' && quickSwitcher.selectedOutline?.width === '2px' && quickSwitcher.withinViewport &&
    focus.focused && focus.focusVisible && focus.outline?.width &&
    primary.text && primary.focused && primary.focusVisible && primary.outline?.width && primary.withinViewport &&
    disabled.length > 0 && disabled.every((item) => item.ariaDisabled === 'true' && item.reason?.startsWith('利用不可:'))
  return {
    id: 'B3-B4-SURROGATE', status: pass ? 'PASS' : 'FAIL', window, layout, current,
    quickSwitcher, focus, primary, disabled, screenshot,
    evidenceBoundary: 'CDP forced-colors and deviceScaleFactor=2 verify current/focus/disabled/empty-state renderer behavior only; they do not prove Windows High Contrast, physical 200% DPI, or forced-colors conflict/error states.'
  }
}

const keyboardScript = (key, options = {}) => `(() => {
  const target = document.activeElement || document.body
  return target.dispatchEvent(new KeyboardEvent('keydown', {
    key: ${JSON.stringify(key)}, bubbles: true, cancelable: true,
    ctrlKey: ${Boolean(options.ctrlKey)}, shiftKey: ${Boolean(options.shiftKey)},
    altKey: ${Boolean(options.altKey)}, isComposing: ${Boolean(options.isComposing)}
  }))
})()`

async function press(cdp, key, options = {}) {
  await cdp.evaluate(keyboardScript(key, options))
  await wait(300)
}

async function setInput(cdp, selector, value) {
  await cdp.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)})
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
      throw new Error('input not found: ' + ${JSON.stringify(selector)})
    }
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }))
  })()`)
  await wait(350)
}

async function setEditorContent(cdp, value) {
  await waitFor(cdp, `document.querySelector('.markdown-editor .cm-content') !== null`, 5_000)
  const point = await cdp.evaluate(`(() => {
    const editor = document.querySelector('.markdown-editor .cm-content')
    if (!(editor instanceof HTMLElement)) throw new Error('Markdown editor not found')
    editor.focus()
    const box = editor.getBoundingClientRect()
    return { x: box.left + 12, y: box.top + 12 }
  })()`)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 })
  await cdp.send('Input.insertText', { text: value })
  await wait(350)
  return true
}

async function scenarioA1(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 1440, 900)
  const entryPoints = []
  for (const entry of [
    { id: 'quick-switcher', key: 'o', selector: '.quick-switcher-modal', input: '.quick-switcher-modal input[role="combobox"]' },
    { id: 'command-palette', key: 'p', selector: '.command-palette-modal', input: '.command-palette-modal input[role="combobox"]' }
  ]) {
    const origin = await appCdp.evaluate(`(() => {
      const button = document.querySelector('button[aria-controls="left-sidebar-content"]')
      button.focus()
      return button.getAttribute('aria-label')
    })()`)
    await press(appCdp, entry.key, { ctrlKey: true })
    const opened = await appCdp.evaluate(`(() => ({
      surfaceCount: document.querySelectorAll(${JSON.stringify(entry.selector)}).length,
      modalCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
      inputFocused: document.activeElement === document.querySelector(${JSON.stringify(entry.input)}),
      workspaceInert: Boolean(document.querySelector('.workspace')?.inert)
    }))()`)
    await press(appCdp, 'Escape')
    const closed = await appCdp.evaluate(`(() => ({
      surfaceCount: document.querySelectorAll(${JSON.stringify(entry.selector)}).length,
      activeLabel: document.activeElement?.getAttribute('aria-label') ?? null
    }))()`)
    entryPoints.push({ id: entry.id, origin, opened, closed })
  }
  await appCdp.evaluate(`document.querySelector('.note-editor textarea')?.focus()`)
  await press(appCdp, 'f', { ctrlKey: true, shiftKey: true })
  const search = await appCdp.evaluate(`(() => {
    const input = document.querySelector('input[placeholder="内容を検索"]')
    return {
      leftExpanded: document.querySelector('button[aria-controls="left-sidebar-content"]')?.getAttribute('aria-expanded'),
      focused: document.activeElement === input,
      modalCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length
    }
  })()`)
  const screenshot = await capture(appCdp, 'a1-entry-points.png')
  const pass = entryPoints.every(({ origin, opened, closed }) =>
    opened.surfaceCount === 1 && opened.modalCount === 1 && opened.inputFocused && opened.workspaceInert &&
    closed.surfaceCount === 0 && closed.activeLabel === origin
  ) && search.leftExpanded === 'true' && search.focused && search.modalCount === 0
  return { id: 'A1', status: pass ? 'PASS' : 'FAIL', window, entryPoints, search, screenshot }
}

async function scenarioA2(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 900, 768)
  const path = '00_Home.md'
  const clicked = await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === ${JSON.stringify(path)})
    if (!row) throw new Error('tree row not found')
    row.click()
    return { focused: document.activeElement === row, label: row.getAttribute('aria-label') }
  })()`)
  await press(appCdp, 'ArrowUp')
  const up = await appCdp.evaluate(`document.activeElement?.getAttribute('aria-label') ?? null`)
  await press(appCdp, 'ArrowDown')
  const down = await appCdp.evaluate(`document.activeElement?.getAttribute('aria-label') ?? null`)
  await press(appCdp, 'F2')
  const renameOpened = await appCdp.evaluate(`(() => ({
    count: document.querySelectorAll('.tree-inline-rename').length,
    focused: document.activeElement?.classList.contains('tree-inline-rename') ?? false,
    value: document.querySelector('.tree-inline-rename')?.value ?? null
  }))()`)
  await press(appCdp, 'Escape')
  const renameClosed = await appCdp.evaluate(`document.querySelectorAll('.tree-inline-rename').length`)
  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === ${JSON.stringify(path)})
    row.focus()
  })()`)
  await press(appCdp, 'F10', { shiftKey: true })
  const menuOpened = await appCdp.evaluate(`(() => ({
    count: document.querySelectorAll('.file-tree-context-menu[role="menu"]').length,
    label: document.querySelector('.file-tree-context-menu')?.getAttribute('aria-label') ?? null
  }))()`)
  await press(appCdp, 'Escape')
  const menuClosed = await appCdp.evaluate(`document.querySelectorAll('.file-tree-context-menu').length`)
  const screenshot = await capture(appCdp, 'a2-file-tree.png')
  const pass = clicked.focused && up && down && up !== path && down === path && renameOpened.count === 1 &&
    renameOpened.focused && renameOpened.value === '00_Home' && renameClosed === 0 &&
    menuOpened.count === 1 && menuOpened.label?.includes(path) && menuClosed === 0
  return { id: 'A2', status: pass ? 'PASS' : 'FAIL', window, clicked, up, down, renameOpened, renameClosed, menuOpened, menuClosed, screenshot }
}

async function scenarioA3(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 900, 768)
  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === '00_Home.md')
    row.focus()
    row.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'に' }))
  })()`)
  const before = await appCdp.evaluate(`document.activeElement?.getAttribute('aria-label') ?? null`)
  await press(appCdp, '日', { isComposing: true })
  const during = await appCdp.evaluate(`document.activeElement?.getAttribute('aria-label') ?? null`)
  await appCdp.evaluate(`document.activeElement?.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日' }))`)
  await press(appCdp, '日')
  const committed = await appCdp.evaluate(`document.activeElement?.getAttribute('aria-label') ?? null`)
  const screenshot = await capture(appCdp, 'a3-ime-typeahead.png')
  const pass = before === '00_Home.md' && during === before && committed === longNoteRelative
  return { id: 'A3', status: pass ? 'PASS' : 'FAIL', window, before, during, committed, expectedCommitted: longNoteRelative, screenshot }
}

async function layoutState(appCdp) {
  return appCdp.evaluate(`(() => {
    const center = document.querySelector('.note-panel')
    const rect = (element) => {
      const box = element?.getBoundingClientRect()
      return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null
    }
    const controls = [...document.querySelectorAll('.sidebar-toggle, .note-actions button, .workspace-tab-close')]
      .filter((button) => button.getClientRects().length > 0)
      .map((button) => ({ label: button.getAttribute('aria-label') ?? button.textContent.trim(), rect: rect(button) }))
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      center: rect(center),
      leftExpanded: document.querySelector('button[aria-controls="left-sidebar-content"]')?.getAttribute('aria-expanded'),
      rightExpanded: document.querySelector('button[aria-controls="right-sidebar-content"]')?.getAttribute('aria-expanded'),
      controls,
      allControlsReachable: controls.every(({ rect: box }) => box && box.left >= -0.5 && box.right <= innerWidth + 0.5 && box.top >= -0.5 && box.bottom <= innerHeight + 0.5)
    }
  })()`)
}

async function setSidebars(appCdp, leftOpen, rightOpen) {
  await appCdp.evaluate(`(() => {
    const left = document.querySelector('button[aria-controls="left-sidebar-content"]')
    const right = document.querySelector('button[aria-controls="right-sidebar-content"]')
    if ((left.getAttribute('aria-expanded') === 'true') !== ${leftOpen}) left.click()
    if ((right.getAttribute('aria-expanded') === 'true') !== ${rightOpen}) right.click()
  })()`)
  await wait(300)
}

async function scenarioA4(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 720, 768)
  await setSidebars(appCdp, true, true)
  const open = await layoutState(appCdp)
  const openScreenshot = await capture(appCdp, 'a4-narrow-open.png')
  await setSidebars(appCdp, false, false)
  const closed = await layoutState(appCdp)
  const closedScreenshot = await capture(appCdp, 'a4-narrow-closed.png')
  await setSidebars(appCdp, true, true)
  const valid = (state) => state.documentWidth <= state.viewport.width && state.bodyWidth <= state.viewport.width &&
    state.center?.width > 0 && state.allControlsReachable
  const pass = valid(open) && valid(closed) && longNoteRelative.length === 120
  return { id: 'A4', status: pass ? 'PASS' : 'FAIL', window, longPathCharacters: longNoteRelative.length, open, closed, screenshots: [openScreenshot, closedScreenshot] }
}

async function openGlobalGraph(appCdp) {
  await press(appCdp, 'p', { ctrlKey: true })
  await setInput(appCdp, '.command-palette-modal input[role="combobox"]', 'Vaultグラフ')
  await press(appCdp, 'Enter')
  await waitFor(appCdp, `document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]') !== null`)
}

async function scenarioA6(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 1440, 900)
  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === ${JSON.stringify(longNoteRelative)})
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 220 }))
  })()`)
  await waitFor(appCdp, `document.querySelector('.file-tree-context-menu') !== null`)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.file-tree-context-menu button')].find((item) => item.textContent.trim() === '新しいタブで開く')
    button.click()
  })()`)
  await wait(500)
  await openGlobalGraph(appCdp)
  await appCdp.evaluate(`(() => {
    document.querySelector('button[aria-label="フィルタを開く"]')?.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.wiki-graph-view label')?.closest('.wiki-graph-view') !== null`)
  await appCdp.evaluate(`(() => {
    const label = [...document.querySelectorAll('.wiki-graph-view label')].find((item) => item.textContent.includes('添付書類'))
    const checkbox = label?.querySelector('input[type="checkbox"]')
    if (checkbox && !checkbox.checked) checkbox.click()
  })()`)
  await wait(1500)
  const attachmentNodeAvailable = await appCdp.evaluate(`document.querySelector('.wiki-graph-node[title="attachments/diagram.svg"]') !== null`)
  if (!attachmentNodeAvailable) {
    const state = await appCdp.evaluate(`(() => ({
      tabs: [...document.querySelectorAll('.workspace-tabs [role="tab"]')].map((tab) => ({ text: tab.textContent.trim(), selected: tab.getAttribute('aria-selected') })),
      graphVisible: Boolean(document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]')),
      attachmentFilter: [...document.querySelectorAll('.wiki-graph-view label')].find((item) => item.textContent.includes('添付書類'))?.querySelector('input')?.checked ?? null,
      nodes: [...document.querySelectorAll('.wiki-graph-node')].map((node) => node.getAttribute('title'))
    }))()`)
    const screenshot = await captureWindow(mainCdp, 'a6-tabs-baseline.png')
    return {
      id: 'A6', status: 'UNVERIFIED', window, state, screenshot,
      evidenceGap: 'installed renderer did not expose the fixture attachment node after enabling the attachment filter',
      r5Keyboard: 'not implemented'
    }
  }
  await appCdp.evaluate(`(() => {
    const node = document.querySelector('.wiki-graph-node[title="attachments/diagram.svg"]')
    const box = node.getBoundingClientRect()
    node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + 2, clientY: box.top + 2 }))
  })()`)
  await waitFor(appCdp, `document.querySelector('.wiki-graph-context-menu') !== null`)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.wiki-graph-context-menu button')].find((item) => item.textContent.trim() === '新規タブに開く')
    button.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.attachment-preview[aria-label="添付ファイルプレビュー"]') !== null`)
  const attachment = await appCdp.evaluate(`(() => ({
    tabs: [...document.querySelectorAll('.workspace-tabs [role="tab"]')].map((tab) => ({ text: tab.textContent.trim(), selected: tab.getAttribute('aria-selected') })),
    attachmentVisible: Boolean(document.querySelector('.attachment-preview'))
  }))()`)
  await appCdp.evaluate(`(() => {
    const graph = [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.trim() === 'グラフビュー')
    graph.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.wiki-graph-view[aria-label="Vault全体グラフ"]') !== null`)
  await appCdp.evaluate(`(() => {
    const node = document.querySelector('.wiki-graph-node[title="10_projects/Project Alpha.md"]')
    const box = node.getBoundingClientRect()
    node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + 2, clientY: box.top + 2 }))
  })()`)
  await waitFor(appCdp, `document.querySelector('.wiki-graph-context-menu') !== null`)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.wiki-graph-context-menu button')].find((item) => item.textContent.includes('リンクされたビューを開く'))
    button.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('[role="menu"][aria-label="リンクされたビュー"]') !== null`)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="menu"][aria-label="リンクされたビュー"] button')].find((item) => item.textContent.trim() === 'バックリンクを開く')
    button.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('[aria-label="バックリンクビュー"]') !== null`)
  const linked = await appCdp.evaluate(`(() => ({
    tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => ({ text: tab.textContent.trim(), selected: tab.getAttribute('aria-selected'), tabIndex: tab.tabIndex })),
    linkedVisible: Boolean(document.querySelector('[aria-label="バックリンクビュー"]')),
    hasAriaControls: [...document.querySelectorAll('[role="tab"]')].every((tab) => tab.hasAttribute('aria-controls'))
  }))()`)
  const keyboard = await appCdp.evaluate(`(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms))
    const press = (target, key, init = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
    const tabs = () => [...document.querySelectorAll('.workspace-tabs [role="tab"]')]
    const state = () => ({
      tabs: tabs().map((tab) => ({
        id: tab.id,
        label: tab.getAttribute('aria-label'),
        title: tab.getAttribute('title'),
        selected: tab.getAttribute('aria-selected'),
        controls: tab.getAttribute('aria-controls'),
        tabIndex: tab.tabIndex
      })),
      focusedId: document.activeElement?.id ?? null,
      panel: (() => {
        const panel = document.querySelector('[role="tabpanel"]')
        return panel ? { id: panel.id, labelledBy: panel.getAttribute('aria-labelledby') } : null
      })()
    })
    const active = tabs().find((tab) => tab.getAttribute('aria-selected') === 'true')
    active.focus()
    press(active, 'ArrowLeft')
    await wait(50)
    const arrowFocused = document.activeElement?.id ?? null
    press(document.activeElement, 'Enter')
    await wait(250)
    const arrowActivated = state()
    press(document.activeElement, 'ArrowRight')
    await wait(50)
    const arrowRightFocused = document.activeElement?.id ?? null
    press(document, '1', { ctrlKey: true })
    await wait(250)
    const directFirst = state()
    press(document, '9', { ctrlKey: true })
    await wait(250)
    const directLast = state()
    press(document, 'Tab', { ctrlKey: true, shiftKey: true })
    await wait(250)
    const cycledBackward = state()
    press(document, '1', { ctrlKey: true })
    await wait(250)
    const editor = document.querySelector('input')
    const beforeProtectedClose = tabs().length
    if (editor) {
      editor.focus()
      press(editor, 'w', { ctrlKey: true })
      await wait(100)
    }
    const protectedClose = { editorFound: Boolean(editor), before: beforeProtectedClose, after: tabs().length }
    document.body.focus()
    press(document, 'w', { ctrlKey: true })
    await wait(300)
    const close = { before: beforeProtectedClose, after: tabs().length, state: state() }
    return { initial: state(), arrowFocused, arrowActivated, arrowRightFocused, directFirst, directLast, cycledBackward, protectedClose, close }
  })()`)
  const narrowWindow = await setViewport(appCdp, mainCdp, 720, 768)
  const narrow = await appCdp.evaluate(`(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentWidth: document.documentElement.scrollWidth,
    tabs: [...document.querySelectorAll('.workspace-tabs [role="tab"]')].map((tab) => ({
      label: tab.getAttribute('aria-label'), title: tab.getAttribute('title'), selected: tab.getAttribute('aria-selected'), tabIndex: tab.tabIndex
    })),
    panelLabelledBy: document.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby') ?? null
  }))()`)
  await setViewport(appCdp, mainCdp, 1440, 900)
  const switching = []
  for (const label of keyboard.close.state.tabs.map((tab) => tab.label)) {
    switching.push(await appCdp.evaluate(`(async () => {
      const tab = [...document.querySelectorAll('[role="tab"]')].find((item) => item.textContent.trim() === ${JSON.stringify(label)})
      if (!tab) return { label: ${JSON.stringify(label)}, found: false }
      tab.click()
      await new Promise((done) => setTimeout(done, 250))
      return { label: ${JSON.stringify(label)}, found: true, selected: tab.getAttribute('aria-selected') }
    })()`))
  }
  const screenshot = await captureWindow(mainCdp, 'a6-tabs-baseline.png')
  const close = await appCdp.evaluate(`(async () => {
    const button = [...document.querySelectorAll('.workspace-tab-close')].find((item) => item.getAttribute('aria-label')?.includes('diagram'))
    if (!button) return { found: false }
    button.click()
    await new Promise((done) => setTimeout(done, 350))
    return { found: true, remaining: [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent.trim()) }
  })()`)
  const validTabState = (state) => state.tabs.length > 0 &&
    state.tabs.filter((tab) => tab.selected === 'true').length === 1 &&
    state.tabs.filter((tab) => tab.tabIndex === 0).length === 1 &&
    state.tabs.every((tab) => tab.id && tab.label && tab.title && tab.controls === 'workspace-tabpanel') &&
    state.panel?.id === 'workspace-tabpanel' &&
    state.panel.labelledBy === state.tabs.find((tab) => tab.selected === 'true')?.id
  const keyboardPass = validTabState(keyboard.arrowActivated) &&
    keyboard.arrowActivated.focusedId === keyboard.arrowFocused &&
    keyboard.arrowRightFocused !== keyboard.arrowFocused &&
    keyboard.directFirst.tabs[0]?.selected === 'true' &&
    keyboard.directLast.tabs.at(-1)?.selected === 'true' &&
    keyboard.cycledBackward.tabs.at(-2)?.selected === 'true' &&
    keyboard.protectedClose.editorFound && keyboard.protectedClose.before === keyboard.protectedClose.after &&
    keyboard.close.after === keyboard.close.before - 1 && validTabState(keyboard.close.state) &&
    keyboard.close.state.focusedId === keyboard.close.state.tabs.find((tab) => tab.selected === 'true')?.id
  const narrowPass = narrow.viewport.width === 720 && narrow.viewport.height === 768 && narrow.documentWidth <= 720 &&
    narrow.tabs.filter((tab) => tab.selected === 'true').length === 1 &&
    narrow.tabs.filter((tab) => tab.tabIndex === 0).length === 1 &&
    narrow.tabs.every((tab) => tab.label && tab.title) && Boolean(narrow.panelLabelledBy)
  const pass = attachment.attachmentVisible && linked.linkedVisible && keyboardPass && narrowPass && switching.every((item) => item.found && item.selected === 'true') && close.found
  return {
    id: 'A6', status: pass ? 'PASS' : 'FAIL', window, narrowWindow, attachment, linked, keyboard, narrow, switching, close, screenshot,
    r5Keyboard: keyboardPass ? 'verified' : 'failed',
    r5AriaLinkage: linked.hasAriaControls && validTabState(keyboard.arrowActivated) ? 'verified' : 'failed'
  }
}

async function scenarioA5(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 1280, 800)
  await setSidebars(appCdp, true, true)
  const treeLong = await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === ${JSON.stringify(longNoteRelative)})
    row.click()
    return { ariaLabel: row.getAttribute('aria-label'), title: row.getAttribute('title'), clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }
  })()`)
  await wait(350)
  const closeButtons = await appCdp.evaluate(`([...document.querySelectorAll('.workspace-tab-close')].map((button) => button.getAttribute('aria-label')))`)
  for (const label of closeButtons) {
    await appCdp.evaluate(`(() => {
      const button = [...document.querySelectorAll('.workspace-tab-close')].find((item) => item.getAttribute('aria-label') === ${JSON.stringify(label)})
      button?.click()
    })()`)
    await wait(250)
  }
  const empty = await appCdp.evaluate(`(() => ({
    visible: Boolean(document.querySelector('.note-empty')),
    text: document.querySelector('.note-empty')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    primaryVisible: Boolean(document.querySelector('.note-empty .primary-button'))
  }))()`)
  const emptyScreenshot = await capture(appCdp, 'a5-empty-state.png')
  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === '00_Home.md')
    row?.click()
  })()`)
  await wait(350)
  await press(appCdp, 'o', { ctrlKey: true })
  await setInput(appCdp, '.quick-switcher-modal input[role="combobox"]', '日日日')
  await press(appCdp, 'Enter')
  await wait(500)
  const quickSwitcherStillOpen = await appCdp.evaluate(`document.querySelector('.quick-switcher-modal') !== null`)
  if (quickSwitcherStillOpen) {
    const screenshot = await capture(appCdp, 'a5-long-open-unverified.png')
    return {
      id: 'A5', status: 'UNVERIFIED', window, treeLong, empty,
      evidenceGap: 'installed renderer kept the quick switcher open after the long-path selection in this tab-empty sequence, so conflict actions were not exercised',
      screenshots: [emptyScreenshot, screenshot]
    }
  }
  await appCdp.evaluate(`(() => {
    if (document.querySelector('.markdown-editor .cm-content')) return
    const button = [...document.querySelectorAll('.note-view-switcher button')].find((item) => item.textContent.trim() === '編集')
    button?.click()
  })()`)
  const editorAvailable = await waitFor(appCdp, `document.querySelector('.markdown-editor .cm-content') !== null`, 5_000)
    .then(() => true)
    .catch(() => false)
  if (!editorAvailable) {
    const state = await appCdp.evaluate(`(() => ({
      activeSurface: document.querySelector('.wiki-graph-view')?.getAttribute('aria-label') ?? document.querySelector('main')?.textContent.slice(0, 120) ?? null,
      workspaceTabs: [...document.querySelectorAll('.workspace-tabs [role="tab"]')].map((tab) => ({ text: tab.textContent.trim(), selected: tab.getAttribute('aria-selected') })),
      quickSwitcherVisible: Boolean(document.querySelector('.quick-switcher-modal'))
    }))()`)
    const screenshot = await capture(appCdp, 'a5-long-empty-unverified.png')
    return {
      id: 'A5', status: 'UNVERIFIED', window, treeLong, empty,
      evidenceGap: 'installed renderer did not reopen the long-path note editor after the empty-tab state',
      state, screenshots: [emptyScreenshot, screenshot]
    }
  }
  const editorReady = await setEditorContent(appCdp, '# ローカル編集中\n\n保存前の内容').catch(() => false)
  if (!editorReady) {
    const state = await appCdp.evaluate(`(() => ({
      selectedTitle: document.querySelector('.note-title')?.textContent.trim() ?? null,
      activeSurface: document.querySelector('.wiki-graph-view')?.getAttribute('aria-label') ?? document.querySelector('main')?.textContent.slice(0, 120) ?? null,
      workspaceTabs: [...document.querySelectorAll('.workspace-tabs [role="tab"]')].map((tab) => ({ text: tab.textContent.trim(), selected: tab.getAttribute('aria-selected') }))
    }))()`)
    const screenshot = await capture(appCdp, 'a5-editor-race-unverified.png')
    return {
      id: 'A5', status: 'UNVERIFIED', window, treeLong, empty,
      evidenceGap: 'installed renderer did not keep the long-path Markdown editor available long enough to exercise conflict actions',
      state, screenshots: [emptyScreenshot, screenshot]
    }
  }
  await writeFile(longNotePath, '# 外部版\n\n別アプリの更新', 'utf8')
  await waitFor(appCdp, `document.querySelector('.conflict-banner')?.textContent.includes('別のアプリでも変更') === true`, 20_000)
  const changed = await appCdp.evaluate(`(() => {
    const banner = document.querySelector('.conflict-banner')
    const box = banner.getBoundingClientRect()
    const buttons = [...banner.querySelectorAll('button')].map((button) => ({ text: button.textContent.trim(), box: button.getBoundingClientRect().toJSON() }))
    return { text: banner.textContent.replace(/\\s+/g, ' ').trim(), box: box.toJSON(), buttons,
      visibleActions: buttons.every(({ box: item }) => item.left >= 0 && item.right <= innerWidth && item.top >= 0 && item.bottom <= innerHeight) }
  })()`)
  const changedScreenshot = await capture(appCdp, 'a5-changed-conflict.png')
  await appCdp.evaluate(`(() => {
    window.confirm = () => true
    const button = [...document.querySelectorAll('.conflict-banner button')].find((item) => item.textContent.includes('外部版'))
    button.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.conflict-banner') === null`)
  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === '00_Home.md')
    row.click()
  })()`)
  await wait(400)
  const missingEditorReady = await setEditorContent(appCdp, '# 削除競合のローカル内容').catch(() => false)
  if (!missingEditorReady) {
    const screenshot = await capture(appCdp, 'a5-missing-editor-unverified.png')
    return {
      id: 'A5', status: 'UNVERIFIED', window, treeLong, empty, changed,
      evidenceGap: 'changed-file conflict actions were visible, but the installed renderer did not expose the Home editor for the deleted-file conflict step',
      screenshots: [emptyScreenshot, changedScreenshot, screenshot]
    }
  }
  await unlink(homePath)
  await waitFor(appCdp, `document.querySelector('.conflict-banner')?.textContent.includes('削除または移動') === true`, 20_000)
  const missing = await appCdp.evaluate(`(() => {
    const banner = document.querySelector('.conflict-banner')
    const buttons = [...banner.querySelectorAll('button')].map((button) => button.textContent.trim())
    return { text: banner.textContent.replace(/\\s+/g, ' ').trim(), buttons }
  })()`)
  const missingScreenshot = await capture(appCdp, 'a5-missing-conflict.png')
  const pass = treeLong.ariaLabel === longNoteRelative && treeLong.title?.includes(longNoteRelative) &&
    empty.visible && empty.primaryVisible && changed.visibleActions && changed.buttons.length >= 2 && missing.buttons.length >= 2
  return { id: 'A5', status: pass ? 'PASS' : 'FAIL', window, treeLong, empty, changed, missing, screenshots: [emptyScreenshot, changedScreenshot, missingScreenshot] }
}

async function scenarioA5Only(appCdp, mainCdp) {
  const window = await setViewport(appCdp, mainCdp, 1280, 800)
  await setSidebars(appCdp, true, true)
  const empty = await appCdp.evaluate(`(() => ({
    visible: Boolean(document.querySelector('.note-empty')),
    text: document.querySelector('.note-empty')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    primaryVisible: Boolean(document.querySelector('.note-empty .primary-button'))
  }))()`)
  const emptyScreenshot = await capture(appCdp, 'a5-01-empty-state.png')

  const treeLong = await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === ${JSON.stringify(longNoteRelative)})
    if (!row) throw new Error('long-path tree row not found')
    const result = { ariaLabel: row.getAttribute('aria-label'), title: row.getAttribute('title'), clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }
    row.click()
    return result
  })()`)
  await waitFor(appCdp, `document.querySelector('.note-header span')?.textContent === ${JSON.stringify(longNoteRelative)}`)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.note-view-switcher button')].find((item) => item.textContent.trim() === '編集')
    button?.click()
  })()`)
  await setEditorContent(appCdp, '# ローカル編集中\n\n保存前の内容')
  await writeFile(longNotePath, '# 外部版\n\n別アプリの更新', 'utf8')
  await waitFor(appCdp, `document.querySelector('.conflict-banner')?.textContent.includes('別のアプリでも変更') === true`, 20_000)
  const changed = await appCdp.evaluate(`(() => {
    const banner = document.querySelector('.conflict-banner')
    const box = banner.getBoundingClientRect()
    const buttons = [...banner.querySelectorAll('button')].map((button) => ({ text: button.textContent.trim(), box: button.getBoundingClientRect().toJSON() }))
    return { text: banner.textContent.replace(/\\s+/g, ' ').trim(), box: box.toJSON(), buttons,
      visibleActions: buttons.every(({ box: item }) => item.left >= 0 && item.right <= innerWidth && item.top >= 0 && item.bottom <= innerHeight) }
  })()`)
  await wait(250)
  const changedScreenshot = await capture(appCdp, 'a5-02-changed-conflict.png')
  await appCdp.evaluate(`(() => {
    window.confirm = () => true
    const button = [...document.querySelectorAll('.conflict-banner button')].find((item) => item.textContent.includes('外部版'))
    button.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.conflict-banner') === null`)

  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === '00_Home.md')
    if (!row) throw new Error('Home tree row not found')
    row.click()
  })()`)
  await wait(400)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.note-view-switcher button')].find((item) => item.textContent.trim() === '編集')
    button?.click()
  })()`)
  await setEditorContent(appCdp, '# 削除競合のローカル内容')
  await unlink(homePath)
  await waitFor(appCdp, `document.querySelector('.conflict-banner')?.textContent.includes('削除または移動') === true`, 20_000)
  const missing = await appCdp.evaluate(`(() => {
    const banner = document.querySelector('.conflict-banner')
    const buttons = [...banner.querySelectorAll('button')].map((button) => button.textContent.trim())
    return { text: banner.textContent.replace(/\\s+/g, ' ').trim(), buttons }
  })()`)
  await wait(250)
  const missingScreenshot = await capture(appCdp, 'a5-03-missing-conflict.png')
  await appCdp.evaluate(`(() => {
    window.confirm = () => true
    const button = [...document.querySelectorAll('.conflict-banner button')].find((item) => item.textContent.includes('破棄して閉じる'))
    button.click()
  })()`)
  await waitFor(appCdp, `document.querySelector('.note-empty') !== null`)

  await appCdp.evaluate(`(() => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find((item) => item.getAttribute('aria-label') === '10_projects/Project Alpha.md')
    if (!row) throw new Error('save-error fixture tree row not found')
    row.click()
  })()`)
  await wait(400)
  await appCdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('.note-view-switcher button')].find((item) => item.textContent.trim() === '編集')
    button?.click()
  })()`)
  const failureInjected = await mainCdp.evaluate(`(() => {
    const createRequire = process.getBuiltinModule('module').createRequire
    const { ipcMain } = createRequire(process.execPath)('electron')
    ipcMain.removeHandler('note:save')
    ipcMain.handle('note:save', async () => ({
      ok: false,
      error: { code: 'UNKNOWN', message: 'A5 fixture: 保存できません。' }
    }))
    return true
  })()`)
  await setEditorContent(appCdp, '# 保存失敗fixture\n\n再試行できます。')
  await waitFor(appCdp, `document.querySelector('.message-banner')?.textContent.includes('A5 fixture') === true`, 10_000)
  const saveError = await appCdp.evaluate(`(() => {
    const banner = document.querySelector('.message-banner')
    const buttons = [...banner.querySelectorAll('button')].map((button) => button.textContent.trim() || button.getAttribute('aria-label'))
    return { text: banner.textContent.replace(/\\s+/g, ' ').trim(), buttons, retryVisible: buttons.includes('再試行') }
  })()`)
  await wait(250)
  const saveErrorScreenshot = await capture(appCdp, 'a5-04-save-error.png')
  const pass = treeLong.ariaLabel === longNoteRelative && treeLong.title?.includes(longNoteRelative) &&
    empty.visible && empty.primaryVisible && changed.visibleActions && changed.buttons.length >= 2 &&
    missing.buttons.length >= 2 && failureInjected && saveError.retryVisible
  return {
    id: 'A5', status: pass ? 'PASS' : 'FAIL', window, treeLong, empty, changed, missing,
    saveError: { ...saveError, fixture: 'isolated main-process note:save failure injection' },
    screenshots: [emptyScreenshot, changedScreenshot, missingScreenshot, saveErrorScreenshot]
  }
}

async function main() {
  assertWithin(resolve(repoRoot, 'work'), workRoot)
  assertWithin(resolve(repoRoot, 'docs/reports/assets'), output)
  await rmWithRetry(output)
  await Promise.all([mkdir(vault, { recursive: true }), mkdir(userData, { recursive: true }), mkdir(output, { recursive: true })])
  await cp(sourceFixture, vault, { recursive: true, force: false })
  const originalHome = await readFile(homePath)
  const originalLong = Buffer.from(`# ${basename(longNoteRelative, '.md')}\n\n長い日本語タイトルと120文字pathの受入fixture。\n`, 'utf8')
  await writeFile(longNotePath, originalLong)
  await writeFile(settingsPath, `${JSON.stringify({ lastVaultPath: vault, lastNotePath: a5Only || phaseBSurrogate ? null : '00_Home.md' }, null, 2)}\n`)
  const before = await markdownDigest(vault)
  const installed = await fileDigest(executable)
  const cdpPort = await freePort()
  let inspectorPort = await freePort()
  while (inspectorPort === cdpPort) inspectorPort = await freePort()
  const stdout = await open(stdoutPath, 'w')
  const stderr = await open(stderrPath, 'w')
  const args = [
    '--start-minimized', '--window-position=-32000,-32000', '--window-size=1440,900',
    `--remote-debugging-port=${cdpPort}`, `--inspect=127.0.0.1:${inspectorPort}`,
    '--remote-debugging-address=127.0.0.1', '--remote-allow-origins=*', '--force-device-scale-factor=1',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion', '--no-first-run', `--user-data-dir=${userData}`
  ]
  const environment = { ...process.env, TSUZUNE_HEADLESS_SMOKE: '1' }
  delete environment.TSUZUNE_HEADLESS_SMOKE_READY_FILE
  delete environment.ELECTRON_RENDERER_URL
  delete environment.GH_TOKEN
  delete environment.GITHUB_TOKEN
  const child = spawn(executable, args, { env: environment, stdio: ['ignore', stdout.fd, stderr.fd], windowsHide: true })
  let appCdp
  let mainCdp
  const results = []
  let runError = null
  try {
    const [appTarget, mainTarget] = await Promise.all([
      waitForTarget(cdpPort, (candidate) => candidate.type === 'page' && candidate.url.endsWith('/out/renderer/index.html')),
      waitForTarget(inspectorPort, (candidate) => candidate.type === 'node')
    ])
    appCdp = await connect(appTarget)
    mainCdp = await connect(mainTarget, false)
    await waitFor(appCdp, `document.querySelector('.workspace') !== null`)
    const isolation = await appCdp.evaluate(`(async () => {
      const [settings, snapshot] = await Promise.all([window.tsuzune.getSettings(), window.tsuzune.getSnapshot()])
      return { settings: settings.value, rootPath: snapshot.value.rootPath, noteCount: snapshot.value.notes.length }
    })()`)
    assert(isolation.rootPath.toLowerCase() === vault.toLowerCase(), 'isolated Vault mismatch', isolation)
    if (phaseBSurrogate) {
      await appCdp.send('Emulation.setEmulatedMedia', {
        media: 'screen',
        features: [{ name: 'forced-colors', value: 'active' }]
      })
      results.push(await scenarioPhaseBSurrogate(appCdp, mainCdp))
    } else if (r5Only) {
      results.push(await scenarioA6(appCdp, mainCdp))
    } else if (a5Only) {
      results.push(await scenarioA5Only(appCdp, mainCdp))
    } else {
      results.push(await scenarioA1(appCdp, mainCdp))
      results.push(await scenarioA2(appCdp, mainCdp))
      results.push(await scenarioA3(appCdp, mainCdp))
      results.push(await scenarioA4(appCdp, mainCdp))
      results.push(await scenarioA6(appCdp, mainCdp))
      results.push(await scenarioA5(appCdp, mainCdp))
    }
  } catch (error) {
    runError = error instanceof Error ? error.stack ?? error.message : String(error)
  } finally {
    appCdp?.socket.close()
    mainCdp?.socket.close()
    if (child.pid) {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      child.kill('SIGKILL')
      child.unref()
    }
    await wait(1000)
    await Promise.allSettled([stdout.close(), stderr.close()])
    await writeFile(homePath, originalHome)
    await writeFile(longNotePath, originalLong)
  }
  const after = await markdownDigest(vault)
  const remaining = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$needle='${userData.replaceAll("'", "''")}'; @(` +
    `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'TSUZUNE.exe' -and $_.CommandLine -and $_.CommandLine.Contains($needle) } | ` +
    `Where-Object { try { -not (Get-Process -Id $_.ProcessId -ErrorAction Stop).HasExited } catch { $false } }).Count`],
  { encoding: 'utf8', windowsHide: true })
  const summary = {
    capturedAt: new Date().toISOString(),
    product: { executable, ...installed },
    isolation: { vault, userData, remainingProcesses: Number(remaining.stdout.trim() || 0) },
    fixture: { before, after, unchanged: before.sha256 === after.sha256 },
    results,
    runError,
    overall: runError || results.length !== (phaseBSurrogate || r5Only || a5Only ? 1 : 6) || !results.every((item) => item.status === 'PASS') || before.sha256 !== after.sha256
      ? 'STOP-UNVERIFIED'
      : phaseBSurrogate ? 'SURROGATE-PASS' : 'R5-READY'
  }
  await writeFile(phaseResultPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (!['R5-READY', 'SURROGATE-PASS'].includes(summary.overall)) process.exitCode = 1
}

await main()
