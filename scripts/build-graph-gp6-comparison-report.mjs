import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportRoot = resolve(repoRoot, "docs", "reports");
const evidenceRoot = resolve(reportRoot, "assets", "graph-gp6");

const comparisonPath = resolve(evidenceRoot, "comparison.json");
const obsidianObservationPath = resolve(
  evidenceRoot,
  "obsidian-1.13.4",
  "01-global-baseline.observation.json",
);
const tsuzuneObservationPath = resolve(
  evidenceRoot,
  "tsuzune-0.5.0",
  "01-global-baseline.observation.json",
);
const obsidianScreenshotPath = resolve(
  evidenceRoot,
  "obsidian-1.13.4",
  "01-global-baseline.png",
);
const tsuzuneScreenshotPath = resolve(
  evidenceRoot,
  "tsuzune-0.5.0",
  "01-global-baseline.png",
);
const outputPath = resolve(
  reportRoot,
  "graph-gp6-production-comparison-2026-08-02.artifact.json",
);

const comparison = JSON.parse(readFileSync(comparisonPath, "utf8"));
const obsidian = JSON.parse(readFileSync(obsidianObservationPath, "utf8"));
const tsuzune = JSON.parse(readFileSync(tsuzuneObservationPath, "utf8"));

if (comparison.comparisonStatus !== "not-matched") {
  throw new Error("Expected the installed-production comparison to be not-matched.");
}

const title = "TSUZUNE Graph GP6 本番比較";
const generatedAt = comparison.comparedAt;

const graphCounts = [
  { metric: "Markdown files", product: "Obsidian 1.13.4", count: comparison.counts.markdownFiles.reference },
  { metric: "Markdown files", product: "TSUZUNE 0.5.0", count: comparison.counts.markdownFiles.candidate },
  { metric: "Rendered nodes", product: "Obsidian 1.13.4", count: comparison.counts.renderedNodes.reference },
  { metric: "Rendered nodes", product: "TSUZUNE 0.5.0", count: comparison.counts.renderedNodes.candidate },
  { metric: "Directed links", product: "Obsidian 1.13.4", count: comparison.counts.directedEdges.reference },
  { metric: "Directed links", product: "TSUZUNE 0.5.0", count: comparison.counts.directedEdges.candidate },
  { metric: "Undirected pairs", product: "Obsidian 1.13.4", count: comparison.counts.undirectedPairs.reference },
  { metric: "Undirected pairs", product: "TSUZUNE 0.5.0", count: comparison.counts.undirectedPairs.candidate },
];

const comparisonRows = [
  {
    order: 1,
    item: "Markdown files",
    reference: "7",
    candidate: "7",
    status: "matched",
    evidence: "同一fixtureの全Markdownを双方が認識",
  },
  {
    order: 2,
    item: "Existing Markdown directed links",
    reference: "11",
    candidate: "11",
    status: "matched",
    evidence: "既存Markdown間のWikiリンク集合は完全一致",
  },
  {
    order: 3,
    item: "Rendered nodes",
    reference: "8",
    candidate: "6",
    status: "different",
    evidence: "孤立ノートと未解決ノートが本番0.5.0にない",
  },
  {
    order: 4,
    item: "Directed links",
    reference: "12",
    candidate: "11",
    status: "different",
    evidence: "00_Home.md → Missing Note が本番0.5.0にない",
  },
  {
    order: 5,
    item: "Undirected pairs",
    reference: "8",
    candidate: "7",
    status: "different",
    evidence: "未解決リンクのpairが本番0.5.0にない",
  },
  {
    order: 6,
    item: "Orphan default",
    reference: "showOrphans=true",
    candidate: "includeOrphans=false",
    status: "different",
    evidence: "90_orphan/Orphan.mdが非表示",
  },
  {
    order: 7,
    item: "Unresolved Wiki links",
    reference: "hideUnresolved=false",
    candidate: "未表示",
    status: "missing",
    evidence: "Missing Noteノードとedgeが欠落",
  },
  {
    order: 8,
    item: "Graph settings surface",
    reference: "右上の浮動設定パネル",
    candidate: "inline controls",
    status: "missing",
    evidence: "Filter／Groups／Display／Forces相当が本番0.5.0にない",
  },
  {
    order: 9,
    item: "Node and edge presentation",
    reference: "円形・Force配置・矢印なし",
    candidate: "pill・規則配置・矢印あり",
    status: "different",
    evidence: "視覚および操作のparityは未成立",
  },
];

