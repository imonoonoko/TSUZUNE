import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(
  process.env.TSUZUNE_REPO_ROOT ?? resolve(scriptDirectory, '..')
)
const reportsRoot = resolve(
  process.env.TSUZUNE_REPORT_OUTPUT_ROOT ?? resolve(repoRoot, 'docs/reports')
)
const sourceAssetsRoot = resolve(
  repoRoot,
  'docs/reports/assets/graph-gp0-node-drag-persistence'
)
const outputAssetsRoot = resolve(
  reportsRoot,
  'assets/graph-gp0-node-drag-persistence'
)

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const obsidianManifest = await readJson(resolve(sourceAssetsRoot, 'manifest.json'))
const obsidianObservation = await readJson(
  resolve(sourceAssetsRoot, 'obsidian-1.13.4/observation.json')
)
const tsuzuneManifest = await readJson(
  resolve(sourceAssetsRoot, 'tsuzune-working-tree/manifest.json')
)
const tsuzuneObservation = await readJson(
  resolve(sourceAssetsRoot, 'tsuzune-working-tree/observation.json')
)

const assertEvidence = (condition, message) => {
  if (!condition) throw new Error(`GP0-3b-d evidence is invalid: ${message}`)
}

assertEvidence(obsidianManifest.status === 'reference-captured', 'Obsidian capture did not pass')
assertEvidence(obsidianManifest.scope.version === '1.13.4', 'Obsidian version drifted')
assertEvidence(obsidianManifest.scope.query === '', 'Obsidian query is not empty')
assertEvidence(obsidianManifest.scope.nodeDragProbe === true, 'Obsidian node-drag mode was not used')
assertEvidence(Object.values(obsidianManifest.assertions).every(Boolean), 'an Obsidian safeguard failed')
assertEvidence(tsuzuneManifest.status === 'captured', 'TSUZUNE capture did not pass')
assertEvidence(Object.values(tsuzuneManifest.assertions).every(Boolean), 'a TSUZUNE safeguard failed')
assertEvidence(tsuzuneObservation.query === '', 'TSUZUNE query is not empty')
assertEvidence(tsuzuneObservation.nodeDragProbe === true, 'TSUZUNE node-drag mode was not used')
assertEvidence(
  obsidianObservation.expected.viewport.width === 1265 &&
    obsidianObservation.expected.viewport.height === 768,
  'Obsidian viewport drifted'
)
assertEvidence(
  [
    tsuzuneObservation.initial.baseline.dimensions,
    tsuzuneObservation.initial.entered.dimensions,
    tsuzuneObservation.initial.reopened.dimensions,
    tsuzuneObservation.restarted.restarted.dimensions
  ].every(
    (dimensions) =>
      dimensions.innerWidth === 1265 &&
      dimensions.innerHeight === 768 &&
      dimensions.devicePixelRatio === 1
  ),
  'TSUZUNE content viewport or device scale factor drifted'
)

const obsidian = obsidianManifest.nodeDragContract
const tsuzune = tsuzuneObservation.nodeDragContract
const near = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

const comparisons = [
  {
    id: 'drag-delta',
    label: 'ノードを +96, +64 CSS px 移動',
    obsidian: obsidian.appliedDeltaCssPx,
    tsuzune: tsuzune.appliedDeltaCssPx,
    status:
      near(obsidian.appliedDeltaCssPx.x, 96) &&
      near(obsidian.appliedDeltaCssPx.y, 64) &&
      near(tsuzune.appliedDeltaCssPx.x, 96) &&
      near(tsuzune.appliedDeltaCssPx.y, 64)
        ? 'matched'
        : 'different'
  },
  {
    id: 'held-during-press',
    label: '押下中だけポインター位置へ固定',
    obsidian: obsidian.heldFixed ? '固定' : '非固定',
    tsuzune: tsuzune.heldAtPointer ? '固定' : '非固定',
    status: obsidian.heldFixed && tsuzune.heldAtPointer ? 'matched' : 'different'
  },
  {
    id: 'released-to-force-simulation',
    label: 'pointerup後にForce simulationへ復帰',
    obsidian: obsidian.releasedImmediately && obsidian.movedAfterRelease ? '復帰' : '固定継続',
    tsuzune: tsuzune.movedAfterRelease ? '復帰' : '固定継続',
    status:
      obsidian.releasedImmediately &&
      obsidian.movedAfterRelease &&
      tsuzune.movedAfterRelease
        ? 'matched'
        : 'different'
  },
  {
    id: 'graph-reopen-persistence',
    label: 'Graph再表示後のnode pin／座標保存',
    obsidian:
      obsidian.unpinnedAfterGraphReopen && obsidian.nodePositionAbsentFromGraphOptions
        ? '保存しない'
        : '保存する',
    tsuzune: tsuzune.nodePositionAbsentFromSettings ? '保存しない' : '保存する',
    status:
      obsidian.unpinnedAfterGraphReopen &&
      obsidian.nodePositionAbsentFromGraphOptions &&
      tsuzune.nodePositionAbsentFromSettings
        ? 'matched'
        : 'different'
  },
  {
    id: 'app-restart-persistence',
    label: 'アプリ再起動後のnode pin／座標保存',
    obsidian:
      obsidian.unpinnedAfterAppRestart && obsidian.nodePositionAbsentFromGraphOptions
        ? '保存しない'
        : '保存する',
    tsuzune: tsuzune.nodePositionAbsentFromSettings ? '保存しない' : '保存する',
    status:
      obsidian.unpinnedAfterAppRestart &&
      obsidian.nodePositionAbsentFromGraphOptions &&
      tsuzune.nodePositionAbsentFromSettings
        ? 'matched'
        : 'different'
  }
]

