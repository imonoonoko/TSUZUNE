import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-attachment-linked-view')
const referenceRoot = resolve(assetsRoot, 'obsidian-1.13.4')
const productRoot = resolve(assetsRoot, 'tsuzune-working-tree')
const targetPath = 'attachments/diagram.svg'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const [obsidian, obsidianManifest, tsuzune, tsuzuneManifest] = await Promise.all([
  readJson(resolve(referenceRoot, 'observation.json')),
  readJson(resolve(assetsRoot, 'manifest.json')),
  readJson(resolve(productRoot, 'observation.json')),
  readJson(resolve(productRoot, 'manifest.json'))
])

const obsidianAction = obsidian.attachmentLinkedView
const productAction = tsuzune.initial.attachmentLinkedView
const obsidianMenu = obsidian.nodeContextMenu?.items ?? []
const productMenu = tsuzune.initial.attachmentContextMenu?.items ?? []
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const allTrue = (value) => Object.values(value ?? {}).every(Boolean)
const menuTexts = (items) => items.map((item) => normalize(item.text))
const selectedTab = (tabs, label) =>
  (tabs ?? []).find((tab) => normalize(tab.label ?? tab.text) === label && tab.selected === true)
const graphTabPresent = (tabs) => (tabs ?? []).some((tab) => normalize(tab.label ?? tab.text) === 'グラフビュー')
const linkedTabPresent = (tabs) =>
  (tabs ?? []).some((tab) => normalize(tab.label ?? tab.text) === 'diagram へのバックリンク')
const tabCount = (tabs, label) =>
  (tabs ?? []).filter((tab) => normalize(tab.label ?? tab.text) === label).length

const referenceSubmenuItems = obsidianAction?.submenu?.items ?? []
const productSubmenuItems = productAction?.submenu?.items ?? []
const required = {
  evidenceCaptured:
    obsidianManifest.status === 'reference-captured' && tsuzuneManifest.status === 'captured',
  evidenceAssertions: allTrue(obsidianManifest.assertions) && allTrue(tsuzuneManifest.assertions),
  linkedViewMenuPresent:
    menuTexts(obsidianMenu).includes('リンクされたビューを開く') &&
    menuTexts(productMenu).some((text) => text.startsWith('リンクされたビューを開く')),
  submenuExact:
    referenceSubmenuItems.length === 1 &&
    productSubmenuItems.length === 1 &&
    normalize(referenceSubmenuItems[0]?.text) === 'バックリンクを開く' &&
    normalize(productSubmenuItems[0]?.text) === 'バックリンクを開く' &&
    referenceSubmenuItems[0]?.disabled === false &&
    productSubmenuItems[0]?.disabled === false,
  firstActionBacklinks:
    normalize(obsidianAction?.firstEnabled?.text) === 'バックリンクを開く' &&
    normalize(productAction?.firstEnabled?.text) === 'バックリンクを開く',
  referenceLinkedView:
    obsidianAction?.after?.activeLeaf?.viewType === 'backlink' &&
    obsidianAction?.after?.activeLeaf?.filePath === targetPath &&
    obsidianAction?.after?.graphLeafCount === 1 &&
    graphTabPresent(obsidianAction?.after?.tabHeaders) &&
    linkedTabPresent(obsidianAction?.after?.tabHeaders),
  productLinkedView:
    productAction?.after?.menuClosed === true &&
    productAction?.after?.linkedViewVisible === true &&
    productAction?.after?.linkedPath === targetPath &&
    Array.isArray(productAction?.after?.backlinks) &&
    productAction.after.backlinks.length > 0 &&
    selectedTab(productAction?.after?.tabs, 'diagram へのバックリンク') !== undefined,
  graphPreserved:
    obsidianAction?.after?.graphLeafCount === 1 &&
    productAction?.graphAfter?.edgeCount === productAction?.beforeGraph?.edgeCount &&
    graphTabPresent(productAction?.graphAfter?.tabs),
  persistencePreserved:
    obsidian.afterGraphReopen?.graphLeafCount === 1 &&
    obsidian.afterAppRestart?.graphLeafCount === 1 &&
    tsuzune.restarted?.restarted?.nodePaths?.includes(targetPath) === true &&
    tsuzune.restarted?.restarted?.edgeCount === productAction?.beforeGraph?.edgeCount,
  linkedViewRestartBoundaryRecorded:
    linkedTabPresent(productAction?.graphAfter?.tabs) &&
    linkedTabPresent(tsuzune.restarted?.restarted?.tabs) === false &&
    tabCount(obsidian.beforeEntry?.tabHeaders, 'バックリンク') === 1 &&
    tabCount(obsidian.afterAppRestart?.tabHeaders, 'バックリンク') === 2
}

