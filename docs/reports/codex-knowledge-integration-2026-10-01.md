# Codex知識連携 — 実装・実利用検証と配布境界（2026-10-01）

4つの読取ツールを実装し、gpt-6.1-sol / highを指定した隔離Codexで、検索・比較・Bases・2段Graph・保存・別実行からの再開の6シナリオを受入した。実行backendのモデル名はJSONから観測できず、指定値と区別する。本番更新の結果は[最新receipt](production-update-latest.json)と最終Vault記録を正本とする。本資料は更新gate前に確定し、receiptなしに本番完了を主張しない。

## 実装

- `build_context_set`: 同じsnapshotで1〜8起点を解決し、本文を重複させず起点へ公平に予算配分。取得不能ならbundleを返さない。既存の節選択・時点判定・関連選定を再利用し、source revision、取得範囲、起点別状態由来、節・本文の省略を明示。旧build_context契約は維持。
- `list_bases`／`query_base`: 保存済み表ビューを既存解析・評価器で評価。条件／複数sort／式／limit／グループ／集計後にページング。Vault別型設定と日時オフセット、明示this文脈を使用する。HTML等はデータだけ返す。実Node Workerは3秒・取消・異常で終了。cursorはVault、revision、作成時刻、型設定、条件、文脈、評価時刻へ束縛。巨大セルと整形JSONを制限し、省略を返す。
- `get_local_graph`: Wiki／Markdown共通リンクの深さ1〜3探索。距離・パス順で上限を適用し、存在する可視ノートへの辺だけ返す。見出し消失とノート参照を分け、AI推測・未リンク言及を辺へ追加しない。
- 共通23／direct25、14read／11write。Freebuffも同じ追加読取を持つ。新読取のtext blockとstructuredContentは同値。書込み権限・承認設定は変更していない。
- サーバー／tool案内を検索→必要本文、比較→複数本文、表→Bases、関係→Graph、根拠本文の確認、既存revision更新と再取得へ整理した。自動更新は未依頼本文・BOM・改行も保全するよう案内した。
- MCP buildにWorkerを同梱。check:mcpは登録済みartifactのhash・mtimeを変えず隔離buildを検査。packaged検査は隔離GUI起動と、exe隣のasarから取り出したserver／Workerの実Node連携検査を分けて報告する。