const matchedCount = comparisons.filter((item) => item.status === 'matched').length
const allMatched = matchedCount === comparisons.length
const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-d',
  capturedAt: new Date().toISOString(),
  status: allMatched ? 'matched' : 'different',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph',
    query: '',
    topology: { nodes: 8 },
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light',
    profile: 'isolated'
  },
  inputProtocol: {
    mechanism: {
      obsidian: 'CDP Input.dispatchMouseEvent',
      tsuzune: 'Electron debugger Input.dispatchMouseEvent'
    },
    targetNode: '00_Home.md',
    drag: { deltaX: 96, deltaY: 64, unit: 'CSS px' },
    checkpoints: [
      'baseline',
      'during-hold',
      'release-immediate',
      'release-250ms',
      'release-settled',
      'graph-close-reopen',
      'full-app-restart'
    ]
  },
  semanticContract: {
    duringPress: 'node is temporarily held at the pointer',
    pointerUp: 'temporary fixation is cleared and the force simulation resumes',
    persistence: 'node coordinates and pin state are not persisted'
  },
  normalization: {
    crossProductAcceptance:
      'semantic lifecycle only; baseline coordinate equality is intentionally excluded',
    obsidianReopenBehavior: 'force layout is reseeded',
    tsuzuneReopenBehavior: 'deterministic layout returns to its baseline',
    tolerance: { dragCssPx: 1 }
  },
  nodeDrag: { obsidian, tsuzune },
  comparisons,
  safeguards: {
    obsidian: obsidianManifest.assertions,
    tsuzune: tsuzuneManifest.assertions
  },
  notEstablished: [
    'physical mouse and real-OS pointer acceptance',
    'pixel-identical force trajectory or decay curve',
    'identical seeded coordinates after graph remount',
    'Local Graph node drag lifecycle',
    'touch or pen input parity'
  ],
  conclusion: allMatched
    ? 'Both products hold a node only during the drag, release it back to the force simulation on pointerup, and persist neither node coordinates nor pin state. No TSUZUNE product-code change is required for this slice.'
    : 'At least one node-drag lifecycle check differs. Review the differing row before changing TSUZUNE product code.'
}

await mkdir(outputAssetsRoot, { recursive: true })
if (relative(sourceAssetsRoot, outputAssetsRoot) !== '') {
  await cp(sourceAssetsRoot, outputAssetsRoot, { recursive: true, force: true })
}
await writeFile(
  resolve(outputAssetsRoot, 'comparison.json'),
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8'
)

