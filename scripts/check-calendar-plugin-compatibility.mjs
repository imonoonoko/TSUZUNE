import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const EXPECTED = Object.freeze({
  id: 'calendar',
  version: '1.5.10',
  mainSha256: '7fb339e9cf9fdbe5a801fa2b8ab85b366b5b3777fbd193cbc8728bc27711d125',
  manifestSha256: 'f3e9581338648512baa12d5b458490f7fd367918f7bdb6bd86171ce57be7d08b'
})

const pluginDirectory = process.argv[2] || process.env.TSUZUNE_CALENDAR_PLUGIN_DIR
if (!pluginDirectory) {
  throw new Error(
    'Usage: node scripts/check-calendar-plugin-compatibility.mjs <path-to-calendar-plugin-directory>'
  )
}

const root = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(root, '..')
const require = createRequire(import.meta.url)

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function localDatePath(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `02_デイリー/${year}-${month}-${day}.md`
}

async function waitFor(predicate, label, timeoutMs = 5_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = predicate()
    if (value) return value
    await new Promise((resolveWait) => setTimeout(resolveWait, 10))
  }
  throw new Error(`${label} did not complete within ${timeoutMs}ms`)
}

const mainPath = join(resolve(pluginDirectory), 'main.js')
const manifestPath = join(resolve(pluginDirectory), 'manifest.json')
const [mainSource, manifestSource, bootstrapSource, commonJsSource, activateSource, momentSource] =
  await Promise.all([
    readFile(mainPath),
    readFile(manifestPath),
    readFile(join(projectRoot, 'src/main/calendar-plugin-host-bootstrap.js'), 'utf8'),
    readFile(join(projectRoot, 'src/main/calendar-plugin-host-commonjs.js'), 'utf8'),
    readFile(join(projectRoot, 'src/main/calendar-plugin-host-activate.js'), 'utf8'),
    readFile(require.resolve('moment/min/moment-with-locales.js'), 'utf8')
  ])

const manifest = JSON.parse(manifestSource.toString('utf8'))
const artifact = {
  id: manifest.id,
  version: manifest.version,
  mainSha256: sha256(mainSource),
  manifestSha256: sha256(manifestSource)
}
if (JSON.stringify(artifact) !== JSON.stringify(EXPECTED)) {
  throw new Error(`Official artifact contract mismatch: ${JSON.stringify(artifact)}`)
}

const now = new Date()
const notePath = localDatePath(now)
const noteContent = `${Array.from({ length: 520 }, (_, index) => `word${index}`).join(' ')}\n\n- [ ] unfinished task\n`
const snapshot = {
  rootPath: 'C:/CalendarCompatibilityFixture',
  rootName: 'CalendarCompatibilityFixture',
  directories: ['02_デイリー'],
  notes: [
    {
      path: notePath,
      name: notePath.split('/').at(-1),
      content: noteContent,
      modifiedAt: now.getTime(),
      createdAt: now.getTime(),
      size: Buffer.byteLength(noteContent)
    }
  ]
}
const settings = {
  shouldConfirmBeforeCreate: true,
  weekStart: 'locale',
  wordsPerDot: 250,
  showWeeklyNote: false,
  weeklyNoteFormat: '',
  weeklyNoteTemplate: '',
  weeklyNoteFolder: '',
  localeOverride: 'system-default'
}

const dom = new JSDOM(
  '<!doctype html><html lang="ja" data-calendar-session="acceptance" data-calendar-channel="tsuzune-calendar"><body><main id="calendar-plugin-host"></main></body></html>',
  {
    // JSDOM treats unknown schemes as opaque origins and disables localStorage.
    // Electron registers tsuzune-calendar as a secure standard scheme; HTTPS is
    // the equivalent storage model for this DOM-only conformance harness.
    url: 'https://host/?session=acceptance',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  }
)
const { window } = dom
window.TextEncoder = globalThis.TextEncoder
window.TextDecoder = globalThis.TextDecoder
window.confirm = () => true

const outbound = []
const runtimeErrors = []
let activated = null

function sendToHost(type, payload) {
  window.dispatchEvent(
    new window.MessageEvent('message', {
      source: parentBridge,
      origin: 'tsuzune-calendar://host',
      data: {
        channel: 'tsuzune-calendar',
        session: 'acceptance',
        type,
        payload
      }
    })
  )
}

