import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-attachment-bookmark')
const reportPath = resolve(repoRoot, 'docs/reports/graph-gp0-attachment-bookmark-2026-08-09.html')
const scenarios = ['cancel', 'create', 'duplicate']
const targetPath = 'attachments/diagram.svg'

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
const bookmarkItems = (snapshot) => {
  const json = snapshot?.bookmarks?.json
  if (Array.isArray(json)) return json
  return Array.isArray(json?.items) ? json.items : []
}
const targetBookmarks = (snapshot) =>
  bookmarkItems(snapshot).filter((bookmark) => bookmark?.path === targetPath)
const stageSnapshots = (scenario, product) => evidence[scenario][product].bookmarkPersistence
const stagesAfterAction = [
  'afterAction',
  'afterGraphReopen',
  'afterFirstProcessExit',
  'afterAppRestart',
  'afterSecondProcessExit'
]
const exactCountAtEveryStage = (scenario, product, expected) => {
  const snapshots = stageSnapshots(scenario, product)
  return (
    targetBookmarks(snapshots.beforeAction).length === 0 &&
    stagesAfterAction.every((stage) => targetBookmarks(snapshots[stage]).length === expected)
  )
}
const ctimeStableAfterAction = (scenario, product) => {
  const snapshots = stageSnapshots(scenario, product)
  const ctimes = stagesAfterAction.map((stage) => targetBookmarks(snapshots[stage])[0]?.ctime)
  return ctimes.every((ctime) => Number.isFinite(ctime) && ctime === ctimes[0])
}
const vaultContentUnchanged = (scenario, product) => {
  const snapshots = Object.values(stageSnapshots(scenario, product))
  const baseline = snapshots[0].vaultContent.combinedSha256
  return snapshots.every((snapshot) => snapshot.vaultContent.combinedSha256 === baseline)
}
const dialogButtons = (dialog) => dialog?.buttons?.map((button) => button.text) ?? []
const obsidianDialogTitle = (dialog) => dialog?.headings?.[0]
const dialogsRecorded = (scenario) => {
  const { obsidian, tsuzune } = evidence[scenario]
  const referenceDialog = obsidian.attachmentBookmark.firstDialog
  const productDialog = tsuzune.attachmentBookmarkContract.firstDialog
  return (
    obsidianDialogTitle(referenceDialog) === 'ブックマークを追加' &&
    referenceDialog.inputs?.[0]?.value === targetPath &&
    referenceDialog.inputs?.[1]?.placeholder === 'diagram.svg' &&
    ['キャンセル', '保存'].every((label) => dialogButtons(referenceDialog).includes(label)) &&
    productDialog?.title === 'ブックマークを追加' &&
    productDialog.description === targetPath &&
    productDialog.inputs?.some(
      (input) => input.name === 'title' && input.placeholder === 'diagram.svg'
    ) &&
    ['キャンセル', '保存'].every((label) => dialogButtons(productDialog).includes(label))
  )
}
const graphLifecyclePreserved = (scenario) => {
  const { obsidian, tsuzune } = evidence[scenario]
  return (
    obsidian.afterGraphReopen.graphLeafCount === 1 &&
    obsidian.afterGraphReopen.renderedNodeIds.includes(targetPath) &&
    obsidian.afterAppRestart.graphLeafCount === 1 &&
    obsidian.afterAppRestart.renderedNodeIds.includes(targetPath) &&
    tsuzune.attachmentBookmarkContract.uiAfterAction.globalGraphVisible === true &&
    tsuzune.initial.reopened.nodePaths.includes(targetPath) &&
    tsuzune.restarted.restarted.nodePaths.includes(targetPath)
  )
}
const firstCreatedBookmark = (product) => {
  const observation = evidence.duplicate[product]
  if (product === 'obsidian') {
    return observation.attachmentBookmark.afterFirst.items.find((item) => item.path === targetPath)
  }
  return targetBookmarks(observation.attachmentBookmarkContract.firstOutcome.persistence)[0]
}
const editedBookmark = (product) => {
  const observation = evidence.duplicate[product]
  if (product === 'obsidian') {
    return observation.attachmentBookmark.afterSecond.items.find((item) => item.path === targetPath)
  }
  return targetBookmarks(observation.bookmarkPersistence.afterAction)[0]
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
  addDialogsRecorded: scenarios.every(dialogsRecorded),
  cancelLeavesNoBookmark: ['obsidian', 'tsuzune'].every((product) =>
    exactCountAtEveryStage('cancel', product, 0)
  ),
  createPersistsExactlyOne: ['obsidian', 'tsuzune'].every(
    (product) =>
      exactCountAtEveryStage('create', product, 1) && ctimeStableAfterAction('create', product)
  ),
  duplicateEditsWithoutDuplication: ['obsidian', 'tsuzune'].every(
    (product) =>
      exactCountAtEveryStage('duplicate', product, 1) &&
      ctimeStableAfterAction('duplicate', product) &&
      firstCreatedBookmark(product)?.ctime === editedBookmark(product)?.ctime
  ),
  editUiRecorded: (() => {
    const { obsidian, tsuzune } = evidence.duplicate
    return (
      obsidian.attachmentBookmark.secondMenu.items.some(
        (item) => item.text === 'ブックマークを編集'
      ) &&
      obsidianDialogTitle(obsidian.attachmentBookmark.secondDialog) === 'ブックマークを編集' &&
      ['削除', 'キャンセル', '保存'].every((label) =>
        dialogButtons(obsidian.attachmentBookmark.secondDialog).includes(label)
      ) &&
      tsuzune.attachmentBookmarkContract.secondMenu.items.some(
        (item) => item.text === 'ブックマークを編集'
      ) &&
      tsuzune.attachmentBookmarkContract.secondDialog.title === 'ブックマークを編集' &&
      ['削除', 'キャンセル', '保存'].every((label) =>
        dialogButtons(tsuzune.attachmentBookmarkContract.secondDialog).includes(label)
      )
    )
  })(),
  graphLifecyclePreserved: scenarios.every(graphLifecyclePreserved),
  vaultContentUnchanged: scenarios.every((scenario) =>
    ['obsidian', 'tsuzune'].every((product) => vaultContentUnchanged(scenario, product))
  ),
  separateApplicationProcesses: scenarios.every(
    (scenario) =>
      evidence[scenario].obsidianManifest.assertions.firstProcessExitedBeforeRestart === true &&
      evidence[scenario].obsidianManifest.assertions.secondProcessStarted === true &&
      evidence[scenario].tsuzuneManifest.assertions.separateApplicationProcesses === true
  )
}

