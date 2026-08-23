import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const vault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve(
  'docs/reports/assets/sidebar-collapse-2026-08-17'
)
const userDataDirectory = resolve('work/sidebar-collapse-ui-userdata')
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

async function sidebarState(window) {
  return evaluate(
    window,
    `(() => {
      const workspace = document.querySelector('.workspace')
      const leftButton = document.querySelector('button[aria-controls="left-sidebar-content"]')
      const rightButton = document.querySelector('button[aria-controls="right-sidebar-content"]')
      const leftContent = document.querySelector('#left-sidebar-content')
      const rightContent = document.querySelector('#right-sidebar-content')
      const leftPanel = document.querySelector('.left-panel')
      const rightPanel = document.querySelector('.related-panel-shell')
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
      return {
        selectedNote: document.querySelector('.note-header strong')?.textContent ?? null,
        leftExpanded: leftButton?.getAttribute('aria-expanded') ?? null,
        rightExpanded: rightButton?.getAttribute('aria-expanded') ?? null,
        leftHidden: Boolean(leftContent?.hidden),
        rightHidden: Boolean(rightContent?.hidden),
        leftDisplay: leftContent ? getComputedStyle(leftContent).display : null,
        rightDisplay: rightContent ? getComputedStyle(rightContent).display : null,
        leftCollapsedClass: Boolean(workspace?.classList.contains('is-left-sidebar-collapsed')),
        rightCollapsedClass: Boolean(workspace?.classList.contains('is-right-sidebar-collapsed')),
        leftPanelRect: rect(leftPanel),
        rightPanelRect: rect(rightPanel),
        leftButtonRect: rect(leftButton),
        rightButtonRect: rect(rightButton),
        gridTemplateColumns: workspace ? getComputedStyle(workspace).gridTemplateColumns : null,
        viewport: { width: innerWidth, height: innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        workspaceWidth: workspace?.getBoundingClientRect().width ?? null
      }
    })()`
  )
}

async function clickCollapsedRail(window, controlId, panelSelector) {
  const clicked = await evaluate(
    window,
    `(() => {
      const panel = document.querySelector(${JSON.stringify(panelSelector)})
      if (!panel) return false
      const bounds = panel.getBoundingClientRect()
      const target = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.bottom - 16
      )
      const button = target?.closest(
        ${JSON.stringify(`button[aria-controls="${controlId}"]`)}
      )
      if (!button) return false
      button.click()
      return true
    })()`
  )
  if (!clicked) throw new Error(`${controlId}のレール下部から再表示できません。`)
  await delay(250)
}

async function clickOpenSidebarStrip(window, controlId, panelSelector) {
  const clicked = await evaluate(
    window,
    `(() => {
      const panel = document.querySelector(${JSON.stringify(panelSelector)})
      const button = document.querySelector(
        ${JSON.stringify(`button[aria-controls="${controlId}"]`)}
      )
      if (!panel || !button) return false
      const panelBounds = panel.getBoundingClientRect()
      const buttonBounds = button.getBoundingClientRect()
      const target = document.elementFromPoint(
        panelBounds.left + panelBounds.width * 0.75,
        buttonBounds.top + buttonBounds.height / 2
      )
      if (!target?.closest(${JSON.stringify(`button[aria-controls="${controlId}"]`)})) {
        return false
      }
      button.click()
      return true
    })()`
  )
  if (!clicked) throw new Error(`${controlId}の上端帯から閉じられません。`)
  await delay(250)
}

async function clickOpenLeftSidebarEdge(window) {
  const clicked = await evaluate(
    window,
    `(() => {
      const panel = document.querySelector('.left-panel')
      const button = document.querySelector('button[aria-controls="left-sidebar-content"]')
      if (!panel || !button) return false
      const panelBounds = panel.getBoundingClientRect()
      const buttonBounds = button.getBoundingClientRect()
      const target = document.elementFromPoint(
        buttonBounds.left + buttonBounds.width / 2,
        panelBounds.top + panelBounds.height * 0.75
      )
      if (!target?.closest('button[aria-controls="left-sidebar-content"]')) {
        return false
      }
      button.click()
      return true
    })()`
  )
  if (!clicked) throw new Error('左サイドバーの右端ハンドルから閉じられません。')
  await delay(250)
}

function coversPanel(panel, button) {
  return Boolean(
    panel &&
      button &&
      Math.abs(panel.left - button.left) <= 1 &&
      Math.abs(panel.top - button.top) <= 1 &&
      Math.abs(panel.right - button.right) <= 1 &&
      Math.abs(panel.bottom - button.bottom) <= 1
  )
}

