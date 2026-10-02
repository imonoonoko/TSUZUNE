import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import electron from 'electron'

const repo = resolve(import.meta.dirname, '..')
const reportPath = resolve(repo, 'docs/reports/eight-improvements-isolated-evidence-2026-10-01.json')
const artifactRoot = resolve(repo, 'work/eight-improvements-isolated')
const prefix = 'tsuzune-eight-improvements-'
function safeCleanup(root) {
  const path = relative(tmpdir(), root)
  if (isAbsolute(path) || path.startsWith('..') || !path.startsWith(prefix)) throw new Error('Unsafe temporary cleanup target')
  // Restore only the fixture file's Windows read-only attribute before cleanup.
  if (process.platform === 'win32') spawnSync('attrib', ['-R', resolve(root, 'vault/readonly.base')], { windowsHide: true })
  rmSync(root, { recursive: true, force: true })
}
if (typeof electron === 'string') {
  const root = await mkdtemp(join(tmpdir(), prefix))
  try {
    const result = spawnSync(electron, process.argv.slice(1), {
      stdio: 'inherit', timeout: 180000, windowsHide: true,
      env: { ...process.env, TSUZUNE_EIGHT_SMOKE_ROOT: root }
    })
    if (result.error) console.error(result.error.message)
    process.exitCode = result.status ?? 1
  } finally { safeCleanup(root) }
} else {
  const { app, BrowserWindow, nativeImage } = electron
  const root = resolve(process.env.TSUZUNE_EIGHT_SMOKE_ROOT || await mkdtemp(join(tmpdir(), prefix)))
  const vault = resolve(root, 'vault'), profile = resolve(root, 'profile')
  const entry = resolve(process.argv[2] || resolve(repo, 'out/main/index.js'))
  const sha = data => createHash('sha256').update(data).digest('hex')
  const report = {
    date: new Date().toISOString(), outcome: 'running', runtime: 'built working tree Electron',
    entry, entrySha256: sha(await readFile(entry)), isolatedVault: vault, isolatedProfile: profile,
    productionProfileOpened: false, installedBinaryUsed: false, mcpSettingsModified: false,
    checks: [], screenshots: [], consoleErrors: [],
    unverified: ['Physical Windows IME input/composition', 'Windows Narrator spoken output', 'Physical Windows high contrast setting (CSS forced-colors emulation is separate)', 'Installed production binary and production acceptance']
  }
  const assert = (value, label, detail) => { if (!value) throw new Error(`${label}${detail ? `: ${JSON.stringify(detail)}` : ''}`) }
  const delay = ms => new Promise(done => setTimeout(done, ms))
  const record = (name, detail) => { report.checks.push({ name, result: 'pass', detail }); console.log(`PASS ${name}`) }
  async function evaluate(window, expression) {
    const result = await window.webContents.debugger.sendCommand('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  async function wait(window, expression, label, timeout = 15000) {
    const until = Date.now() + timeout
    while (Date.now() < until) {
      const value = await evaluate(window, `(async()=>Boolean(await (${expression})))()`)
      if (value) return value
      await delay(100)
    }
    throw new Error(`Timeout: ${label}`)
  }
  const button = text => `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`
  const click = async (window, expression) => {
    await evaluate(window, `(()=>{const e=${expression};if(!e||e.disabled)throw new Error('Missing/enabled UI control');e.click()})()`)
    await delay(100)
  }
  async function change(window, expression, value) {
    await evaluate(window, `(()=>{const e=${expression};if(!e)throw new Error('Missing field');const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await delay(100)
  }
  async function key(window, expression, name) {
    await evaluate(window, `(${expression}).focus()`)
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: name })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: name })
    await delay(100)
  }
  async function screenshot(window, name) {
    const file = resolve(artifactRoot, `${name}.png`)
    const bytes = (await window.webContents.capturePage()).toPNG()
    await writeFile(file, bytes)
    report.screenshots.push({ name, path: file, sha256: sha(bytes) })
  }
  const baseSource = `# Preserve fixture comment\npluginFixture: keep\nformulas:\n  double: price * 2\n  final: formula.double + 1\n  safeHtml: 'html("<b>safe</b><script>unsafe()</script>")'\n  picture: 'image("assets/pixel.png")'\nproperties:\n  price: {displayName: Price}\nsummaries:\n  Total: values.reduce(acc + value, 0)\nviews:\n  - type: table\n    name: Grouped\n    order: [file.name, status, price, formula.double, formula.final, formula.safeHtml, formula.picture]\n    sort: [{property: status}, {property: price, direction: DESC}]\n    groupBy: {property: status}\n    summaries: {price: Total}\n  - type: table\n    name: Expensive\n    filters: price > 5\n    order: [file.path, price]\n`
  const noteA = '---\nstatus: active\nprice: 2\ntags: [work/project]\n---\n# A\n\n[[B]]\n\n| Name | Value |\n| --- | --- |\n| Table fixture | 42 |\n\n![Pixel](../assets/pixel.png)\n\n- [ ] Read only task\n\n' + 'Scrolling fixture paragraph.\n\n'.repeat(30)
  await Promise.all([mkdir(resolve(vault, 'notes'), { recursive: true }), mkdir(resolve(vault, 'assets'), { recursive: true }), mkdir(profile, { recursive: true }), mkdir(artifactRoot, { recursive: true })])
  await Promise.all([
    writeFile(resolve(vault, 'notes/A.md'), noteA),
    writeFile(resolve(vault, 'notes/B.md'), '---\nstatus: active\nprice: 8\n---\n# B\n'),
    writeFile(resolve(vault, 'notes/C.md'), '---\nstatus: second\nprice: 3\n---\n# C\n'),
    writeFile(resolve(vault, 'assets/pixel.png'), nativeImage.createFromBitmap(Buffer.from([32, 144, 224, 255]), { width: 1, height: 1 }).toPNG()),
    writeFile(resolve(vault, 'smoke.base'), baseSource), writeFile(resolve(vault, 'readonly.base'), baseSource),
    writeFile(resolve(profile, 'settings.json'), JSON.stringify({ lastVaultPath: vault, lastNotePath: 'notes/A.md' }))
  ])
  app.setPath('userData', profile)
  for (const flag of ['disable-background-timer-throttling', 'disable-renderer-backgrounding', 'disable-backgrounding-occluded-windows']) app.commandLine.appendSwitch(flag)
  process.env.TSUZUNE_HEADLESS_SMOKE = '1'
  async function run(window) {
    window.setSkipTaskbar(true); window.setSize(1280, 900, false); window.setPosition(-32000, -32000, false); window.showInactive()
    window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.consoleErrors.push(message) })
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Page.enable')
    // Observe genuine workers without replacing their evaluation or transport.
    await window.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `window.__smokeWorkers=[];const OriginalWorker=window.Worker;window.Worker=class extends OriginalWorker{constructor(...args){super(...args);const item={url:String(args[0]),messages:0};window.__smokeWorkers.push(item);this.addEventListener('message',()=>item.messages++)}}` })
    window.webContents.reload()
    await wait(window, `document.querySelector('.workspace-pane .markdown-preview table') && document.querySelector('.workspace-pane .markdown-preview input[type="checkbox"]')`, 'initial note preview')
    await wait(window, `document.querySelector('.workspace-pane .markdown-preview img')?.naturalWidth > 0`, 'fixture image decoded')
    const preview = await evaluate(window, `(()=>{const p=document.querySelector('.workspace-pane .markdown-preview');return {table:p.querySelector('table').textContent,images:[...p.querySelectorAll('img')].map(i=>({complete:i.complete,width:i.naturalWidth})),tasks:[...p.querySelectorAll('input[type=checkbox]')].map(i=>i.disabled)}})()`)
    assert(preview.table.includes('Table fixture') && preview.images.length >= 1 && preview.images.every(i=>i.complete&&i.width>0) && preview.tasks.length>=1 && preview.tasks.every(Boolean), 'Preview table/image/task rendering', preview)
    record('markdown-preview-table-image-readonly-task', preview)
    await click(window, button('Live Preview'))
    await wait(window, `document.querySelector('.ts-live-preview-block table') && document.querySelector('.ts-live-preview-block img')?.naturalWidth>0 && document.querySelector('.ts-live-preview-block input[type=checkbox]')?.disabled`, 'Live Preview widgets')
    record('live-preview-real-codemirror', { editors: await evaluate(window, `document.querySelectorAll('.cm-editor').length`) })
    await screenshot(window, 'live-preview')
    for (let count = 2; count <= 8; count++) {
      await click(window, button(count % 2 ? '上下に分割' : '左右に分割'))
      await wait(window, `document.querySelectorAll('.workspace-pane').length===${count}`, `split to ${count} panes`)
    }
    const paneState = await evaluate(window, `({panes:document.querySelectorAll('.workspace-pane').length,editors:document.querySelectorAll('.cm-editor').length,limited:(${button('左右に分割')}).disabled&&(${button('上下に分割')}).disabled})`)
    assert(paneState.panes === 8 && paneState.editors === 1 && paneState.limited, 'Eight pane bound / shared single editor', paneState)
    record('eight-panes-single-editor-and-limit', paneState)
    const separator = `document.querySelector('.workspace-pane-split [role=separator]')`
    await key(window, separator, 'Home'); assert(await evaluate(window, `(${separator}).getAttribute('aria-valuenow')`) === '10', 'Split Home')
    await key(window, separator, 'End'); assert(await evaluate(window, `(${separator}).getAttribute('aria-valuenow')`) === '90', 'Split End')
    await key(window, separator, 'Left'); assert(await evaluate(window, `(${separator}).getAttribute('aria-valuenow')`) === '85', 'Split left arrow')
    record('split-separator-native-keyboard', { home: 10, end: 90, left: 85 })
    const persistedEight = await wait(window, `(async()=>{const r=await window.tsuzune.getWorkspaces(${JSON.stringify(vault)});return r.ok&&r.value.state.lastSession?.panes.length===8&&r.value.state.lastSession.layout.ratio===0.85})()`, 'eight-pane V2 persistence')
    record('eight-pane-version2-persistence', { panes: 8, rootRatio: 0.85, persisted: persistedEight })
    const restoredFields = `(async()=>{const r=await window.tsuzune.getWorkspaces(${JSON.stringify(vault)});if(!r.ok)throw Error(r.error.message);const s=r.value.state.lastSession;return {layout:s.layout,activePaneId:s.activePaneId,panes:s.panes.map(p=>({id:p.id,tabs:p.tabs,activeIndex:p.activeIndex,noteView:p.noteView})),left:s.left,right:s.right}})()`
    const beforeRestore = await evaluate(window, restoredFields)
    window.webContents.reload(); await delay(200)
    await wait(window, `document.querySelectorAll('.workspace-pane').length===8 && document.querySelector('.workspace-pane-split [role=separator]')?.getAttribute('aria-valuenow')==='85'`, 'renderer reloaded eight-pane workspace restoration')
    const afterRestore = await evaluate(window, restoredFields)
    assert(isDeepStrictEqual(beforeRestore, afterRestore), 'Persisted eight-pane tree/tab/view/sidebar restoration')
    const renderedIds = await evaluate(window, `[...document.querySelectorAll('.workspace-pane')].map(e=>e.dataset.paneId)`)
    assert(isDeepStrictEqual([...renderedIds].sort(), beforeRestore.panes.map(p=>p.id).sort()), 'Restored actual pane ids')
    record('renderer-reload-eight-pane-workspace-restoration', { realMainServiceRead: true, processRestart: false, panes: renderedIds, snapshotSha256: sha(JSON.stringify(afterRestore)) })
    const restoredSeparator = `document.querySelector('.workspace-pane-split [role=separator]')`
    await key(window, restoredSeparator, 'Home'); await key(window, restoredSeparator, 'End'); await key(window, restoredSeparator, 'Left')
    window.setSize(720, 900, false); window.webContents.setZoomFactor(2); await delay(350)
    const narrow = await evaluate(window, `(()=>{const p=document.querySelector('.workspace-pane-layout');return {innerWidth,zoom:devicePixelRatio,clientWidth:p.clientWidth,scrollWidth:p.scrollWidth,paneRects:[...document.querySelectorAll('.workspace-pane')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}})()`)
    assert(narrow.scrollWidth > narrow.clientWidth && narrow.paneRects.every(r => r.width >= 179 && r.height >= 179), 'Narrow viewport minimum panes / scroll', narrow)
    record('720px-200percent-minimum-pane-scroll', { ...narrow, zoomFactor: window.webContents.getZoomFactor(), windowSize: window.getSize() })
    await screenshot(window, 'eight-panes-720px-200percent')
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    assert(await evaluate(window, `matchMedia('(forced-colors: active)').matches`), 'Forced-colors CSS emulation')
    await screenshot(window, 'eight-panes-forced-colors-css')
    record('forced-colors-css-emulation', { emulated: true, physicalWindowsSettingVerified: false })
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] })
    window.webContents.setZoomFactor(1); window.setSize(1280, 900, false)
    for (let count = 7; count >= 1; count--) { await click(window, button('ペインを閉じる')); await wait(window, `document.querySelectorAll('.workspace-pane').length===${count}`, 'close pane') }
    await click(window, `document.querySelector('button[aria-label="Baseを開く"]')`)
    await wait(window, `document.querySelector('[role=option]')`, 'Base list')
    await click(window, `Array.from(document.querySelectorAll('[role=option]')).find(e=>e.textContent.includes('smoke.base'))`)
    await click(window, `document.querySelector('[role=dialog] button[type=submit]')`)
    await wait(window, `document.querySelector('.base-table-panel h2')?.textContent==='Grouped' && document.querySelector('.base-group-row')`, 'real Worker grouped Base')
    const grouped = await evaluate(window, `({groups:[...document.querySelectorAll('.base-group-row')].map(e=>e.textContent),summary:document.querySelector('.base-table-panel tfoot')?.textContent,worker:window.__smokeWorkers,readOnlyCells:[...document.querySelectorAll('.base-table-panel tbody tr:not(.base-group-row):not(.base-summary-row)')].every(row=>[...row.querySelectorAll('td')].filter((_,i)=>i===0||i>=3).every(td=>!td.querySelector('.base-cell-edit'))),sanitized:!document.querySelector('.base-table-panel script')})`)
    assert(grouped.groups.length === 2 && grouped.summary.includes('13') && grouped.readOnlyCells && grouped.sanitized && grouped.worker.some(w => w.messages), 'Base grouped/summary/readonly/real worker', grouped)
    await wait(window, `document.querySelector('.base-table-panel img')?.naturalWidth>0`, 'Base formula image decoded')
    report.workerBundle = { path: fileURLToPath(grouped.worker[0].url), sha256: sha(await readFile(fileURLToPath(grouped.worker[0].url))) }
    const rendererScripts = await evaluate(window, `[...document.querySelectorAll('script[src]')].map(s=>s.src)`)
    report.rendererBundles = await Promise.all(rendererScripts.map(async url => ({ path: fileURLToPath(url), sha256: sha(await readFile(fileURLToPath(url))) })))
    record('base-real-worker-group-sort-summary-rendering', grouped)
    await screenshot(window, 'bases-grouped')
    await change(window, `document.querySelector('.base-table-meta select')`, '1')
    await wait(window, `document.querySelector('.base-table-panel h2')?.textContent==='Expensive' && document.querySelector('.base-table-meta')?.textContent.includes('1行')`, 'filtered second view')
    record('bases-view-selection-and-filter', { view: 'Expensive', rows: 1 })
    await change(window, `document.querySelector('.base-table-meta select')`, '0')
    await wait(window, `document.querySelector('.base-table-panel h2')?.textContent==='Grouped'`, 'first view')
    await click(window, button('設定'))
    await change(window, `Array.from(document.querySelectorAll('.base-settings-panel label')).find(e=>e.firstChild?.textContent==='ビュー名').querySelector('input')`, 'Reviewed Grouped')
    assert((await readFile(resolve(vault, 'smoke.base'), 'utf8')) === baseSource, 'GUI draft mutated file before preview')
    await click(window, button('下書きをプレビュー'))
    await wait(window, `document.querySelector('.base-table-panel h2')?.textContent==='Reviewed Grouped' && !(${button('確認した変更を保存')}).disabled`, 'draft preview')
    assert((await readFile(resolve(vault, 'smoke.base'), 'utf8')) === baseSource, 'Preview mutated Base file')
    await click(window, button('確認した変更を保存'))
    await wait(window, `document.body.textContent.includes('Bases設定を保存しました。')`, 'Base save')
    const saved = await readFile(resolve(vault, 'smoke.base'), 'utf8')
    assert(saved.includes('Reviewed Grouped') && saved.includes('# Preserve fixture comment') && saved.includes('pluginFixture: keep'), 'Saved configuration/extensions preserved')
    record('bases-gui-draft-preview-save-preserves-yaml', { sha256: sha(saved), previewDidNotWrite: true })
    // Reuse every existing official-function behavioral fixture against the actual bundled worker.
    const source = await readFile(resolve(repo, 'tests/base-expression.test.ts'), 'utf8')
    const caseStart = source.indexOf('const cases:'), caseEnd = source.indexOf('\ndescribe(', caseStart)
    assert(caseStart >= 0 && caseEnd > caseStart, 'Formula fixture boundary')
    const code = ts.transpileModule(source.slice(caseStart, caseEnd) + '\nreturn cases', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    const cases = Function('now', code)(Date.parse('2026-10-01T12:00:00Z'))
    const formulas = Object.fromEntries(cases.map(([, expression], index) => [`f${index}`, expression]))
    const view = { type: 'table', name: 'Functions', filters: [], order: ['file.path', ...cases.map((_, i) => `formula.f${i}`)] }
    const workerResult = await evaluate(window, `(async()=>{const s=await window.tsuzune.getSnapshot();if(!s.ok)throw Error(s.error.message);const url=window.__smokeWorkers[0].url;const worker=new Worker(url,{type:'module'});return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{worker.terminate();reject(Error('worker timeout'))},10000);worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();resolve(e.data)};worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message))};worker.postMessage({profile:${JSON.stringify({ filters: [], view, views: [view], formulas })},notes:s.value.notes,viewIndex:0,options:{now:${Date.parse('2026-10-01T12:00:00Z')},deadline:Date.now()+8000,maxSteps:1000000}})})})()`)
    assert(workerResult.ok, 'All formula worker request', workerResult)
    const row = workerResult.evaluation.rows.find(r => r.path === 'notes/A.md')
    assert(row, 'Worker fixture A row', workerResult.evaluation)
    const failures = []
    cases.forEach(([name, expression, expected], i) => {
      const cell = row.cells[`formula.f${i}`]
      const ok = cell?.kind === 'value' && (name === 'random' ? cell.value >= 0 && cell.value < 1 : isDeepStrictEqual(cell.value, expected))
      if (!ok) failures.push({ name, expression, expected, actual: cell })
    })
    assert(!failures.length, 'Bundled Worker formula behavior', failures)
    record('all-existing-formula-behaviors-real-bundled-worker', { cases: cases.length, fixtureSha256: sha(source), random: 'range assertion (actual Worker randomness)', diagnostics: workerResult.evaluation.diagnostics })
    // Physical read-only attribute and revision guard, through real main-process IPC.
    if (process.platform === 'win32') {
      const attribute = spawnSync('attrib', ['+R', resolve(vault, 'readonly.base')], { windowsHide: true })
      assert(attribute.status === 0, 'Fixture read-only attribute')
      const blocked = await evaluate(window, `(async()=>{const doc=await window.tsuzune.readBase('readonly.base');const work=await window.tsuzune.getWorkspaces(${JSON.stringify(vault)});if(!doc.ok||!work.ok)throw Error('fixture scope');return window.tsuzune.applyBaseChanges({scope:work.value.scope,path:'readonly.base',expectedRevision:doc.value.revision,content:doc.value.content.replace('Grouped','Blocked')})})()`)
      assert(!blocked.ok && (await readFile(resolve(vault, 'readonly.base'), 'utf8')) === baseSource, 'Read-only Base write blocked', blocked)
      record('windows-readonly-base-main-ipc-preserves-file', blocked)
      spawnSync('attrib', ['-R', resolve(vault, 'readonly.base')], { windowsHide: true })
    } else report.unverified.push('Windows read-only file attribute (non-Windows runtime)')
    const session = await evaluate(window, `(async()=>{const r=await window.tsuzune.getWorkspaces(${JSON.stringify(vault)});if(!r.ok)throw Error(r.error.message);return r.value.state})()`)
    assert(session.version === 2, 'Actual service V2 session')
    record('main-service-version2-session', { version: session.version, panes: session.lastSession?.panes.length })
    assert((await readFile(resolve(vault, 'notes/A.md'), 'utf8')) === noteA, 'Read-only task / view operations modified note')
    record('fixture-note-unchanged', { sha256: sha(noteA) })
    report.outcome = 'pass'
  }
  let started = false
  const loadFile = BrowserWindow.prototype.loadFile
  BrowserWindow.prototype.loadFile = function (...args) {
    const loaded = loadFile.apply(this, args)
    if (!started) {
      started = true
      void loaded.then(() => run(this)).catch(async error => {
        report.outcome = 'fail'; report.failure = error.stack || String(error); console.error(report.failure)
        try { report.failureUi = await evaluate(this, `({text:document.body.textContent.slice(-6000),images:[...document.images].map(i=>({src:i.src.slice(0,80),complete:i.complete,width:i.naturalWidth}))})`); await screenshot(this, 'failure') } catch (secondary) { console.error(secondary.message) }
      }).finally(async () => {
        report.completedAt = new Date().toISOString()
        await mkdir(resolve(repo, 'docs/reports'), { recursive: true })
        await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
        this.destroy(); app.exit(report.outcome === 'pass' ? 0 : 1)
      })
    }
    return loaded
  }
  await import(`file://${entry.replaceAll('\\', '/')}`)
}
