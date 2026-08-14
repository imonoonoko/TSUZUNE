import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-attachment-file-move')
const scenarios = ['cancel', 'success', 'collision']

const evidence = Object.fromEntries(
  await Promise.all(
    scenarios.map(async (scenario) => {
      const scenarioRoot = resolve(assetsRoot, scenario)
      return [
        scenario,
        {
          obsidian: JSON.parse(
            await readFile(resolve(scenarioRoot, 'obsidian-1.13.4/observation.json'), 'utf8')
          ),
          obsidianManifest: JSON.parse(
            await readFile(resolve(scenarioRoot, 'manifest.json'), 'utf8')
          ),
          tsuzune: JSON.parse(
            await readFile(resolve(scenarioRoot, 'tsuzune-working-tree/observation.json'), 'utf8')
          ),
          tsuzuneManifest: JSON.parse(
            await readFile(resolve(scenarioRoot, 'tsuzune-working-tree/manifest.json'), 'utf8')
          )
        }
      ]
    })
  )
)

const allTrue = (assertions = {}) => Object.values(assertions).every(Boolean)
const includesAll = (items, expected) => expected.every((item) => items.includes(item))
const homeUnchanged = (scenario) => {
  const { obsidian, tsuzune } = evidence[scenario]
  return (
    obsidian.attachmentMove.before.homeContent === obsidian.attachmentMove.after.homeContent &&
    tsuzune.attachmentMoveContract.before.home.sha256 ===
      tsuzune.attachmentMoveContract.after.home.sha256
  )
}
const graphNodes = (scenario, product, lifecycle) => {
  const observation = evidence[scenario][product]
  if (product === 'obsidian') {
    return lifecycle === 'reopen'
      ? observation.afterGraphReopen.renderedNodeIds
      : observation.afterAppRestart.renderedNodeIds
  }
  return lifecycle === 'reopen'
    ? observation.initial.reopened.nodePaths
    : observation.restarted.restarted.nodePaths
}

const required = {
  evidenceCaptured: scenarios.every(
    (scenario) =>
      evidence[scenario].obsidianManifest.status === 'reference-captured' &&
      evidence[scenario].tsuzuneManifest.status === 'captured'
  ),
  evidenceAssertions: scenarios.every(
    (scenario) =>
      allTrue(evidence[scenario].obsidianManifest.assertions) &&
      allTrue(evidence[scenario].tsuzuneManifest.assertions)
  ),
  cancelUnchanged: (() => {
    const { obsidian, tsuzune } = evidence.cancel
    return (
      obsidian.attachmentMove.after.sourceExists === true &&
      obsidian.attachmentMove.after.destinationExists === false &&
      tsuzune.attachmentMoveContract.after.source.exists === true &&
      tsuzune.attachmentMoveContract.after.destination.exists === false &&
      homeUnchanged('cancel')
    )
  })(),
  successMovedWithoutRewrite: (() => {
    const { obsidian, tsuzune } = evidence.success
    return (
      obsidian.attachmentMove.after.sourceExists === false &&
      obsidian.attachmentMove.after.destinationExists === true &&
      tsuzune.attachmentMoveContract.after.source.exists === false &&
      tsuzune.attachmentMoveContract.after.destination.exists === true &&
      tsuzune.attachmentMoveContract.before.source.sha256 ===
        tsuzune.attachmentMoveContract.after.destination.sha256 &&
      homeUnchanged('success')
    )
  })(),
  collisionAutoNumbered: (() => {
    const { obsidian, tsuzune } = evidence.collision
    const before = tsuzune.attachmentMoveContract.before
    const after = tsuzune.attachmentMoveContract.after
    return (
      obsidian.attachmentMove.after.sourceExists === false &&
      obsidian.attachmentMove.after.destinationExists === true &&
      obsidian.attachmentMove.after.collisionDestinationExists === true &&
      after.source.exists === false &&
      after.destination.exists === true &&
      after.numberedDestination.exists === true &&
      before.destination.sha256 === after.destination.sha256 &&
      before.source.sha256 === after.numberedDestination.sha256 &&
      homeUnchanged('collision')
    )
  })(),
  graphLifecycleMatched: scenarios.every((scenario) => {
    const expected =
      scenario === 'cancel'
        ? ['attachments/diagram.svg']
        : scenario === 'success'
          ? ['attachments/diagram.svg', '20_knowledge/diagram.svg']
          : [
              'attachments/diagram.svg',
              '20_knowledge/diagram.svg',
              '20_knowledge/diagram 1.svg'
            ]
    return ['reopen', 'restart'].every(
      (lifecycle) =>
        includesAll(graphNodes(scenario, 'obsidian', lifecycle), expected) &&
        includesAll(graphNodes(scenario, 'tsuzune', lifecycle), expected)
    )
  }),
  graphRemainedVisible: scenarios.every(
    (scenario) =>
      evidence[scenario].obsidian.attachmentMove.after.graphLeafCount === 1 &&
      evidence[scenario].tsuzune.attachmentMoveContract.uiAfterAction.globalGraphVisible === true
  )
}