const sqlLiteral = (value) => {
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};

const valuesSql = (columns, rows) => {
  const values = rows
    .map((row) => `(${columns.map((column) => sqlLiteral(row[column])).join(", ")})`)
    .join(",\n  ");
  return `SELECT *\nFROM (VALUES\n  ${values}\n) AS snapshot(${columns.join(", ")})`;
};

const summaryRows = [
  {
    matchedExistingLinks: comparison.counts.commonMarkdownDirectedEdges.candidate,
    missingNodes: comparison.counts.renderedNodes.reference - comparison.counts.renderedNodes.candidate,
    missingEdges: comparison.counts.directedEdges.reference - comparison.counts.directedEdges.candidate,
  },
];

const evidencePath = "docs/reports/assets/graph-gp6/comparison.json";
const sourceDefinitions = [
  {
    id: "gp6_comparison",
    label: "GP6 installed-production comparison",
    path: evidencePath,
  },
  {
    id: "gp6_summary_snapshot",
    label: "GP6 reviewed summary snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(["matchedExistingLinks", "missingNodes", "missingEdges"], summaryRows),
      description: "Materializes the reviewed summary values from comparison.json.",
      executed_at: generatedAt,
      tables_used: [],
    },
  },
  {
    id: "gp6_count_snapshot",
    label: "GP6 reviewed count snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(["metric", "product", "count"], graphCounts),
      description: "Materializes the eight reviewed product-count rows from comparison.json.",
      executed_at: generatedAt,
      tables_used: [],
    },
  },
  {
    id: "gp6_behavior_snapshot",
    label: "GP6 reviewed behavior snapshot",
    path: evidencePath,
    query: {
      engine: "snapshot-sql",
      sql: valuesSql(["order", "item", "reference", "candidate", "status", "evidence"], comparisonRows),
      description: "Materializes the reviewed behavior comparison rows from comparison.json.",
      executed_at: generatedAt,
      tables_used: [],
    },
  },
  {
    id: "obsidian_gp6",
    label: "Obsidian 1.13.4 baseline observation",
    path: "docs/reports/assets/graph-gp6/obsidian-1.13.4/01-global-baseline.observation.json",
  },
  {
    id: "tsuzune_gp6",
    label: "TSUZUNE 0.5.0 baseline observation",
    path: "docs/reports/assets/graph-gp6/tsuzune-0.5.0/01-global-baseline.observation.json",
  },
];
const manifestSources = sourceDefinitions.map(({ id, label, path }) => ({ id, label, path }));

const screenshotHtml = `
<style>
  .gp6-shot-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .gp6-shot { margin: 0; padding: 12px; border: 1px solid #d8d6cf; border-radius: 12px; background: #fbfaf7; }
  .gp6-shot img { width: 100%; height: auto; display: block; border: 1px solid #c8c5bb; border-radius: 6px; }
  .gp6-shot figcaption { margin-top: 8px; color: #3d3b36; font: 600 13px/1.45 system-ui, sans-serif; }
  @media (max-width: 860px) { .gp6-shot-grid { grid-template-columns: 1fr; } }
</style>
<div class="gp6-shot-grid">
  <figure class="gp6-shot">
    <img alt="Obsidian 1.13.4 Global Graph baseline" src="data:image/png;base64,${readFileSync(obsidianScreenshotPath).toString("base64")}">
    <figcaption>Obsidian Desktop 1.13.4 — 8 nodes / 12 directed links</figcaption>
  </figure>
  <figure class="gp6-shot">
    <img alt="Installed TSUZUNE 0.5.0 Global Graph baseline" src="data:image/png;base64,${readFileSync(tsuzuneScreenshotPath).toString("base64")}">
    <figcaption>Installed TSUZUNE 0.5.0 — 6 nodes / 11 directed links</figcaption>
  </figure>
</div>`;

