import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-attachment-new-window')
const obsidian = JSON.parse(
  await readFile(resolve(assetsRoot, 'obsidian-1.13.4/observation.json'), 'utf8')
)
const obsidianManifest = JSON.parse(
  await readFile(resolve(assetsRoot, 'manifest.json'), 'utf8')
)
const tsuzune = JSON.parse(
  await readFile(resolve(assetsRoot, 'tsuzune-working-tree/observation.json'), 'utf8')
)

const obsidianAction = obsidian.attachmentNewWindow
const tsuzuneAction = tsuzune.attachmentNewWindowContract
const obsidianMenu = obsidian.nodeContextMenu
const tsuzuneMenu = tsuzune.initial.nodeContextMenu
const required = {
  obsidianWindowCreated:
    obsidianAction.sourceAfter.browserWindowCount > obsidianAction.before.browserWindowCount,
  tsuzuneWindowCreated: tsuzune.assertions.attachmentWindowCreated === true,
  obsidianInternalImage:
    obsidianAction.newWindow.activeLeaf?.viewType === 'image' &&
    obsidianAction.newWindow.activeLeaf?.filePath === 'attachments/diagram.svg',
  tsuzuneInternalImage:
    tsuzuneAction.preview?.previewVisible === true &&
    tsuzuneAction.preview?.path === 'attachments/diagram.svg',
  obsidianSourceGraphRetained: obsidianAction.sourceAfter.graphLeafCount === 1,
  tsuzuneSourceGraphRetained: tsuzune.assertions.sourceGraphKeptOpen === true,
  obsidianMenuClosed: obsidianAction.sourceAfter.menuClosed === true,
  tsuzuneMenuClosed: tsuzune.assertions.attachmentContextMenuClosedAfterAction === true
}
if (!Object.values(required).every(Boolean)) {
  throw new Error(`GP0-3b-i attachment new-window contractが成立していません: ${JSON.stringify(required)}`)
}

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-i',
  capturedAt: tsuzune.capturedAt,
  status: 'matched',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph attachment node new-window action',
    targetNode: 'attachments/diagram.svg',
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  comparisons: [
    {
      id: 'new-window-action',
      label: '右クリック「新規ウィンドウで開く」でトップレベルウィンドウを生成',
      obsidian: required.obsidianWindowCreated,
      tsuzune: required.tsuzuneWindowCreated,
      status: 'matched'
    },
    {
      id: 'internal-image-preview',
      label: 'SVGを外部アプリへ渡さず内部画像ビューで表示',
      obsidian: obsidianAction.newWindow.activeLeaf.viewType,
      tsuzune: 'internal image preview',
      status: 'matched'
    },
    {
      id: 'source-graph-retained',
      label: '元Global Graphを開いたまま保持',
      obsidian: required.obsidianSourceGraphRetained,
      tsuzune: required.tsuzuneSourceGraphRetained,
      status: 'matched'
    },
    {
      id: 'context-menu-closes',
      label: '操作後にcontext menuを閉じる',
      obsidian: required.obsidianMenuClosed,
      tsuzune: required.tsuzuneMenuClosed,
      status: 'matched'
    },
    {
      id: 'attachment-context-menu-size',
      label: '添付ノードの右クリックメニュー項目数',
      obsidian: obsidianMenu.items.length,
      tsuzune: tsuzuneMenu.items.length,
      status: 'known-gap-outside-slice'
    },
    {
      id: 'detached-window-visual-shell',
      label: '独立ウィンドウのタブ・パス・余白の視覚一致',
      obsidian: 'Obsidian workspace shell',
      tsuzune: 'minimal TSUZUNE attachment shell',
      status: 'known-gap-outside-slice'
    }
  ],
  established: [
    '両製品で添付ノードから2つ目のトップレベルウィンドウを生成できる',
    '両製品でSVGをOS既定アプリではなく内部画像ビューとして表示する',
    '両製品で元Global Graphを保持し、操作後にcontext menuを閉じる'
  ],
  remainingGap: {
    summary: '公開操作と状態遷移は一致した。独立ウィンドウのworkspace装飾とcontext menu全11項目の網羅は未一致。',
    obsidianItems: obsidianMenu.items.map((item) => item.text),
    tsuzuneItems: tsuzuneMenu.items.map((item) => item.text)
  },
  safeguards: {
    obsidian: {
      sourceUnchanged: obsidianManifest.assertions.sourceUnchanged,
      isolatedVaultProtectedFilesUnchanged:
        obsidianManifest.assertions.isolatedVaultProtectedFilesUnchanged,
      protocolRestored: obsidianManifest.assertions.protocolRestored
    },
    tsuzune: tsuzune.assertions
  },
  notEstablished: [
    '添付context menuの残り操作の同等実装',
    '独立ウィンドウのpixel-identical workspace chrome',
    '物理マウスと実OSアクセシビリティ'
  ],
  conclusion:
    'GP0-3b-iでは添付ノードの「新規ウィンドウで開く」の公開操作と状態遷移を一致確認した。TSUZUNEは元Graphを保持し、SVGを安全な内部画像ウィンドウに表示する。視覚shellと残りcontext menu項目は後続差分である。'
}

await mkdir(assetsRoot, { recursive: true })
await writeFile(resolve(assetsRoot, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')

const rows = comparison.comparisons
  .map(
    (item) =>
      `<tr><td>${item.label}</td><td>${String(item.obsidian)}</td><td>${String(item.tsuzune)}</td><td class="${item.status}">${item.status}</td></tr>`
  )
  .join('')
const report = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-i Attachment New Window</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#d9f4ec;color:#08685f;font-weight:800}.shots{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched{color:#08766d;font-weight:800}.known-gap-outside-slice{color:#a66100;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:900px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-i · 固定公開UI比較</p><h1>添付を別窓へ開き、元グラフはそのまま残す。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。</p><div class="verdict">matched: 添付ノードの新規ウィンドウ動作</div><h2>操作結果</h2><div class="shots"><figure><figcaption>Obsidian: detached image window</figcaption><img src="assets/graph-gp0-attachment-new-window/obsidian-1.13.4/02-attachment-new-window.png" alt="Obsidian attachment new window"></figure><figure><figcaption>TSUZUNE: detached internal preview</figcaption><img src="assets/graph-gp0-attachment-new-window/tsuzune-working-tree/02-attachment-new-window.png" alt="TSUZUNE attachment new window"></figure></div><h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><p class="scope">公開操作と状態遷移は一致しました。独立ウィンドウの細かなworkspace装飾とcontext menu全体は、後続sliceの公開差です。</p></main></body></html>`
await writeFile(resolve(repoRoot, 'docs/reports/graph-gp0-attachment-new-window-2026-08-09.html'), report, 'utf8')

console.log(JSON.stringify({ status: comparison.status, comparisons: comparison.comparisons.length }, null, 2))
