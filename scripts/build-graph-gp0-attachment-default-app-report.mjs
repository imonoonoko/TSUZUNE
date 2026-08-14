import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const assetsRoot = resolve(repoRoot, 'docs/reports/assets/graph-gp0-attachment-default-app')
const referenceRoot = resolve(assetsRoot, 'obsidian-1.13.4')
const productRoot = resolve(assetsRoot, 'tsuzune-working-tree')
const targetPath = 'attachments/diagram.svg'
const referenceFileUrl = `file:///<OBSIDIAN_VAULT_ROOT>/${targetPath}`
const productFilePath = `<TSUZUNE_VAULT_ROOT>/${targetPath}`

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const [obsidian, obsidianManifest, tsuzune, tsuzuneManifest] = await Promise.all([
  readJson(resolve(referenceRoot, 'observation.json')),
  readJson(resolve(assetsRoot, 'manifest.json')),
  readJson(resolve(productRoot, 'observation.json')),
  readJson(resolve(productRoot, 'manifest.json'))
])

const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const normalizePath = (value) => String(value ?? '').replaceAll('\\', '/')
const allTrue = (value) => Object.values(value ?? {}).every(Boolean)
const menuTexts = (items) => items.map((item) => normalize(item.text))
const stableSignature = (values, signature) => {
  const signatures = values.map(signature)
  return signatures.length > 0 && signatures.every((value) => value === signatures[0])
}
const cameraSignature = (state) =>
  JSON.stringify({
    targetScale: state?.camera?.targetScale,
    scale: state?.camera?.scale,
    panX: state?.camera?.panX,
    panY: state?.camera?.panY,
    width: state?.camera?.width,
    height: state?.camera?.height,
    devicePixelRatio: state?.camera?.devicePixelRatio,
    graphOptionsScale: state?.camera?.graphOptionsScale
  })
const nodeSignature = (state) =>
  JSON.stringify([...(state?.renderedNodeIds ?? state?.nodePaths ?? [])].sort())
const edgeSignature = (state) =>
  JSON.stringify(
    [...(state?.renderedLinks ?? state?.edgeSignature ?? [])]
      .map((edge) => [edge.source ?? edge.sourcePath, edge.target ?? edge.targetPath])
      .sort(([leftSource, leftTarget], [rightSource, rightTarget]) =>
        `${leftSource}\u0000${leftTarget}`.localeCompare(`${rightSource}\u0000${rightTarget}`)
      )
  )
const graphTab = (state) =>
  (state?.tabHeaders ?? state?.tabs ?? []).find(
    (tab) => normalize(tab.ariaLabel ?? tab.label ?? tab.text) === 'グラフビュー'
  )
const referenceGraphWorkspace = (state) =>
  state?.graphLeafCount === 1 &&
  state?.activeLeaf?.viewType === 'graph' &&
  graphTab(state)?.classes?.includes('mod-active') === true
const productGraphWorkspace = (state) => graphTab(state)?.selected === true
const productSurfaceSignature = (state) =>
  JSON.stringify({
    query: state?.query,
    stageTransform: state?.stageTransform,
    nodes: JSON.parse(nodeSignature(state)),
    edges: JSON.parse(edgeSignature(state)),
    tabs: (state?.tabs ?? []).map((tab) => ({
      label: normalize(tab.label ?? tab.text),
      selected: tab.selected === true
    }))
  })

const obsidianAction = obsidian.attachmentDefaultApp
const productAction = tsuzune.attachmentDefaultAppContract
const obsidianMenu = obsidian.nodeContextMenu?.items ?? []
const productMenu = tsuzune.initial?.attachmentContextMenu?.items ?? []
const referenceStates = [
  obsidianAction?.beforeGraph,
  obsidianAction?.afterGraph,
  obsidian.afterGraphReopen
]
const productStates = [
  productAction?.graphBeforeAction,
  productAction?.graphAfterAction,
  tsuzune.initial?.reopened
]
const referenceRequest = obsidianAction?.afterRequest?.calls?.[0]
const productRequest = productAction?.calls?.[0]
const productRestart = tsuzune.restarted?.attachmentDefaultAppShell
const productMenuLabels = menuTexts(productMenu)
const productDefaultAppIndex = productMenuLabels.indexOf('デフォルトアプリで開く')
const productLinkedViewIndex = productMenuLabels.findIndex((text) =>
  text.startsWith('リンクされたビューを開く')
)
const productDeleteIndex = productMenuLabels.indexOf('ファイルを削除')