if (!Object.values(required).every(Boolean)) {
  throw new Error(`GP0-3b-m linked-view contractが成立していません: ${JSON.stringify(required)}`)
}

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-m',
  capturedAt: tsuzune.capturedAt,
  status: 'matched-core-behavior',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph attachment node linked-view action',
    targetNode: targetPath,
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  required,
  comparisons: [
    {
      id: 'linked-view-menu',
      label: '「リンクされたビューを開く」を親menuから開ける',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'linked-view-submenu',
      label: 'submenuの先頭かつ唯一の有効操作が「バックリンクを開く」',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'backlink-view',
      label: '対象添付のバックリンクビューを開き、対象pathと参照元を表示する',
      obsidian: required.referenceLinkedView,
      tsuzune: required.productLinkedView,
      status: 'matched'
    },
    {
      id: 'graph-preserved',
      label: '操作後もGlobal Graphのnode・edgeとGraph tabを保持する',
      obsidian: required.graphPreserved,
      tsuzune: required.graphPreserved,
      status: 'matched'
    },
    {
      id: 'reopen-restart',
      label: 'Graph再表示・別プロセス再起動後もGraphの構造を保持する',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'linked-view-restart-boundary',
      label: 'linked-viewの別プロセス再起動後の扱い',
      obsidian: 'バックリンクtab shellを保持。対象添付へのbindingは未証明',
      tsuzune: 'linked-view tabを復元しない',
      status: 'known-gap-outside-slice'
    },
    {
      id: 'context-menu-scope',
      label: '添付nodeのcontext menu全体',
      obsidian: obsidianMenu.length,
      tsuzune: productMenu.length,
      status: 'known-gap-outside-slice'
    }
  ],
  established: [
    '親menuからlinked-view submenuを開き、親menuを残したまま表示できる',
    '両製品で唯一の有効操作「バックリンクを開く」を実行できる',
    '起動中の同一workspaceで対象添付のバックリンクビューを追加し、Graphを保持できる',
    'Graph再表示・別プロセス再起動後もGraphのnode集合とedge数を保持する'
  ],
  knownGaps: [
    'Obsidianの分割pane・workspace装飾・バックリンク本文の視覚一致は未証明',
    'TSUZUNEはlinked-view tabを別プロセス再起動後に復元しない。Obsidianはバックリンクtab shellを保持するが対象添付へのbindingは未証明',
    '添付context menu全体はObsidian 11項目、TSUZUNE 7項目で残差がある',
    '物理マウス／キーボード、screen reader、High Contrast、multi-DPI、pixel identityは未証明'
  ],
  evidenceBoundary: {
    input: '隔離fixtureと固定viewportを使ったCDP／Electronの合成入力',
    notEstablished: [
      '物理OS入力とtrusted event parity',
      '実OS clipboardや外部アプリとのpaste roundtrip',
      '実運用Vaultの全node種別に対する同等性'
    ]
  },
  safeguards: {
    obsidian: {
      sourceUnchanged: obsidianManifest.assertions?.sourceUnchanged,
      protocolRestored: obsidianManifest.assertions?.protocolRestored,
      graphLeafCountAfter: obsidianAction?.after?.graphLeafCount
    },
    tsuzune: tsuzune.assertions
  },
  menuItems: {
    obsidian: menuTexts(obsidianMenu),
    tsuzune: menuTexts(productMenu),
    linkedSubmenu: ['バックリンクを開く']
  },
  conclusion:
    'GP0-3b-mでは、添付nodeの「リンクされたビューを開く」から「バックリンクを開く」を実行し、起動中のバックリンクビュー追加とGlobal Graph保持を中核挙動として一致確認した。linked-viewの再起動復元、context menu全体、workspace視覚一致は対象外または未証明である。'
}

await mkdir(assetsRoot, { recursive: true })
await writeFile(resolve(assetsRoot, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
const rows = comparison.comparisons
  .map(
    (item) =>
      `<tr><td>${esc(item.label)}</td><td>${esc(item.obsidian)}</td><td>${esc(item.tsuzune)}</td><td class="${esc(item.status)}">${esc(item.status)}</td></tr>`
  )
  .join('')
const report = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-m Attachment Linked View</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#d9f4ec;color:#08685f;font-weight:800}.shots{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched{color:#08766d;font-weight:800}.known-gap-outside-slice{color:#a66100;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:900px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-m · 固定公開UI比較</p><h1>リンクされたビューから、参照元へ戻れる。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。</p><div class="verdict">matched-core-behavior: 添付linked view</div><h2>操作結果</h2><div class="shots"><figure><figcaption>Obsidian: バックリンクビュー</figcaption><img src="assets/graph-gp0-attachment-linked-view/obsidian-1.13.4/04-after-linked-view-action.png" alt="Obsidian linked backlink view"></figure><figure><figcaption>TSUZUNE: バックリンクビュー</figcaption><img src="assets/graph-gp0-attachment-linked-view/tsuzune-working-tree/04-after-linked-view-action.png" alt="TSUZUNE linked backlink view"></figure><figure><figcaption>Obsidian: Graph再表示後</figcaption><img src="assets/graph-gp0-attachment-linked-view/obsidian-1.13.4/05-after-graph-reopen.png" alt="Obsidian graph after reopen"></figure><figure><figcaption>TSUZUNE: Graph再表示後</figcaption><img src="assets/graph-gp0-attachment-linked-view/tsuzune-working-tree/05-after-graph-reopen.png" alt="TSUZUNE graph after reopen"></figure></div><h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><h2>境界</h2><p class="scope">中核一致は起動中の操作とGraph保持です。TSUZUNEはlinked-view tabを再起動後に復元せず、Obsidianはバックリンクtab shellを保持しますが対象添付へのbindingは未証明です。context menu全体、分割pane、視覚的な1:1一致、物理入力／実OSアクセシビリティも完了扱いにしていません。</p></main></body></html>`
await writeFile(resolve(repoRoot, 'docs/reports/graph-gp0-attachment-linked-view-2026-08-10.html'), report, 'utf8')

console.log(JSON.stringify({ status: comparison.status, comparisons: comparison.comparisons.length }, null, 2))
