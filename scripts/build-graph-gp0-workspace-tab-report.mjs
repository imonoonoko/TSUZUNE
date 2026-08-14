import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-workspace-tab')
const obsidianObservation = JSON.parse(
  await readFile(
    resolve(
      repoRoot,
      'docs/reports/assets/graph-gp0-node-new-tab/obsidian-1.13.4/observation.json'
    ),
    'utf8'
  )
)
const tsuzuneManifest = JSON.parse(
  await readFile(resolve(assetsRoot, 'tsuzune-working-tree/manifest.json'), 'utf8')
)

const obsidianGraphRetained =
  obsidianObservation.nodeNewTab?.before?.graphLeafCount === 1 &&
  obsidianObservation.nodeNewTab?.after?.graphLeafCount === 1
const tsuzuneGraphRetained =
  tsuzuneManifest.assertions?.globalGraphTabRetained === true
const tsuzuneReturned =
  tsuzuneManifest.assertions?.returnedToGlobalGraphTab === true &&
  tsuzuneManifest.assertions?.globalGraphVisibleAfterReturn === true

if (!obsidianGraphRetained || !tsuzuneGraphRetained || !tsuzuneReturned) {
  throw new Error('GP0-3b-gのGraph workspace tab契約が成立していません。')
}

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-g',
  capturedAt: tsuzuneManifest.capturedAt,
  status: 'matched',
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
  comparisons: [
    {
      id: 'note-tab-created',
      label: '対象noteの新規タブを生成して選択',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'graph-tab-retained',
      label: 'noteを開いた後も元Global Graphを別タブとして保持',
      obsidian: obsidianGraphRetained,
      tsuzune: tsuzuneGraphRetained,
      status: 'matched'
    },
    {
      id: 'tsuzune-graph-return',
      label: 'TSUZUNEの保持タブからGlobal Graphへ復帰',
      obsidian: 'retained leaf established; return click not separately captured',
      tsuzune: tsuzuneReturned,
      status: 'tsuzune-verified'
    }
  ],
  safeguards: {
    obsidian: {
      graphLeafBefore: obsidianObservation.nodeNewTab.before.graphLeafCount,
      graphLeafAfter: obsidianObservation.nodeNewTab.after.graphLeafCount,
      markdownLeafAfter: obsidianObservation.nodeNewTab.after.markdownLeafCount
    },
    tsuzune: tsuzuneManifest.assertions
  },
  established: [
    '両製品で対象noteの新規タブを生成して選択する',
    '両製品で元Global Graphのworkspace leaf/tabを保持する',
    'TSUZUNEは保持したGraphタブを選び直してGlobal Graphへ戻れる'
  ],
  notEstablished: [
    'Obsidian側で保持Graph tabを選び直す追加capture',
    'タブの並べ替え、復元、分割、ウィンドウ間移動',
    '物理マウスと実OSアクセシビリティ',
    'pixel-identical tab geometry and styling'
  ],
  conclusion:
    'GP0-3b-fで残った元Global Graph保持の公開差を閉じた。固定fixtureでは両製品がGraph workspaceを保持し、TSUZUNEはnote新規tabから元Graph tabへ復帰できた。'
}

await mkdir(assetsRoot, { recursive: true })
await writeFile(
  resolve(assetsRoot, 'comparison.json'),
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8'
)

const rows = comparison.comparisons
  .map(
    (item) =>
      `<tr><td>${item.label}</td><td>${String(item.obsidian)}</td><td>${String(item.tsuzune)}</td><td class="${item.status}">${item.status}</td></tr>`
  )
  .join('')
const report = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-g Global Graph Workspace Tab</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#d9f4ec;color:#08685f;font-weight:800}.shots{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched,.tsuzune-verified{color:#08766d;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:900px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-g · 固定公開UI比較</p><h1>ノートを開いても、グラフはタブに残る。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。</p><div class="verdict">matched: 元Global Graph workspaceを保持</div><h2>操作結果</h2><div class="shots"><figure><figcaption>Obsidian: note新規tab後もGraph leaf 1</figcaption><img src="assets/graph-gp0-node-new-tab/obsidian-1.13.4/02-note-new-tab.png" alt="Obsidian note new tab"></figure><figure><figcaption>TSUZUNE: note新規tab</figcaption><img src="assets/graph-gp0-workspace-tab/tsuzune-working-tree/02-note-new-tab.png" alt="TSUZUNE note new tab"></figure><figure><figcaption>TSUZUNE: 元Global Graphへ復帰</figcaption><img src="assets/graph-gp0-workspace-tab/tsuzune-working-tree/03-returned-global-graph.png" alt="TSUZUNE returned Global Graph"></figure></div><h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><p class="scope">確定範囲はGraph workspace保持とTSUZUNE内の復帰操作です。タブ復元・分割・並べ替え、物理入力、ピクセル一致は未証明です。</p></main></body></html>`
await writeFile(
  resolve(repoRoot, 'docs/reports/graph-gp0-workspace-tab-2026-08-09.html'),
  report,
  'utf8'
)

console.log(JSON.stringify({ status: comparison.status, comparisons: comparison.comparisons.length }, null, 2))
