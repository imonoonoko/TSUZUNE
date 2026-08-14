import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-node-new-tab')
const reportPath = resolve(repoRoot, 'docs/reports/graph-gp0-node-new-tab-2026-08-09.html')
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const obsidianManifest = await readJson(resolve(assetsRoot, 'manifest.json'))
const obsidianObservation = await readJson(
  resolve(assetsRoot, 'obsidian-1.13.4/observation.json')
)
const tsuzuneManifest = await readJson(
  resolve(assetsRoot, 'tsuzune-working-tree/manifest.json')
)
const tsuzuneObservation = await readJson(
  resolve(assetsRoot, 'tsuzune-working-tree/observation.json')
)

if (
  obsidianManifest.status !== 'reference-captured' ||
  !obsidianManifest.scope.nodeNewTabProbe ||
  tsuzuneManifest.status !== 'captured' ||
  !tsuzuneObservation.nodeNewTabProbe
) {
  throw new Error('GP0-3b-f evidence is invalid')
}
if (
  ![obsidianManifest.assertions, tsuzuneManifest.assertions].every((checks) =>
    Object.values(checks).every(Boolean)
  )
) {
  throw new Error('A capture safeguard failed')
}

const obsidianMenuActions = obsidianObservation.nodeContextMenu.items.filter(
  (item) => !item.classes.includes('is-label')
)
const obsidianAction = obsidianMenuActions.find((item) => item.text === '新規タブに開く')
const tsuzuneAction = tsuzuneObservation.nodeMenuContract.items.find(
  (item) => item.text === '新規タブに開く'
)
const obsidian = obsidianObservation.nodeNewTab
const tsuzune = tsuzuneObservation.nodeNewTabContract
const attachment = tsuzuneObservation.attachmentNewTabContract
const comparisons = [
  {
    id: 'action-label',
    label: '操作文言',
    obsidian: obsidianAction?.text,
    tsuzune: tsuzuneAction?.text,
    status: obsidianAction?.text === tsuzuneAction?.text ? 'matched' : 'different'
  },
  {
    id: 'action-enabled',
    label: '操作が有効',
    obsidian: !obsidianAction?.disabled,
    tsuzune: !tsuzuneAction?.disabled,
    status: obsidianAction?.disabled === tsuzuneAction?.disabled ? 'matched' : 'different'
  },
  {
    id: 'note-tab-created',
    label: 'note用の新規タブを生成',
    obsidian: obsidian.after.markdownLeafCount > obsidian.before.markdownLeafCount,
    tsuzune: tsuzune.afterTabCount > tsuzune.beforeTabCount,
    status:
      obsidian.after.markdownLeafCount > obsidian.before.markdownLeafCount &&
      tsuzune.afterTabCount > tsuzune.beforeTabCount
        ? 'matched'
        : 'different'
  },
  {
    id: 'target-active',
    label: '対象noteを新規タブで選択',
    obsidian: obsidian.after.activeFile,
    tsuzune: tsuzune.activeTab,
    status:
      obsidian.after.activeFile === '00_Home.md' && tsuzune.activeTab === '00_Home'
        ? 'matched'
        : 'different'
  },
  {
    id: 'graph-retained',
    label: '元のグラフを別タブとして保持',
    obsidian: obsidian.after.graphLeafCount === obsidian.before.graphLeafCount,
    tsuzune: !tsuzune.graphClosed,
    status:
      obsidian.after.graphLeafCount === obsidian.before.graphLeafCount && !tsuzune.graphClosed
        ? 'matched'
        : 'different'
  },
  {
    id: 'attachment-tab',
    label: 'attachmentを内部タブで開く',
    obsidian: 'not-established',
    tsuzune: attachment.attachmentVisible && attachment.afterTabCount > attachment.beforeTabCount,
    status: 'not-established'
  }
]
const status = comparisons.every((item) => item.status === 'matched') ? 'matched' : 'partial'
const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-f',
  capturedAt: new Date().toISOString(),
  status,
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph',
    query: '',
    targetNode: '00_Home.md',
    attachmentNode: 'attachments/diagram.svg',
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  comparisons,
  safeguards: {
    obsidian: obsidianManifest.assertions,
    tsuzune: tsuzuneManifest.assertions
  },
  established: [
    '両製品で「新規タブに開く」が有効',
    '両製品で対象noteの新規タブが生成され選択される',
    'TSUZUNEでattachmentがOSへ即送出されず内部preview tabとして開く',
    'TSUZUNEでは内部previewから明示操作した時だけ既定アプリへ送る'
  ],
  notEstablished: [
    'Obsidian attachment nodeの同操作結果',
    'TSUZUNEで元Global Graphをworkspace tabとして保持する挙動',
    'タブの並び替え、復元、分割、ウィンドウ間移動',
    '物理マウスと実OSアクセシビリティ',
    'pixel-identical tab geometry and styling'
  ],
  conclusion:
    'noteの新規タブ生成は一致した。TSUZUNEのattachment内部tabも成立したが、Obsidianは元Graph leafを保持し、TSUZUNEはGraph viewを閉じる。attachmentのObsidian側実動作も未採取のためGP0-3b-fはpartial。'
}
await mkdir(assetsRoot, { recursive: true })
await writeFile(
  resolve(assetsRoot, 'comparison.json'),
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8'
)

const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const format = (value) => escape(typeof value === 'object' ? JSON.stringify(value) : value)
const rows = comparisons
  .map(
    (item) =>
      `<tr><td>${escape(item.label)}</td><td>${format(item.obsidian)}</td><td>${format(item.tsuzune)}</td><td class="${item.status}">${item.status}</td></tr>`
  )
  .join('')
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-f Node New Tab</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#fff1cf;color:#7a4d00;font-weight:800}.shots{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched{color:#08766d;font-weight:800}.different{color:#b42318;font-weight:800}.not-established{color:#7a4d00;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:760px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-f · 固定公開UI比較</p><h1>noteは新規タブへ。attachmentもTSUZUNE内で開く。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。</p><div class="verdict">${status}: note生成は一致、Graph保持とattachment基準は残件</div><h2>note操作</h2><div class="shots"><figure><figcaption>Obsidian 1.13.4</figcaption><img src="assets/graph-gp0-node-new-tab/obsidian-1.13.4/02-note-new-tab.png" alt="Obsidian note new tab"></figure><figure><figcaption>TSUZUNE working tree</figcaption><img src="assets/graph-gp0-node-new-tab/tsuzune-working-tree/02-note-new-tab.png" alt="TSUZUNE note new tab"></figure></div><h2>TSUZUNE attachment操作</h2><div class="shots"><figure><figcaption>attachment context menu</figcaption><img src="assets/graph-gp0-node-new-tab/tsuzune-working-tree/03-attachment-context-menu.png" alt="TSUZUNE attachment context menu"></figure><figure><figcaption>internal attachment tab</figcaption><img src="assets/graph-gp0-node-new-tab/tsuzune-working-tree/04-attachment-new-tab.png" alt="TSUZUNE attachment tab"></figure></div><h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><p class="scope">未証明: Obsidian attachment実動作、TSUZUNEの元Graph tab保持、タブ復元・分割・並べ替え、物理マウス、完全な見た目。</p></main></body></html>`
await writeFile(reportPath, html, 'utf8')
process.stdout.write(
  `${JSON.stringify({ status, report: reportPath, checks: comparisons.length }, null, 2)}\n`
)
