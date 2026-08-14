import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-attachment-path-copy')
const reportPath = resolve(repoRoot, 'docs/reports/graph-gp0-attachment-path-copy-2026-08-09.html')
const scenarios = ['url', 'vault', 'system']
const submenuLabels = ['Obsidian URL として', '保管庫フォルダから', 'システムルートから']
const relativeTarget = 'attachments/diagram.svg'

const evidence = Object.fromEntries(
  await Promise.all(
    scenarios.map(async (scenario) => {
      const root = resolve(assetsRoot, scenario)
      return [
        scenario,
        {
          obsidian: JSON.parse(
            await readFile(resolve(root, 'obsidian-1.13.4/observation.json'), 'utf8')
          ),
          obsidianManifest: JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8')),
          tsuzune: JSON.parse(
            await readFile(resolve(root, 'tsuzune-working-tree/observation.json'), 'utf8')
          ),
          tsuzuneManifest: JSON.parse(
            await readFile(resolve(root, 'tsuzune-working-tree/manifest.json'), 'utf8')
          )
        }
      ]
    })
  )
)

const allTrue = (assertions = {}) => Object.values(assertions).every(Boolean)
const obsidianMenu = (scenario) => evidence[scenario].obsidian.nodeContextMenu.items
const tsuzuneMenu = (scenario) => evidence[scenario].tsuzune.nodeMenuContract.items
const obsidianCopy = (scenario) =>
  evidence[scenario].obsidian.attachmentPathCopy.clipboardCapture.calls
const tsuzuneCopy = (scenario) => evidence[scenario].tsuzune.attachmentPathCopyContract.writes
const obsidianSubmenu = (scenario) =>
  evidence[scenario].obsidian.attachmentPathCopy.afterGraph.pathCopySubmenu
const tsuzuneSubmenu = (scenario) =>
  evidence[scenario].tsuzune.attachmentPathCopyContract.submenu
const menuParentContract = (items, exactText) => {
  const bookmarkIndex = items.findIndex((item) => item.text.includes('ブックマーク'))
  const pathCopyIndex = items.findIndex((item) =>
    exactText ? item.text === 'パスをコピー' : item.text.startsWith('パスをコピー')
  )
  return (
    bookmarkIndex >= 0 &&
    pathCopyIndex === bookmarkIndex + 1 &&
    items[pathCopyIndex]?.disabled === false
  )
}
const clipboardFingerprintStable = (clipboard) => {
  return clipboard.unchanged === true || clipboard.clipboardUnchanged === true
}
const windowsSuffix = `\\${relativeTarget.replaceAll('/', '\\')}`.toLowerCase()
const sanitizedSystemValues = {
  obsidian: `<OBSIDIAN_VAULT_ROOT>${windowsSuffix}`,
  tsuzune: `<TSUZUNE_VAULT_ROOT>${windowsSuffix}`
}
const copiedValues = Object.fromEntries(
  scenarios.map((scenario) => [
    scenario,
    {
      obsidian: obsidianCopy(scenario)[0]?.text ?? null,
      tsuzune: tsuzuneCopy(scenario)[0]?.text ?? null
    }
  ])
)