function coversPanelWidth(panel, button) {
  return Boolean(panel && button && button.width / panel.width >= 0.9)
}

function coversPanelHeightAtRightEdge(panel, button) {
  return Boolean(
    panel &&
      button &&
      button.height / panel.height >= 0.9 &&
      Math.abs(panel.right - button.right) <= 1
  )
}

async function clickControl(window, controlId) {
  const clicked = await evaluate(
    window,
    `(() => {
      const button = document.querySelector(
        ${JSON.stringify(`button[aria-controls="${controlId}"]`)}
      )
      if (!button) return false
      button.click()
      return true
    })()`
  )
  if (!clicked) throw new Error(`${controlId}の開閉ボタンが見つかりません。`)
  await delay(250)
}

function assertState(condition, message, state) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(state)}`)
}

async function runCheck(window) {
  window.setSkipTaskbar(true)
  window.setSize(1440, 900, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, '.workspace')

  const opened = await sidebarState(window)
  assertState(
    opened.leftExpanded === 'true' && opened.rightExpanded === 'true',
    '初期状態で両サイドバーが開いていません',
    opened
  )
  assertState(
    coversPanelHeightAtRightEdge(opened.leftPanelRect, opened.leftButtonRect),
    '展開時の左閉じるボタンが右端の全高ハンドルになっていません',
    opened
  )
  assertState(
    coversPanelWidth(opened.rightPanelRect, opened.rightButtonRect),
    '展開時の右閉じるボタンがサイドバー上端の横幅を覆っていません',
    opened
  )
  const openedImage = await window.webContents.capturePage()
  await writeFile(
    resolve(outputDirectory, '00-both-sidebars-open.png'),
    openedImage.toPNG()
  )

  await clickOpenLeftSidebarEdge(window)
  await clickOpenSidebarStrip(window, 'right-sidebar-content', '.related-panel-shell')
  const collapsedWide = await sidebarState(window)
  assertState(
    collapsedWide.leftExpanded === 'false' &&
      collapsedWide.rightExpanded === 'false' &&
      collapsedWide.leftHidden &&
      collapsedWide.rightHidden &&
      collapsedWide.leftDisplay === 'none' &&
      collapsedWide.rightDisplay === 'none' &&
      collapsedWide.leftCollapsedClass &&
      collapsedWide.rightCollapsedClass,
    '折り畳み状態がDOMとARIAへ反映されていません',
    collapsedWide
  )
  assertState(
    collapsedWide.selectedNote === opened.selectedNote,
    '折り畳みで選択中ノートが変わりました',
    collapsedWide
  )
  assertState(
    coversPanel(collapsedWide.leftPanelRect, collapsedWide.leftButtonRect) &&
      coversPanel(collapsedWide.rightPanelRect, collapsedWide.rightButtonRect),
    '折り畳み時の再表示ボタンがサイドバー全体を覆っていません',
    collapsedWide
  )

  const image = await window.webContents.capturePage()
  await writeFile(
    resolve(outputDirectory, '01-both-sidebars-collapsed.png'),
    image.toPNG()
  )

  window.setSize(640, 720, false)
  await delay(300)
  const collapsedNarrow = await sidebarState(window)
  assertState(
    collapsedNarrow.documentWidth <= collapsedNarrow.viewport.width &&
      collapsedNarrow.workspaceWidth <= collapsedNarrow.viewport.width,
    '狭いviewportの折り畳み状態で横overflowが発生しました',
    collapsedNarrow
  )

  await clickCollapsedRail(window, 'left-sidebar-content', '.left-panel')
  await clickCollapsedRail(window, 'right-sidebar-content', '.related-panel-shell')
  const reopened = await sidebarState(window)
  assertState(
    reopened.leftExpanded === 'true' &&
      reopened.rightExpanded === 'true' &&
      !reopened.leftHidden &&
      !reopened.rightHidden &&
      reopened.leftDisplay !== 'none' &&
      reopened.rightDisplay !== 'none',
    'サイドバーを復元できません',
    reopened
  )
  assertState(
    reopened.selectedNote === opened.selectedNote,
    '復元後に選択中ノートが変わりました',
    reopened
  )

  const result = {
    result: 'pass',
    isolatedVault: vault,
    opened,
    collapsedWide,
    collapsedNarrow,
    reopened
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