if (!Object.values(required).every(Boolean)) {
  throw new Error(`GP0-3b-j attachment file move contractが成立していません: ${JSON.stringify(required)}`)
}

const obsidianMenu = evidence.success.obsidian.nodeContextMenu.items.map((item) => item.text)
const tsuzuneMenu = evidence.success.tsuzune.initial.nodeContextMenu.items.map((item) => item.text)
const remainingMenuActions = [
  'ブックマーク…',
  'パスをコピー',
  'リンクされたビューを開く',
  'デフォルトアプリで開く',
  'フォルダで表示',
  'ファイルエクスプローラでファイルを表示'
]

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-j',
  capturedAt: evidence.collision.tsuzune.capturedAt,
  status: 'matched-core-behavior',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph attachment node file move',
    targetNode: 'attachments/diagram.svg',
    destinationDirectory: '20_knowledge',
    scenarios,
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  comparisons: [
    {
      id: 'menu-action-order',
      label: '右クリックで「新規ウィンドウで開く」の次に「ファイルを移動…」を表示',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'cancel',
      label: '取消時は元添付・埋め込み・Graphを変更しない',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'success-move',
      label: '通常移動で元添付を消し、20_knowledge/diagram.svgを作る',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'no-link-rewrite',
      label: '移動後も![[attachments/diagram.svg]]を自動書換えしない',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'unresolved-and-moved-nodes',
      label: '旧pathを未解決node、新pathを実在する孤立attachment nodeとして表示',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'collision-auto-number',
      label: '同名衝突時は既存diagram.svgを保持し、移動元をdiagram 1.svgへ採番',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'reopen-restart',
      label: '取消／通常移動／衝突の結果をGraph再表示・アプリ再起動後も維持',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'global-graph-retained',
      label: '操作後もGlobal Graphを開いたまま保持',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'move-dialog-ui',
      label: '移動先選択UI',
      obsidian: '検索できるtypeahead prompt',
      tsuzune: 'selectと移動／キャンセルbutton',
      status: 'known-ui-gap'
    },
    {
      id: 'attachment-context-menu-size',
      label: '添付nodeの右クリックmenu行数',
      obsidian: obsidianMenu.length,
      tsuzune: tsuzuneMenu.length,
      status: 'known-ui-gap'
    }
  ],
  established: [
    '取消、通常移動、同名衝突のファイル状態遷移が両製品で一致する',
    '通常移動と衝突では埋め込みを自動書換えせず、旧pathを未解決nodeとして残す',
    '移動後の実ファイルを孤立attachment nodeとして表示し、Graph再表示とアプリ再起動後も維持する',
    '衝突時は既存ファイルを上書きせず、空いている「diagram 1.svg」へ自動採番する'
  ],
  remainingGap: {
    summary:
      'ファイル移動の中核動作は一致した。移動先UIはObsidianのtypeahead promptに対してTSUZUNEはselect/buttonであり、menu全体も11対4のままである。',
    obsidianItems: obsidianMenu,
    tsuzuneItems: tsuzuneMenu,
    remainingMenuActions,
    nextSlice: 'GP0-3b-k ブックマーク…'
  },
  safeguards: Object.fromEntries(
    scenarios.map((scenario) => [
      scenario,
      {
        obsidian: evidence[scenario].obsidianManifest.assertions,
        tsuzune: evidence[scenario].tsuzuneManifest.assertions
      }
    ])
  ),
  notEstablished: [
    'Obsidian typeahead promptとTSUZUNE select/button dialogの視覚・操作一致',
    '添付context menuの残り6操作と対象ラベル行',
    'pixel-identicalなGraph配置・dialog・menu',
    '物理マウス、実OS keyboard、screen reader、High Contrast、複数DPI'
  ],
  conclusion:
    'GP0-3b-jでは添付ファイル移動の取消、通常移動、同名衝突、自動採番、リンク非書換え、未解決／実在node分離、再表示／再起動保持を一致確認した。中核挙動はmatchedだが、移動先UIとmenu全体は既知差であり、Graph parity全体やpixel equivalenceは主張しない。'
}

