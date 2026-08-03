import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-camera-persistence')
const obsidianManifest = JSON.parse(await readFile(resolve(assetsRoot, 'manifest.json'), 'utf8'))
const obsidianObservation = JSON.parse(
  await readFile(resolve(assetsRoot, 'obsidian-1.13.4/observation.json'), 'utf8')
)
const tsuzuneObservation = JSON.parse(
  await readFile(resolve(assetsRoot, 'tsuzune-working-tree/observation.json'), 'utf8')
)
const tsuzuneManifest = JSON.parse(
  await readFile(resolve(assetsRoot, 'tsuzune-working-tree/manifest.json'), 'utf8')
)

const assertEvidence = (condition, message) => {
  if (!condition) throw new Error(`GP0-3b-c evidence is invalid: ${message}`)
}

assertEvidence(obsidianManifest.status === 'reference-captured', 'Obsidian capture did not pass')
assertEvidence(obsidianManifest.scope.version === '1.13.4', 'Obsidian version drifted')
assertEvidence(obsidianManifest.scope.query === '', 'Obsidian query is not empty')
assertEvidence(obsidianManifest.scope.cameraProbe === true, 'Obsidian camera mode was not used')
assertEvidence(
  Object.values(obsidianManifest.assertions).every(Boolean),
  'an Obsidian safeguard failed'
)
assertEvidence(tsuzuneManifest.status === 'captured', 'TSUZUNE capture did not pass')
assertEvidence(
  Object.values(tsuzuneManifest.assertions).every(Boolean),
  'a TSUZUNE safeguard failed'
)
assertEvidence(tsuzuneObservation.query === '', 'TSUZUNE query is not empty')
assertEvidence(tsuzuneObservation.cameraProbe === true, 'TSUZUNE camera mode was not used')
assertEvidence(
  obsidianObservation.expected.viewport.width === 1265 &&
    obsidianObservation.expected.viewport.height === 768 &&
    obsidianObservation.beforeEntry.windowBounds.width === 1265 &&
    obsidianObservation.beforeEntry.windowBounds.height === 768,
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

const obsidian = {
  baseline: obsidianObservation.beforeEntry.camera,
  ...obsidianManifest.cameraContract
}
const tsuzune = tsuzuneObservation.cameraContract

const comparisons = [
  {
    id: 'zoom-application',
    label: 'ホイールで1.5倍ズーム',
    obsidian: obsidian.afterInput.targetScale,
    tsuzune: tsuzune.afterInput.scale,
    status: obsidian.afterInput.targetScale === 1.5 && tsuzune.afterInput.scale === 1.5
      ? 'matched'
      : 'different'
  },
  {
    id: 'pan-application',
    label: '背景を+96,+64 CSS pxパン',
    obsidian: [obsidian.afterInput.panOffsetX, obsidian.afterInput.panOffsetY],
    tsuzune: [tsuzune.afterInput.panX, tsuzune.afterInput.panY],
    status:
      Math.abs(obsidian.afterInput.panOffsetX - 96) < 1 &&
      Math.abs(obsidian.afterInput.panOffsetY - 64) < 1 &&
      tsuzune.afterInput.panX === 96 &&
      tsuzune.afterInput.panY === 64
        ? 'matched'
        : 'different'
  },
  {
    id: 'zoom-graph-reopen-persistence',
    label: 'Graph再表示後のズーム',
    obsidian: obsidian.zoomPersistedAfterGraphReopen ? '保持' : '非保持',
    tsuzune:
      tsuzune.afterGraphReopen.scale === tsuzune.afterInput.scale ? '保持' : '非保持',
    status:
      obsidian.zoomPersistedAfterGraphReopen &&
      tsuzune.afterGraphReopen.scale === tsuzune.afterInput.scale
        ? 'matched'
        : 'different'
  },
  {
    id: 'pan-graph-reopen-persistence',
    label: 'Graph再表示後のパン',
    obsidian: obsidian.panResetAfterGraphReopen ? '中央へリセット' : '保持',
    tsuzune:
      tsuzune.afterGraphReopen.panX === 0 && tsuzune.afterGraphReopen.panY === 0
        ? '中央へリセット'
        : '保持',
    status:
      obsidian.panResetAfterGraphReopen &&
      tsuzune.afterGraphReopen.panX === 0 &&
      tsuzune.afterGraphReopen.panY === 0
        ? 'matched'
        : 'different'
  },
  {
    id: 'zoom-app-restart-persistence',
    label: 'アプリ再起動後のズーム',
    obsidian: obsidian.zoomPersistedAfterAppRestart ? '保持' : '非保持',
    tsuzune:
      tsuzune.afterAppRestart.scale === tsuzune.afterInput.scale ? '保持' : '非保持',
    status:
      obsidian.zoomPersistedAfterAppRestart &&
      tsuzune.afterAppRestart.scale === tsuzune.afterInput.scale
        ? 'matched'
        : 'different'
  },
  {
    id: 'pan-app-restart-persistence',
    label: 'アプリ再起動後のパン',
    obsidian: obsidian.panResetAfterAppRestart ? '中央へリセット' : '保持',
    tsuzune:
      tsuzune.afterAppRestart.panX === 0 && tsuzune.afterAppRestart.panY === 0
        ? '中央へリセット'
        : '保持',
    status:
      obsidian.panResetAfterAppRestart &&
      tsuzune.afterAppRestart.panX === 0 &&
      tsuzune.afterAppRestart.panY === 0
        ? 'matched'
        : 'different'
  }
]

const matchedCount = comparisons.filter((item) => item.status === 'matched').length
const allMatched = matchedCount === comparisons.length

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-c',
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
      tsuzune: 'offscreen DOM WheelEvent and PointerEvent'
    },
    zoom: { type: 'wheel', deltaY: -120, anchor: 'graph background center' },
    pan: { type: 'background drag', deltaX: 96, deltaY: 64, unit: 'CSS px' },
    checkpoints: ['baseline', 'after-input', 'graph-close-reopen', 'full-app-restart']
  },
  normalization: {
    obsidianZoom: 'renderer.targetScale and persisted graph option',
    obsidianPan: 'renderer pan minus canvas device-pixel center',
    tsuzuneZoom: 'CSS stage transform scale',
    tsuzunePan: 'CSS stage transform translate',
    tolerance: { zoom: 0.000001, panCssPx: 1 }
  },
  camera: { obsidian, tsuzune },
  comparisons,
  safeguards: {
    obsidian: obsidianManifest.assertions,
    tsuzune: tsuzuneManifest.assertions
  },
  notEstablished: [
    'pixel-level visual parity',
    'Obsidian zoom easing curve parity',
    'Local Graph camera lifecycle',
    'fit/reset and zoom-limit behavior in this lifecycle slice',
    'workspace leaf auto-restoration parity',
    'physical mouse and trusted-event parity'
  ],
  conclusion: allMatched
    ? 'Both products persist Global Graph zoom across Graph reopen and full app restart, while pan returns to the centered origin. No TSUZUNE product-code change is required for this slice.'
    : 'At least one Global Graph camera lifecycle check differs. Review the differing rows before changing TSUZUNE product code.'
}