const parentBridge = {
  postMessage(message) {
    outbound.push(message)
    if (message?.type === 'host-ready') {
      queueMicrotask(() =>
        sendToHost('init', {
          snapshot,
          settings,
          selectedPath: notePath,
          daily: { format: 'YYYY-MM-DD', folder: '02_デイリー', template: '' },
          language: 'ja'
        })
      )
      return
    }
    if (message?.type === 'activated') activated = message.payload
    if (message?.type === 'error') runtimeErrors.push(String(message.payload?.message || 'unknown'))
    if (message?.type !== 'request') return
    const { requestId, action, payload } = message.payload
    let value = null
    if (action === 'create-directory') value = { path: payload.path }
    if (action === 'create-note') {
      value = {
        path: payload.path,
        name: payload.path.split('/').at(-1),
        content: payload.content,
        modifiedAt: Date.now(),
        createdAt: Date.now(),
        size: Buffer.byteLength(payload.content)
      }
    }
    queueMicrotask(() =>
      sendToHost('response', { requestId, ok: true, value })
    )
  }
}
Object.defineProperty(window, 'parent', { configurable: true, value: parentBridge })
window.addEventListener('error', (event) => runtimeErrors.push(event.message))
window.addEventListener('unhandledrejection', (event) =>
  runtimeErrors.push(String(event.reason))
)

try {
  window.eval(`${bootstrapSource}\n//# sourceURL=calendar-plugin-host-bootstrap.js`)
  window.eval(`${momentSource}\n//# sourceURL=moment-with-locales.js`)
  window.eval(`${commonJsSource}\n//# sourceURL=calendar-plugin-host-commonjs.js`)
  window.eval(`${mainSource.toString('utf8')}\n//# sourceURL=calendar-plugin-main-1.5.10.js`)
  window.eval(`${activateSource}\n//# sourceURL=calendar-plugin-host-activate.js`)

  await waitFor(
    () => activated,
    `Calendar activation${runtimeErrors.length ? ` (${runtimeErrors.join(' | ')})` : ''}`
  )
  await waitFor(
    () => window.document.getElementById('calendar-plugin-host')?.children.length,
    'Calendar rendering'
  )
  await waitFor(
    () => window.document.querySelector('.hollow.task, .task.hollow'),
    'unfinished-task hollow dot',
    2_000
  )

  const commands = activated.commands.map((command) => command.id).sort()
  const expectedCommands = [
    'open-weekly-note',
    'reveal-active-note',
    'show-calendar-view'
  ]
  if (JSON.stringify(commands) !== JSON.stringify(expectedCommands)) {
    throw new Error(`Unexpected command contract: ${JSON.stringify(commands)}`)
  }
  if (outbound.some((message) => message?.type === 'request' && message.payload?.action === 'save-settings')) {
    throw new Error('Calendar echoed unchanged settings back to the parent during activation')
  }
  sendToHost('settings', { settings: { shouldConfirmBeforeCreate: false } })
  const savedSettings = await waitFor(
    () => outbound.find(
      (message) => message?.type === 'request' && message.payload?.action === 'save-settings'
    ),
    'Calendar normalized settings persistence'
  )
  if (
    savedSettings.payload.payload?.settings?.shouldConfirmBeforeCreate !== false ||
    savedSettings.payload.payload?.settings?.wordsPerDot !== 250
  ) {
    throw new Error(`Calendar persisted unexpected normalized settings: ${JSON.stringify(savedSettings)}`)
  }
  if (runtimeErrors.length > 0) {
    throw new Error(`Calendar runtime errors: ${runtimeErrors.join(' | ')}`)
  }

  const renderedTaskDots = window.document.querySelectorAll('.hollow.task, .task.hollow').length
  if (renderedTaskDots !== 1) {
    throw new Error(`Expected one unfinished-task hollow dot, got ${renderedTaskDots}`)
  }

  const result = {
    ok: true,
    artifact,
    commands,
    renderedButtons: window.document.querySelectorAll('button').length,
    renderedDots: window.document.querySelectorAll('.dot').length,
    renderedTaskDots,
    dotClasses: [...window.document.querySelectorAll('.dot, .hollow')].map((element) => element.getAttribute('class')),
    dotMarkup: [...window.document.querySelectorAll('.dot, .hollow')].map((element) => element.outerHTML),
    hasTaskMarkup: window.document.body.innerHTML.includes('task'),
    hostRequests: outbound
      .filter((message) => message?.type === 'request')
      .map((message) => message.payload.action),
    textSample: window.document.body.textContent.replace(/\s+/g, ' ').trim().slice(0, 180)
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  window.__tsuzuneCalendarHost?.unload?.()
  dom.window.close()
}
