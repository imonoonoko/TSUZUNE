import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workRoot = resolve(repoRoot, "work", "large-vault-performance");
const reportRoot = resolve(repoRoot, "docs", "reports");
const evidenceRoot = resolve(
  reportRoot,
  "assets",
  "large-vault-performance-2026-08-03",
);
const sourceSummaryPath = resolve(workRoot, "summary.json");
const publicSummaryPath = resolve(evidenceRoot, "summary-public.json");
const artifactPath = resolve(
  reportRoot,
  "tsuzune-large-vault-performance-2026-08-03.artifact.json",
);

const sourceSummary = JSON.parse(readFileSync(sourceSummaryPath, "utf8"));

if (sourceSummary.schemaVersion !== 2) {
  throw new Error(`Expected summary schemaVersion 2, got ${sourceSummary.schemaVersion}.`);
}
if (sourceSummary.trialCount !== 3) {
  throw new Error(`Expected 3 Electron trials, got ${sourceSummary.trialCount}.`);
}

const bySize = new Map(
  sourceSummary.measurements.map((measurement) => [measurement.size, measurement]),
);
const size500 = bySize.get(500);
const size2000 = bySize.get(2000);

if (!size500 || !size2000 || bySize.size !== 2) {
  throw new Error("Expected exactly the 500-note and 2000-note measurements.");
}

for (const measurement of [size500, size2000]) {
  if (measurement.electronTrials.length !== sourceSummary.trialCount) {
    throw new Error(
      `Expected ${sourceSummary.trialCount} Electron trials for ${measurement.size} notes.`,
    );
  }
  for (const [index, trial] of measurement.electronTrials.entries()) {
    if (!trial.ok) {
      throw new Error(`Electron trial ${index + 1} failed for ${measurement.size} notes.`);
    }
    if (
      trial.graph.nodeCount !== measurement.fixture.noteCount ||
      trial.graph.finiteNodeGeometryCount !== measurement.fixture.noteCount ||
      trial.graph.edgeCount !== measurement.fixture.renderedUndirectedPairCount
    ) {
      throw new Error(
        `Electron trial ${index + 1} has an incomplete graph for ${measurement.size} notes.`,
      );
    }
    if (
      !trial.sourceFixture.unchanged ||
      !trial.measurementCopy.homeContentRestored ||
      !trial.measurementCopy.markdownUnchanged
    ) {
      throw new Error(
        `Electron trial ${index + 1} failed integrity checks for ${measurement.size} notes.`,
      );
    }
  }
}

const round = (value, digits = 1) => Number(value.toFixed(digits));
const ratio = (large, small) => round(large / small, 2);

const sqlLiteral = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replaceAll("'", "''")}'`;
};

const valuesSql = (columns, rows) => {
  const values = rows
    .map((row) => `(${columns.map((column) => sqlLiteral(row[column])).join(", ")})`)
    .join(",\n  ");
  return `SELECT *\nFROM (VALUES\n  ${values}\n) AS snapshot(${columns.join(", ")})`;
};

const sanitizeCore = (core) => ({
  schemaVersion: core.schemaVersion,
  measurementScope: core.measurementScope,
  measuredAt: core.measuredAt,
  limitations: core.limitations,
  input: {
    noteCount: core.input.noteCount,
    bytes: core.input.bytes,
    loadMarkdownMs: core.input.loadMarkdownMs,
  },
  graph: core.graph,
  configuration: core.configuration,
  timingsMs: core.timingsMs,
  runtime: core.runtime,
});

