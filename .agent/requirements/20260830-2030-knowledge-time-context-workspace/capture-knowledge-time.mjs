import { app, BrowserWindow } from 'electron'
import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sourceVault = resolve('fixtures/obsidian-graph-parity-vault')
const outputDirectory = resolve(
  'docs/reports/assets/knowledge-time-ux-2026-08-31'
)
const temporaryRoot = await mkdtemp(join(tmpdir(), 'tsuzune-knowledge-time-'))
const vault = join(temporaryRoot, 'vault')
const userDataDirectory = join(temporaryRoot, 'user-data')
const originalLoadFile = BrowserWindow.prototype.loadFile
let captureStarted = false

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitFor(window, expression, label) {
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
          reject(new Error(${JSON.stringify(`${label}を待機できませんでした。`)}))
        }
      }, 100)
    })`
  )
  await delay(200)
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
  if (!clicked) throw new Error(`ボタン「${label}」が見つかりませんでした。`)
  await delay(250)
}

async function capture(window, name) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, name), image.toPNG())
}

async function layoutState(window) {
  return evaluate(
    window,
    `(() => {
      const workspace = document.querySelector('.knowledge-time-workspace')
      const controls = document.querySelector('.knowledge-time-controls')
      const body = document.querySelector('.knowledge-time-body')
      const controlColumns = controls ? getComputedStyle(controls).gridTemplateColumns : null
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        workspaceOverflow: Boolean(workspace && workspace.scrollWidth > workspace.clientWidth),
        workspaceScrollable: Boolean(
          workspace &&
          workspace.scrollHeight > workspace.clientHeight &&
          ['auto', 'scroll'].includes(getComputedStyle(workspace).overflowY)
        ),
        controlColumns,
        controlColumnCount: controlColumns?.split(/\\s+/).filter(Boolean).length ?? 0,
        bodyColumns: body ? getComputedStyle(body).gridTemplateColumns : null,
        bodyScrollable: Boolean(
          body &&
          body.scrollHeight > body.clientHeight &&
          ['auto', 'scroll'].includes(getComputedStyle(body).overflowY)
        ),
        heading: document.querySelector('#knowledge-time-title')?.textContent ?? null,
        evidenceCount: document.querySelectorAll('.knowledge-time-evidence').length,
        rightPanelPresent: Boolean(document.querySelector('.related-panel-shell'))
      }
    })()`
  )
}

async function rightContextState(window) {
  return evaluate(
    window,
    `(() => {
      const panel = document.querySelector('.related-panel')
      const tabs = [...document.querySelectorAll('.related-panel-tab')]
      const tabRows = new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)))
      const legend = document.querySelector('.daily-calendar-activity-legend')
      const legendItems = [...(legend?.querySelectorAll(':scope > span') ?? [])]
      return {
        viewport: { width: innerWidth, height: innerHeight },
        heading: document.querySelector('#related-panel-title')?.textContent?.trim() ?? null,
        selectedNoteName: document.querySelector('.related-panel-heading p')?.textContent?.trim() ?? null,
        tabCount: tabs.length,
        tabRows: tabRows.size,
        panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth),
        legend: legend?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
        legendPassive: legendItems.every((item) => {
          const style = getComputedStyle(item)
          return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopStyle === 'none'
        })
      }
    })()`
  )
}

async function rightContextScrolledState(window) {
  return evaluate(
    window,
    `(() => {
      const panel = document.querySelector('.related-panel')
      const sticky = document.querySelector('.related-panel-sticky')
      const heading = document.querySelector('.related-panel-heading')
      const tabs = document.querySelector('.related-panel-tabs')
      if (!panel || !sticky || !heading || !tabs) return null
      panel.scrollTop = panel.scrollHeight
      const panelBounds = panel.getBoundingClientRect()
      const headingBounds = heading.getBoundingClientRect()
      const tabsBounds = tabs.getBoundingClientRect()
      return {
        scrollable: panel.scrollHeight > panel.clientHeight,
        scrollTop: panel.scrollTop,
        stickyPosition: getComputedStyle(sticky).position,
        headingVisible: headingBounds.top >= panelBounds.top - 1 && headingBounds.bottom <= panelBounds.bottom + 1,
        tabsVisible: tabsBounds.top >= panelBounds.top - 1 && tabsBounds.bottom <= panelBounds.bottom + 1
      }
    })()`
  )
}

async function prepare() {
  await Promise.all([
    cp(sourceVault, vault, { recursive: true }),
    mkdir(userDataDirectory, { recursive: true }),
    mkdir(outputDirectory, { recursive: true })
  ])
  app.setPath('userData', userDataDirectory)
  await writeFile(
    join(userDataDirectory, 'settings.json'),
    JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2),
    'utf8'
  )
}

async function runCapture(window) {
  window.setSkipTaskbar(true)
  window.setContentSize(1265, 792, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, `document.querySelector('.app-shell')`, 'workspace shell')

  const rightContext = await rightContextState(window)
  if (
    rightContext.heading !== 'ノートの文脈' ||
    rightContext.tabCount !== 4 ||
    rightContext.tabRows !== 2 ||
    rightContext.panelOverflow ||
    !rightContext.selectedNoteName ||
    !rightContext.legendPassive ||
    !rightContext.legend?.includes('日付の印を押すと一覧')
  ) {
    throw new Error(`右文脈ペインのレイアウトが不正です: ${JSON.stringify(rightContext)}`)
  }
  await capture(window, 'right-context-1265.png')

  window.setContentSize(1265, 650, false)
  await delay(300)
  const rightContextScrolled = await rightContextScrolledState(window)
  if (
    !rightContextScrolled?.scrollable ||
    rightContextScrolled.scrollTop < 1 ||
    rightContextScrolled.stickyPosition !== 'sticky' ||
    !rightContextScrolled.headingVisible ||
    !rightContextScrolled.tabsVisible
  ) {
    throw new Error(`右文脈ペインの固定表示が不正です: ${JSON.stringify(rightContextScrolled)}`)
  }
  await capture(window, 'right-context-scrolled-1265.png')

  window.setContentSize(1440, 900, false)
  await delay(300)

  await clickButton(window, '知識の時間')
  await waitFor(window, `document.querySelector('#knowledge-time-title')`, '知識の時間')
  await evaluate(
    window,
    `(() => {
      const input = document.querySelector('input[aria-label="目的"]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '設計判断と現在までの変化')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })()`
  )
  await clickButton(window, 'この条件で根拠を見る')
  await waitFor(
    window,
    `document.querySelectorAll('.knowledge-time-evidence').length > 0`,
    'Contextの根拠'
  )

  const captures = []
  for (const [index, [width, height, name]] of [
    [1440, 900, 'knowledge-time-1440.png'],
    [1265, 792, 'knowledge-time-1265.png'],
    [1024, 768, 'knowledge-time-1024.png'],
    [720, 768, 'knowledge-time-720.png']
  ].entries()) {
    if (index > 0) window.setSize(width, height, false)
    await delay(350)
    const state = await layoutState(window)
    const expectedControlColumns = width === 1440 ? 3 : width === 720 ? 1 : 2
    if (
      state.heading !== '知識の時間' ||
      state.evidenceCount < 1 ||
      !state.rightPanelPresent ||
      state.documentOverflow ||
      state.workspaceOverflow ||
      state.controlColumnCount !== expectedControlColumns ||
      (width === 720 && !state.workspaceScrollable)
    ) {
      throw new Error(`${width}pxレイアウトが不正です: ${JSON.stringify(state)}`)
    }
    captures.push(state)
    await capture(window, name)
    if (width === 720) {
      const evidenceReachable = await evaluate(
        window,
        `(() => {
          const workspace = document.querySelector('.knowledge-time-workspace')
          workspace?.scrollTo({ top: workspace.scrollHeight })
          const lastEvidence = [...document.querySelectorAll('.knowledge-time-evidence')].at(-1)
          const bounds = lastEvidence?.getBoundingClientRect()
          return Boolean(bounds && bounds.top < innerHeight && bounds.bottom > 0)
        })()`
      )
      await delay(200)
      if (!evidenceReachable) throw new Error('720pxで根拠一覧の末尾へ到達できません。')
      await capture(window, 'knowledge-time-720-results.png')
    }
  }

  const result = { temporaryRoot, rightContext, rightContextScrolled, captures }
  await writeFile(
    resolve(outputDirectory, 'capture-result.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  )
  console.log(JSON.stringify(result, null, 2))
  app.exit(0)
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

await import(pathToFileURL(resolve('out/main/index.js')).href)
