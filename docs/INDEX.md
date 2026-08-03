# TSUZUNE Documentation Index

更新日: 2026-08-03

## まず読む

- [現在地](../PROJECT_STATUS.md) — 本番、working tree、検証済み範囲、次の一手。
- [README](../README.md) — 利用方法と実装済み機能。
- [Product Definition](../PRODUCT.md) — 製品目的、原則、非目標。
- [Design System](../DESIGN.md) — UI、ブランド、アクセシビリティ。
- [Working Agreement](../AGENTS.md) — 開発と本番dogfoodの運用規約。

## 現在の開発

- [Product Plan](../PLAN.md) — 長期計画、完了履歴、Active v0.6 Track。
- [Obsidian Graph Parity Reference](obsidian-graph-parity-reference.md) — 固定比較対象と受入契約。
- [MCP Integration](mcp-integration.md) — Codex／ChatGPTデスクトップ連携と書込境界。
- [Windows Production](windows-production.md) — build、installer、更新、受入手順。

## 現行の検証証拠

- [Latest production receipt](reports/production-update-latest.json) — インストール済み本番の機械可読な固定点。
- [GP6 production comparison](reports/graph-gp6-production-comparison-2026-08-02.html) — 配布済み0.5.0とObsidian固定版の比較。
- [GP6 working-tree manifest](reports/assets/graph-gp6/tsuzune-working-tree/manifest.json) — 現在のworking treeによる構造採取。
- [GP7 Global settings default](reports/graph-gp7-global-settings-default-2026-08-03.html) — 固定fixtureでGlobal Graph初回設定パネル表示を一致させた狭い比較。
- [Large Vault performance](reports/tsuzune-large-vault-performance-2026-08-03.html) — 500件／2000件baseline。
- [Large Vault public summary](reports/assets/large-vault-performance-2026-08-03/summary-public.json) — 性能値の耐久する機械可読版。
- [Product optimization](reports/tsuzune-product-optimization-2026-08-03.html) — GUI、icon、画像preview、watcher、更新gate。
- [Graph edge viewport](reports/graph-edge-viewport-2026-08-03.html) — 低倍率Canvas線描画の修正証拠。
- [Temporal M5 dogfood](m5-dogfood.md) — 時点付きContextの固定比較。

HTMLは閲覧用、`.artifact.json`と`assets/**/*.json`は機械可読な証拠、`assets/**/*.png`は画面証拠です。役割が異なるため、同名内容に見えても一括削除しません。

## 歴史資料

- [v0.1 Scope](v0.1-scope.md) — 初期MVPの凍結記録。現行仕様ではない。
- `reports/graph-explorer-p0-2-*`
- `reports/graph-explorer-p0-3-*`
- [Graph Explorer P0-4](reports/graph-explorer-p0-4-2026-08-01.html)
- [Graph Explorer GP1](reports/graph-explorer-gp1-2026-08-02.html)
- [Graph Explorer GP2-2](reports/graph-explorer-gp2-2-2026-08-02.html)

これらは当時の完了条件と退行確認に使う履歴です。現在のGraph仕様はParity Referenceと`PLAN.md`のActive Trackを優先します。`graph-explorer-gp1-2026-08-02.html`はファイル名と内部見出しが一致していない既知の資料上の問題があり、内容を改変せず履歴として残しています。

## 将来計画

- Google Tasks、Drive選択取込、YouTube、Data Portability: `PLAN.md`のPersonal Google Intake。
- ChatGPT export取込: `PLAN.md`のFuture Track。
- Context Compiler 2.0、AI時間モデル、GraphRAG、Plugin API、独自DB: 固定評価または計測で導入条件を満たしてから着手。

## 証拠の保管規則

- 最新本番は`production-update-latest.json`、過去比較は日付付きreport／artifactへ分離する。
- `work/`は再生成可能なローカル計測領域とし、文書からの耐久リンクは`docs/reports/`配下へ向ける。
- fixture、raw observation、画像、比較表は同じdelivery sliceの一組として扱う。
- 日付付きEvidenceを現在値へ書き換えず、新しいEvidenceまたはrolling indexから参照する。
