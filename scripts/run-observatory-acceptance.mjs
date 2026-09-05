import { app, BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const fixtureKind = process.argv.includes('--singleton') ? 'singleton' : 'dense'
const fixtureNodeCount = fixtureKind === 'singleton' ? 1 : 589
const fixtureEdgeCount = fixtureKind === 'singleton' ? 0 : 4_175
const root = resolve('work'); const originalLoadFile = BrowserWindow.prototype.loadFile; let started = false
await mkdir(root, { recursive: true }); const runDirectory = await mkdtemp(resolve(root, `observatory-acceptance-${fixtureKind}-`))
const vaultDirectory = resolve(runDirectory, 'vault'); const userDataDirectory = resolve(runDirectory, 'userdata')
await mkdir(vaultDirectory, { recursive: true }); await mkdir(userDataDirectory, { recursive: true })
const noteName = (i) => `Observatory-Node-${i.toString().padStart(3, '0')}-Critical-Technical-Record-With-A-Very-Long-Name`
const fixturePaths = Array.from({ length: fixtureNodeCount }, (_, i) => `${noteName(i)}.md`); const outgoing = Array.from({ length: fixtureNodeCount }, () => []); let generatedEdges = 0
for (let offset = 1; fixtureNodeCount > 1 && generatedEdges < fixtureEdgeCount; offset += 1) for (let source = 0; source < fixtureNodeCount && generatedEdges < fixtureEdgeCount; source += 1) { outgoing[source].push((source + offset) % fixtureNodeCount); generatedEdges += 1 }
await Promise.all(outgoing.map((targets, i) => writeFile(resolve(vaultDirectory, `${noteName(i)}.md`), `# ${noteName(i)}\n\n${targets.map((t) => `[[${noteName(t)}]]`).join('\n')}\n`, 'utf8')))
await writeFile(resolve(userDataDirectory, 'settings.json'), `${JSON.stringify({ lastVaultPath: vaultDirectory, lastNotePath: fixturePaths[0] })}\n`, 'utf8'); app.setPath('userData', userDataDirectory)
for (const flag of ['disable-background-timer-throttling', 'disable-renderer-backgrounding', 'disable-backgrounding-occluded-windows']) app.commandLine.appendSwitch(flag)
BrowserWindow.prototype.show = function () {}
const delay = (ms) => new Promise((r) => setTimeout(r, ms)); const evaluate = (win, code) => win.webContents.executeJavaScript(code, true)
async function waitFor(win, code, timeout = 20_000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await evaluate(win, code)) return; await delay(100) } throw new Error(`表示待機がタイムアウトしました: ${code}`) }
async function hashes(paths) { return Object.fromEntries(await Promise.all(paths.map(async (p) => [p, `sha256:${createHash('sha256').update(await readFile(resolve(p))).digest('hex')}`]))) }
const assets = (await readdir(resolve('out/renderer/assets'))).filter((n) => /\.(?:css|js)$/.test(n)).sort().map((n) => `out/renderer/assets/${n}`)
const evidence = { capturedAt: new Date().toISOString(), sourceHashes: await hashes(['src/core/observatory.ts', 'src/renderer/components/ObservatoryView.tsx', 'src/renderer/styles.css', 'scripts/run-observatory-acceptance.mjs', 'package.json']), buildHashes: await hashes(['out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html', ...assets]) }
async function inspect(win) {
  return evaluate(win, `(() => {
    const root = document.querySelector('.observatory')
    const canvas = document.querySelector('.observatory-particle-world')
    const caption = document.querySelector('.observatory-caption')
    const controls = document.querySelector('.observatory-controls')
    if (!root || !canvas || !caption || !controls) return null
    const sample = JSON.parse(canvas.dataset.particleSample || '[]')
    const paths = JSON.parse(canvas.dataset.particlePaths || '[]')
    const rect = canvas.getBoundingClientRect()
    return {
      mode: root.dataset.observationMode,
      motion: root.dataset.motion,
      playing: root.dataset.playing,
      pausedReason: root.dataset.pausedReason,
      particleCount: Number(canvas.dataset.particleCount),
      realNoteCount: Number(canvas.dataset.realNoteCount),
      edgeCount: Number(canvas.dataset.edgeCount),
      paths,
      sample,
      simulationTime: Number(canvas.dataset.simulationTime || 0),
      fieldState: canvas.dataset.fieldState || null,
      viewport: { width: rect.width, height: rect.height },
      canvasCount: document.querySelectorAll('.observatory canvas').length,
      edgeCountDom: root.querySelectorAll('svg, .observatory-link, .observatory-edge-stage, .observatory-scene, .observatory-star').length,
      controlCount: controls.querySelectorAll('button').length,
      buttonLabels: [...controls.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')),
      safeBounds: sample.every((particle) => particle.x >= 0 && particle.x <= rect.width && particle.y >= 0 && particle.y <= rect.height),
      caption: caption.textContent?.trim() || ''
    }
  })()`)
}

async function capture(win, name) {
  const state = await inspect(win)
  await writeFile(resolve(runDirectory, `${name}.png`), (await win.webContents.capturePage()).toPNG())
  return state
}

const pathsValid = (state) => state && state.paths.length === state.particleCount &&
  new Set(state.paths).size === state.paths.length &&
  state.paths.every((path) => fixturePaths.includes(path))