const required = {
  allRawAssertionsPass: scenarios.every(
    (scenario) =>
      allTrue(evidence[scenario].obsidianManifest.assertions) &&
      allTrue(evidence[scenario].tsuzuneManifest.assertions)
  ),
  parentLabelOrderAndEnabled: scenarios.every(
    (scenario) =>
      menuParentContract(obsidianMenu(scenario), true) &&
      menuParentContract(tsuzuneMenu(scenario), false)
  ),
  submenuLabelsOrderAndEnabled: scenarios.every(
    (scenario) =>
      JSON.stringify(obsidianSubmenu(scenario).map((item) => item.text)) ===
        JSON.stringify(submenuLabels) &&
      obsidianSubmenu(scenario).every((item) => item.disabled === false) &&
      JSON.stringify(tsuzuneSubmenu(scenario).items.map((item) => item.text)) ===
        JSON.stringify(submenuLabels) &&
      tsuzuneSubmenu(scenario).items.every((item) => item.disabled === false)
  ),
  parentKeepsMenuAndOpensSubmenu: scenarios.every((scenario) => {
    const obsidian = evidence[scenario].obsidian.attachmentPathCopy.parentActivation.afterClick
    const tsuzune = tsuzuneSubmenu(scenario)
    return (
      obsidian.parentMenuVisible === true &&
      obsidian.submenuVisible === true &&
      tsuzune.mainMenuStillOpen === true &&
      tsuzune.parentAriaExpanded === 'true'
    )
  }),
  childClosesBothMenus: scenarios.every(
    (scenario) =>
      evidence[scenario].obsidian.attachmentPathCopy.menuClosed === true &&
      evidence[scenario].tsuzune.attachmentPathCopyContract.uiAfterAction.contextMenuOpen ===
        false &&
      evidence[scenario].tsuzune.attachmentPathCopyContract.uiAfterAction.submenuOpen === false
  ),
  urlExact:
    copiedValues.url.obsidian ===
      'obsidian://open?vault=vault&file=attachments%2Fdiagram.svg' &&
    copiedValues.url.tsuzune === copiedValues.url.obsidian,
  vaultRelativeExact:
    copiedValues.vault.obsidian === relativeTarget &&
    copiedValues.vault.tsuzune === copiedValues.vault.obsidian,
  systemAbsoluteWithSameRelativeSuffix:
    copiedValues.system.obsidian.toLowerCase() === sanitizedSystemValues.obsidian.toLowerCase() &&
    copiedValues.system.tsuzune.toLowerCase() === sanitizedSystemValues.tsuzune.toLowerCase() &&
    evidence.system.obsidianManifest.assertions.attachmentPathCopyPlainTextExact === true &&
    evidence.system.tsuzuneManifest.assertions.exactPlainTextCopied === true,
  onePlainTextWritePerSelection: scenarios.every(
    (scenario) => obsidianCopy(scenario).length === 1 && tsuzuneCopy(scenario).length === 1
  ),
  clipboardIsolatedAndRestored: scenarios.every((scenario) => {
    const obsidian = evidence[scenario].obsidian.attachmentPathCopy.clipboardCapture
    const tsuzune = evidence[scenario].tsuzune.attachmentPathCopyContract.clipboard
    return (
      clipboardFingerprintStable(obsidian) &&
      obsidian.writeTextRestored === true &&
      obsidian.writeRestored === true &&
      obsidian.navigatorWriteTextRestored === true &&
      clipboardFingerprintStable(tsuzune) &&
      tsuzune.hookInstalled === true &&
      tsuzune.hookRestored === true
    )
  }),
  graphQueryNodesVaultReopenAndRestartPreserved: scenarios.every(
    (scenario) =>
      evidence[scenario].obsidianManifest.assertions.queryPersistedAfterGraphReopen === true &&
      evidence[scenario].obsidianManifest.assertions.filteredNodesAfterGraphReopen === true &&
      evidence[scenario].obsidianManifest.assertions.firstProcessExitedBeforeRestart === true &&
      evidence[scenario].obsidianManifest.assertions.secondProcessStarted === true &&
      evidence[scenario].obsidianManifest.assertions.queryPersistedAfterAppRestart === true &&
      evidence[scenario].obsidianManifest.assertions.filteredNodesAfterAppRestart === true &&
      evidence[scenario].obsidianManifest.assertions.sourceUnchanged === true &&
      evidence[scenario].obsidianManifest.assertions.isolatedVaultProtectedFilesExpected === true &&
      evidence[scenario].tsuzuneManifest.assertions.graphSurfacePreservedImmediately === true &&
      evidence[scenario].tsuzuneManifest.assertions
        .queryCameraNodesLinksTabsPreservedAcrossReopenAndRestart === true &&
      evidence[scenario].tsuzuneManifest.assertions.isolatedVaultContentUnchanged === true &&
      evidence[scenario].tsuzuneManifest.assertions.separateApplicationProcesses === true
  ),
  productSubmenuFullyInsideViewport: scenarios.every(
    (scenario) => tsuzuneSubmenu(scenario).fullyInsideViewport === true
  )
}

if (!Object.values(required).every(Boolean)) {
  throw new Error(
    `GP0-3b-l attachment path-copy contractが成立していません: ${JSON.stringify(required)}`
  )
}