const sanitizeElectronTrial = (trial, size, trialNumber) => ({
  schemaVersion: trial.schemaVersion,
  trialNumber,
  ok: trial.ok,
  measuredAt: trial.measuredAt,
  runtime: trial.runtime,
  isolation: {
    productionProfileTouched: trial.isolation.productionProfileTouched,
    browserWindow: trial.isolation.browserWindow,
  },
  sourceFixture: {
    manifest: trial.sourceFixture.manifest,
    fileCount: trial.sourceFixture.fileCount,
    recursiveSha256: trial.sourceFixture.recursiveSha256,
    unchanged: trial.sourceFixture.unchanged,
  },
  measurementCopy: {
    noteCount: trial.measurementCopy.noteCount,
    initialMarkdownSha256: trial.measurementCopy.initialMarkdownSha256,
    finalMarkdownSha256: trial.measurementCopy.finalMarkdownSha256,
    homeContentRestored: trial.measurementCopy.homeContentRestored,
    markdownUnchanged: trial.measurementCopy.markdownUnchanged,
    temporaryRootScheduledForDeletion:
      trial.measurementCopy.temporaryRootScheduledForDeletion,
  },
  expected: trial.expected,
  freshProfileWarmCacheOpen: trial.freshProfileWarmCacheOpen,
  graph: trial.graph,
  editorInput: trial.editorInput,
  watcherBurst: trial.watcherBurst,
  animationFrameCadence: trial.animationFrameCadence,
  definitions: trial.definitions,
  limitations: trial.limitations,
  artifacts: {
    json: `docs/reports/assets/large-vault-performance-2026-08-03/electron-${size}-trial-${trialNumber}.json`,
    screenshot: `docs/reports/assets/large-vault-performance-2026-08-03/electron-${size}-trial-${trialNumber}.png`,
    screenshotSize: trial.artifacts.screenshotSize,
  },
});

const publicMeasurements = [size500, size2000].map((measurement) => ({
  size: measurement.size,
  fixture: measurement.fixture,
  core: sanitizeCore(measurement.core),
  electronTrials: measurement.electronTrials.map((trial, index) =>
    sanitizeElectronTrial(trial, measurement.size, index + 1),
  ),
  aggregate: measurement.aggregate,
}));

const publicSummary = {
  schemaVersion: 1,
  sourceSchemaVersion: sourceSummary.schemaVersion,
  measuredAt: sourceSummary.measuredAt,
  scope: sourceSummary.scope,
  trialCount: sourceSummary.trialCount,
  childTimeoutMs: sourceSummary.childTimeoutMs,
  revision: sourceSummary.revision,
  runtime: sourceSummary.runtime,
  host: sourceSummary.host,
  conditions: sourceSummary.conditions,
  measurements: publicMeasurements,
  reportingNotes: {
    audience: "technical",
    deliveryMode: "html",
    requiredStructure: [
      "Title",
      "Technical summary",
      "Key findings with visual evidence",
      "Scope, data, and metric definitions",
      "Methodology",
      "Limitations, uncertainty, and robustness checks",
      "Recommended next steps",
      "Further questions",
    ],
    chartMap: [
      {
        section: "4倍規模で増える処理コスト",
        question: "500件から2000件へ増やしたとき、コア処理のp95は何倍になるか。",
        family: "Comparison & Ranking",
        type: "bar",
        fields: ["metric", "slowdownRatio"],
        claim:
          "4倍のノート規模でgraph build p95は3.97倍、180 ticks p95は4.90倍になった。",
        palettePolicy: "single-root preferred",
        delivery: "native artifact chart in portable HTML",
      },
    ],
    omittedVisuals: [
      "Electron timingは各規模3試行だけなので、分布チャートではなくmin/median/maxの監査表を採用した。",
    ],
  },
};

mkdirSync(evidenceRoot, { recursive: true });
writeFileSync(publicSummaryPath, `${JSON.stringify(publicSummary, null, 2)}\n`, "utf8");

for (const measurement of publicMeasurements) {
  writeFileSync(
    resolve(evidenceRoot, `core-${measurement.size}.json`),
    `${JSON.stringify(measurement.core, null, 2)}\n`,
    "utf8",
  );
  for (const trial of measurement.electronTrials) {
    const suffix = `${measurement.size}-trial-${trial.trialNumber}`;
    writeFileSync(
      resolve(evidenceRoot, `electron-${suffix}.json`),
      `${JSON.stringify(trial, null, 2)}\n`,
      "utf8",
    );
    copyFileSync(
      resolve(workRoot, `electron-${suffix}.png`),
      resolve(evidenceRoot, `electron-${suffix}.png`),
    );
  }
}