const passes = (state) => Boolean(
  state &&
  state.mode === 'autonomous' &&
  state.particleCount === (fixtureKind === 'singleton' ? 1 : 72) &&
  state.realNoteCount === state.particleCount &&
  state.edgeCount === 0 &&
  state.canvasCount === 1 &&
  state.edgeCountDom === 0 &&
  state.controlCount === 1 &&
  state.buttonLabels.length === 1 &&
  pathsValid(state) &&
  state.safeBounds &&
  !/存在相そのもの|重要度|価値|確定/.test(state.caption)
)

async function finish(result) {
  await writeFile(resolve(runDirectory, 'acceptance-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result, null, 2))
  app.exit(result.passed ? 0 : 1)
}

async function run(win) {
  win.setSkipTaskbar(true)
  win.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 }, false)
  win.showInactive()
  await waitFor(win, `Boolean(document.querySelector('button[aria-label="観測宙域"]'))`)
  await evaluate(win, `document.querySelector('button[aria-label="観測宙域"]').click()`)
  await waitFor(win, `Boolean(document.querySelector('.observatory-particle-world'))`)
  await delay(500)
  const initial = await capture(win, '01-particle-field')
  const timeline = [{ elapsedSeconds: 0, state: initial, image: '01-particle-field.png' }]
  if (fixtureKind === 'dense') {
    for (const [elapsedSeconds, name] of [
      [10, '02-field-t10s'],
      [20, '03-field-t20s'],
      [30, '04-field-t30s'],
      [40, '05-field-t40s'],
      [50, '06-field-t50s'],
      [60, '07-field-t60s']
    ]) {
      await delay(10_000)
      timeline.push({
        elapsedSeconds,
        state: await capture(win, name),
        image: `${name}.png`
      })
    }
  }

  win.setBounds({ x: -10000, y: -10000, width: 1024, height: 640 }, false)
  await delay(300)
  const compact = await capture(win, '01b-compact-field')
  const before = await inspect(win)
  await delay(350)
  const moved = await inspect(win)
  const displacements = moved.sample.map((particle, index) => Math.hypot(
      particle.x - before.sample[index].x,
      particle.y - before.sample[index].y
    ))
  const movement = {
    meanPixels: displacements.reduce((total, distance) => total + distance, 0) / displacements.length,
    maximumPixels: Math.max(...displacements)
  }
  const movedEnough = moved.simulationTime > before.simulationTime &&
    movement.meanPixels >= (fixtureKind === 'singleton' ? 1 : 4) &&
    movement.maximumPixels >= (fixtureKind === 'singleton' ? 1 : 6)

  const button = `document.querySelector('.observatory-controls button')`
  await evaluate(win, `${button}.click()`)
  const pausedA = await inspect(win)
  win.setBounds({ x: -10000, y: -10000, width: 900, height: 700 }, false)
  await delay(350)
  const pausedB = await inspect(win)
  const frozen = Math.abs(pausedB.simulationTime - pausedA.simulationTime) <= 0.01
  const staticReflow = pausedB.viewport.width !== pausedA.viewport.width &&
    pausedB.viewport.height !== pausedA.viewport.height &&
    pausedB.sample.every((particle, index) => {
      const previous = pausedA.sample[index]
      return Math.abs(particle.x / pausedB.viewport.width - previous.x / pausedA.viewport.width) <= 0.002 &&
        Math.abs(particle.y / pausedB.viewport.height - previous.y / pausedA.viewport.height) <= 0.002
    })

  await evaluate(win, `${button}.click()`)
  await delay(350)
  const resumed = await inspect(win)
  const resumedMotion = resumed.simulationTime > pausedB.simulationTime
  const openedPath = await evaluate(win, `(() => {
    const canvas = document.querySelector('.observatory-particle-world')
    const rect = canvas.getBoundingClientRect()
    const particle = JSON.parse(canvas.dataset.particleSample || '[]')[0]
    if (!particle) return null
    const event = new PointerEvent('click', {
      bubbles: true,
      clientX: rect.left + particle.x,
      clientY: rect.top + particle.y
    })
    canvas.dispatchEvent(event)
    return particle.path
  })()`)
  await waitFor(win, `Boolean(document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('aria-label') !== '観測宙域')`)
  const activeTab = await evaluate(win, `document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('aria-label') ?? null`)
  const expectedTab = openedPath?.split(/[\\/]/).at(-1)?.replace(/\.md$/i, '') ?? null

  await finish({
    schema: 'observatory-acceptance-r5.v1',
    runDirectory,
    fixture: { kind: fixtureKind, nodeCount: fixtureNodeCount, edgeCount: fixtureEdgeCount },
    evidence,
    initial,
    timeline,
    compact,
    before,
    moved,
    pausedA,
    pausedB,
    resumed,
    movement,
    movedEnough,
    frozen,
    staticReflow,
    resumedMotion,
    openedPath,
    expectedTab,
    activeTab,
    passed: generatedEdges === fixtureEdgeCount &&
      passes(initial) &&
      timeline.every(({ state }) => passes(state)) &&
      passes(compact) &&
      movedEnough &&
      frozen &&
      staticReflow &&
      resumedMotion &&
      expectedTab === activeTab
  })
}
BrowserWindow.prototype.loadFile = function (...args) { const loaded = originalLoadFile.apply(this, args); if (!started) { started = true; void loaded.then(() => run(this)).catch((e) => { console.error(e); app.exit(1) }) } return loaded }
await import('../out/main/index.js')