const obsidianMenuItems = obsidianMenu('url').map((item) => item.text)
const tsuzuneMenuItems = tsuzuneMenu('url').map((item) => item.text)
const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-l',
  capturedAt: evidence.system.tsuzune.capturedAt,
  status: 'matched-core-behavior',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph existing attachment node path copy',
    targetNode: relativeTarget,
    scenarios,
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  required,
  copiedValues,
  comparisons: [
    {
      id: 'parent-menu-contract',
      label: '「パスをコピー」は「ブックマーク…」の直後にあり、有効である',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'submenu-contract',
      label: '3形式の文言・順序・有効状態',
      obsidian: submenuLabels,
      tsuzune: submenuLabels,
      status: 'matched'
    },
    {
      id: 'url-copy',
      label: 'Obsidian URL として',
      obsidian: copiedValues.url.obsidian,
      tsuzune: copiedValues.url.tsuzune,
      status: 'matched'
    },
    {
      id: 'vault-relative-copy',
      label: '保管庫フォルダから',
      obsidian: copiedValues.vault.obsidian,
      tsuzune: copiedValues.vault.tsuzune,
      status: 'matched'
    },
    {
      id: 'system-absolute-copy',
      label: 'システムルートから',
      obsidian: copiedValues.system.obsidian,
      tsuzune: copiedValues.system.tsuzune,
      status: 'matched-semantic'
    },
    {
      id: 'clipboard-and-menu-lifecycle',
      label: '1回のplain-text write、選択後menu close、利用者clipboard隔離・hook復元',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'graph-vault-lifecycle',
      label: 'Graph検索条件・node集合・Vault内容をGraph再表示・別プロセス再起動まで保持',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'adaptive-submenu-placement',
      label: '観測した配置でsubmenuがviewport内に収まる',
      obsidian: 'right-edge reference: opens left (visual evidence)',
      tsuzune: 'center capture: opens right and stays inside viewport (measured bounds)',
      status: 'partial-evidence'
    },
    {
      id: 'attachment-context-menu-size',
      label: '添付nodeの右クリックmenu行数',
      obsidian: obsidianMenuItems.length,
      tsuzune: tsuzuneMenuItems.length,
      status: 'known-ui-gap'
    }
  ],
  established: [
    '3つのcopy形式は文言、順序、有効状態が一致する',
    'Obsidian URLとVault相対pathは文字列が完全一致し、system pathは各隔離Vaultの絶対pathとして同じ相対suffixを持つ',
    '選択ごとにplain textを1回だけ書き、menuを閉じる',
    '共通検証範囲としてGraph query、node集合、Vault内容をGraph再表示と別プロセス再起動まで保つ',
    '固定参照は右端から左へ、TSUZUNEの中央captureは右へ展開し、各観測位置では表示領域内に収まった'
  ],
  remainingGap: {
    summary:
      '対象のpath-copy中核挙動は一致した。添付context menu全体はObsidian 11行に対してTSUZUNE 6行であり、OS clipboardへの実writeは安全のため両captureともinterceptした。',
    obsidianItems: obsidianMenuItems,
    tsuzuneItems: tsuzuneMenuItems,
    nextSlice: 'GP0-3b-m リンクされたビューを開く'
  },
  notEstablished: [
    'physical OS clipboardへのwriteと別applicationへのpaste roundtrip',
    '物理mouse／keyboard、touch／pen、screen reader、Windows High Contrast、複数DPI',
    'TSUZUNE実画面を右端へ置いたときの左開き。renderer回帰testはあるが、この固定captureでは未観測',
    'pixel-identicalなmenu／submenu描画とForce配置',
    'non-empty Graph queryでのpath-copy command固有capture',
    'unresolved node、tag node、folder-only target、.mdと.svg以外の実file extension',
    '添付context menuの残る5操作とmenu全体の一致'
  ],
  conclusion:
    'GP0-3b-lでは3形式のpath copy、menu lifecycle、共通検証範囲であるGraph query・node集合・Vault内容の再表示／別プロセス再起動までの保持、各観測位置でviewport内に収まるsubmenu配置をmatched-core-behaviorと判定した。固定参照は右端から左、TSUZUNE captureは中央から右へ開いており、同じgeometryは証明していない。OS clipboard roundtrip、全node種別、menu全体、pixel equivalenceも未証明であり、Graph parity全体の完了は主張しない。'
}

await mkdir(assetsRoot, { recursive: true })
const contract = {
  schemaVersion: 1,
  status: 'reference-captured',
  product: 'Obsidian Desktop',
  version: '1.13.4',
  targetNode: relativeTarget,
  menuItems: obsidianMenuItems,
  submenuItems: submenuLabels,
  copiedValues: Object.fromEntries(
    scenarios.map((scenario) => [scenario, copiedValues[scenario].obsidian])
  ),
  assertions: Object.fromEntries(
    scenarios.map((scenario) => [scenario, evidence[scenario].obsidianManifest.assertions])
  ),
  evidenceBoundary: comparison.notEstablished
}
await writeFile(resolve(assetsRoot, 'contract.json'), `${JSON.stringify(contract, null, 2)}\n`, 'utf8')
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
      `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(Array.isArray(item.obsidian) ? item.obsidian.join(' / ') : item.obsidian)}</td><td>${escapeHtml(Array.isArray(item.tsuzune) ? item.tsuzune.join(' / ') : item.tsuzune)}</td><td class="${item.status}">${item.status}</td></tr>`
  )
  .join('')