const summaryRows = [
  {
    graphFirstUsable2000Ms:
      size2000.aggregate.electronMs.graphFirstUsableMs.median,
    editorInput2000Ms:
      size2000.aggregate.electronMs.editorInputDoubleRafMs.median,
    watcherAdd2000Ms: size2000.aggregate.electronMs.watcherAddVisibleMs.median,
    animationFrameP95_2000Ms:
      size2000.aggregate.electronMs.animationFrameP95Ms.median,
    autosave2000Ms: size2000.aggregate.electronMs.autosaveCompleteMs.median,
    autosaveTargetMs: 650,
  },
];

const slowdownRows = [
  {
    order: 1,
    metric: "Graph構築 p95",
    slowdownRatio: ratio(
      size2000.core.timingsMs.buildWikiGraph.p95,
      size500.core.timingsMs.buildWikiGraph.p95,
    ),
    baseline500Ms: size500.core.timingsMs.buildWikiGraph.p95,
    large2000Ms: size2000.core.timingsMs.buildWikiGraph.p95,
  },
  {
    order: 2,
    metric: "1 tick p95",
    slowdownRatio: ratio(
      size2000.core.timingsMs.tick1.p95,
      size500.core.timingsMs.tick1.p95,
    ),
    baseline500Ms: size500.core.timingsMs.tick1.p95,
    large2000Ms: size2000.core.timingsMs.tick1.p95,
  },
  {
    order: 3,
    metric: "180 ticks p95",
    slowdownRatio: ratio(
      size2000.core.timingsMs.tick180.p95,
      size500.core.timingsMs.tick180.p95,
    ),
    baseline500Ms: size500.core.timingsMs.tick180.p95,
    large2000Ms: size2000.core.timingsMs.tick180.p95,
  },
  {
    order: 4,
    metric: "位置読出し p95",
    slowdownRatio: ratio(
      size2000.core.timingsMs.positions.p95,
      size500.core.timingsMs.positions.p95,
    ),
    baseline500Ms: size500.core.timingsMs.positions.p95,
    large2000Ms: size2000.core.timingsMs.positions.p95,
  },
];

const coreMetricLabels = {
  buildWikiGraph: "Wiki graph構築",
  createWikiGraphSimulation: "Force simulation生成",
  tick1: "Force simulation 1 tick",
  tick180: "Force simulation 180 ticks",
  positions: "位置読出し",
};

const coreRows = [size500, size2000].flatMap((measurement) =>
  Object.entries(coreMetricLabels).map(([field, metric], index) => {
    const timing = measurement.core.timingsMs[field];
    return {
      order: measurement.size + index / 10,
      size: measurement.size,
      metric,
      sampleCount: timing.sampleRuns,
      minMs: timing.min,
      p50Ms: timing.p50,
      p95Ms: timing.p95,
      maxMs: timing.max,
    };
  }),
);

const electronMetricLabels = {
  freshProfileWarmCacheOpenMs: "fresh profile warm-cache open",
  graphFirstUsableMs: "Global Graph first usable",
  editorInputDoubleRafMs: "synthetic input → double rAF",
  autosaveCompleteMs: "input → autosave complete",
  watcherAddVisibleMs: "20 Markdown add visible",
  watcherRemoveVisibleMs: "20 Markdown remove visible",
  animationFrameP50Ms: "rAF cadence p50",
  animationFrameP95Ms: "rAF cadence p95",
  animationFrameMaxMs: "rAF cadence max",
};

const electronRows = [size500, size2000].flatMap((measurement) =>
  Object.entries(electronMetricLabels).map(([field, metric], index) => {
    const timing = measurement.aggregate.electronMs[field];
    return {
      order: measurement.size + index / 10,
      size: measurement.size,
      metric,
      sampleCount: timing.sampleCount,
      minMs: timing.min,
      medianMs: timing.median,
      maxMs: timing.max,
    };
  }),
);

const autosaveRows = [size500, size2000].map((measurement) => ({
  size: measurement.size,
  targetMs: 650,
  trialsMet: measurement.electronTrials.filter(
    (trial) => trial.editorInput.autosave.withinTarget,
  ).length,
  trialCount: measurement.electronTrials.length,
  medianMs: measurement.aggregate.electronMs.autosaveCompleteMs.median,
}));

const evidencePath =
  "docs/reports/assets/large-vault-performance-2026-08-03/summary-public.json";
