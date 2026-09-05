import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, readdir, utimes, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import electron from 'electron'

const { app, BrowserWindow } = electron
const repoRoot = resolve(import.meta.dirname, '..')
const sourceVault = resolve(repoRoot, 'fixtures/obsidian-graph-parity-vault')
const assetArgument = process.argv[2]
const applicationEntry = resolve(process.argv[3] || resolve(repoRoot, 'out/main/index.js'))
const outputDirectory = resolve(
  process.argv[4] || resolve(repoRoot, 'docs/reports/assets/calendar-plugin-compatibility-2026-08-29')
)

const EXPECTED = Object.freeze({
  main: '7fb339e9cf9fdbe5a801fa2b8ab85b366b5b3777fbd193cbc8728bc27711d125',
  manifest: 'f3e9581338648512baa12d5b458490f7fd367918f7bdb6bd86171ce57be7d08b'
})

function assert(condition, message, state = null) {
  if (!condition) {
    throw new Error(`${message}${state ? `: ${JSON.stringify(state)}` : ''}`)
  }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

function localDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function localTimestamp(date, hour = 12) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour).getTime()
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
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
  return {
    fileCount: paths.length,
    sha256: hash.digest('hex'),
    paths: paths.map((path) => relative(root, path).replaceAll('\\', '/'))
  }
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitFor(check, label, timeoutMilliseconds = 12_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastState = null
  while (Date.now() < deadline) {
    try {
      lastState = await check()
      if (lastState) return lastState
    } catch (error) {
      lastState = error instanceof Error ? error.message : String(error)
    }
    await delay(100)
  }
  throw new Error(`timeout: ${label}${lastState ? ` (${JSON.stringify(lastState)})` : ''}`)
}

async function readWhenPresent(path, label) {
  return waitFor(async () => {
    try {
      return await readFile(path, 'utf8')
    } catch {
      return null
    }
  }, label)
}