const shot = (scenario, product, file, caption) =>
  `<figure><figcaption>${escapeHtml(caption)}</figcaption><img src="assets/graph-gp0-attachment-path-copy/${scenario}/${product}/${file}" alt="${escapeHtml(caption)}"></figure>`
const evidenceSections = [
  {
    title: '3形式のsubmenu: 各観測位置でviewport内に表示',
    scenario: 'url',
    obsidianFile: '03-after-parent-click.png',
    tsuzuneFile: '02-path-copy-submenu.png'
  },
  {
    title: '選択後: menuを閉じてGlobal Graphを保持',
    scenario: 'vault',
    obsidianFile: '04-after-path-copy.png',
    tsuzuneFile: '03-after-path-copy.png'
  },
  {
    title: '別process再起動後: Graphと対象nodeを保持',
    scenario: 'system',
    obsidianFile: '06-after-app-restart.png',
    tsuzuneFile: '05-after-app-restart.png'
  }
]
  .map(
    (item) =>
      `<section><h2>${escapeHtml(item.title)}</h2><div class="shots">${shot(item.scenario, 'obsidian-1.13.4', item.obsidianFile, `Obsidian · ${item.scenario}`)}${shot(item.scenario, 'tsuzune-working-tree', item.tsuzuneFile, `TSUZUNE · ${item.scenario}`)}</div></section>`
  )
  .join('')
const report = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GP0-3b-l Attachment Path Copy</title>
<style>
body{margin:0;background:#f2f4f1;color:#1f2924;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4.1rem);line-height:1.05;margin:.15em 0}.eyebrow{letter-spacing:.14em;text-transform:uppercase;color:#5a665f}.lead{max-width:820px;font-size:1.15rem;line-height:1.8}.badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#dcebe3;color:#1f5a3e;font-weight:700}section{margin-top:42px;background:#fff;border:1px solid #d9ded9;border-radius:18px;padding:24px;box-shadow:0 12px 32px #26342d0d}h2{margin-top:0}.shots{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}figcaption{font-weight:700;margin-bottom:8px}img{display:block;width:100%;height:auto;border:1px solid #d9ded9;border-radius:10px;background:#fff}table{width:100%;border-collapse:collapse;font-size:.92rem}th,td{padding:12px;border-bottom:1px solid #e2e6e2;text-align:left;vertical-align:top;overflow-wrap:anywhere}.matched,.matched-semantic{color:#17633e;font-weight:700}.partial-evidence,.known-ui-gap{color:#965a0a;font-weight:700}.gap{border-left:5px solid #d38a24}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9rem}@media(max-width:780px){.shots{grid-template-columns:1fr}section{padding:18px}table{display:block;overflow:auto}}
</style></head><body><main>
<p class="eyebrow">TSUZUNE × Obsidian 1.13.4 · GP0-3b-l</p>
<h1>3つのpath copyを、<br>同じ文字列契約へ。</h1>
<p class="lead">Obsidian URL、Vault相対path、Windows絶対pathを、同じfixtureの添付nodeからコピーした。menu、Graph検索条件・node集合、Vault内容、再表示、別process再起動、clipboard隔離までを3シナリオで固定した。</p>
<p><span class="badge">matched core behavior · evidence boundaries retained</span></p>
<section><h2>比較結果</h2><table><thead><tr><th>契約</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></section>
${evidenceSections}
<section class="gap"><h2>残る差と境界</h2><p>${escapeHtml(comparison.remainingGap.summary)}</p><ul>${comparison.notEstablished.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p><strong>次:</strong> ${escapeHtml(comparison.remainingGap.nextSlice)}</p></section>
<section><h2>結論</h2><p>${escapeHtml(comparison.conclusion)}</p><p class="mono">Machine-readable source: assets/graph-gp0-attachment-path-copy/comparison.json</p></section>
</main></body></html>`

await writeFile(reportPath, report, 'utf8')
console.log(`Wrote ${resolve(assetsRoot, 'comparison.json')}`)
console.log(`Wrote ${reportPath}`)