const sourceDefinitions = [
  {
    id: "large_vault_public_summary",
    label: "TSUZUNE large-Vault sanitized performance evidence",
    path: evidencePath,
  },
  {
    id: "large_vault_headline_snapshot",
    label: "Reviewed large-Vault headline snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(Object.keys(summaryRows[0]), summaryRows),
      description:
        "Materializes reviewed headline values from summary-public.json; this is a saved VALUES snapshot, not an external database query.",
      executed_at: sourceSummary.measuredAt,
      tables_used: [],
    },
  },
  {
    id: "large_vault_slowdown_snapshot",
    label: "Reviewed core p95 slowdown snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(Object.keys(slowdownRows[0]), slowdownRows),
      description:
        "Materializes reviewed 2000-note / 500-note p95 ratios calculated from summary-public.json.",
      executed_at: sourceSummary.measuredAt,
      tables_used: [],
    },
  },
  {
    id: "large_vault_core_snapshot",
    label: "Reviewed core timing snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(Object.keys(coreRows[0]), coreRows),
      description:
        "Materializes the reviewed core min, p50, p95, and max values from summary-public.json.",
      executed_at: sourceSummary.measuredAt,
      tables_used: [],
    },
  },
  {
    id: "large_vault_electron_snapshot",
    label: "Reviewed Electron timing snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(Object.keys(electronRows[0]), electronRows),
      description:
        "Materializes the reviewed three-trial Electron min, median, and max values from summary-public.json.",
      executed_at: sourceSummary.measuredAt,
      tables_used: [],
    },
  },
  {
    id: "large_vault_autosave_snapshot",
    label: "Reviewed autosave target snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(Object.keys(autosaveRows[0]), autosaveRows),
      description:
        "Materializes the explicit 650 ms reporting-target results from the six Electron trials.",
      executed_at: sourceSummary.measuredAt,
      tables_used: [],
    },
  },
  {
    id: "large_vault_500_screenshot",
    label: "500-note Electron trial 1 screenshot",
    path:
      "docs/reports/assets/large-vault-performance-2026-08-03/electron-500-trial-1.png",
  },
  {
    id: "large_vault_2000_screenshot",
    label: "2000-note Electron trial 1 screenshot",
    path:
      "docs/reports/assets/large-vault-performance-2026-08-03/electron-2000-trial-1.png",
  },
];
const manifestSources = sourceDefinitions.map(({ id, label, path }) => ({
  id,
  label,
  path,
}));

const screenshot500Path = resolve(evidenceRoot, "electron-500-trial-1.png");
const screenshot2000Path = resolve(evidenceRoot, "electron-2000-trial-1.png");
const screenshotHtml = `
<style>
  .vault-shot-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .vault-shot { margin: 0; padding: 12px; border: 1px solid #d8d6cf; border-radius: 12px; background: #fbfaf7; }
  .vault-shot img { width: 100%; height: auto; display: block; border: 1px solid #c8c5bb; border-radius: 6px; }
  .vault-shot figcaption { margin-top: 8px; color: #3d3b36; font: 600 13px/1.45 system-ui, sans-serif; }
  @media (max-width: 860px) { .vault-shot-grid { grid-template-columns: 1fr; } }
</style>
<div class="vault-shot-grid">
  <figure class="vault-shot">
    <img alt="500-note synthetic Vault rendered in the TSUZUNE Global Graph" src="data:image/png;base64,${readFileSync(screenshot500Path).toString("base64")}">
    <figcaption>500 notes / 1,000 undirected rendered pairs — Electron trial 1</figcaption>
  </figure>
  <figure class="vault-shot">
    <img alt="2000-note synthetic Vault rendered in the TSUZUNE Global Graph" src="data:image/png;base64,${readFileSync(screenshot2000Path).toString("base64")}">
    <figcaption>2,000 notes / 4,000 undirected rendered pairs — Electron trial 1</figcaption>
  </figure>
</div>`;