async function assertFileAbsent(path, label) {
  await delay(350)
  try {
    await readFile(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  throw new Error(`${label}: ${path}`)
}

async function runCommandPaletteCommand(window, label) {
  await evaluate(window, `window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'p',
    ctrlKey: true,
    bubbles: true
  }))`)
  await waitFor(
    () => evaluate(window, `document.querySelector('.command-palette-modal') !== null`),
    `command palette for ${label}`
  )
  const clicked = await evaluate(window, `(() => {
    const label = ${JSON.stringify(label)}
    const option = [...document.querySelectorAll('.command-palette-option')].find(
      (candidate) => candidate.querySelector('.command-palette-option-label')?.textContent?.trim() === label
    )
    option?.click()
    return Boolean(option)
  })()`)
  assert(clicked, `コマンドが見つかりません: ${label}`)
  await waitFor(
    () => evaluate(window, `document.querySelector('.command-palette-modal') === null`),
    `command palette close for ${label}`
  )
}

async function applyCalendarSettings(window, settings) {
  const sent = await evaluate(window, `(() => {
    const frame = document.querySelector('iframe[title="Calendar"]')
    if (!frame?.contentWindow) return false
    const session = new URL(frame.src).searchParams.get('session')
    frame.contentWindow.postMessage({
      channel: 'tsuzune-calendar',
      session,
      type: 'settings',
      payload: { settings: ${JSON.stringify(settings)} }
    }, 'tsuzune-calendar://host')
    return Boolean(session)
  })()`)
  assert(sent, 'Calendar設定を隔離ホストへ送れません')
  await delay(100)
}

async function openCalendarSettings(window) {
  const opened = await evaluate(window, `(() => {
    const button = document.querySelector('.activity-rail-footer button[aria-label="設定"]')
    button?.click()
    return Boolean(button)
  })()`)
  assert(opened, '設定ボタンが見つかりません')
  await waitFor(
    () => evaluate(window, `document.querySelector('.app-settings-modal') !== null`),
    'settings modal'
  )
  const selected = await evaluate(window, `(() => {
    const button = document.querySelector('.app-settings-navigation button[aria-label="Calendar互換"]')
    button?.click()
    return Boolean(button)
  })()`)
  assert(selected, 'Calendar設定カテゴリが見つかりません')
  return waitFor(
    () => evaluate(window, `(() => {
      const section = document.querySelector('.calendar-settings-section')
      const text = section?.innerText || ''
      const checkboxFor = (labelText) => [...(section?.querySelectorAll('label') || [])]
        .find((label) => label.textContent?.includes(labelText))
        ?.querySelector('input[type="checkbox"]')
      return text.includes('公式配布物を検証済み') && text.includes('SHA一致')
        ? {
            text,
            badge: section.querySelector('.calendar-compatibility-badge')?.textContent?.trim(),
            weekStart: section.querySelector('[aria-label="Calendarの週の開始曜日"]')?.value,
            wordsPerDot: section.querySelector('[aria-label="Calendarの1ドットあたりの単語数"]')?.value,
            localeOverride: section.querySelector('[aria-label="Calendarの表示言語"]')?.value,
            shouldConfirmBeforeCreate: checkboxFor('新しいデイリーノートを作る前に確認する')?.checked,
            showWeeklyNote: checkboxFor('週番号を表示する')?.checked
          }
        : null
    })()`),
    'verified Calendar settings'
  )
}

async function runAcceptance(window, fixture) {
  window.setSkipTaskbar(true)
  window.setPosition(-32_000, -32_000, false)
  window.showInactive()

  await waitFor(
    () => evaluate(window, `document.querySelector('iframe[title="Calendar"]') !== null`),
    'Calendar iframe'
  )
  const frame = await waitFor(
    () => window.webContents.mainFrame.framesInSubtree.find(
      (candidate) => candidate.url.startsWith('tsuzune-calendar://host/')
    ),
    'Calendar child frame'
  )

  const inspectFrame = () => frame.executeJavaScript(`(() => ({
    text: document.body.innerText.replace(/\\s+/g, ' ').trim(),
    dayCount: document.querySelectorAll('.day').length,
    todayCount: document.querySelectorAll('.day.today').length,
    filledDots: document.querySelectorAll('.dot.filled').length,
    todayFilledDots: document.querySelectorAll('.day.today .dot.filled').length,
    taskDots: document.querySelectorAll('.hollow.task').length,
    previewCount: document.querySelectorAll('.calendar-hover-preview').length,
    activeToday: Boolean(document.querySelector('.day.today.active')),
    hostChildren: document.getElementById('calendar-plugin-host')?.children.length || 0,
    headers: [...document.querySelectorAll('thead th')].map((element) => element.textContent.trim()),
    weekdayHeaders: [...document.querySelectorAll('thead th')]
      .map((element) => element.textContent.trim())
      .slice(-7),
    weekNumbers: [...document.querySelectorAll('.week-num')].map((element) => element.textContent.trim()),
    month: document.querySelector('.title .month')?.textContent?.trim() || null,
    year: document.querySelector('.title .year')?.textContent?.trim() || null,
    locale: window.moment.locale(),
    localeFirstWeekday: window.moment.weekdaysShort(true)[0],
    calendarVariables: (() => {
      const style = getComputedStyle(document.getElementById('calendar-container'))
      return {
        dot: style.getPropertyValue('--color-dot').trim(),
        textDay: style.getPropertyValue('--color-text-day').trim(),
        weekend: style.getPropertyValue('--color-background-weekend').trim()
      }
    })()
  }))()`, true)

  const clickMissingDay = (fromEnd = false) => frame.executeJavaScript(`(() => {
    const days = [...document.querySelectorAll('.day')]
    const candidates = days
      .map((element, index) => ({ element, index }))
      .filter(({ element }) => !element.classList.contains('has-note') && !element.classList.contains('today'))
    const candidate = candidates[${fromEnd ? 'candidates.length - 1' : '0'}]
    if (!candidate) return null
    const month = window.moment(
      (document.querySelector('.title .month')?.textContent || '') + ' ' +
      (document.querySelector('.title .year')?.textContent || ''),
      'MMM YYYY',
      true
    )
    const date = month.clone().startOf('month').startOf('week').add(candidate.index, 'days')
    candidate.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { date: date.format('YYYY-MM-DD'), index: candidate.index }
  })()`, true)

  const inspectCalendarModal = () => frame.executeJavaScript(`(() => {
    const modal = document.querySelector('.calendar-modal-container')
    return modal ? {
      title: modal.querySelector('h2')?.textContent?.trim() || '',
      text: modal.querySelector('p')?.textContent?.trim() || '',
      buttons: [...modal.querySelectorAll('button')].map((button) => button.textContent.trim())
    } : null
  })()`, true)

  const clickCalendarModalButton = (label) => frame.executeJavaScript(`(() => {
    const label = ${JSON.stringify(label)}
    const button = [...document.querySelectorAll('.calendar-modal-container button')]
      .find((candidate) => candidate.textContent?.trim() === label)
    button?.click()
    return Boolean(button)
  })()`, true)

  const initial = await waitFor(async () => {
    const state = await inspectFrame()
    return state.dayCount === 42 && state.filledDots === 2 && state.taskDots === 1
      ? state
      : null
  }, 'Calendar month, word dots, and unfinished-task dot')
  assert(initial.todayCount === 1, '今日の日付セルが一意ではありません', initial)
  assert(initial.text.length > 20, '月表示がありません', initial)
  assert(
    initial.weekdayHeaders[0] === initial.localeFirstWeekday,
    'locale既定の週開始が表示へ反映されていません',
    initial
  )
  assert(
    Object.values(initial.calendarVariables).every(Boolean),
    'Calendarの公式CSS変数が公開されていません',
    initial.calendarVariables
  )

  const activity = await waitFor(
    () => frame.executeJavaScript(`(() => {
      const trigger = document.querySelector(
        '.day[data-tsuzune-date="${fixture.activityDate}"] .tsuzune-note-activity-trigger'
      )
      const day = trigger?.closest('.day')
      return trigger ? {
        ariaLabel: trigger.getAttribute('aria-label'),
        created: Number(trigger.dataset.createdCount),
        modified: Number(trigger.dataset.modifiedCount),
        markers: trigger.querySelectorAll('.tsuzune-note-activity-mark').length,
        dayActivity: day?.dataset.tsuzuneActivity,
        dayBoxShadow: day ? getComputedStyle(day).boxShadow : 'none',
        legend: document.querySelector('.tsuzune-note-activity-legend')?.textContent.replace(/\\s+/g, ' ').trim() || null,
        triggerRect: (() => { const r = trigger.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } })(),
        dayRect: (() => { const r = day.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } })(),
        markerRects: [...trigger.querySelectorAll('.tsuzune-note-activity-mark')].map((mark) => { const r = mark.getBoundingClientRect(); return { width: r.width, height: r.height } })
      } : null
    })()`, true),
    'note creation and update activity marker'
  )
  assert(
    activity.created === 1 && activity.modified === 2 && activity.markers === 2 &&
      activity.dayActivity === 'created-modified' && activity.dayBoxShadow !== 'none' &&
      activity.legend?.includes('作成') && activity.legend?.includes('更新') &&
      activity.legend?.includes('印を押すと一覧'),
    '作成日・最終更新日の活動件数がCalendarへ表示されていません',
    activity
  )
  assert(
    activity.triggerRect.width >= 18 && activity.triggerRect.height >= 18 &&
      activity.triggerRect.left >= activity.dayRect.left && activity.triggerRect.top >= activity.dayRect.top &&
      activity.triggerRect.right <= activity.dayRect.right && activity.triggerRect.bottom <= activity.dayRect.bottom &&
      activity.markerRects.every((rect) => rect.width >= 6 && rect.height >= 6),
    '活動マーカーの可視サイズまたはクリック領域が日付セル内に収まっていません',
    activity
  )
  await mkdir(outputDirectory, { recursive: true })
  const activityMarkersScreenshotPath = resolve(outputDirectory, 'electron-activity-markers.png')
  window.webContents.invalidate()
  await delay(100)
  await writeFile(activityMarkersScreenshotPath, (await window.webContents.capturePage()).toPNG())
  const selectedBeforeActivity = await evaluate(
    window,
    `document.querySelector('.note-header strong')?.textContent?.trim() || null`
  )
  const activityPoint = await frame.executeJavaScript(`(() => {
    const trigger = document.querySelector(
      '.day[data-tsuzune-date="${fixture.activityDate}"] .tsuzune-note-activity-trigger'
    )
    if (!trigger) return null
    const r = trigger.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`, true)
  assert(activityPoint, '活動マーカーのクリック座標を取得できません')
  const iframePoint = await evaluate(window, `(() => {
    const frame = document.querySelector('iframe[title="Calendar"]')
    const r = frame.getBoundingClientRect()
    return { x: r.left + ${activityPoint.x}, y: r.top + ${activityPoint.y} }
  })()`)
  const hitTest = {
    parent: await evaluate(window, `document.elementFromPoint(${iframePoint.x}, ${iframePoint.y})?.getAttribute('title') || null`),
    frame: await frame.executeJavaScript(
      `document.elementFromPoint(${activityPoint.x}, ${activityPoint.y})?.closest('.tsuzune-note-activity-trigger')?.getAttribute('aria-label') || null`,
      true
    )
  }
  assert(
    hitTest.parent === 'Calendar' && hitTest.frame === activity.ariaLabel,
    '活動マーカーの画面座標が実際のクリック対象と一致しません',
    { iframePoint, activityPoint, hitTest }
  )
  await frame.executeJavaScript(`(() => {
    window.__tsuzuneActivityPointerEvents = []
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      document.addEventListener(type, (event) => {
        window.__tsuzuneActivityPointerEvents.push({
          type,
          target: event.target?.closest?.('.tsuzune-note-activity-trigger')?.getAttribute('aria-label') || event.target?.className || event.target?.tagName
        })
      }, { capture: true, once: true })
    }
  })()`, true)
  const inputPoint = { x: Math.round(iframePoint.x), y: Math.round(iframePoint.y) }
  const devtools = window.webContents.debugger
  if (!devtools.isAttached()) devtools.attach('1.3')
  await devtools.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', ...inputPoint })
  await devtools.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...inputPoint, button: 'left', clickCount: 1 })
  await devtools.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', ...inputPoint, button: 'left', clickCount: 1 })
  devtools.detach()
  await delay(100)
  const coordinateEvents = await frame.executeJavaScript('window.__tsuzuneActivityPointerEvents', true)
  assert(
    coordinateEvents.some((event) => event.type === 'click' && event.target === activity.ariaLabel),
    '活動マーカーへ実座標clickが届きません',
    { inputPoint, hitTest, coordinateEvents }
  )
  const activityPopover = await waitFor(
    () => frame.executeJavaScript(`(() => {
    const dialog = document.querySelector('.tsuzune-note-activity-popover')
    return dialog ? {
      ariaLabel: dialog.getAttribute('aria-label'),
      text: dialog.textContent.replace(/\\s+/g, ' ').trim(),
      paths: [...dialog.querySelectorAll('[data-note-path]')].map((element) => element.dataset.notePath),
      dailyModal: Boolean(document.querySelector('.calendar-modal-container'))
    } : null
  })()`, true),
    'note activity popover after coordinate click'
  )
  assert(
    activityPopover &&
      activityPopover.ariaLabel === `${fixture.activityDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, year, month, day) => `${Number(year)}年${Number(month)}月${Number(day)}日`)}のノート活動` &&
      activityPopover.text.includes('作成 1') &&
      activityPopover.text.includes('最終更新 2') &&
      activityPopover.paths.includes(fixture.createdActivityPath) &&
      activityPopover.paths.includes(fixture.updatedActivityPath) &&
      !activityPopover.paths.includes(fixture.historyActivityPath) &&
      activityPopover.dailyModal === false,
    'Calendarのノート活動一覧が正しく表示されていません',
    activityPopover
  )
  const dismissedOutside = await frame.executeJavaScript(`(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return document.querySelector('.tsuzune-note-activity-popover') === null
  })()`, true)
  assert(dismissedOutside, 'ノート活動一覧を外側クリックで閉じられません')
  assert(
    await evaluate(window, `document.querySelector('.note-header strong')?.textContent?.trim() || null`) === selectedBeforeActivity,
    '活動マーカーのクリックがDaily Noteクリックとして伝播しました'
  )
  const openedActivityNote = await frame.executeJavaScript(`(() => {
    document.querySelector(
      '.day[data-tsuzune-date="${fixture.activityDate}"] .tsuzune-note-activity-trigger'
    )?.click()
    const note = document.querySelector(
      '.tsuzune-note-activity-popover [data-note-path="${fixture.updatedActivityPath}"]'
    )
    note?.click()
    return Boolean(note)
  })()`, true)
  assert(openedActivityNote, '活動一覧のノートをクリックできません')
  await waitFor(
    () => evaluate(window, `document.querySelector('.note-header strong')?.textContent?.trim() === 'Calendar Updated'`),
    'note activity open bridge'
  )

  const clicked = await frame.executeJavaScript(`(() => {
    const day = document.querySelector('.day.today')
    day?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return Boolean(day)
  })()`, true)
  assert(clicked, '今日の日付セルをクリックできません')
  let clickDiagnostic = null
  const clickState = await waitFor(async () => {
    const child = await inspectFrame()
    const parent = await evaluate(window, `(() => ({
      activeTab: document.querySelector('.workspace-tab [role="tab"][aria-selected="true"]')?.getAttribute('aria-label') || null,
      tabs: document.querySelectorAll('.workspace-tab [role="tab"]').length,
      selectedHeading: document.querySelector('.note-header strong')?.textContent?.trim() || null,
      status: document.querySelector('.status-message')?.textContent?.trim() || null
    }))()`)
    clickDiagnostic = { child, parent }
    return child.activeToday && parent.selectedHeading === fixture.today ? clickDiagnostic : null
  }, 'daily-note click bridge').catch((error) => {
    throw new Error(`${error.message}: ${JSON.stringify(clickDiagnostic)}`)
  })

  const tabsBeforeControlClick = clickState.parent.tabs
  await frame.executeJavaScript(`(() => {
    document.querySelector('.day.today')?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      ctrlKey: true
    }))
  })()`, true)
  const tabsAfterControlClick = await waitFor(async () => {
    const count = await evaluate(window, `document.querySelectorAll('.workspace-tab [role="tab"]').length`)
    return count > tabsBeforeControlClick ? count : null
  }, 'Ctrl-click new tab')

  await frame.executeJavaScript(`(() => {
    document.querySelector('.day.today')?.dispatchEvent(new PointerEvent('pointerover', {
      bubbles: true,
      ctrlKey: true
    }))
  })()`, true)
  const preview = await waitFor(async () => {
    const state = await inspectFrame()
    return state.previewCount === 1 ? state : null
  }, 'Ctrl-hover note preview')

  const readOnlyDigest = await markdownDigest(fixture.vault)
  assert(
    fixture.markdownBefore.sha256 === readOnlyDigest.sha256,
    '読取操作中に隔離VaultのMarkdownが変化しました',
    { before: fixture.markdownBefore, after: readOnlyDigest }
  )

  const canceledDay = await clickMissingDay(false)
  assert(canceledDay && canceledDay.date !== 'Invalid date', '未作成日を選べません')
  const cancelModal = await waitFor(inspectCalendarModal, 'daily create confirmation')
  assert(
    cancelModal.title === 'New Daily Note' &&
      cancelModal.text.includes(canceledDay.date) &&
      cancelModal.buttons.includes('Never mind') &&
      cancelModal.buttons.includes('Create'),
    '公式の新規デイリーノート確認が表示されません',
    cancelModal
  )
  assert(await clickCalendarModalButton('Never mind'), 'デイリーノート作成をキャンセルできません')
  const canceledPath = resolve(fixture.vault, '02_デイリー', `${canceledDay.date}.md`)
  await assertFileAbsent(canceledPath, 'キャンセルしたノートが作成されました')
  const afterCancel = await markdownDigest(fixture.vault)
  assert(
    readOnlyDigest.sha256 === afterCancel.sha256,
    '作成キャンセルでMarkdownが変化しました',
    { before: readOnlyDigest, after: afterCancel }
  )

  const confirmedDay = await clickMissingDay(false)
  assert(confirmedDay?.date === canceledDay.date, 'キャンセル後に同じ未作成日を再選択できません')
  await waitFor(inspectCalendarModal, 'daily create confirmation retry')
  assert(await clickCalendarModalButton('Create'), '確認後のデイリーノート作成を開始できません')
  const confirmedDailyContent = await readWhenPresent(canceledPath, 'confirmed daily note creation')
  assert(
    confirmedDailyContent.includes('daily-template-marker') && !confirmedDailyContent.includes('{{'),
    'デイリーノートのテンプレートが展開されていません',
    { path: canceledPath, content: confirmedDailyContent }
  )
  await waitFor(async () => await inspectCalendarModal() === null, 'confirmed daily modal close')

  await applyCalendarSettings(window, {
    shouldConfirmBeforeCreate: false
  })
  await waitFor(async () => {
    try {
      const saved = JSON.parse(await readFile(resolve(fixture.userData, 'settings.json'), 'utf8'))
      return saved.calendarPlugin?.shouldConfirmBeforeCreate === false ? saved : null
    } catch {
      return null
    }
  }, 'confirmation setting persistence')
  const noConfirmDay = await clickMissingDay(true)
  assert(noConfirmDay && noConfirmDay.date !== 'Invalid date', '確認なし作成用の日付を選べません')
  await delay(350)
  const noConfirmModal = await inspectCalendarModal()
  assert(
    noConfirmModal === null,
    '確認OFFでも作成モーダルが表示されました',
    {
      modal: noConfirmModal,
      persisted: JSON.parse(await readFile(resolve(fixture.userData, 'settings.json'), 'utf8')).calendarPlugin
    }
  )
  const noConfirmPath = resolve(fixture.vault, '02_デイリー', `${noConfirmDay.date}.md`)
  const noConfirmContent = await readWhenPresent(noConfirmPath, 'daily note creation without confirmation')
  assert(
    noConfirmContent.includes('daily-template-marker') && !noConfirmContent.includes('{{'),
    '確認OFFのデイリーノートでテンプレートが展開されていません',
    { path: noConfirmPath, content: noConfirmContent }
  )

  await applyCalendarSettings(window, {
    weekStart: 'monday',
    wordsPerDot: 50,
    localeOverride: 'ja',
    shouldConfirmBeforeCreate: false,
    showWeeklyNote: true,
    weeklyNoteFormat: 'gggg-[W]ww',
    weeklyNoteTemplate: '90_テンプレート/週次',
    weeklyNoteFolder: '02_デイリー/週次'
  })
  const expanded = await waitFor(async () => {
    const state = await inspectFrame()
    return state.todayFilledDots === 5 && state.weekNumbers.length > 0 && state.locale === 'ja'
      ? state
      : null
  }, 'words-per-dot max, week start, locale, and week numbers')
  assert(
    expanded.weekdayHeaders[0] === expanded.localeFirstWeekday &&
      expanded.localeFirstWeekday.startsWith('月'),
    '月曜始まりと日本語localeが表示へ反映されていません',
    expanded
  )

  await delay(100)
  const mondayActivity = await frame.executeJavaScript(`(() => {
    const activities = [...document.querySelectorAll('.tsuzune-note-activity-trigger')].map((trigger) => {
      const day = trigger.closest('.day')
      return {
        date: day?.dataset.tsuzuneDate || null,
        displayedDay: day?.firstChild?.textContent?.trim() || null,
        adjacentMonth: day?.classList.contains('adjacent-month') || false,
        created: Number(trigger.dataset.createdCount),
        modified: Number(trigger.dataset.modifiedCount)
      }
    })
    return {
      expected: activities.find((activity) => activity.date === '${fixture.activityDate}') || null,
      activities,
      firstDisplayedDay: document.querySelector('.day')?.firstChild?.textContent?.trim() || null,
      firstCurrentMonthIndex: [...document.querySelectorAll('.day')]
        .findIndex((day) => !day.classList.contains('adjacent-month'))
    }
  })()`, true)
  assert(
    mondayActivity.expected?.date === fixture.activityDate &&
      mondayActivity.expected.displayedDay === String(Number(fixture.activityDate.slice(-2))) &&
      mondayActivity.expected.adjacentMonth === false &&
      mondayActivity.expected.created >= activity.created &&
      mondayActivity.expected.modified >= activity.modified,
    '月曜始まりでノート活動印が別の日付セルへずれました',
    mondayActivity
  )

  await runCommandPaletteCommand(window, 'Calendar: 週次ノートを開く')
  const weeklyDirectory = resolve(fixture.vault, '02_デイリー', '週次')
  const weeklyFile = await waitFor(async () => {
    try {
      const names = (await readdir(weeklyDirectory)).filter((name) => name.endsWith('.md'))
      return names.length === 1 ? names[0] : null
    } catch {
      return null
    }
  }, 'weekly note command creation')
  const weeklyPath = resolve(weeklyDirectory, weeklyFile)
  const weeklyContent = await readWhenPresent(weeklyPath, 'weekly note template expansion')
  assert(
    weeklyContent.includes('weekly-template-marker') &&
      !weeklyContent.includes('{{') &&
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        .every((day) => weeklyContent.includes(`${day}:`)),
    '週次テンプレートタグがすべて展開されていません',
    { path: weeklyPath, content: weeklyContent }
  )
  const weeklyClicked = await frame.executeJavaScript(`(() => {
    const week = document.querySelector('.week-num.has-note') || document.querySelector('.week-num.active')
    week?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return Boolean(week)
  })()`, true)
  assert(weeklyClicked, '作成済み週次ノートの週番号セルをクリックできません')

  await frame.executeJavaScript(`document.querySelector('.day.today')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`, true)
  await waitFor(
    () => evaluate(window, `document.querySelector('.note-header strong')?.textContent?.trim() === ${JSON.stringify(fixture.today)}`),
    'return to active daily note'
  )
  const expectedRevealTitle = await frame.executeJavaScript(`({
    month: window.moment().format('MMM'),
    year: window.moment().format('YYYY')
  })`, true)
  const movedMonth = await frame.executeJavaScript(`(() => {
    const before = document.querySelector('.title')?.textContent?.replace(/\\s+/g, ' ').trim()
    document.querySelector('.arrow.right')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return before
  })()`, true)
  await waitFor(async () => {
    const state = await inspectFrame()
    return `${state.month} ${state.year}` !== movedMonth ? state : null
  }, 'navigate away before reveal')
  await runCommandPaletteCommand(window, 'Calendar: 選択中のノートを表示')
  const revealed = await waitFor(async () => {
    const state = await inspectFrame()
    return state.activeToday &&
      state.month === expectedRevealTitle.month &&
      state.year === expectedRevealTitle.year
      ? state
      : null
  }, 'reveal active daily note command')

  const collapsed = await evaluate(window, `(() => {
    const button = document.querySelector('button[aria-label="右サイドバーを閉じる"]')
    button?.click()
    return Boolean(button)
  })()`)
  assert(collapsed, '右サイドバーを閉じられません')
  await waitFor(
    () => evaluate(window, `document.querySelector('button[aria-label="右サイドバーを開く"]') !== null`),
    'right sidebar close'
  )
  await runCommandPaletteCommand(window, 'Calendar: ビューを開く')
  await waitFor(
    () => evaluate(window, `document.querySelector('button[aria-label="右サイドバーを閉じる"]') !== null`),
    'show Calendar view command'
  )

  await applyCalendarSettings(window, {
    weekStart: 'sunday',
    wordsPerDot: 0,
    localeOverride: 'en',
    showWeeklyNote: false
  })
  const disabledDots = await waitFor(async () => {
    const state = await inspectFrame()
    return state.filledDots === 0 && state.weekNumbers.length === 0 && state.locale === 'en'
      ? state
      : null
  }, 'disabled word dots and Sunday week start')
  assert(
    disabledDots.weekdayHeaders[0] === 'Sun',
    '日曜始まりが表示へ反映されていません',
    disabledDots
  )

  const customCssOverride = await frame.executeJavaScript(`(() => {
    const style = document.createElement('style')
    style.textContent = '#calendar-container { --color-dot: rgb(1, 2, 3); }'
    document.head.append(style)
    return getComputedStyle(document.getElementById('calendar-container'))
      .getPropertyValue('--color-dot').trim()
  })()`, true)
  assert(customCssOverride === 'rgb(1, 2, 3)', '公式CSS変数を上書きできません', customCssOverride)

  const persistedSettings = JSON.parse(await readFile(resolve(fixture.userData, 'settings.json'), 'utf8'))
  assert(
    persistedSettings.calendarPlugin?.wordsPerDot === 0 &&
      persistedSettings.calendarPlugin?.weekStart === 'sunday' &&
      persistedSettings.calendarPlugin?.showWeeklyNote === false,
    'Calendar設定がsettings.jsonへ永続化されていません',
    persistedSettings.calendarPlugin
  )

  const reloaded = new Promise((resolveReload) => {
    window.webContents.once('did-finish-load', resolveReload)
  })
  window.webContents.reload()
  await reloaded
  await waitFor(
    () => evaluate(window, `document.querySelector('.activity-rail-footer button[aria-label="設定"]') !== null`),
    'renderer restart'
  )
  const reloadedFrame = await waitFor(
    () => window.webContents.mainFrame.framesInSubtree.find(
      (candidate) => candidate.url.startsWith('tsuzune-calendar://host/')
    ),
    'Calendar frame after renderer restart'
  )
  const reloadedRuntime = await waitFor(async () => {
    const state = await reloadedFrame.executeJavaScript(`(() => ({
      filledDots: document.querySelectorAll('.dot.filled').length,
      weekNumbers: document.querySelectorAll('.week-num').length,
      firstWeekday: [...document.querySelectorAll('thead th')]
        .map((element) => element.textContent.trim())
        .slice(-7)[0],
      locale: window.moment.locale()
    }))()`, true)
    return state.filledDots === 0 &&
      state.weekNumbers === 0 &&
      state.firstWeekday === 'Sun' &&
      state.locale === 'en'
      ? state
      : null
  }, 'Calendar settings after renderer restart')

  const settings = await openCalendarSettings(window)
  assert(
    settings.weekStart === 'sunday' &&
      settings.wordsPerDot === '0' &&
      settings.localeOverride === 'en' &&
      settings.shouldConfirmBeforeCreate === false &&
      settings.showWeeklyNote === false,
    '永続化したCalendar設定が設定画面へ再表示されていません',
    settings
  )
  const closedSettings = await evaluate(window, `(() => {
    const button = document.querySelector('.app-settings-modal [aria-label="設定を閉じる"]')
    button?.click()
    return Boolean(button)
  })()`)
  assert(closedSettings, 'Calendar設定を閉じられません')
  await waitFor(
    () => evaluate(window, `document.querySelector('.app-settings-modal') === null`),
    'close Calendar settings before activity screenshot'
  )
  const reloadedActivity = await waitFor(
    () => reloadedFrame.executeJavaScript(`(() => {
      const trigger = document.querySelector(
        '.day[data-tsuzune-date="${fixture.activityDate}"] .tsuzune-note-activity-trigger'
      )
      trigger?.click()
      const dialog = document.querySelector('.tsuzune-note-activity-popover')
      return dialog ? {
        paths: [...dialog.querySelectorAll('[data-note-path]')].map((element) => element.dataset.notePath),
        text: dialog.textContent.replace(/\\s+/g, ' ').trim()
      } : null
    })()`, true),
    'note activity after renderer restart'
  )
  assert(
    reloadedActivity.paths.includes(fixture.createdActivityPath) &&
      reloadedActivity.paths.includes(fixture.updatedActivityPath) &&
      !reloadedActivity.paths.includes(fixture.historyActivityPath),
    '再起動後のノート活動一覧が復元されていません',
    reloadedActivity
  )
  const markdownAfter = await markdownDigest(fixture.vault)
  const expectedCreatedPaths = [
    `02_デイリー/${canceledDay.date}.md`,
    `02_デイリー/${noConfirmDay.date}.md`,
    `02_デイリー/週次/${weeklyFile}`
  ].sort((left, right) => left.localeCompare(right, 'ja'))
  const createdPaths = markdownAfter.paths
    .filter((path) => !fixture.markdownBefore.paths.includes(path))
    .sort((left, right) => left.localeCompare(right, 'ja'))
  const removedPaths = fixture.markdownBefore.paths.filter((path) => !markdownAfter.paths.includes(path))
  assert(
    JSON.stringify(createdPaths) === JSON.stringify(expectedCreatedPaths) && removedPaths.length === 0,
    '隔離Vaultに想定外のMarkdown変更があります',
    { expectedCreatedPaths, createdPaths, removedPaths }
  )

  const finalUi = {
    settingsOpen: await evaluate(window, `document.querySelector('.app-settings-modal') !== null`),
    activityOpen: await reloadedFrame.executeJavaScript(
      `document.querySelector('.tsuzune-note-activity-popover') !== null`,
      true
    )
  }
  assert(!finalUi.settingsOpen && finalUi.activityOpen, '活動一覧の画面証拠を取得できる状態ではありません', finalUi)
  await evaluate(window, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
  window.webContents.invalidate()
  await delay(100)

  await mkdir(outputDirectory, { recursive: true })
  const screenshotPath = resolve(outputDirectory, 'electron-acceptance.png')
  const screenshot = await window.webContents.capturePage()
  await writeFile(screenshotPath, screenshot.toPNG())
  const result = {
    checkedAt: new Date().toISOString(),
    overall: 'PASS',
    applicationEntry,
    artifact: EXPECTED,
    runtime: {
      frameUrl: reloadedFrame.url,
      days: initial.dayCount,
      filledDots: initial.filledDots,
      unfinishedTaskDots: initial.taskDots,
      clickOpened: clickState.parent.selectedHeading,
      controlClickAddedTab: tabsAfterControlClick > tabsBeforeControlClick,
      controlHoverPreview: preview.previewCount === 1,
      settingsBadge: settings.badge,
      createConfirmationCancel: afterCancel.sha256 === readOnlyDigest.sha256,
      createConfirmationAccept: relative(fixture.vault, canceledPath).replaceAll('\\', '/'),
      createWithoutConfirmation: relative(fixture.vault, noConfirmPath).replaceAll('\\', '/'),
      maxWordDots: expanded.todayFilledDots,
      disabledWordDots: disabledDots.filledDots,
      mondayJapaneseWeekStart: expanded.weekdayHeaders[0],
      mondayNoteActivity: mondayActivity.expected,
      sundayWeekStart: disabledDots.weekdayHeaders[0],
      weekNumbers: expanded.weekNumbers.length,
      weeklyNote: relative(fixture.vault, weeklyPath).replaceAll('\\', '/'),
      weeklyTemplateTagsExpanded: !weeklyContent.includes('{{'),
      revealActiveNote: revealed.activeToday,
      showCalendarView: true,
      customCssVariableOverride: customCssOverride,
      settingsPersisted: true,
      rendererRestartRestored: reloadedRuntime,
      noteActivity: {
        date: fixture.activityDate,
        created: activity.created,
        modified: activity.modified,
        historyExcluded: !activityPopover.paths.includes(fixture.historyActivityPath),
        opened: fixture.updatedActivityPath,
        outsideDismissed: dismissedOutside,
        markerScreenshot: relative(repoRoot, activityMarkersScreenshotPath).replaceAll('\\', '/')
      }
    },
    fixture: {
      markdownBefore: fixture.markdownBefore,
      markdownAfter,
      expectedCreatedPaths,
      createdPaths,
      removedPaths,
      expectedChangesOnly: true
    },
    screenshot: relative(repoRoot, screenshotPath).replaceAll('\\', '/')
  }
  await writeFile(
    resolve(outputDirectory, 'result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  )
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

assert(assetArgument, 'Usage: npx electron scripts/check-calendar-plugin-electron.mjs <official-calendar-asset-directory>')
const assetDirectory = resolve(assetArgument)
const [mainSource, manifestSource] = await Promise.all([
  readFile(resolve(assetDirectory, 'main.js')),
  readFile(resolve(assetDirectory, 'manifest.json'))
])
assert(digest(mainSource) === EXPECTED.main, '公式main.jsのSHA-256が一致しません')
assert(digest(manifestSource) === EXPECTED.manifest, '公式manifest.jsonのSHA-256が一致しません')

const runtimeRoot = await mkdtemp(join(tmpdir(), 'tsuzune-calendar-electron-'))
assert(
  runtimeRoot.startsWith(resolve(tmpdir()) + '\\'),
  '隔離runtime rootが一時ディレクトリ外です',
  { runtimeRoot }
)
const vault = resolve(runtimeRoot, 'vault')
const userData = resolve(runtimeRoot, 'user-data')
const pluginDirectory = resolve(vault, '.obsidian', 'plugins', 'calendar')
const today = localDate(new Date())
const dailyPath = `02_デイリー/${today}.md`
const createdActivityPath = '10_projects/Calendar Created.md'
const updatedActivityPath = '20_knowledge/Calendar Updated.md'
const historyActivityPath = '50_履歴/AI更新/Calendar Hidden.md'

await cp(sourceVault, vault, { recursive: true })
await Promise.all([
  mkdir(pluginDirectory, { recursive: true }),
  mkdir(userData, { recursive: true }),
  mkdir(resolve(vault, '02_デイリー'), { recursive: true }),
  mkdir(resolve(vault, '90_テンプレート'), { recursive: true }),
  mkdir(resolve(vault, '50_履歴', 'AI更新'), { recursive: true })
])
await Promise.all([
  writeFile(resolve(pluginDirectory, 'main.js'), mainSource),
  writeFile(resolve(pluginDirectory, 'manifest.json'), manifestSource),
  writeFile(
    resolve(vault, ...dailyPath.split('/')),
    `${Array.from({ length: 520 }, (_, index) => `word${index}`).join(' ')}\n\n- [ ] unfinished task\n`,
    'utf8'
  ),
  writeFile(
    resolve(vault, '90_テンプレート', '今日のノート.md'),
    '# {{date:YYYY-MM-DD}}\n\ndaily-template-marker\n\nTitle: {{title}}\n',
    'utf8'
  ),
  writeFile(
    resolve(vault, '90_テンプレート', '週次.md'),
    [
      '# {{title}}',
      '',
      'weekly-template-marker',
      'Sunday: {{sunday:YYYY-MM-DD}}',
      'Monday: {{monday:YYYY-MM-DD}}',
      'Tuesday: {{tuesday:YYYY-MM-DD}}',
      'Wednesday: {{wednesday:YYYY-MM-DD}}',
      'Thursday: {{thursday:YYYY-MM-DD}}',
      'Friday: {{friday:YYYY-MM-DD}}',
      'Saturday: {{saturday:YYYY-MM-DD}}',
      'Date: {{date:YYYY-MM-DD}}',
      'Time: {{time:HH:mm}}',
      ''
    ].join('\n'),
    'utf8'
  ),
  writeFile(resolve(vault, ...createdActivityPath.split('/')), '# Calendar Created\n', 'utf8'),
  writeFile(resolve(vault, ...updatedActivityPath.split('/')), '# Calendar Updated\n', 'utf8'),
  writeFile(resolve(vault, ...historyActivityPath.split('/')), '# Calendar Hidden\n', 'utf8'),
  writeFile(
    resolve(userData, 'settings.json'),
    `${JSON.stringify({ lastVaultPath: vault, lastNotePath: '00_Home.md' }, null, 2)}\n`,
    'utf8'
  )
])

const activityTimestamp = localTimestamp(today)
const oldTimestamp = activityTimestamp - 45 * 24 * 60 * 60 * 1000
const preparedMarkdown = await markdownDigest(vault)
const creationTimes = Object.fromEntries(preparedMarkdown.paths.map((path) => [path, oldTimestamp]))
creationTimes[createdActivityPath] = activityTimestamp
creationTimes[historyActivityPath] = activityTimestamp
await writeFile(
  resolve(vault, '.tsuzune', 'graph-file-times.json'),
  `${JSON.stringify(creationTimes, null, 2)}\n`,
  'utf8'
)
await Promise.all(preparedMarkdown.paths.map((path) =>
  utimes(resolve(vault, ...path.split('/')), new Date(oldTimestamp), new Date(oldTimestamp))
))
await Promise.all([createdActivityPath, updatedActivityPath, historyActivityPath].map((path) =>
  utimes(resolve(vault, ...path.split('/')), new Date(activityTimestamp), new Date(activityTimestamp))
))

const fixture = {
  vault,
  userData,
  today,
  activityDate: today,
  createdActivityPath,
  updatedActivityPath,
  historyActivityPath,
  markdownBefore: await markdownDigest(vault)
}

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.setPath('userData', userData)

let started = false
process.once('exit', () => {
  try {
    rmSync(runtimeRoot, { recursive: true, force: true })
  } catch {
    // Electron may retain a transient cache file until process teardown.
  }
})
const originalLoadFile = BrowserWindow.prototype.loadFile
BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!started) {
    started = true
    void loaded
      .then(() => runAcceptance(this, fixture))
      .then(() => {
        this.destroy()
        app.exit(0)
      })
      .catch((error) => {
        console.error(error?.stack || error)
        this.destroy()
        app.exit(1)
        process.exitCode = 1
      })
  }
  return loaded
}

await import(pathToFileURL(applicationEntry).href)
