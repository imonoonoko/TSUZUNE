import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-node-context-menu')
const reportPath = resolve(repoRoot, 'docs/reports/graph-gp0-node-context-menu-2026-08-09.html')
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const obsidianManifest = await readJson(resolve(assetsRoot, 'manifest.json'))
const obsidianObservation = await readJson(resolve(assetsRoot, 'obsidian-1.13.4/observation.json'))
const tsuzuneManifest = await readJson(resolve(assetsRoot, 'tsuzune-working-tree/manifest.json'))
const tsuzuneObservation = await readJson(resolve(assetsRoot, 'tsuzune-working-tree/observation.json'))

if (obsidianManifest.status !== 'reference-captured' || !obsidianManifest.scope.nodeMenuProbe) {
  throw new Error('Obsidian node context menu evidence is invalid')
}
if (tsuzuneManifest.status !== 'captured' || !tsuzuneObservation.nodeMenuProbe) {
  throw new Error('TSUZUNE node context menu evidence is invalid')
}
if (![obsidianManifest.assertions, tsuzuneManifest.assertions].every((checks) => Object.values(checks).every(Boolean))) {
  throw new Error('A capture safeguard failed')
}

const obsidian = obsidianObservation.nodeContextMenu
const tsuzune = tsuzuneObservation.nodeMenuContract
const obsidianActions = obsidian.items.filter((item) => !item.classes.includes('is-label'))
const tsuzuneActions = tsuzune.items
const comparisons = [
  {
    id: 'target-label',
    label: '対象nodeラベル',
    obsidian: obsidian.items[0]?.text,
    tsuzune: tsuzune.title,
    status: obsidian.items[0]?.text === tsuzune.title ? 'matched' : 'different'
  },
  {
    id: 'action-count',
    label: '操作項目数（ラベルを除く）',
    obsidian: obsidianActions.length,
    tsuzune: tsuzuneActions.length,
    status: obsidianActions.length === tsuzuneActions.length ? 'matched' : 'different'
  },
  {
    id: 'action-order',
    label: '操作名と順序',
    obsidian: obsidianActions.map((item) => item.text),
    tsuzune: tsuzuneActions.map((item) => item.text),
    status: JSON.stringify(obsidianActions.map((item) => item.text)) === JSON.stringify(tsuzuneActions.map((item) => item.text)) ? 'matched' : 'different'
  },
  {
    id: 'first-action-label',
    label: '先頭操作の文言',
    obsidian: obsidianActions[0]?.text,
    tsuzune: tsuzuneActions[0]?.text,
    status: obsidianActions[0]?.text === tsuzuneActions[0]?.text ? 'matched' : 'different'
  },
  {
    id: 'first-action-enabled',
    label: '先頭操作の有効状態',
    obsidian: !obsidianActions[0]?.disabled,
    tsuzune: !tsuzuneActions[0]?.disabled,
    status: obsidianActions[0]?.disabled === tsuzuneActions[0]?.disabled ? 'matched' : 'different'
  },
  {
    id: 'delete-action',
    label: '削除操作の文言と有効状態',
    obsidian: obsidianActions.at(-1),
    tsuzune: tsuzuneActions.at(-1),
    status:
      obsidianActions.at(-1)?.text === tsuzuneActions.at(-1)?.text &&
      obsidianActions.at(-1)?.disabled === tsuzuneActions.at(-1)?.disabled
        ? 'matched'
        : 'different'
  }
]
const status = comparisons.every((item) => item.status === 'matched') ? 'matched' : 'different'
const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-e',
  capturedAt: new Date().toISOString(),
  status,
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph',
    query: '',
    targetNode: '00_Home.md',
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  obsidian: { title: obsidian.items[0]?.text, actions: obsidianActions },
  tsuzune: { title: tsuzune.title, actions: tsuzuneActions },
  comparisons,
  safeguards: { obsidian: obsidianManifest.assertions, tsuzune: tsuzuneManifest.assertions },
  changeInThisSlice: '先頭操作の文言だけを「新規タブに開く」へ一致させた。',
  notEstablished: [
    '残る9操作と2 submenuの実装互換',
    '新規タブ操作の有効化と実際のtab生成',
    'attachment、tag、unresolved nodeのObsidian実機menu',
    '物理マウスと実OS context-menu acceptance',
    'pixel-identical menu geometry and styling'
  ],
  conclusion: 'ラベル、先頭文言、削除操作は一致したが、TSUZUNEは2操作、Obsidianは11操作で、先頭操作の有効状態も異なる。GP0-3b-eはdifferent。'
}
await mkdir(assetsRoot, { recursive: true })
await writeFile(resolve(assetsRoot, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')

const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const format = (value) => escape(typeof value === 'object' ? JSON.stringify(value) : value)
const rows = comparisons.map((item) => `<tr><td>${escape(item.label)}</td><td>${format(item.obsidian)}</td><td>${format(item.tsuzune)}</td><td class="${item.status}">${item.status}</td></tr>`).join('')
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-e Node Context Menu</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#ffe3df;color:#9b2219;font-weight:800}.shots{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched{color:#08766d;font-weight:800}.different{color:#b42318;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:760px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-e · 固定実機比較</p><h1>右クリックメニューは、まだ同じではない。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。</p><div class="verdict">${status}: TSUZUNE 2操作 / Obsidian 11操作</div><h2>画面証拠</h2><div class="shots"><figure><figcaption>Obsidian 1.13.4</figcaption><img src="assets/graph-gp0-node-context-menu/obsidian-1.13.4/01-node-context-menu.png" alt="Obsidian node context menu"></figure><figure><figcaption>TSUZUNE working tree</figcaption><img src="assets/graph-gp0-node-context-menu/tsuzune-working-tree/01-node-context-menu.png" alt="TSUZUNE node context menu"></figure></div><h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><h2>今回の最小修正</h2><p>先頭操作の文言だけを「新規タブに開く」へ一致させました。残りの操作や無効状態を未実装のまま一致扱いにはしていません。</p><p class="scope">未証明: attachment／tag／unresolved nodeの実機menu、物理マウス、完全な見た目、残る9操作とsubmenu、実際の新規タブ生成。</p></main></body></html>`
await writeFile(reportPath, html, 'utf8')
process.stdout.write(`${JSON.stringify({ status, report: reportPath, checks: comparisons.length }, null, 2)}\n`)