if (!Object.values(required).every(Boolean)) {
  throw new Error(
    `GP0-3b-k attachment bookmark contractが成立していません: ${JSON.stringify(required)}`
  )
}

const obsidianMenu = evidence.create.obsidian.nodeContextMenu.items.map((item) => item.text)
const tsuzuneMenu = evidence.create.tsuzune.initial.attachmentContextMenu.items.map(
  (item) => item.text
)
const groupControlGapObserved =
  evidence.create.obsidian.attachmentBookmark.firstDialog.inputs.length === 2 &&
  evidence.create.tsuzune.attachmentBookmarkContract.firstDialog.inputs.some(
    (input) => input.name === 'group'
  )

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-k',
  capturedAt: evidence.duplicate.tsuzune.capturedAt,
  status: 'matched-core-behavior',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph attachment node bookmark',
    targetNode: targetPath,
    scenarios,
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  required,
  comparisons: [
    {
      id: 'bookmark-add-dialog',
      label: '「ブックマーク…」から対象path・タイトル初期値・取消／保存を持つ追加dialogを開く',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'cancel',
      label: '取消ではブックマークを作成しない',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'create',
      label: '保存で対象pathのfile bookmarkを1件だけ作成する',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'duplicate-upsert',
      label: '同じpathを再操作すると「ブックマークを編集」になり、重複せず1件へupsertする',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'ctime-preserved',
      label: '既存ブックマークの編集保存でctimeを保持する',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'reopen-restart',
      label: 'Graph再表示・別プロセス再起動後も結果を保持する',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'vault-content-unchanged',
      label: 'Markdown・添付を含むVault内容を変更しない',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'bookmark-group-control',
      label: 'ブックマークグループ入力UI',
      obsidian: 'selector button',
      tsuzune: 'plain text input',
      status: groupControlGapObserved ? 'known-ui-gap' : 'not-established'
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
    '取消は永続ブックマークを作成しない',
    '作成と同一path再編集はpathあたり常に1件で、編集時も最初のctimeを保持する',
    'Graph再表示と別Electronプロセス再起動後も作成／取消／編集結果を保持する',
    'ブックマーク保存はMarkdown・添付原本を変更しない'
  ],
  remainingGap: {
    summary:
      'ブックマークの中核動作は一致した。Obsidianのグループselectorに対してTSUZUNEはplain text inputであり、添付context menu全体も11対5のままである。Bookmarks side panel全体は本sliceで比較していない。',
    obsidianItems: obsidianMenu,
    tsuzuneItems: tsuzuneMenu,
    remainingMenuActions: [
      'パスをコピー',
      'リンクされたビューを開く',
      'デフォルトアプリで開く',
      'フォルダで表示',
      'ファイルエクスプローラでファイルを表示'
    ],
    nextSlice: 'GP0-3b-l パスをコピー'
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
    'ObsidianのブックマークグループselectorとTSUZUNE plain text inputの視覚・操作一致',
    'Bookmarks side panel、一覧、並べ替え、グループ階層の一致',
    '添付context menuの残り5操作と対象ラベル行',
    'pixel-identicalなGraph配置・dialog・menu',
    '物理マウス、実OS keyboard、screen reader、High Contrast、複数DPI'
  ],
  conclusion:
    'GP0-3b-kでは添付ブックマークの作成、取消、同一path編集upsert、ctime保持、Graph再表示／別プロセス再起動保持、Vault内容不変を一致確認した。中核挙動はmatchedだが、グループ入力UI、menu全体、Bookmarks side panelは未一致または未証明であり、Graph parity全体やpixel equivalenceは主張しない。'
}