await mkdir(assetsRoot, { recursive: true })
await writeFile(resolve(assetsRoot, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const rows = comparison.comparisons
  .map(
    (item) =>
      `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.obsidian)}</td><td>${escapeHtml(item.tsuzune)}</td><td class="${item.status}">${item.status}</td></tr>`
  )
  .join('')
const shot = (scenario, product, file, caption) =>
  `<figure><figcaption>${escapeHtml(caption)}</figcaption><img src="assets/graph-gp0-attachment-file-move/${scenario}/${product}/${file}" alt="${escapeHtml(caption)}"></figure>`
const scenarioSections = [
  {
    id: 'cancel',
    title: '取消: ファイルもリンクも変えない',
    obsidianFile: '02-after-file-move-action.png',
    tsuzuneFile: '03-after-cancel.png'
  },
  {
    id: 'success',
    title: '通常移動: 旧pathは未解決、新pathは実在node',
    obsidianFile: '02-after-graph-reopen.png',
    tsuzuneFile: '04-after-graph-reopen.png'
  },
  {
    id: 'collision',
    title: '同名衝突: diagram 1.svgへ自動採番',
    obsidianFile: '03-after-app-restart.png',
    tsuzuneFile: '05-after-app-restart.png'
  }
]
  .map(
    (scenario) =>
      `<section><h2>${scenario.title}</h2><div class="shots">${shot(scenario.id, 'obsidian-1.13.4', scenario.obsidianFile, `Obsidian · ${scenario.id}`)}${shot(scenario.id, 'tsuzune-working-tree', scenario.tsuzuneFile, `TSUZUNE · ${scenario.id}`)}</div></section>`
  )
  .join('')
const report = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-j Attachment File Move</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#d9f4ec;color:#08685f;font-weight:800}.shots{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched{color:#08766d;font-weight:800}.known-ui-gap{color:#a66100;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:900px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-j · 固定公開UI比較</p><h1>移動しても、元リンクは勝手に書き換えない。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。</p><div class="verdict">matched core behavior · known UI gaps</div>${scenarioSections}<h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><p class="scope">取消、通常移動、同名衝突、自動採番、リンク非書換え、旧未解決nodeと新実在node、再表示／再起動保持は一致しました。移動先UIはtypeahead対select/button、menu全体は11対4であり、完全互換やpixel equivalenceは未達です。</p></main></body></html>`
await writeFile(
  resolve(repoRoot, 'docs/reports/graph-gp0-attachment-file-move-2026-08-09.html'),
  report,
  'utf8'
)

console.log(JSON.stringify({ status: comparison.status, comparisons: comparison.comparisons.length }, null, 2))