const formatValue = (value) => {
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${typeof item === 'number' ? item.toFixed(3) : item}`)
      .join(', ')
  }
  return String(value)
}
const rows = comparisons
  .map(
    (item) => `<tr><td>${item.label}</td><td>${formatValue(item.obsidian)}</td><td>${formatValue(item.tsuzune)}</td><td class="${item.status}">${item.status === 'matched' ? '一致' : '差分'}</td></tr>`
  )
  .join('\n')
const checkpoints = [
  ['Baseline', '00-baseline.png'],
  ['During node drag', '01-during-node-drag.png'],
  ['After node release', '02-after-node-release.png'],
  ['After Graph reopen', '03-after-graph-reopen.png'],
  ['After app restart', '04-after-app-restart.png']
]
const shots = checkpoints
  .map(
    ([label, file]) => `<section class="checkpoint"><h3>${label}</h3><div class="shots"><figure><figcaption>Obsidian 1.13.4</figcaption><img src="assets/graph-gp0-node-drag-persistence/obsidian-1.13.4/${file}" alt="${label} in Obsidian"></figure><figure><figcaption>TSUZUNE</figcaption><img src="assets/graph-gp0-node-drag-persistence/tsuzune-working-tree/${file}" alt="${label} in TSUZUNE"></figure></div></section>`
  )
  .join('\n')
const decision = allMatched
  ? '<p><strong>TSUZUNE本体の修正は不要です。</strong> 両製品ともドラッグ中だけ一時固定し、pointerup後はForce simulationへ戻り、座標とpinを永続化しません。</p>'
  : '<p><strong>公開挙動の差分があります。</strong> 差分行の原証拠を確認してから本体修正へ進みます。</p>'

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>GP0-3b-d Node Drag Lifecycle — Obsidian 1.13.4 × TSUZUNE</title><style>
:root{color-scheme:light;--ink:#202923;--muted:#66716a;--paper:#f4f2eb;--card:#fffdf8;--line:#d6ddd7;--accent:#0f766e;--soft:#ddf3ef}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 0%,rgb(15 118 110 / 11%),transparent 32rem),var(--paper);color:var(--ink);font-family:Inter,"Segoe UI","Noto Sans JP",sans-serif;line-height:1.65}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:56px 0 72px}h1{margin:0;max-width:980px;font-size:clamp(2.25rem,5vw,4.35rem);line-height:1.05;letter-spacing:-.045em}h2{margin:54px 0 12px;font-size:clamp(1.4rem,3vw,2.1rem)}h3{margin:0 0 12px}.eyebrow{margin:0 0 10px;color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.lede{max-width:900px;color:#445149;font-size:1.12rem}.verdict{display:inline-block;margin-top:18px;padding:8px 14px;border:1px solid #9bcfc5;border-radius:999px;background:var(--soft);color:#0b625c;font-weight:750}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:30px}.card,.table-wrap,.checkpoint{border:1px solid var(--line);border-radius:18px;background:rgb(255 253 248 / 94%);box-shadow:0 12px 32px rgb(35 48 41 / 8%)}.card{padding:20px}.card strong{display:block;font-size:1.3rem}.card span,.note{color:var(--muted)}.table-wrap{overflow:auto}table{width:100%;min-width:760px;border-collapse:collapse}th,td{padding:14px 16px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#edf1ec;color:#3b4840;font-size:.78rem;letter-spacing:.05em;text-transform:uppercase}tr:last-child td{border-bottom:0}.matched{color:var(--accent);font-weight:800}.different{color:#b42318;font-weight:800}.checkpoint{margin-top:18px;padding:18px}.shots{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0}figcaption{margin-bottom:8px;color:var(--muted);font-size:.9rem;font-weight:700}img{display:block;width:100%;border:1px solid var(--line);border-radius:12px;background:#fff}.scope{padding:18px 20px;border-left:4px solid #d39b37;border-radius:12px;background:#fff1cf;color:#71480d}@media(max-width:780px){.cards,.shots{grid-template-columns:1fr}main{padding-top:36px}}
</style></head><body><main><p class="eyebrow">GP0-3b-d · Node drag lifecycle</p><h1>つかんでいる間だけ固定し、離せば物理配置へ戻る。</h1><p class="lede">固定Obsidian Desktop 1.13.4とTSUZUNEを、同じ8-node fixture・1265×768・DPR 1・ライトテーマで比較しました。絶対座標ではなく、ノード固定と永続化の公開契約を判定しています。</p><div class="verdict">${matchedCount} / ${comparisons.length} lifecycle checks matched</div><div class="cards"><div class="card"><strong>+96, +64</strong><span>制御入力したCSS pixel移動</span></div><div class="card"><strong>Release</strong><span>pointerup後にsimulationへ復帰</span></div><div class="card"><strong>Not persisted</strong><span>座標・pinを保存しない</span></div></div><h2>契約比較</h2><p class="note">Obsidianは再表示時に配置を再シードし、TSUZUNEは決定的baselineへ戻ります。この絶対座標差は、node pin／座標保存契約の不一致として扱いません。</p><div class="table-wrap"><table><thead><tr><th>Check</th><th>Obsidian</th><th>TSUZUNE</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div><h2>画面証拠</h2>${shots}<h2>判断</h2>${decision}<div class="scope">入力は両製品ともCDP系の隔離オフスクリーン制御です。物理マウス、実OSポインター、完全に同一な減衰曲線、再シード座標、Local Graph、touch／penは今回確定していません。</div></main></body></html>`

await mkdir(reportsRoot, { recursive: true })
await writeFile(
  resolve(reportsRoot, 'graph-gp0-node-drag-persistence-2026-08-04.html'),
  html,
  'utf8'
)

process.stdout.write(
  `${JSON.stringify({ status: comparison.status, checks: comparisons.length, reportsRoot }, null, 2)}\n`
)