await mkdir(assetsRoot, { recursive: true })
await writeFile(
  resolve(assetsRoot, 'comparison.json'),
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8'
)

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
  `<figure><figcaption>${escapeHtml(caption)}</figcaption><img src="assets/graph-gp0-attachment-bookmark/${scenario}/${product}/${file}" alt="${escapeHtml(caption)}"></figure>`
const evidenceSections = [
  {
    title: '追加dialog: 対象pathと保存／取消を確認',
    scenario: 'create',
    obsidianFile: '02-bookmark-dialog.png',
    tsuzuneFile: '02-bookmark-dialog.png'
  },
  {
    title: '取消: 永続ブックマークを作らない',
    scenario: 'cancel',
    obsidianFile: '03-after-bookmark-action.png',
    tsuzuneFile: '03-after-bookmark-action.png'
  },
  {
    title: '重複操作: 追加ではなく編集へ切り替える',
    scenario: 'duplicate',
    obsidianFile: '04-duplicate-dialog.png',
    tsuzuneFile: '04-duplicate-bookmark-dialog.png'
  },
  {
    title: '別プロセス再起動: Graphと1件のブックマークを保持',
    scenario: 'duplicate',
    obsidianFile: '07-after-app-restart.png',
    tsuzuneFile: '07-after-app-restart.png'
  }
]
  .map(
    (item) =>
      `<section><h2>${escapeHtml(item.title)}</h2><div class="shots">${shot(item.scenario, 'obsidian-1.13.4', item.obsidianFile, `Obsidian · ${item.scenario}`)}${shot(item.scenario, 'tsuzune-working-tree', item.tsuzuneFile, `TSUZUNE · ${item.scenario}`)}</div></section>`
  )
  .join('')
const report = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GP0-3b-k Attachment Bookmark</title>
<style>
body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4.2rem);line-height:1.05;margin:.15em 0}.eyebrow{letter-spacing:.14em;text-transform:uppercase;color:#59665f}.lead{max-width:780px;font-size:1.15rem;line-height:1.8}.badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#dcebe3;color:#1f5a3e;font-weight:700}section{margin-top:42px;background:#fff;border:1px solid #ddd8cb;border-radius:18px;padding:24px;box-shadow:0 12px 32px #2e382b0d}h2{margin-top:0}.shots{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}figcaption{font-weight:700;margin-bottom:8px}img{display:block;width:100%;height:auto;border:1px solid #ddd8cb;border-radius:10px;background:#fff}table{width:100%;border-collapse:collapse;font-size:.94rem}th,td{padding:12px;border-bottom:1px solid #e2ded3;text-align:left;vertical-align:top}.matched{color:#17633e;font-weight:700}.known-ui-gap,.not-established{color:#965a0a;font-weight:700}.gap{border-left:5px solid #d38a24}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.92rem}@media(max-width:780px){.shots{grid-template-columns:1fr}section{padding:18px}table{display:block;overflow:auto}}
</style></head><body><main>
<p class="eyebrow">TSUZUNE × Obsidian 1.13.4 · GP0-3b-k</p>
<h1>同じ添付をもう一度保存しても、<br>ブックマークは二重にならない。</h1>
<p class="lead">作成、取消、同一pathの編集、<span class="mono">ctime</span>保持、Graph再表示、別プロセス再起動までを、同じfixtureと3シナリオで固定比較した。</p>
<p><span class="badge">matched core behavior · known UI gaps</span></p>
<section><h2>比較結果</h2><table><thead><tr><th>契約</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></section>
${evidenceSections}
<section class="gap"><h2>残る差と境界</h2><p>${escapeHtml(comparison.remainingGap.summary)}</p><ul>${comparison.notEstablished.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p><strong>次:</strong> ${escapeHtml(comparison.remainingGap.nextSlice)}</p></section>
<section><h2>結論</h2><p>${escapeHtml(comparison.conclusion)}</p><p class="mono">Machine-readable source: assets/graph-gp0-attachment-bookmark/comparison.json</p></section>
</main></body></html>`

await writeFile(reportPath, report, 'utf8')
console.log(`Wrote ${resolve(assetsRoot, 'comparison.json')}`)
console.log(`Wrote ${reportPath}`)