const artifact = {
  surface: "report",
  manifest: {
    version: 1,
    surface: "report",
    title,
    description: "Obsidian Desktop 1.13.4とインストール済みTSUZUNE 0.5.0の固定GP6 Global Graph比較。",
    generatedAt,
    cards: [
      {
        id: "matched_core",
        description: "既存Markdown間で集合一致した有向Wikiリンク数。",
        dataset: "summary",
        sourceId: "gp6_summary_snapshot",
        metrics: [{ label: "一致した既存リンク", field: "matchedExistingLinks", format: "number" }],
      },
      {
        id: "missing_objects",
        description: "本番0.5.0の既定画面で公式より少ないグラフ要素。",
        dataset: "summary",
        sourceId: "gp6_summary_snapshot",
        metrics: [
          { label: "不足node", field: "missingNodes", format: "number" },
          { label: "不足edge", field: "missingEdges", format: "number" },
        ],
      },
    ],
    charts: [
      {
        id: "graph_object_counts",
        title: "GP6 Global Graph object counts",
        subtitle: "同一fixture・1265×768・DPR 1・light theme。値は表示件数。",
        question: "配布済みTSUZUNE 0.5.0の既定Global Graphは、公式Obsidian 1.13.4と同じ要素集合を表示するか。",
        rationale: "4種類の離散件数を2製品で比較するため、ゼロ始点のgrouped barを使う。",
        intent: "comparison",
        type: "bar",
        dataset: "graph_counts",
        sourceId: "gp6_count_snapshot",
        encodings: {
          x: { field: "metric", type: "ordinal", label: "Object type" },
          y: { field: "count", type: "quantitative", label: "Count", format: "number" },
          color: { field: "product", type: "nominal", label: "Product" },
        },
        yAxisTitle: "Count",
        valueFormat: "number",
        layout: "full",
        palette: { kind: "categorical", name: "two-product-comparison" },
        legend: { position: "bottom", sort: "spec" },
        labels: { values: "all" },
        settings: { groupMode: "grouped", showValues: true, sort: "none" },
      },
    ],
    tables: [
      {
        id: "behavior_comparison",
        title: "公開挙動の固定比較",
        subtitle: "matchedは集合一致、differentは値・既定値の差、missingは本番0.5.0に相当挙動がないことを示す。",
        dataset: "comparison_rows",
        sourceId: "gp6_behavior_snapshot",
        defaultSort: { field: "order", direction: "asc" },
        density: "dense",
        layout: "full",
        columns: [
          { field: "order", label: "#", format: "number" },
          { field: "item", label: "項目", type: "text" },
          { field: "reference", label: "Obsidian 1.13.4", type: "text" },
          { field: "candidate", label: "TSUZUNE 0.5.0", type: "text" },
          { field: "status", label: "判定", type: "text" },
        ],
      },
    ],
    sources: manifestSources,
    blocks: [
      { id: "title", type: "markdown", body: `# ${title}` },
      {
        id: "technical_summary",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: "## Technical summary\n\n**判定は `NOT MATCHED`。** ただし既存Markdown間の有向Wikiリンク11本は完全一致した。差は本番0.5.0の既定表示から孤立ノート、未解決ノート、その未解決edgeが欠落すること、および旧Graph UI／描画方式に限定して観測できる。",
      },
      {
        id: "key_findings",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: "## Key findings\n\n- Markdown認識は7対7で一致。\n- 既存Markdown間リンクは11対11で集合完全一致。リンク解析のこの部分は変更対象にしない。\n- 公式だけに`90_orphan/Orphan.md`と`Missing Note`があり、公式だけに`00_Home.md → Missing Note`がある。\n- 配布済み0.5.0は現行working treeより古い。0.5.0の差をそのまま再実装せず、次に現行sourceを隔離captureする。",
      },
      { id: "metrics", type: "metric-strip", cardIds: ["matched_core", "missing_objects"] },
      { id: "counts_chart", type: "chart", chartId: "graph_object_counts", layout: "full" },
      { id: "comparison_table", type: "table", tableId: "behavior_comparison", layout: "full" },
      {
        id: "visual_evidence_heading",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: "## Visual evidence\n\n同じfixture、viewport、DPR、light themeで採取した原寸スクリーンショット。公式は円形ノードとForce由来の不規則配置、本番0.5.0はpillノードと規則配置になっている。",
      },
      { id: "visual_evidence", type: "html", body: screenshotHtml },
      {
        id: "scope_definitions",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: "## Scope, data, and metric definitions\n\n対象はGlobal Graphの既定frameだけ。固定fixtureは`fixtures/obsidian-graph-parity-vault`、viewportは1265×768、DPR 1、light theme。`directed links`はWikiリンクの向きを保持したedge数、`undirected pairs`は相互リンクを1組へ正規化した接続数、`rendered nodes`は実際のGraph rendererに存在したnode数である。",
      },
      {
        id: "methodology",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: `## Methodology\n\n公式Obsidian 1.13.4（asar SHA ${comparison.reference.asarSha256}）とインストール済みTSUZUNE 0.5.0（app.asar SHA ${comparison.candidate.asarSha256}）を別の隔離profile／Vaultで起動し、同一fixtureと表示条件でDOM・renderer・設定・PNGを採取した。採取前後のfixture、隔離Vault、本番通常profileをSHA-256で比較し、不変を確認した。`,
      },
      {
        id: "limitations",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: "## Limitations and robustness\n\nこのsliceで比較したのは既定Global Graphの静止frameだけ。node drag、camera、context menu、Groups、Animate、Restore defaults、再起動後の保存境界は未比較。さらに対象の本番0.5.0は現行dirty working treeより古いため、この結果は現行sourceの欠陥一覧ではない。Local Graphの可変depth撤廃は今回のGlobal Graph比較には該当しない唯一の意図的例外として維持する。",
      },
      {
        id: "next_steps",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: "## Recommended next step\n\n`GP6-0W`として現在のworking treeを隔離buildし、同じcaptureを実行する。最初の停止条件は **8 nodes / 12 directed links / 8 undirected pairs** の確認と、現行sourceに残る最初の公開差を1件だけ特定すること。製品挙動の変更はその後に行う。",
      },
      {
        id: "further_questions",
        type: "markdown",
        sourceId: "gp6_comparison",
        body: "## Further questions\n\n- 現行working treeは公式と同じnode／edge集合を既定表示するか。\n- Force、drag、camera、設定値と保存境界のうち、最初に残る公開差は何か。\n- 大規模Vaultで計測上の問題が出るか。出ない限りWebGL、独自DB、固定表示上限は導入しない。",
      },
    ],
  },
  snapshot: {
    version: 1,
    generatedAt,
    status: "ready",
    datasets: {
      summary: summaryRows,
      graph_counts: graphCounts,
      comparison_rows: comparisonRows,
    },
    accessIssues: [],
  },
  sources: sourceDefinitions,
  package_info: {
    root: ".",
    manifestPath: "docs/reports/graph-gp6-production-comparison-2026-08-02.artifact.json",
    snapshotPath: "docs/reports/graph-gp6-production-comparison-2026-08-02.artifact.json",
  },
};

if (obsidian.renderer?.nodeCount !== comparison.counts.renderedNodes.reference) {
  throw new Error("Obsidian node count does not match comparison.json.");
}
if (tsuzune.summary?.renderedNodeCount !== comparison.counts.renderedNodes.candidate) {
  throw new Error("TSUZUNE node count does not match comparison.json.");
}

writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(outputPath);
