import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve('docs/reports/assets/context-tabs-2026-08-17')
const userDataDirectory = resolve('work/context-tabs-ui-userdata')
const originalLoadFile = BrowserWindow.prototype.loadFile
let checkStarted = false

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

async function contextState(window) {
  return evaluate(
    window,
    `(() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')]
      const panels = [...document.querySelectorAll('[role="tabpanel"]')]
      const panel = document.querySelector('.related-panel')
      return {
        selectedNote: document.querySelector('.note-header strong')?.textContent ?? null,
        tabs: tabs.map((tab) => ({
          id: tab.id,
          label: tab.getAttribute('aria-label') ?? tab.textContent?.trim() ?? '',
          selected: tab.getAttribute('aria-selected'),
          controls: tab.getAttribute('aria-controls'),
          controlsExist: Boolean(document.getElementById(tab.getAttribute('aria-controls') ?? '')),
          tabIndex: tab.getAttribute('tabindex')
        })),
        panels: panels.map((candidate) => ({
          id: candidate.id,
          hidden: candidate.hidden,
          labelledBy: candidate.getAttribute('aria-labelledby')
        })),
        activeElement: document.activeElement?.id ?? null,
        hasResolvedLinks: Boolean(document.querySelector('#context-panel-links .related-link')),
        hasBacklinks: Boolean(document.querySelector('#context-panel-backlinks .related-link')),
        temporalText: document.querySelector('#context-panel-temporal')?.textContent?.trim() ?? '',
        viewportWidth: innerWidth,
        panelWidth: panel?.getBoundingClientRect().width ?? null,
        panelScrollWidth: panel?.scrollWidth ?? null
      }
    })()`
  )
}

async function clickTab(window, tabId) {
  const clicked = await evaluate(
    window,
    `(() => {
      const tab = document.getElementById(${JSON.stringify(tabId)})
      if (!(tab instanceof HTMLButtonElement)) return false
      tab.click()
      return true
    })()`
  )
  if (!clicked) throw new Error(`${tabId}が見つかりません。`)
  await delay(250)
}

async function pressTabKey(window, tabId, key) {
  const dispatched = await evaluate(
    window,
    `(() => {
      const tab = document.getElementById(${JSON.stringify(tabId)})
      if (!(tab instanceof HTMLButtonElement)) return false
      tab.focus()
      tab.dispatchEvent(new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)},
        bubbles: true,
        cancelable: true
      }))
      return true
    })()`
  )
  if (!dispatched) throw new Error(`${tabId}へ${key}を送れませんでした。`)
  await delay(250)
}

function assertState(condition, message, state) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(state)}`)
}

function isSelected(state, tabId) {
  return state.tabs.find((tab) => tab.id === tabId)?.selected === 'true'
}

function isPanelVisible(state, panelId) {
  return state.panels.find((panel) => panel.id === panelId)?.hidden === false
}

async function capture(window, filename) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, filename), image.toPNG())
}

async function runCheck(window) {
  window.setSkipTaskbar(true)
  window.setSize(1440, 900, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, '#context-tab-links')

  const links = await contextState(window)
  assertState(
    links.selectedNote === '00_Home' &&
      isSelected(links, 'context-tab-links') &&
      isPanelVisible(links, 'context-panel-links') &&
      links.tabs.every((tab) => tab.controlsExist) &&
      links.hasResolvedLinks,
    'リンクタブの初期状態が正しくありません',
    links
  )
  await capture(window, '01-links.png')

  await clickTab(window, 'context-tab-backlinks')
  const backlinks = await contextState(window)
  assertState(
    isSelected(backlinks, 'context-tab-backlinks') &&
      isPanelVisible(backlinks, 'context-panel-backlinks') &&
      backlinks.hasBacklinks,
    'バックリンクタブへ切り替えられません',
    backlinks
  )
  await capture(window, '02-backlinks.png')

  await pressTabKey(window, 'context-tab-backlinks', 'ArrowRight')
  const temporal = await contextState(window)
  assertState(
    isSelected(temporal, 'context-tab-temporal') &&
      isPanelVisible(temporal, 'context-panel-temporal') &&
      temporal.activeElement === 'context-tab-temporal' &&
      temporal.temporalText.length > 0,
    'キーボードで時間タブへ切り替えられません',
    temporal
  )
  assertState(
    temporal.panelWidth !== null &&
      temporal.panelScrollWidth !== null &&
      temporal.panelScrollWidth <= temporal.panelWidth + 1,
    '右コンテキスト内で横overflowが発生しました',
    temporal
  )
  await capture(window, '03-temporal.png')

  const result = {
    result: 'pass',
    isolatedVault: vault,
    links,
    backlinks,
    temporal
  }
  await writeFile(
    resolve(outputDirectory, 'capture-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify(result, null, 2))
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
await mkdir(userDataDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
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
