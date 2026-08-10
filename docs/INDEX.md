# TSUZUNE Documentation Index

更新日: 2026-08-10

## まず読む

- [現在地](../PROJECT_STATUS.md) — 本番、working tree、検証済み範囲、次の一手。
- [README](../README.md) — 利用方法と実装済み機能。
- [Product Definition](../PRODUCT.md) — 製品目的、原則、非目標。
- [Design System](../DESIGN.md) — UI、ブランド、アクセシビリティ。
- [Working Agreement](../AGENTS.md) — 開発と本番dogfoodの運用規約。

## 現在の開発

- [Product Plan](../PLAN.md) — 現在の実行順、受入条件、保留Track、長期roadmap。
- [Obsidian Graph Parity Reference](obsidian-graph-parity-reference.md) — 固定比較対象と受入契約。
- [GP0-3b-n Attachment Default App Requirements](../.agent/requirements/20260810-1941-attachment-default-app/4_requirements.md) — 実外部アプリを起動せず、添付の既定アプリ要求を一項目だけ比較した設計、安全境界、停止条件。
- [MCP Integration](mcp-integration.md) — Codex／ChatGPTデスクトップ連携と書込境界。
- [Compact Context Requirements](../.agent/requirements/20260810-0440-query-aware-compact-context/4_requirements.md) — X1-M1 MOC Title Routerの実装契約と、未実装のquery選定・MCP二重搬送削減を分離して記録。
- [Templates and Freshness](templates-and-freshness.md) — Markdown雛形、placeholder、最終更新日、再確認表示の使い方。
- [Path Alias](path-aliases.md) — 分類移動後の旧Wikiリンク・MCP IDをcanonical pathへ安全に解決するsidecar契約。
- [O2-P2 Classification Migration Dry-run](reports/o2-p2-classification-migration-dry-run-2026-08-10.md) — 本番Vaultを変更せず、5 movesの参照・Graph・Context・fingerprintと適用blockerを固定した証拠。
- [ChatGPT Export Intake](chatgpt-export-intake.md) — 公式Exportの読み取り専用preview、正規化、個人データ境界。
- [Windows Production](windows-production.md) — build、installer、更新、受入手順。

## 現行の検証証拠