await writeFile(
  resolve(assetsRoot, 'comparison.json'),
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8'
)

const formatCell = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => (typeof item === 'number' ? item.toFixed(2) : String(item))).join(', ')}]`
  }
  return String(value)
}

const rows = comparisons
  .map(
    (item) => `<tr><td>${item.label}</td><td>${formatCell(item.obsidian)}</td><td>${formatCell(item.tsuzune)}</td><td class="${item.status === 'matched' ? 'match' : 'different'}">${item.status === 'matched' ? '一致' : '差分'}</td></tr>`
  )
  .join('\n')

const headline = allMatched ? 'ズームは残り、パンは中央へ戻る。' : 'カメラ契約に差分があります。'
const lede = allMatched
  ? '制御された論理入力後、Graph再表示後、完全再起動後のカメラ契約は一致しています。'
  : '制御された論理入力後、Graph再表示後、完全再起動後の比較で差分を検出しました。'
const decision = allMatched
  ? '<p><strong>TSUZUNE本体の修正は不要です。</strong> パンを永続化すると、今回固定したObsidian 1.13.4の公開挙動から逆に離れます。比較・再現スクリプトと証拠のみ追加しました。</p>'
  : '<p><strong>TSUZUNE本体をまだ変更しません。</strong> 差分行と原証拠を確認し、公開挙動の不一致だけを次の修正候補にします。</p>'

const checkpoints = [
  ['Baseline', '00-baseline.png'],
  ['After camera input', '01-after-camera-input.png'],
  ['After Graph reopen', '02-after-graph-reopen.png'],
  ['After app restart', '03-after-app-restart.png']
]
const shots = checkpoints
  .map(
    ([label, file]) => `<section class="checkpoint"><h3>${label}</h3><div class="shots"><figure><figcaption>Obsidian 1.13.4</figcaption><img src="assets/graph-gp0-camera-persistence/obsidian-1.13.4/${file}" alt="${label} in Obsidian"></figure><figure><figcaption>TSUZUNE</figcaption><img src="assets/graph-gp0-camera-persistence/tsuzune-working-tree/${file}" alt="${label} in TSUZUNE"></figure></div></section>`
  )
  .join('\n')

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>GP0-3b-c Camera Persistence — Obsidian 1.13.4 × TSUZUNE</title>
  <style>
    :root { color-scheme: light; --ink:#1f2924; --muted:#66716a; --paper:#f5f3ec; --card:#fffdf8; --line:#d8ddd7; --accent:#0f766e; --soft:#ddf3ef; }
    * { box-sizing:border-box; }
    body { margin:0; background:radial-gradient(circle at 10% 0%,rgb(15 118 110 / 10%),transparent 32rem),var(--paper); color:var(--ink); font-family:Inter,"Segoe UI","Noto Sans JP",sans-serif; line-height:1.65; }
    main { width:min(1180px,calc(100% - 32px)); margin:auto; padding:60px 0 72px; }
    h1 { margin:0; max-width:980px; font-size:clamp(2.2rem,5vw,4.4rem); line-height:1.04; letter-spacing:-.045em; }
    h2 { margin:56px 0 10px; font-size:clamp(1.4rem,3vw,2.1rem); }
    h3 { margin:0 0 12px; }
    .eyebrow { margin:0 0 10px; color:var(--accent); font-size:.78rem; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
    .lede { max-width:880px; color:#445149; font-size:1.12rem; }
    .verdict { display:inline-block; margin-top:18px; padding:8px 14px; border:1px solid #9bcfc5; border-radius:999px; background:var(--soft); color:#0b625c; font-weight:750; }
    .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:30px; }
    .card,.table-wrap,.checkpoint { border:1px solid var(--line); border-radius:18px; background:rgb(255 253 248 / 94%); box-shadow:0 12px 32px rgb(35 48 41 / 8%); }
    .card { padding:20px; }
    .card strong { display:block; font-size:1.35rem; }
    .card span,.note { color:var(--muted); }
    .table-wrap { overflow:auto; }
    table { width:100%; min-width:760px; border-collapse:collapse; }
    th,td { padding:14px 16px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { background:#edf1ec; color:#3b4840; font-size:.78rem; letter-spacing:.05em; text-transform:uppercase; }
    tr:last-child td { border-bottom:0; }
    .match { color:var(--accent); font-weight:800; }
    .different { color:#b42318; font-weight:800; }
    .checkpoint { margin-top:18px; padding:18px; }
    .shots { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    figure { margin:0; }
    figcaption { margin-bottom:8px; color:var(--muted); font-size:.9rem; font-weight:700; }
    img { display:block; width:100%; border:1px solid var(--line); border-radius:12px; background:#fff; }
    code { padding:.1rem .35rem; border:1px solid var(--line); border-radius:.35rem; background:#fff; }
    .scope { padding:18px 20px; border-left:4px solid #d39b37; border-radius:12px; background:#fff1cf; color:#71480d; }
    @media (max-width:780px) { .cards,.shots { grid-template-columns:1fr; } main { padding-top:36px; } }
  </style>
</head>
<body><main>
  <p class="eyebrow">GP0-3b-c · Camera lifecycle</p>
  <h1>${headline}</h1>
  <p class="lede">固定Obsidian Desktop 1.13.4とTSUZUNEを、同じfixture・1265×768・DPR 1・ライトテーマで比較しました。${lede}</p>
  <div class="verdict">${matchedCount} / ${comparisons.length} camera checks matched</div>
  <div class="cards"><div class="card"><strong>1.5×</strong><span>両製品で保存されるズーム</span></div><div class="card"><strong>+96, +64</strong><span>背景ドラッグで適用したパン</span></div><div class="card"><strong>0, 0</strong><span>再表示・再起動後の中央オフセット</span></div></div>
  <h2>契約比較</h2>
  <p class="note">Obsidianの生panはdevice pixel中心座標なので、canvas中央からのオフセットへ正規化しています。ズームは補間中の描画値ではなく、保存対象の<code>targetScale</code>を正本にしました。</p>
  <div class="table-wrap"><table><thead><tr><th>Check</th><th>Obsidian</th><th>TSUZUNE</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2>画面証拠</h2>
  ${shots}
  <h2>判断</h2>
  ${decision}
  <div class="scope">入力機構はObsidian側がCDPマウス入力、TSUZUNE側が隔離オフスクリーンのDOM合成入力です。この結果はGlobal Graphのカメラ生命周期だけを確定します。物理マウス／trusted event、pixel単位の描画一致、Obsidianのズーム補間曲線、Local Graph、fit/reset、workspace leaf自動復元は未確定です。</div>
</main></body></html>`

await writeFile(
  resolve(repoRoot, 'docs/reports/graph-gp0-camera-persistence-2026-08-03.html'),
  html,
  'utf8'
)

process.stdout.write(`${JSON.stringify({ status: comparison.status, checks: comparisons.length }, null, 2)}\n`)