利用契約は[mcp-integration.md](../mcp-integration.md#複数本文basesgraphの読取契約)、作業契約は[plan.md](../../.agent/requirements/20261001-codex-knowledge-integration/plan.md)。

## 自動検証

| 層 | 最終確認 |
|---|---|
| 配布対象source | exact production archive＋今回分のtypecheck PASS、1,734 PASS／1 SKIP。isolated-tests-resumed.log |
| 元checkout | typecheck PASS、1,740 PASS／1 SKIP。current-tests-resumed-2.log。並行した画面変更11pathは配布対象から除外 |
| MCP transport | check:mcp PASS、共通23／direct25。全新読取の正常・異常でVault／設定bytes・mtime不変、登録済みartifact不変、text／structured同値 |
| Context・Bases・Graph | 複数起点・別名・取得不能・予算・同名見出し省略・時点・状態由来、型／日時／巨大セル／cursor変更／集計、実Worker停止と復帰、方向／循環／上限／Markdownリンク／除外 |
| 保存・再接続 | 合成fixtureで既存revision更新、競合拒否、BOM／CRLF／コメント／保持欄保全、別client fetch |
| 独立review | 同名見出しの後半省略と作成時刻だけのcursor変更を再現・修正し、元の入力を再検査 |

現treeの先行runは17件のapp.safety失敗、所有外3行の末尾空白で失敗した。その後の現tree回帰と差分検査は合格。今回の修正による解消とは主張せず途中失敗ログを保持する。隔離MCP検査の初回は未buildのENOENTで失敗し、build後は合格した。最初のproduction gateはpackaged検査のWindows asarパス区切りの誤りでインストール前に停止した。梱包にはserver／Workerが存在し、検査側を標準path.joinへ修正した。既存パッケージの隔離GUI起動と抽出MCP／実Worker・保存／再接続は修正後PASS（packaged-corrected-2.log）。誤った相対copyで未修正版を再実行した試行も保存し、修正を同期後に再検査した。配布sourceを再確定しproduction gate全体を再実行する。

## 実際のCodexによる受入

同一fixture・自然文・既存カタログ承認を使い、通常config／rulesを読まない6つの独立ephemeral実行を行った。依頼文にtool名・回答本文を入れず、Vaultの読書きはfixture MCPのみ。approve-for-meの自動レビューを使い、承認bypassと代替モデルは使っていない。通常設定・認証は変更していない。

| シナリオ | 旧版 | 新版で確認した内容 |
|---|---|---|
| 以前の判断と理由 | PASS | 判断日・採用理由・見送り案・未測定を本文／見出し／短い引用へ対応付けた |
| 3件比較 | PASS | 1回の複数本文取得で3起点の全文・revisionへ到達。採用と実装完了を区別 |
| Base指定ビュー | 能力不足 | C→Aの2行だけが対象。行順・本文revision・省略0件を照合。関連本文と別ビューの行を混同しない |
| 周囲2段と別分野 | PASS（手動探索） | 6ノード／5辺を取得し全6本文を読んだ。実リンクと未検証の解釈を分離 |
| 指定ノートへ保存 | PASS | matching revisionの既存自動更新1回と再取得。出典、BOM／CRLF／コメント／保持欄を保全 |
| 別実行から続き | PASS | 別threadで保存結果と原文を取得し、新提案を保存済み事実から分離。書込みなし |

完成版のMCP呼出し数は順に4／2／6／11／9／3。Baseの過度に限定した検索語は短く言い換えて解決した。Graphではfixtureにない運用資料を探す余分な検索、保存ではSkillによるbacklink確認が残る。新版は同一本文・revisionを更新なしに再fetchしていない。検索エンジンの欠陥は再現しておらず変更しない。一対の合成試行から速度・費用・日常全般の効果を一般化しない。

証拠はwork/codex-integration/actual-codex-acceptance.json、新版final-hHSceR/、旧版baseline-ngTzOM/のJSONL・回答・保存bytes。旧版保存はpatch後に追加の整形更新を行ったが、取得時のBOM／CRLF／保持欄は維持されている。

初回モデル非対応、read-only／neverでの保存拒否、カタログを揃えてもruntime承認で止まった試行、自動レビューとsandbox flag併用の起動失敗を別directoryへ保持した。exit0やtool単体PASSだけを自然文受入とせず、回答・MCP本文・保存結果を親が照合した。自動レビューの動作は[公式資料](https://learn.chatgpt.com/docs/sandboxing/auto-review)を参照。

## 本番sourceと完了判定

基準はverified receipt 2026-09-30T18:20:41.771Zのexact archive work/production-source-hC5Emb。開始時checkoutとの差分0件を確認した。後発のペイン・タブ等の画面変更11pathは保持し、今回の昇格対象に含めない。

配布元はwork/codex-integration/source-isolated。既存archiveへ今回所有のcode・文書だけを重ね、非所有bytes不変と今回分の一致をisolated-delivery-audit.jsonで確認した。独立Git rootだがGit公開は行わない。production:updateのMCP登録はこの安定した配布元を参照する。元checkout全体は追加変更を持つため、配布元と一致したとは扱わない。

計画・状態・本資料を確定してから配布元でproduction:updateを実行する。成否、source fingerprint／archive、packaged／installed smoke、exe／asar一致、通常profile不変、登録は最新receiptへ保存する。新登録から起動したprocessのruntime／deliveryと最終Vault同期は最終実施記録へ保存する。Desktopは再起動するまで旧19tool接続を保持し得るため、新processの確認をDesktop再接続と混同しない。

同じcampaignの実施記録を最終境界で更新し、影響MOCだけを各1回同期する。本番Vaultは試験に使わない。利用者の日常操作確認、ChatGPT接続、Obsidian全体との優劣は未確認であり、この受入から推定しない。