- [Latest production receipt](reports/production-update-latest.json) — インストール済み本番の機械可読な固定点。
- [O2-P2 Classification Migration Dry-run](reports/o2-p2-classification-migration-dry-run-2026-08-10.md) — 同一manifestを2回得て、Vault write／物理move／Markdown write／Drive操作が0件だったread-only移行検査。
- [GP6 production comparison](reports/graph-gp6-production-comparison-2026-08-02.html) — 配布済み0.5.0とObsidian固定版の比較。
- [GP6 working-tree manifest](reports/assets/graph-gp6/tsuzune-working-tree/manifest.json) — `5c0f4bb3`へ収録された、GP6-0W採取時working treeの構造証拠。
- [GP7 Global settings default](reports/graph-gp7-global-settings-default-2026-08-03.html) — 固定fixtureでGlobal Graph初回設定パネル表示を一致させた狭い比較。
- [GP0 Global search persistence](reports/graph-gp0-search-persistence-2026-08-03.html) — `path:"10_projects"`の入力、Graph再表示、アプリ再起動後保持をObsidian 1.13.4と比較した狭い一致証拠。
- [GP0 search comparison JSON](reports/assets/graph-gp0-search-persistence/comparison.json) — 3観測点、2 node／1 unique visible edge、未証明範囲を固定した機械可読比較。
- [GP0 Global camera persistence](reports/graph-gp0-camera-persistence-2026-08-03.html) — 制御された論理wheel／背景drag後、Graph再表示、アプリ再起動までのzoom保持／pan中央復帰を比較した6/6一致証拠。
- [GP0 camera comparison JSON](reports/assets/graph-gp0-camera-persistence/comparison.json) — 固定条件、正規化、4観測点、safeguard、未証明範囲を固定した機械可読比較。
- [GP0-3b-d Global node drag persistence](reports/graph-gp0-node-drag-persistence-2026-08-04.html) — 押下中の一時固定、pointerup後のForce復帰、Graph再表示／アプリ再起動への座標・pin非永続化を比較した5/5一致証拠。
- [GP0-3b-d node drag comparison JSON](reports/assets/graph-gp0-node-drag-persistence/comparison.json) — 8 node固定fixture、drag lifecycle、safeguard、未証明範囲を固定した機械可読比較。
- [GP0-3b-e Global node context menu](reports/graph-gp0-node-context-menu-2026-08-09.html) — Obsidian 1.13.4の11操作とTSUZUNEの2操作を固定比較し、3/6一致の`different`を示す画面証拠。
- [GP0-3b-e node context menu comparison JSON](reports/assets/graph-gp0-node-context-menu/comparison.json) — 項目、順序、無効状態、今回の一項目修正、未証明範囲を固定した機械可読比較。
- [GP0-3b-f Global node new tab](reports/graph-gp0-node-new-tab-2026-08-09.html) — `新規タブに開く`のnote実動作をObsidian 1.13.4と比較し、TSUZUNEのattachment内部previewも固定した画面証拠。
- [GP0-3b-f node new tab comparison JSON](reports/assets/graph-gp0-node-new-tab/comparison.json) — note作成・active化は一致、Graph workspace leaf保持は差分、attachmentの参照版境界は未証明とした機械可読比較。
- [GP0-3b-g Global Graph workspace tab](reports/graph-gp0-workspace-tab-2026-08-09.html) — note新規tab後も元Global Graphを保持し、TSUZUNEでGraph tabへ戻れることを固定した画面証拠。
- [GP0-3b-g workspace tab comparison JSON](reports/assets/graph-gp0-workspace-tab/comparison.json) — ObsidianのGraph leaf保持とTSUZUNEのGraph tab保持を`matched`とした機械可読比較。
- [GP0-3b-h attachment new tab](reports/graph-gp0-attachment-new-tab-2026-08-09.html) — attachment nodeを新しい内部preview tabへ開き、元Global Graph tabを保持・復帰できることを両製品で固定した画面証拠。
- [GP0-3b-h attachment new tab comparison JSON](reports/assets/graph-gp0-attachment-new-tab/comparison.json) — 対象動作を`matched`とし、添付context menu 11対2の残差をslice外の既知差として残した機械可読比較。
- [GP0-3b-i attachment new window](reports/graph-gp0-attachment-new-window-2026-08-09.html) — attachment nodeを独立した内部画像windowへ開き、元Global Graphを保持する公開動作を両製品で固定した画面証拠。
- [GP0-3b-i attachment new window comparison JSON](reports/assets/graph-gp0-attachment-new-window/comparison.json) — 対象動作を`matched`とし、独立windowの視覚shellと添付context menu全体を既知差として残した機械可読比較。
- [GP0-3b-j attachment file move](reports/graph-gp0-attachment-file-move-2026-08-09.html) — 取消、通常移動、同名衝突、自動採番、リンク非書換え、旧未解決／新実在node、再表示／再起動保持を両製品で固定した画面証拠。
- [GP0-3b-j attachment file move comparison JSON](reports/assets/graph-gp0-attachment-file-move/comparison.json) — 中核動作を`matched-core-behavior`とし、typeahead対select/buttonとmenu 11対4を既知UI差として残した機械可読比較。
- [GP0-3b-k attachment bookmark](reports/graph-gp0-attachment-bookmark-2026-08-09.html) — 作成、取消、同一path再編集upsert、`ctime`保持、Graph再表示／別プロセス再起動保持、Vault内容不変を両製品で固定した画面証拠。
- [GP0-3b-k attachment bookmark comparison JSON](reports/assets/graph-gp0-attachment-bookmark/comparison.json) — 中核動作を`matched-core-behavior`とし、group selector対plain text input、menu 11対5、Bookmarks side panel未証明を残した機械可読比較。
- [GP0-3b-l attachment path copy](reports/graph-gp0-attachment-path-copy-2026-08-09.html) — URL、Vault相対path、system絶対pathの3形式、menu lifecycle、Graph検索条件・node集合・Vault内容の再表示／別プロセス再起動までの保持を両製品で固定した画面証拠。
- [GP0-3b-l attachment path-copy comparison JSON](reports/assets/graph-gp0-attachment-path-copy/comparison.json) — 中核動作を`matched-core-behavior`とし、system root差、submenu geometry差、interceptしたclipboard、menu 11対6を境界として残した機械可読比較。
- [GP0-3b-m attachment linked view](reports/graph-gp0-attachment-linked-view-2026-08-10.html) — `リンクされたビューを開く`から対象添付のバックリンクビューを追加し、元Global Graphを保持する公開動作を両製品で固定した画面証拠。
- [GP0-3b-m attachment linked-view comparison JSON](reports/assets/graph-gp0-attachment-linked-view/comparison.json) — 中核動作を`matched-core-behavior`とし、分割pane／視覚shell未証明とmenu 11対7を境界として残した機械可読比較。
- [GP0-3b-n attachment default app](reports/graph-gp0-attachment-default-app-2026-08-10.html) — 外部アプリを起動せず、同じfixture fileへのopen要求1回、menu close、Graph／Vault保持を固定した画面証拠。
- [GP0-3b-n attachment default-app comparison JSON](reports/assets/graph-gp0-attachment-default-app/comparison.json) — 中核動作を`matched-core-behavior`とし、API seam差、Obsidian再起動未観測、実OS既定app未証明、menu 11対8を境界として残した機械可読比較。
- [Large Vault performance](reports/tsuzune-large-vault-performance-2026-08-03.html) — 500件／2000件baseline。
- [Large Vault public summary](reports/assets/large-vault-performance-2026-08-03/summary-public.json) — 性能値の耐久する機械可読版。
- [Product optimization](reports/tsuzune-product-optimization-2026-08-03.html) — GUI、icon、画像preview、watcher、更新gate。
- [Graph edge viewport](reports/graph-edge-viewport-2026-08-03.html) — 低倍率Canvas線描画の修正証拠。
- [Temporal M5 dogfood](m5-dogfood.md) — 時点付きContextの固定比較。
- [TSUZUNEあり／なし benchmark](reports/tsuzune-with-without-benchmark-2026-08-09.md) — 固定課題の品質差と本番VaultのContext構築コストを分離した比較。
- [TSUZUNE benchmark public summary](reports/assets/tsuzune-with-without-benchmark-2026-08-09/summary-public.json) — 本文を含まない機械可読集計。
- [ChatGPT Candidate Quality C1-B](reports/chatgpt-candidate-quality-c1b-2026-08-09.md) — 57件の層化review、出典追跡、3 ruleの自動適用精度gate。
- [ChatGPT Candidate Eligibility C1-C](reports/chatgpt-candidate-eligibility-c1c-2026-08-09.md) — 候補適格性、本文由来privacy、固定57件回帰、7件再review、10件gate未達の停止判断。

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
- ChatGPT export取込: C1-Cの安全回帰は完了。rule別reviewが10件未満のためC1-D自動適用は停止中。
- Context Compiler 2.0、AI時間モデル、GraphRAG、Plugin API、独自DB: 固定評価または計測で導入条件を満たしてから着手。

## 証拠の保管規則

- 最新本番は`production-update-latest.json`、過去比較は日付付きreport／artifactへ分離する。
- `work/`は再生成可能なローカル計測領域とし、文書からの耐久リンクは`docs/reports/`配下へ向ける。
- fixture、raw observation、画像、比較表は同じdelivery sliceの一組として扱う。
- 日付付きEvidenceを現在値へ書き換えず、新しいEvidenceまたはrolling indexから参照する。
