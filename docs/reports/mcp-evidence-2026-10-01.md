# MCP原文・根拠到達の実装と受入境界

更新日: 2026-10-01（JST）。[利用者採用の実行契約](../../.agent/requirements/20261001-mcp-evidence/plan.md)。本資料は本番gate前に確定する。導入結果は[最新receipt](production-update-latest.json)、再接続と最終同期は同campaignのVault実施記録を正本とする。

## 変更内容

共通カタログへ`list_note_sections`と`fetch_note_section`を追加した。共通25／direct27、16読取／11書込。既存の書込・承認カタログは変更していない。

節一覧は既存の位置ID・slug・階層と親節を返す。節取得は期待revisionを必須とし、見出し行から次の同レベル以上の見出し直前までの原文を返す。先頭の前置き・見出しなし、ATX／Setext、日本語・重複見出しに対応。BOM・CRLF・空白・コメント・絵文字を保持し、ページ途中でサロゲート／CRLFを分断しない。cursorはVault・ノート・revision・節へ結び付ける。古いrevisionは本文を返さず一覧再取得を案内する。全文更新には既存`fetch`を使う。

`search`は旧整形済みtextを保持し、raw_excerpt・excerpt_kind・revision・原文参照を追加した。本文一致と先頭の代替抜粋を区別し、小文字化で長さが変わる文字も元のUTF-16位置へ対応付ける。抜粋は指定節内へ限定する。共通の検索順位・候補・フィルタは変更していない。

`build_context`／`build_context_set`は既存の見出し一覧・状態由来・時間判定・候補選定を維持し、収録ノートの節locatorを追加した。省略節も一覧・節取得へ接続する。Contextの整形本文に推測した引用範囲を付けず、原文locatorであることを明示する。新参照情報はMarkdownの文字予算へ含める。既存の状態由来等の制御情報は従来どおり別枠。巨大見出しの表示名を省略してもID・位置は保持し、参照省略件数を返す。

サーバー案内を検索→候補識別→必要本文→不足節→根拠提示へ整え、回答の引用に完全revision・節ID・原文範囲を添えるよう案内した。0件を知識全体の不存在と断定しない。画面の変更、Appを開く導線、新DB・検索エンジン・embedding・永続cache・別AI・Hook・書込権限拡張は追加していない。

## 自動検証

節単体・MCP実経路で階層、重複、見出しなし、BOM／CRLF／絵文字、原文範囲、巨大見出し、文字予算、ページ継続、古いrevision・Vault切替、除外・履歴・Vault外、検索のUnicode位置とtitle-only fallback、両Contextの最小予算と省略を検査した。保存・競合・別clientでの再開は既存の実MCP検査を回帰し、packaged／installedの同じsmokeへ新2ツールとstale拒否を接続した。

型検査、全1,744 PASS／1 SKIP、MCP契約・16読取／11書込・Unicode fetch・実Worker／保存／競合／別client再開・Freebuff・delivery／stale runtimeは合格。文書索引の位置修正後に全testを再実行して合格し、文書／workflowも合格。本資料を確定して本番gateへ進む。

新読取の正常・異常前後でVault／設定の内容とmtimeを確認する。実Codexの読取11件もfixture／設定のbytes・mtime不変を検査し、5番だけ指定ノートへの保存を許す。隔離`check:mcp`は実際の旧登録serverとWorker一式のhash・mtimeを監視し、テスト用bundleのbuildで登録済みartifactを変えない。

## 実Codexの固定比較

指定値は`gpt-6.1-sol`／`high`。backendの実モデルは`not_observable`。合成fixture、必須の隔離MCP、`--ephemeral --ignore-user-config --ignore-rules --json`で実行。既存の承認カタログと自動レビューを使い、通常設定・認証は変更せず、承認bypassは使っていない。依頼文へtool名や回答本文を埋め込まず、変更前後で同じ12依頼を使う。

