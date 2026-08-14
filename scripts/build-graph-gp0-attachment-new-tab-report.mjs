import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-attachment-new-tab')
const obsidian = JSON.parse(
  await readFile(resolve(assetsRoot, 'obsidian-1.13.4/observation.json'), 'utf8')
)
const obsidianManifest = JSON.parse(
  await readFile(resolve(assetsRoot, 'manifest.json'), 'utf8')
)
const tsuzune = JSON.parse(
  await readFile(resolve(assetsRoot, 'tsuzune-working-tree/observation.json'), 'utf8')
)

const obsidianAction = obsidian.attachmentNewTab
const tsuzuneAction = tsuzune.initial.attachmentNewTab
const obsidianMenu = obsidian.nodeContextMenu
const tsuzuneMenu = tsuzune.initial.nodeContextMenu
const obsidianGraphRetained =
  obsidianAction.after.tabHeaders.some((tab) => tab.ariaLabel === 'グラフビュー')
const tsuzuneGraphRetained =
  tsuzune.assertions.globalGraphTabRetained === true &&
  tsuzune.assertions.returnedToGlobalGraphTab === true

const required = {
  obsidianAttachmentTab:
    obsidianAction.after.activeLeaf?.viewType === 'image' &&
    obsidianAction.after.activeLeaf?.filePath === 'attachments/diagram.svg',
  tsuzuneAttachmentTab:
    tsuzuneAction.attachmentVisible === true && tsuzuneAction.activeTab === 'diagram.svg',
  obsidianGraphRetained,
  tsuzuneGraphRetained
}
if (!Object.values(required).every(Boolean)) {
  throw new Error(`GP0-3b-h attachment new-tab contractが成立していません: ${JSON.stringify(required)}`)
}

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-h',
  capturedAt: tsuzune.capturedAt,
  status: 'matched',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph attachment node new-tab action',
    targetNode: 'attachments/diagram.svg',
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  comparisons: [
    {
      id: 'attachment-node-visible',
      label: '公開フィルタで添付ノードを表示',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'new-tab-action',
      label: '右クリック「新規タブに開く」で添付タブを生成・選択',
      obsidian: required.obsidianAttachmentTab,
      tsuzune: required.tsuzuneAttachmentTab,
      status: 'matched'
    },
    {
      id: 'internal-preview',
      label: 'SVGをOS外部アプリへ渡さず内部プレビュー',
      obsidian: obsidianAction.after.activeLeaf.viewType,
      tsuzune: 'attachment preview',
      status: 'matched'
    },
    {
      id: 'graph-tab-retained',
      label: '添付を開いた後もGlobal Graphタブを保持して復帰可能',
      obsidian: obsidianGraphRetained,
      tsuzune: tsuzuneGraphRetained,
      status: 'matched'
    },
    {
      id: 'attachment-context-menu-size',
      label: '添付ノードの右クリックメニュー項目数',
      obsidian: obsidianMenu.items.length,
      tsuzune: tsuzuneMenu.items.length,
      status: 'known-gap-outside-slice'
    }
  ],
  established: [
    '両製品で添付ノードを公開フィルタから表示できる',
    '両製品で添付ノードを新しい内部プレビュータブへ開ける',
    '両製品で元Global Graphタブを保持し、TSUZUNEでは実際に復帰できる'
  ],
  remainingGap: {
    summary: '添付ノードの新規タブ動作は一致したが、TSUZUNEの添付context menuは2項目、Obsidianは11項目。',
    obsidianItems: obsidianMenu.items.map((item) => item.text),
    tsuzuneItems: tsuzuneMenu.items.map((item) => item.text)
  },
  safeguards: {
    obsidian: {
      sourceUnchanged: obsidianManifest.assertions.sourceUnchanged,
      isolatedVaultProtectedFilesUnchanged:
        obsidianManifest.assertions.isolatedVaultProtectedFilesUnchanged,
      protocolRestored: obsidianManifest.assertions.protocolRestored,
      activeViewType: obsidianAction.after.activeLeaf.viewType,
      graphTabRetained: obsidianGraphRetained
    },
    tsuzune: tsuzune.assertions
  },
  notEstablished: [
    '添付context menuの残り9項目の同等実装',
    '新規ウィンドウ、移動、ブックマーク、パスコピー、linked view、既定アプリ、フォルダ表示の操作結果',
    '物理マウスと実OSアクセシビリティ',
    'pixel-identical tab geometry and styling'
  ],
  conclusion:
    'GP0-3b-hでは添付ノードの「新規タブに開く」を一致確認した。TSUZUNEはSVGを内部プレビューし、Global Graphタブを保持して復帰できる。残る差は同アクションではなく、添付context menuの項目網羅性である。'
}

await mkdir(assetsRoot, { recursive: true })
await writeFile(resolve(assetsRoot, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')

const rows = comparison.comparisons
  .map(
    (item) =>
      `<tr><td>${item.label}</td><td>${String(item.obsidian)}</td><td>${String(item.tsuzune)}</td><td class="${item.status}">${item.status}</td></tr>`
  )
  .join('')
const report = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-h Attachment New Tab</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#d9f4ec;color:#08685f;font-weight:800}.shots{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched{color:#08766d;font-weight:800}.known-gap-outside-slice{color:#a66100;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:900px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-h · 固定公開UI比較</p><h1>添付も、内部タブで開き、グラフへ戻れる。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。</p><div class="verdict">matched: 添付ノードの新規タブ動作</div><h2>操作結果</h2><div class="shots"><figure><figcaption>Obsidian: SVG image tab</figcaption><img src="assets/graph-gp0-attachment-new-tab/obsidian-1.13.4/02-attachment-new-tab.png" alt="Obsidian attachment new tab"></figure><figure><figcaption>TSUZUNE: SVG internal preview tab</figcaption><img src="assets/graph-gp0-attachment-new-tab/tsuzune-working-tree/02-attachment-new-tab.png" alt="TSUZUNE attachment new tab"></figure><figure><figcaption>TSUZUNE: retained Global Graphへ復帰</figcaption><img src="assets/graph-gp0-attachment-new-tab/tsuzune-working-tree/03-returned-global-graph.png" alt="TSUZUNE returned Global Graph"></figure></div><h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><p class="scope">新規タブ動作は一致しました。添付context menu全体はObsidian 11項目、TSUZUNE 2項目で、残り操作は次slice以降の公開差です。</p></main></body></html>`
await writeFile(resolve(repoRoot, 'docs/reports/graph-gp0-attachment-new-tab-2026-08-09.html'), report, 'utf8')

console.log(JSON.stringify({ status: comparison.status, comparisons: comparison.comparisons.length }, null, 2))