const generatedAt = sourceSummary.measuredAt;
const title = "TSUZUNE 大規模Vault性能ベースライン";
const artifact = {
  surface: "report",
  manifest: {
    version: 1,
    surface: "report",
    title,
    description:
      "500件・2000件の制御された疎グラフVaultで採取したTSUZUNEコア／Electron性能ベースライン。",
    generatedAt,
    cards: [
      {
        id: "graph_first_usable",
        description: "2,000件、fresh profile warm-cache、3試行の中央値。",
        dataset: "headline",
        sourceId: "large_vault_headline_snapshot",
        metrics: [
          {
            label: "Graph first usable (ms)",
            field: "graphFirstUsable2000Ms",
            format: "number",
          },
        ],
      },
      {
        id: "editor_input",
        description: "2,000件、synthetic char inputからdouble rAFまで、3試行の中央値。",
        dataset: "headline",
        sourceId: "large_vault_headline_snapshot",
        metrics: [
          {
            label: "Input → double rAF (ms)",
            field: "editorInput2000Ms",
            format: "number",
          },
        ],
      },
      {
        id: "watcher_add",
        description: "2,000件へ20 Markdownを追加しGraph DOMが所定件数になるまで、3試行の中央値。",
        dataset: "headline",
        sourceId: "large_vault_headline_snapshot",
        metrics: [
          {
            label: "20-file add visible (ms)",
            field: "watcherAdd2000Ms",
            format: "number",
          },
        ],
      },
      {
        id: "raf_p95",
        description: "2,000件Global Graph表示中の120 rAF intervals、各試行p95の中央値。",
        dataset: "headline",
        sourceId: "large_vault_headline_snapshot",
        metrics: [
          {
            label: "rAF cadence p95 (ms)",
            field: "animationFrameP95_2000Ms",
            format: "number",
          },
        ],
      },
    ],
    charts: [
      {
        id: "core_p95_slowdown",
        title: "500件から2000件へのコア処理p95増加倍率",
        subtitle: "同一の疎グラフ生成規則。2000件値 ÷ 500件値、単位は倍率。",
        question:
          "ノート数とリンク数を4倍にしたとき、TSUZUNEのグラフコア処理p95は何倍になるか。",
        rationale:
          "4つの離散処理を共通の増加倍率で比較するため、ゼロ始点のsingle-series barを使う。",
        intent: "comparison",
        type: "bar",
        dataset: "slowdown",
        sourceId: "large_vault_slowdown_snapshot",
        encodings: {
          x: { field: "metric", type: "ordinal", label: "処理" },
          y: {
            field: "slowdownRatio",
            type: "quantitative",
            label: "2000 / 500 倍",
            format: "number",
          },
        },
        yAxisTitle: "Slowdown ratio (×)",
        valueFormat: "number",
        layout: "full",
        labels: { values: "all" },
        settings: { showValues: true, sort: "none", zeroBaseline: true },
      },
    ],
    tables: [
      {
        id: "core_timings",
        title: "Nodeコア処理の実測値",
        subtitle: "各規模10サンプル、単位ms。p95は線形補間で算出した保存済み測定値。",
        dataset: "core_timings",
        sourceId: "large_vault_core_snapshot",
        defaultSort: { field: "size", direction: "asc" },
        density: "dense",
        layout: "full",
        columns: [
          { field: "size", label: "Notes", format: "number" },
          { field: "metric", label: "処理", type: "text" },
          { field: "p50Ms", label: "p50 ms", format: "number" },
          { field: "p95Ms", label: "p95 ms", format: "number" },
        ],
      },
      {
        id: "electron_timings",
        title: "Electron実アプリ経路の実測値",
        subtitle: "各規模3つの独立temporary-copy／fresh-profile試行、単位ms。",
        dataset: "electron_timings",
        sourceId: "large_vault_electron_snapshot",
        defaultSort: { field: "size", direction: "asc" },
        density: "dense",
        layout: "full",
        columns: [
          { field: "size", label: "Notes", format: "number" },
          { field: "metric", label: "経路", type: "text" },
          { field: "sampleCount", label: "n", format: "number" },
          { field: "minMs", label: "min ms", format: "number" },
          { field: "medianMs", label: "median ms", format: "number" },
          { field: "maxMs", label: "max ms", format: "number" },
        ],
      },
      {
        id: "autosave_target",
        title: "明示済みautosave reporting target",
        subtitle: "650 ms targetを満たした試行数。その他の計測項目には合否閾値を置いていない。",
        dataset: "autosave_target",
        sourceId: "large_vault_autosave_snapshot",
        defaultSort: { field: "size", direction: "asc" },
        density: "spacious",
        layout: "full",
        columns: [
          { field: "size", label: "Notes", format: "number" },
          { field: "targetMs", label: "Target ms", format: "number" },
          { field: "trialsMet", label: "Met", format: "number" },
          { field: "trialCount", label: "Trials", format: "number" },
          { field: "medianMs", label: "Median ms", format: "number" },
        ],
      },
    ],
    sources: manifestSources,
    blocks: [
      { id: "title", type: "markdown", body: `# ${title}` },
      {
        id: "technical_summary",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## Technical summary\n\n**2,000件のGlobal Graphは正しい2,000 node／4,000 pairを描画できたが、対話性の余裕は小さい。** 3試行中央値はGraph first usable **1,147.5 ms**、synthetic input→double rAF **96.8 ms**、20-file add visible **2,172.2 ms**、Global Graph表示中rAF p95 **164.4 ms**だった。500件から2,000件への4倍化では、コアのGraph構築p95が **3.97倍**、180 ticks p95が **4.90倍**になった。これは制御された疎グラフにおける記述的ベースラインであり、一般的な合否判定や物理入力・GPU描画性能を示さない。",
      },
      {
        id: "key_findings",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## 2,000件では表示完了より継続フレームと外部変更反映が先に効く\n\n- 2,000件でも全nodeのgeometryは有限かつ正値で、全4,000 pairを描画した。欠落やNaNは観測していない。\n- Graph first usable中央値は500件 **261.6 ms**、2,000件 **1,147.5 ms**。\n- rAF cadence p95中央値は500件 **25.0 ms**、2,000件 **164.4 ms**。これはrenderer schedulingのproxyでGPU paint時間ではない。\n- 20-file add visible中央値は500件 **372.9 ms**、2,000件 **2,172.2 ms**。完了点はraw watcher eventではなくGraph DOMの所定件数到達である。\n- 唯一の明示targetであるautosave 650 msは両規模とも0/3試行。中央値は500件 **664.8 ms**、2,000件 **1,022.9 ms**だった。",
      },
      { id: "headline_metrics", type: "metric-strip", cardIds: ["graph_first_usable", "editor_input", "watcher_add", "raf_p95"] },
      {
        id: "slowdown_interpretation",
        type: "markdown",
        sourceId: "large_vault_slowdown_snapshot",
        body:
          "## 4倍規模で増える処理コスト\n\n下図は絶対時間ではなく、同一マシン・同一生成規則で2,000件のp95を500件のp95で割った倍率である。Graph構築は規模とほぼ同じ **3.97倍**、180 ticksは **4.90倍**まで増えた。一方、位置読出しは **1.72倍**で、主な調査対象は位置配列の取得よりグラフ構築・Force反復・renderer経路になる。",
      },
      { id: "slowdown_chart", type: "chart", chartId: "core_p95_slowdown", layout: "full" },
      {
        id: "exact_values_heading",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## Exact measurements\n\nコア表は同一process内のwarm-up後10サンプル、Electron表は3つの独立profile／Vault-copy試行である。コア`tick180`は同期CPU microbenchmarkで、UIが3.56秒停止したという測定ではない。",
      },
      { id: "core_table", type: "table", tableId: "core_timings", layout: "full" },
      { id: "electron_table", type: "table", tableId: "electron_timings", layout: "full" },
      { id: "autosave_table", type: "table", tableId: "autosave_target", layout: "full" },
      {
        id: "visual_evidence_heading",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## Rendered evidence\n\n同じ1264×761 capture surfaceで、temporary measurement VaultのGlobal Graphを採取した。画像は速度を証明するものではなく、計測時に対象規模のnode／edgeが実際のTSUZUNE rendererへ載っていたことを確認する補助証拠である。",
      },
      { id: "visual_evidence", type: "html", body: screenshotHtml },
      {
        id: "scope_definitions",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## Scope, data, and metric definitions\n\n対象は決定的に生成した **500件／1,000 pair** と **2,000件／4,000 pair** の疎グラフ（概ねdegree 4）。`Graph first usable`はGlobal Graph root、正確なnode／edge件数、全nodeの正値geometry、最初のCanvas clear、double rAFが揃うまで。`input → double rAF`はoff-screen non-focusable Electron webContentsのsynthetic char inputからCodeMirror DOM変更とdouble rAFまで。`watcher add/remove visible`は20 Markdownの追加／削除からGlobal Graph DOMが期待件数になるまで。`rAF cadence`はGlobal Graph表示中120 intervalsのrenderer scheduling proxyである。",
      },
      {
        id: "methodology",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body: `## Methodology\n\nWindows ${sourceSummary.host.release}、${sourceSummary.host.cpuModel}（${sourceSummary.host.logicalCpuCount} logical CPUs）、Node ${sourceSummary.runtime.node}、Electron ${sourceSummary.runtime.electron}、Chrome ${sourceSummary.runtime.chrome}で測定した。coreは3 warm-up後10 sample。Electronは各規模3回、毎回canonical fixtureをtemporary Vaultへコピーしfresh userData profileで起動した。Windowはcompositor上でvisibleだがnon-focusable／taskbar非表示／座標外で、foreground activateや物理入力は行っていない。編集内容は元へ戻し、canonical fixtureのrecursive SHA-256不変とmeasurement-copyのMarkdown digest復元を全試行で確認した。測定時Git HEADは\`${sourceSummary.revision.gitHead}\`、working treeはdirtyだった。`,
      },
      {
        id: "limitations",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## Limitations, uncertainty, and robustness\n\n- OS filesystem cacheはwarmで、power-cycle cold startではない。\n- Electronは各規模3試行だけで、広い分布や長時間安定性は推定できない。\n- synthetic off-screen inputは物理キーボード／前景OS input latencyの代替ではない。\n- rAFはGPU paintやCanvas 1描画の時間ではなく、座標外compositorのcadenceは実モニターと異なる可能性がある。\n- watcher時間はGraph DOM可視化までを含み、raw filesystem event latencyではない。\n- fixtureは均質な疎グラフだけ。hub、相互リンク、未解決リンク、長文・添付混在を含まない。\n- dirty working treeの一点測定であり、Obsidian比較や一般ハードウェアへの外挿はできない。\n\nRobustnessとして全6 Electron試行が正しいnode／edge件数、全node finite geometry、fixture不変、編集復元を通過した。",
      },
      {
        id: "next_steps",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## Recommended next steps\n\n1. このベースラインを固定し、予定どおり`GP6-0W`で現行working treeのGlobal Graph公開差を隔離captureする。\n2. 性能改修を始める前に、前景手動確認とhub／相互／未解決リンクfixtureを別sliceで追加し、164.4 ms rAF p95と2.17 s watcher反映が実利用でも再現するか確認する。\n3. 再現した場合は、Force tick schedulingとfile-change後の全Graph再構築を最初のprofile対象にする。独自DB、WebGL、固定node上限は測定で必要性が確定するまで導入しない。",
      },
      {
        id: "further_questions",
        type: "markdown",
        sourceId: "large_vault_public_summary",
        body:
          "## Further questions\n\n- 2,000件で観測したrAF cadenceは前景モニター上でも再現するか。\n- 高degree hub、相互リンク、未解決リンク、長文本文はどの処理を最初に悪化させるか。\n- file watcher反映の遅延はscan、graph rebuild、React DOM、Canvasのどこで支配されるか。\n- autosaveの650 ms reporting targetはdebounce開始点、disk完了点、UI表示のどれを製品SLOにすべきか。",
      },
    ],
  },
  snapshot: {
    version: 1,
    generatedAt,
    status: "ready",
    datasets: {
      headline: summaryRows,
      slowdown: slowdownRows,
      core_timings: coreRows,
      electron_timings: electronRows,
      autosave_target: autosaveRows,
    },
    accessIssues: [],
  },
  sources: sourceDefinitions,
  package_info: {
    root: ".",
    manifestPath:
      "docs/reports/tsuzune-large-vault-performance-2026-08-03.artifact.json",
    snapshotPath:
      "docs/reports/tsuzune-large-vault-performance-2026-08-03.artifact.json",
  },
};

writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${publicSummaryPath}`);
console.log(`Wrote ${artifactPath}`);