| シナリオ | 変更前の原文到達 | 最終版 |
|---|---|---|
| 判断と理由、3件比較、Base指定ビュー、Graph2段 | 4件到達。本文・対象行・実辺を照合 | 4件受入。本文を読み、完全revision・節ID・範囲を提示 |
| 指定ノートへ保存、別実行で続き | 保存・保持欄・コメント・BOM／CRLFと再取得を確認 | 2件受入。保存・再取得・別実行再開と保全を確認 |
| 同名の技術／創作、SIF別名 | 対象を区別し採用理由へ到達。英語の正式名は不明 | 2件受入。主題を識別し、正式名の未確認を保持 |
| 長文末尾、重複する2番目の反対 | 全文取得で該当節へ到達 | 2件受入。後半節と2番目の反対を一意な節IDで取得 |
| 採用と撤回、該当なし | 9月29日の撤回と未確認を分け、検索範囲を限定 | 2件受入。現在保留と再採用条件、検索範囲と不足を区別 |

変更前12件は本文到達に成功した。Base名の余分な語、検索へのTSUZUNE接頭辞、不要な再取得は呼出し側の選択として観測したが、共通検索処理の失敗は再現していないため検索順位の修正は不要とした。今回の効果は節追加取得と再取得可能な根拠位置の契約であり、日常全般の検索成功、回答の正しさ、速度・costの改善まで保証しない。

途中試行は`final-auG5CI`（8件、継続未完了）、`final-IavqQk`（引用案内調整版。文字予算修正後に所有CLIだけ停止）として保持した。最終版`final-wVnWjM`は境界修正後の凍結bundleで全12件を再実行した。全回答・MCP呼出しを原文と照合し、検索／節取得のraw sliceを別検査した。1〜11は完全revision・節ID・原文範囲を含み、12は対象不在の検索範囲と未確認を示す。12に対象引用の位置があるとは扱わない。終了コードだけを受入にしていない。

Evidence（配布元のignored work内）: `work/codex-integration/baseline-6TfhCa/`、`work/codex-integration/final-wVnWjM/`。親checkoutの`work/mcp-evidence/actual-codex-source-audit.json`と`actual-codex-acceptance.json`へ原文照合・12件の受入を分離して記録した。JSONL、回答、stderr、保存後bytes、指定モデル・bundle hashを保持する。

## 利用者報告の入力・名前変更

本番利用者は、編集欄に行番号とtoolbarがあるがカーソルも英数字入力も出ず、別ウィンドウから戻ると入力できると確認した。確認popupは出ていないため、popup起因とは判定しない。元のフォーカス喪失症状は隔離環境で再現していない。

別の実処理不具合として、新規作成の遅延通知が既知の保存済みcontent／modifiedAtと同じでも編集中なら外部競合にして名前変更を止めることを、installed binary＋隔離fixtureで再現した。既知revisionと同じ通知を無視する最小変更を加えた。変更前に失敗する回帰testを追加し、既存の真の外部変更・本文保全検査を維持する。

main windowのfocus時にwebContentsの入力focusを戻す処理も加えた。isolated Electronでfocus handlerが1回呼ばれること、新規ノートのpointer入力と保存・名前変更で本文を保持することを確認した。これは元の実Windows症状の再現・解決証明ではない。更新後の利用者確認が必要であり、画面の見た目は変更しない。source検査は`work/edit-input-smoke/report.json`、旧installedでの不具合再現は`work/edit-input-smoke/installed-before.json`を参照する。

## 配布と残る確認

配布元は`work/mcp-evidence/source-isolated`。2026-10-01T02:49:43.656Zのverified receiptとexact archive `work/codex-integration/source-isolated/work/production-source-lTdCCM`を複製し、変更前1,717 files／digest `acdeb38117215fa4b601f7a0a62712d9c5ba55e2149aa9909bd3c8a726b23b42`の一致を確認した。今回の所有差分だけを追加し、元checkoutの並行変更を昇格しない。元checkoutへの同期は所有pathのbaseline一致を確認し、App.tsxだけは3-way merge後の追加・削除行が所有hunkと一致することを検査する。並行UI hunkは保持する。

文書確定後に`production:update`を実行し、隔離packaged／installed、exe・app.asar一致、通常profile不変、共通25件のMCP登録を確認する。本番アプリを強制終了しない。本番Vaultを試験に使わない。導入後の新processと現在のDesktop再接続、利用者の日常操作確認を分ける。再接続未確認なら追加2ツールを現在のチャットから使えるとは報告しない。ChatGPT接続・Obsidian全体との比較・Git公開は対象外。