const required = {
  evidenceCaptured:
    obsidianManifest.status === 'reference-captured' && tsuzuneManifest.status === 'captured',
  evidenceAssertions: allTrue(obsidianManifest.assertions) && allTrue(tsuzuneManifest.assertions),
  menuTargetAndOrder:
    obsidianMenu.length === 11 &&
    obsidianMenu[7]?.text === 'デフォルトアプリで開く' &&
    obsidianMenu[7]?.disabled === false &&
    productDefaultAppIndex > productLinkedViewIndex &&
    productDefaultAppIndex < productDeleteIndex &&
    productMenu[productDefaultAppIndex]?.disabled === false,
  referenceRequestExact:
    obsidianAction?.beforeRequest?.callCount === 0 &&
    obsidianAction?.afterRequest?.callCount === 1 &&
    referenceRequest?.url === referenceFileUrl &&
    referenceRequest?.target === '_external',
  productRequestExact:
    productAction?.calls?.length === 1 &&
    normalizePath(productRequest?.path) === productFilePath &&
    productAction?.apiSeam === 'electron.shell.openPath',
  sameFixtureFileIdentity:
    referenceRequest?.url?.endsWith(`/${targetPath}`) === true &&
    normalizePath(productRequest?.path).endsWith(`/${targetPath}`),
  actionLifecycle:
    obsidianAction?.menuClosed === true &&
    productAction?.uiAfterAction?.contextMenuOpen === false &&
    productAction?.uiAfterAction?.globalGraphVisible === true,
  referenceNoReplayAfterReopen:
    obsidianAction?.afterGraphReopenCapture?.callCount === 1 &&
    obsidianAction?.afterGraphReopenCapture?.calls?.[0]?.url === referenceFileUrl,
  productNoReplayAfterReopen: productAction?.callCountAfterGraphReopen === 1,
  productNoReplayAfterRestart:
    productRestart?.callCountAfterAppRestart === 0 && productRestart?.calls?.length === 0,
  hooksInstalledAndRestored:
    obsidianAction?.firstHookSetup?.installed === true &&
    obsidianAction?.firstHookSetup?.hooked === true &&
    obsidianAction?.firstHookRestore?.restored === true &&
    obsidianAction?.firstHookRestore?.captureRemoved === true &&
    productAction?.shell?.hookInstalled === true &&
    productAction?.shell?.identityVerifiedBeforeAction === true &&
    productAction?.shell?.hookRestored === true &&
    productRestart?.hookInstalled === true &&
    productRestart?.hookRestored === true,
  referenceRawQueryStable: stableSignature(
    referenceStates,
    (state) => state?.graphOptionsSearch ?? state?.searchInputValue
  ),
  referenceRawCameraStable:
    referenceStates.every((state) => state?.camera !== undefined) &&
    stableSignature(referenceStates, cameraSignature),
  referenceRawNodeSetStable: stableSignature(referenceStates, nodeSignature),
  referenceRawEdgeSignatureStable:
    referenceStates.every((state) => (state?.renderedLinks?.length ?? 0) > 0) &&
    stableSignature(referenceStates, edgeSignature),
  referenceRawGraphWorkspaceStable: referenceStates.every(referenceGraphWorkspace),
  productRawSurfaceStable:
    productStates.every((state) => (state?.edgeSignature?.length ?? 0) > 0) &&
    stableSignature(productStates, productSurfaceSignature) &&
    productStates.every(productGraphWorkspace),
  vaultContentUnchanged:
    obsidianManifest.assertions?.attachmentDefaultAppVaultUnchanged === true &&
    tsuzune.assertions?.isolatedVaultContentUnchanged === true &&
    tsuzune.protection?.before?.isolatedVaultContent?.combinedSha256 ===
      tsuzune.protection?.after?.isolatedVaultContent?.combinedSha256,
  referenceRestartHonestlyUnobserved:
    obsidianManifest.assertions?.appRestartNotObserved === true &&
    obsidianManifest.scope?.lifecycle?.includes('app-restart') !== true
}

if (!Object.values(required).every(Boolean)) {
  throw new Error(
    `GP0-3b-n attachment default-app contractが成立していません: ${JSON.stringify(required)}`
  )
}

const screenshots = [
  'obsidian-1.13.4/01-node-context-menu.png',
  'obsidian-1.13.4/02-after-default-app-request.png',
  'tsuzune-working-tree/01-node-context-menu.png',
  'tsuzune-working-tree/02-after-default-app-request.png'
]
await Promise.all(screenshots.map((path) => access(resolve(assetsRoot, path))))

