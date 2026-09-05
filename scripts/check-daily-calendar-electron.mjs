import { cp, mkdir, mkdtemp, readFile, utimes, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import electron from 'electron'

if (typeof electron === 'string') {
  const wrapperRuntimeRoot = await mkdtemp(join(tmpdir(), 'tsuzune-daily-calendar-electron-'))
  const result = spawnSync(electron, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, TSUZUNE_DAILY_CALENDAR_RUNTIME: wrapperRuntimeRoot }
  })
  rmSync(wrapperRuntimeRoot, { recursive: true, force: true })
  process.exit(result.status ?? 1)
}
const { app, BrowserWindow } = electron
const repoRoot = resolve(import.meta.dirname, '..')
const sourceVault = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const applicationEntry = resolve(process.argv[2] || resolve(repoRoot, 'out/main/index.js'))
const outputDirectory = resolve(process.env.TSUZUNE_DAILY_CALENDAR_OUTPUT || resolve(repoRoot, 'docs/reports/assets/calendar-plugin-compatibility-2026-08-29'))
const fixtureDate = '2026-08-17'
const createdPath = '10_projects/Calendar Created.md'
const updatedPath = '20_knowledge/Calendar Updated.md'
const historyPath = '50_履歴/AI更新/Calendar Hidden.md'

const assert = (condition, message, state = null) => {
  if (!condition) throw new Error(`${message}${state ? `: ${JSON.stringify(state)}` : ''}`)
}
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
const evaluate = (window, expression) => window.webContents.executeJavaScript(expression, true)
async function waitFor(window, expression, label, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(window, expression)
      if (value) return value
    } catch {}
    await delay(100)
  }
  throw new Error(`timeout: ${label}`)
}

async function clickAt(window, point) {
  const input = { x: Math.round(point.x), y: Math.round(point.y) }
  window.webContents.sendInputEvent({ type: 'mouseMove', ...input })
  window.webContents.sendInputEvent({ type: 'mouseDown', ...input, button: 'left', clickCount: 1 })
  window.webContents.sendInputEvent({ type: 'mouseUp', ...input, button: 'left', clickCount: 1 })
  await delay(100)
}

const runtimeRoot = process.env.TSUZUNE_DAILY_CALENDAR_RUNTIME
  ? resolve(process.env.TSUZUNE_DAILY_CALENDAR_RUNTIME)
  : await mkdtemp(join(tmpdir(), 'tsuzune-daily-calendar-electron-'))
const vault = resolve(runtimeRoot, 'vault')
const userData = resolve(runtimeRoot, 'user-data')
const dailyPath = `02_デイリー/${fixtureDate}.md`
const activityTimestamp = new Date(2026, 7, 17, 12).getTime()
const oldTimestamp = activityTimestamp - 45 * 24 * 60 * 60 * 1000

await cp(sourceVault, vault, { recursive: true })
await Promise.all([
  mkdir(userData, { recursive: true }),
  mkdir(resolve(vault, '02_デイリー'), { recursive: true }),
  mkdir(resolve(vault, '10_projects'), { recursive: true }),
  mkdir(resolve(vault, '20_knowledge'), { recursive: true }),
  mkdir(resolve(vault, '50_履歴', 'AI更新'), { recursive: true })
])
await Promise.all([
  writeFile(resolve(vault, dailyPath), '# 2026-08-17\n\nDaily fixture\n', 'utf8'),
  writeFile(resolve(vault, createdPath), '# Calendar Created\n', 'utf8'),
  writeFile(resolve(vault, updatedPath), '# Calendar Updated\n', 'utf8'),
  writeFile(resolve(vault, historyPath), '# Calendar Hidden\n', 'utf8'),
  writeFile(resolve(userData, 'settings.json'), `${JSON.stringify({ lastVaultPath: vault, lastNotePath: dailyPath }, null, 2)}\n`, 'utf8'),
  writeFile(resolve(vault, '.tsuzune', 'graph-file-times.json'), `${JSON.stringify({ [dailyPath]: oldTimestamp, [createdPath]: activityTimestamp, [updatedPath]: oldTimestamp, [historyPath]: activityTimestamp }, null, 2)}\n`, 'utf8')
])
await Promise.all([
  utimes(resolve(vault, dailyPath), new Date(oldTimestamp), new Date(oldTimestamp)),
  utimes(resolve(vault, createdPath), new Date(activityTimestamp), new Date(activityTimestamp)),
  utimes(resolve(vault, updatedPath), new Date(activityTimestamp), new Date(activityTimestamp)),
  utimes(resolve(vault, historyPath), new Date(activityTimestamp), new Date(activityTimestamp))
])
assert(!await (async () => { try { await readFile(resolve(vault, '.obsidian', 'plugins', 'calendar', 'main.js')); return true } catch { return false } })(), 'fixtureにCalendarプラグインが存在します')