const comparison = {
  schemaVersion: 1,
  stage: 'GP0-3b-n',
  capturedAt: tsuzune.capturedAt,
  status: 'matched-core-behavior',
  fixedConditions: {
    reference: 'Obsidian Desktop 1.13.4',
    fixture: 'fixtures/obsidian-graph-parity-vault',
    scope: 'Global Graph attachment node default-app action',
    targetNode: targetPath,
    viewport: { width: 1265, height: 768 },
    deviceScaleFactor: 1,
    theme: 'light'
  },
  required,
  comparisons: [
    {
      id: 'default-app-menu',
      label: '実在attachmentに「デフォルトアプリで開く」を有効表示',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'single-file-request',
      label: '同じrelative fixture file identityを外部open境界へ1回だけ要求',
      obsidian: 'window.open(file URL, "_external")',
      tsuzune: 'electron.shell.openPath(absolute filesystem path)',
      status: 'matched-core-behavior'
    },
    {
      id: 'menu-close',
      label: '要求後にcontext menuを閉じ、Global Graphを保持',
      obsidian: true,
      tsuzune: true,
      status: 'matched'
    },
    {
      id: 'same-process-reopen',
      label: 'Graph再表示でrequestを再生せず、query・camera・node・edge・Graph workspace・Vaultを保持',
      obsidian: true,
      tsuzune: true,
      status: 'matched-core-behavior'
    },
    {
      id: 'app-restart',
      label: '別process再起動時のrequest非再生',
      obsidian: '安全境界により未観測・未確立',
      tsuzune: 'main import前hookで0回を追加確認',
      status: 'product-extra-evidence'
    },
    {
      id: 'context-menu-scope',
      label: '添付nodeのcontext menu全体',
      obsidian: obsidianMenu.length,
      tsuzune: productMenu.length,
      status: 'known-gap-outside-slice'
    },
    {
      id: 'real-default-app-launch',
      label: 'OS既定appの選択・実起動・chooser／cancel',
      obsidian: '未実行・未証明',
      tsuzune: '未実行・未証明',
      status: 'not-established'
    }
  ],
  established: [
    '両製品の実在attachment nodeから同じrelative fixture file identityへの外部open requestを1回だけ発行する',
    '両製品で操作後にcontext menuを閉じ、同一process内のGraph再表示でrequestを再発行しない',
    '固定Obsidian raw observationからquery、camera、node ID集合、edge signature、Graph tab／leafの不変を直接確認した',
    'TSUZUNE raw observationからquery、camera transform、node ID集合、edge signature、Graph tabの不変を直接確認した',
    '両captureでVault content digestを保持し、外部open hookを復元した'
  ],
  knownGaps: [
    `添付context menu全体はObsidian ${obsidianMenu.length}項目、TSUZUNE ${productMenu.length}項目で残差がある`,
    'Obsidianのfile URLとTSUZUNEのabsolute filesystem pathはAPI表現が異なる。同じrelative fixture file identityだけを中核一致とした',
    'Obsidianの別process再起動は安全境界により意図的に実行せず、request非再生は未観測・未確立である',
    'TSUZUNEの別process再起動0回は製品固有の追加証拠で、共通parity判定には使用していない',
    'OS既定appの選択・実起動成功、chooser／cancel、物理入力、screen reader、High Contrast、multi-DPI、pixel identityは未証明'
  ],
  evidenceBoundary: {
    input: '隔離fixture、固定viewport、offscreen Electron、CDP／DOM合成入力',
    interception: {
      obsidian: 'renderer window.openをaction直前にfail-closedで差し替え、OSへ転送しない',
      tsuzune: 'main import前にelectron.shell.openPathをfail-closedで差し替え、IPC／Vault validationは実経路を通す'
    },
    commonLifecycle: ['action', 'same-process Graph reopen'],
    productOnlyLifecycle: ['TSUZUNE app restart'],
    notEstablished: [
      '実OS default application launchとfile association',
      'chooserとcancel結果',
      'physical inputとreal-OS accessibility',
      'pixel-identical rendering'
    ]
  },
  safeguards: {
    obsidian: {
      sourceUnchanged: obsidianManifest.assertions?.sourceUnchanged,
      vaultUnchanged: obsidianManifest.assertions?.attachmentDefaultAppVaultUnchanged,
      protocolRestored: obsidianManifest.assertions?.protocolRestored,
      hookRestored: obsidianAction.firstHookRestore.restored,
      secondProcessLaunched: false
    },
    tsuzune: {
      sourceFixtureUnchanged: tsuzune.assertions?.sourceFixtureUnchanged,
      isolatedVaultContentUnchanged: tsuzune.assertions?.isolatedVaultContentUnchanged,
      hookRestored: productAction.shell.hookRestored,
      isolatedProcessesRemaining: tsuzune.assertions?.noIsolatedProcessesRemaining === true ? 0 : null
    }
  },
  menuItems: {
    obsidian: menuTexts(obsidianMenu),
    tsuzune: productMenuLabels
  },
  requestRepresentations: {
    obsidian: {
      apiSeam: 'window.open',
      url: referenceFileUrl,
      target: '_external'
    },
    tsuzune: {
      apiSeam: 'electron.shell.openPath',
      path: productFilePath
    },
    sharedRelativeFileIdentity: targetPath
  },
  conclusion:
    'GP0-3b-nでは、実在attachment nodeの「デフォルトアプリで開く」から同じrelative fixture file identityへの外部open requestを1回だけ発行し、menu close、Graph／Vault保持、同一process内のGraph再表示での非再生を中核挙動として一致確認した。実外部アプリは起動しておらず、Obsidianの別process再起動も未観測である。'
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
const report = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GP0-3b-n Attachment Default App</title><style>body{margin:0;background:#f4f2eb;color:#202923;font-family:"Segoe UI","Noto Sans JP",sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08}.verdict{display:inline-block;padding:8px 14px;border-radius:999px;background:#d9f4ec;color:#08685f;font-weight:800}.shots{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure,.table{background:#fff;border:1px solid #d6ddd7;border-radius:16px;padding:14px;overflow:auto}img{width:100%;border:1px solid #ddd;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.matched,.matched-core-behavior{color:#08766d;font-weight:800}.known-gap-outside-slice,.product-extra-evidence,.not-established{color:#a66100;font-weight:800}.scope{border-left:4px solid #d39b37;background:#fff1cf;padding:16px}@media(max-width:900px){.shots{grid-template-columns:1fr}}</style></head><body><main><p>GP0-3b-n · 固定公開UI比較</p><h1>添付を既定アプリへ渡す要求だけを、安全に固定する。</h1><p>Obsidian Desktop 1.13.4とTSUZUNEを同じfixture、Global Graph、1265×768、DPR 1、ライトテーマで比較しました。外部アプリは実際には起動していません。</p><div class="verdict">matched-core-behavior: default-app request</div><h2>Context menu</h2><div class="shots"><figure><figcaption>Obsidian: ${obsidianMenu.length}項目menu</figcaption><img src="assets/graph-gp0-attachment-default-app/obsidian-1.13.4/01-node-context-menu.png" alt="Obsidian attachment context menu"></figure><figure><figcaption>TSUZUNE: ${productMenu.length}項目menu</figcaption><img src="assets/graph-gp0-attachment-default-app/tsuzune-working-tree/01-node-context-menu.png" alt="TSUZUNE attachment context menu"></figure><figure><figcaption>Obsidian: intercepted request後</figcaption><img src="assets/graph-gp0-attachment-default-app/obsidian-1.13.4/02-after-default-app-request.png" alt="Obsidian after intercepted default-app request"></figure><figure><figcaption>TSUZUNE: intercepted request後</figcaption><img src="assets/graph-gp0-attachment-default-app/tsuzune-working-tree/02-after-default-app-request.png" alt="TSUZUNE after intercepted default-app request"></figure></div><h2>比較</h2><div class="table"><table><thead><tr><th>確認項目</th><th>Obsidian</th><th>TSUZUNE</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></div><h2>証拠境界</h2><p class="scope">中核一致は、同じrelative fixture file identityへのrequest 1回、menu close、Graph／Vault保持、同一process内のGraph再表示での非再生です。Obsidianはfile URL、TSUZUNEはabsolute filesystem pathを別のAPI seamへ渡します。OS既定appの選択・実起動とObsidianの別process再起動は証明していません。</p></main></body></html>`
await writeFile(
  resolve(repoRoot, 'docs/reports/graph-gp0-attachment-default-app-2026-08-10.html'),
  report,
  'utf8'
)

console.log(JSON.stringify({ status: comparison.status, comparisons: comparison.comparisons.length }, null, 2))