app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.setPath('userData', userData)
process.env.TSUZUNE_HEADLESS_SMOKE = '1'
process.once('exit', () => { try { rmSync(runtimeRoot, { recursive: true, force: true }) } catch {} })

async function runAcceptance(window) {
  window.setSkipTaskbar(true)
  window.setSize(1280, 900, false)
  window.setPosition(-32000, -32000, false)
  window.showInactive()
  await waitFor(window, `Boolean(document.querySelector('.app-shell'))`, 'app shell')
  const mode = await evaluate(window, `(() => ({ iframe: Boolean(document.querySelector('iframe[title="Calendar"]')), calendar: Boolean(document.querySelector('.daily-calendar')) }))()`)
  assert(!mode.iframe && mode.calendar, '標準DailyCalendarではありません', mode)

  let month = await evaluate(window, `document.querySelector('.daily-calendar-header h2')?.textContent.trim() || ''`)
  for (let i = 0; i < 24 && month !== '2026年8月'; i += 1) {
    const [year, targetMonth] = month.match(/(\d+)年(\d+)月/).slice(1).map(Number)
    const direction = year > 2026 || (year === 2026 && targetMonth > 8) ? '前の月を表示' : '次の月を表示'
    await evaluate(window, `document.querySelector('button[aria-label="${direction}"]')?.click()`)
    await delay(100)
    month = await evaluate(window, `document.querySelector('.daily-calendar-header h2')?.textContent.trim() || ''`)
  }
  assert(month === '2026年8月', 'fixture月へ移動できません', { month })
  const targetTrigger = `Array.from(document.querySelectorAll('.daily-calendar-cell')).find((cell) => cell.querySelector('.daily-calendar-day[aria-label^="2026年8月17日"]'))?.querySelector('.daily-calendar-activity-trigger')`
  const state = await evaluate(window, `(() => {
    const trigger = ${targetTrigger}
    const cell = trigger?.closest('.daily-calendar-cell')
    const triggerRect = trigger?.getBoundingClientRect()
    const cellRect = cell?.getBoundingClientRect()
    const point = triggerRect ? { x: triggerRect.left + triggerRect.width / 2, y: triggerRect.top + triggerRect.height / 2 } : null
    return {
      legend: document.querySelector('.daily-calendar-activity-legend')?.innerText || '',
      trigger: Boolean(trigger),
      label: trigger?.getAttribute('aria-label') || '',
      triggerRect: triggerRect ? { left: triggerRect.left, top: triggerRect.top, right: triggerRect.right, bottom: triggerRect.bottom, width: triggerRect.width, height: triggerRect.height } : null,
      cellRect: cellRect ? { left: cellRect.left, top: cellRect.top, right: cellRect.right, bottom: cellRect.bottom } : null,
      hitLabel: point ? document.elementFromPoint(point.x, point.y)?.closest('.daily-calendar-activity-trigger')?.getAttribute('aria-label') || null : null,
      days: [...document.querySelectorAll('.daily-calendar-day')].map((day) => day.getAttribute('aria-label'))
    }
  })()`)
  assert(state.trigger && state.label.includes('作成1件') && /最終更新[1-9]\d*件/.test(state.label), '活動表示が不正です', state)
  assert(
    state.triggerRect.width >= 20 && state.triggerRect.height >= 18 &&
      state.triggerRect.left >= state.cellRect.left && state.triggerRect.top >= state.cellRect.top &&
      state.triggerRect.right <= state.cellRect.right && state.triggerRect.bottom <= state.cellRect.bottom &&
      state.hitLabel === state.label,
    '活動印の可視サイズまたはクリック座標が不正です',
    state
  )
  await mkdir(outputDirectory, { recursive: true })
  window.webContents.invalidate()
  await delay(150)
  await writeFile(resolve(outputDirectory, 'daily-calendar-markers.png'), (await window.webContents.capturePage()).toPNG())
  const activityPoint = {
    x: state.triggerRect.left + state.triggerRect.width / 2,
    y: state.triggerRect.top + state.triggerRect.height / 2
  }
  await clickAt(window, activityPoint)
  const opened = await waitFor(window, `(() => { const e = document.querySelector('.daily-calendar-activity-popover'); return e ? { text: e.innerText, rows: [...e.querySelectorAll('.daily-calendar-activity-note')].map((x) => x.innerText) } : null })()`, 'activity dialog')
  assert(opened.rows.some((row) => row.includes(createdPath)) && opened.rows.some((row) => row.includes(updatedPath)) && !opened.rows.some((row) => row.includes(historyPath)), '活動一覧が不正です', opened)
  window.webContents.invalidate()
  await delay(150)
  await writeFile(resolve(outputDirectory, 'daily-calendar-activity-list.png'), (await window.webContents.capturePage()).toPNG())
  await evaluate(window, `(() => { const row = [...document.querySelectorAll('.daily-calendar-activity-note')].find((item) => item.innerText.includes(${JSON.stringify(updatedPath)})); row?.click() })()`)
  await waitFor(window, `Boolean(document.querySelector('.note-header strong'))`, 'activity note open')
  const openedNote = await evaluate(window, `document.querySelector('.note-header strong')?.textContent.trim() || ''`)
  assert(openedNote.includes('Calendar Updated'), '活動ノートを開けません', { openedNote })
  await clickAt(window, activityPoint)
  await waitFor(window, `Boolean(document.querySelector('.daily-calendar-activity-popover'))`, 'activity reopen')
  const outsidePoint = await evaluate(window, `(() => { const r = document.querySelector('.note-panel').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.className || null } })()`)
  await clickAt(window, outsidePoint)
  await waitFor(window, `!document.querySelector('.daily-calendar-activity-popover')`, 'outside close')
  await clickAt(window, activityPoint)
  await waitFor(window, `Boolean(document.querySelector('.daily-calendar-activity-popover'))`, 'activity second reopen')
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
  await waitFor(window, `!document.querySelector('.daily-calendar-activity-popover')`, 'escape close')
  const dailyPoint = await evaluate(window, `(() => { const day = document.querySelector('.daily-calendar-day[aria-label^="2026年8月17日"]'); const r = day.getBoundingClientRect(); const point = { x: r.left + r.width / 2, y: r.top + 8 }; return { ...point, hit: document.elementFromPoint(point.x, point.y)?.closest('.daily-calendar-day')?.getAttribute('aria-label') || null } })()`)
  assert(dailyPoint.hit?.startsWith('2026年8月17日'), '日付本体のクリック座標が活動印に奪われています', dailyPoint)
  await clickAt(window, dailyPoint)
  await waitFor(window, `Boolean(document.querySelector('.note-header strong'))`, 'daily note open')
  const dailyNote = await evaluate(window, `document.querySelector('.note-header strong')?.textContent.trim() || ''`)
  assert(dailyNote.includes('2026-08-17'), 'デイリーノートを開けません', { dailyNote })
  window.webContents.invalidate()
  await delay(150)
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, 'daily-calendar-electron.png'), image.toPNG())
  const result = {
    mode,
    month,
    activity: state,
    dialog: opened,
    interactions: { activityCoordinateClick: true, outsideCoordinateClose: true, escapeClose: true, dailyCoordinateClick: true, outsidePoint, dailyPoint },
    dailyOpened: true,
    fixture: { createdPath, updatedPath, historyPath },
    screenshots: {
      markers: 'docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-markers.png',
      activityList: 'docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-activity-list.png',
      final: 'docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-electron.png'
    }
  }
  await writeFile(resolve(outputDirectory, 'daily-calendar-electron.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

let started = false
const originalLoadFile = BrowserWindow.prototype.loadFile
BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!started) {
    started = true
    void loaded.then(() => runAcceptance(this)).then(() => { this.destroy(); app.exit(0) }).catch((error) => { console.error(error?.stack || error); this.destroy(); app.exit(1); process.exitCode = 1 })
  }
  return loaded
}
await import(`file://${applicationEntry.replaceAll('\\', '/')}`)
