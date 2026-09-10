# TSUZUNE Project Status

更新日: 2026-09-10（JST）

この文書は、TSUZUNEの「今」を一枚で確認するための入口です。実行順と将来計画は[PLAN.md](PLAN.md)、製品の不変条件は[PRODUCT.md](PRODUCT.md)、画面・ブランド規約は[DESIGN.md](DESIGN.md)を正本とします。完了証拠は[docs/INDEX.md](docs/INDEX.md)から辿ります。

## 現在地

2026-09-10、Contextの読取境界をtool説明と既存利用案内へ反映した。質問の意味を全て収録するという保証を外し、抜粋不足・現在性不明・既読本文の再取得の扱いを明確にした。検索・本文・schema構造は変更していない。固定6ケースの最終実AI受入はPASSで、baselineもPASSのため一般的な行動改善は未確認。本番反映・fresh MCP・最終同期は対応receiptとVault実施記録で判定する。[実装・受入境界](docs/reports/context-reading-boundary-2026-09-10.md)。

2026-09-09、A6としてBaseを一覧・検索から選んで開く操作を実装した。左railとCtrl+Pの両入口、名前・folder検索、一覧更新、手入力を備え、保存失敗時は入力と選択を保持する。除外設定・Vault世代・junction差替えの拒否と、既存の読み取り専用表・path-only復元を検証した。本番反映は対応する最新receipt、隔離installedの操作とfresh MCP・最終同期はVault実施記録で確認する。[実装・受入境界](.agent/requirements/20260908-bases-design/implementation.md)。

2026-09-09、S2としてContext／MCPに本文の変換種別を追加した。通常本文・質問に合わせた節選択・MOC索引・本文省略を区別し、全文読取と取り違えないための判断材料を返す。本文、収録順、revision、既存の切断・省略情報は保持する。24ケースの実装前比較と全1,222 tests（1 SKIP）はPASS。本番反映・fresh MCP・最終Vault同期は対応receiptと実施記録で判定する。[実装証拠・完了条件](docs/reports/context-content-mode-2026-09-09.md)。画面の見た目は変わらない。

2026-09-09、起動時の欠落タブ通知に表示スタイルを適用し、「見つからないタブを前回の配置から外す」を追加した。通知だけ閉じる操作と、lastSessionの参照を明示的に外す操作を分け、ノート本文と名前付き配置を保持する。対象ノートは既存の受信箱整理で派生後trashされた記録があり、今回の修正では移動・復元しない。関連126 testsと隔離Electronの表示・再読込・保存保持検査はPASS。本番完了は対応する最新receiptとVault実施記録で判定する。[原因・検証・受入境界](docs/reports/missing-tab-notice-2026-09-09.md)。

2026-09-09、利用者の依頼により「AIとレビュー」の承認機能を撤去した。通常ノートの作成・更新・派生知識作成は、人間の承認待ちを挟まず検証後に直接保存する。取得時revision、原典保護、カテゴリ／topic検証、衝突防止は維持する。旧提案は自動適用せず、そのまま不活性に保持する。typecheck、全1,217 tests（1 SKIP）、MCP検査、限定reviewはPASS。本番反映は対応する最新receipt、最終Vault同期は実施記録で判定する。[変更・受入境界](docs/reports/ai-direct-write-2026-09-09.md)。

2026-09-09、S1の検索一致抜粋を実装した。自然文の最初の検索語が本文にそのまま存在しない時、候補選定に使った正の語の一致箇所を検索一覧とMCPへ返す。既存の一致抜粋・検索順位・候補・ノート本文は保持する。固定20ケースと全1,220 testsがPASS。本番反映は対応する最新receipt、隔離installedでの表示確認と最終同期はVault実施記録を参照する。[実装証拠・受入境界](docs/reports/search-matching-excerpts-2026-09-09.md)。画面構成は変えず、検索結果の抜粋内容を改善した。

2026-09-08、ワークフロー改善第1段階として`autonomous_update_note`の取得時revisionを必須化した。省略・空値・競合はno-opやReview提案より先に拒否する。既存の通常更新・同一本文・Review・原典保護を回帰検証し、現在地と承認済み範囲の案内を整合した。本番同一性と最終Vault同期は対応する最新receipt・Vault実施記録で判定し、この文書のsource記載だけで完了としない。[作業境界](PLAN.md#ワークフロー改善第1段階--2026-09-08)／[API契約](docs/mcp-integration.md)。画面の見た目は変更していない。

2026-09-08、利用者が選択したBasesの読み取り専用表を本番反映し、隔離installed受入を確認した。コマンドパレットの「Baseを開く」からVault相対の`.base`を指定し、対応profileの表、診断、再読込、ノート遷移を利用する。workspaceにはpathだけを保存し、除外設定と外部snapshot更新を反映する。その後のレビューで、Properties一覧への除外設定適用と、Basesの重複キーを不正値として診断する修正をsource実装・回帰テスト済み。修正版の本番同一性は最新receipt、隔離installed受入は最終Vault実施記録で確認する。[範囲・検証・制限](.agent/requirements/20260908-bases-design/plan.md)。

2026-09-06、本人はAIとの再利用まで既に行えていると報告した。未確認なのは必要なノートの根拠が回答に適切に反映されているか。[AI再利用の基盤レビュー](docs/reports/ai-reuse-foundation-review-2026-09-06.md)で取得・Context・利用観測の境界を確認した。次の実行状態はPLAN.mdへ集約し、今回のレビューでは画面・製品コードを変更していない。

2026-09-06、本人が現状評価を今後の方針として採用した。[PRODUCT.md](PRODUCT.md#adopted-direction--2026-09-06)に製品価値を定義し、現在のPrimary／Nextは[PLAN.md](PLAN.md#current-decision)に一本化した。当日の文書変更とdelivery判定は日付付き証拠であり、現在の本番判定は最新receiptで確認する。

Obsidian互換性はP0-7までの選択済み範囲を本番反映・隔離installed受入済み。2026-09-06にGitHub main統合と、レビューで選んだ保守へ進んだ。保守のsource証拠は[保守結果](docs/reports/review-maintenance-2026-09-06.md)、本番完了はそれに対応する最新receipt・Vault実施記録を参照する。

| 対象 | 現在の状態 | 正本 |
|---|---|---|
| インストール済み本番 | 最新のstatus、source fingerprint、packaged／installed hash、profile不変性、MCP再登録はmachine-readable receiptを唯一の正本とする。製品source変更後は、その変更を含む`production:update`のreceiptが`installed-and-verified`になるまでinstalled productionと同一視しない | [production-update-latest.json](docs/reports/production-update-latest.json) |
| Obsidian互換性Program | P0-1〜P0-7の選択済み範囲は2026-09-05本番反映・隔離installed受入済み。全文法・全面互換を証明したものではない。型・byte保持・profile差分などの個別境界は台帳と各受入記録を参照する。現在の優先順位はPLANが所有する | [互換性台帳](.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md) |
| 観測宙域／Life Weather | 終了。2026-09-06利用者判断で製品の専用機能を撤去。App安全性99 tests PASS。installed完了は撤去sourceに対応する最新receiptで判定。研究ノート・履歴・試作成果は保持する | [終了済み開発計画](.agent/requirements/20260903-0032-existence-phase-observatory-mvp/implementation-plan.md)／[receipt](docs/reports/production-update-latest.json) |
| 受信箱capture first slice | Command Paletteから現在のfolderや分類を問わず`01_受信箱`へcollision-safeな空メモを作成して開くsource実装を完了。このcapture操作自体には分類DB・Hook・background処理・履歴を追加していない。typecheck、全test、MCP check、独立reviewはPASS。本番反映は最新receiptのsource fingerprintがcurrent sourceと一致する時だけ成立する | [実装・検証packet](.agent/requirements/20260831-note-organization-video/packets/D5-D6-implementation-verification.md)／[receipt](docs/reports/production-update-latest.json) |
| Browser Clipper | Chrome／Edgeの明示操作でWeb／YouTubeを出典付きMarkdownとして`01_受信箱`へcreate-only保存するsource実装を完了。通常WebとYouTube字幕はクリップ時に文字数・64 KiBで切らず、10万文字超の原典はMCP `fetch` cursorでAIがrevisionを保ったまま分割読取できる。Mozilla Readability 0.6.0をローカル同梱し、YouTubeは可視文字起こし、パネル展開、現在動画IDと一致する字幕トラック、取得不能時のローカル`yt-dlp`の順に探す。`yt-dlp`は設定・Cookie・remote componentを読まず、一時字幕を変換後に削除する。固定拡張ID、6桁pairing、OS暗号化token、exact Origin／Host、一回8 MiBの入力上限、同時冪等性、衝突非上書きを維持し、広域host権限、cloud文字起こし、汎用履歴、新しい`50_履歴`は追加しない。installed一致は最新receipt、実ブラウザのtoolbar操作は利用者確認を別に判定する | [利用方法](docs/browser-clipper.md)／[強化packet](.agent/requirements/20260901-browser-clipper-existing-tech/plan.md)／[receipt](docs/reports/production-update-latest.json) |
| AI派生知識整理 | `create_derived_note`で概念単位に直接作成し、`propose_derived_note`も同じ直接作成を行う互換名とする。アプリ内の人間承認は廃止。原典revision、カテゴリ／topic、Wiki出典、concept key、衝突を検査し、派生時に原典を変更しない。未承認の重要判断は必要なら会話で確認する。受信箱日次整理・条件付き復元可能trashの権限はVaultの`30_知識/TSUZUNE-AI整理運用契約.md`を参照し、今回の承認画面撤去で操作範囲を増やさない | [現行APIと安全境界](docs/mcp-integration.md)／[receipt](docs/reports/production-update-latest.json) |
| Icon refresh | Interwoven Bellのapp／tray専用assetを本番反映済み。全626 tests、10/10 checks、build／installed hash一致、profile 57 files不変。タイトルバー、アプリ内ヘッダー、タスクバー、通知領域のinstalled実機目視もPASSし、slice完了 | [icon refresh](docs/reports/tsuzune-icon-refresh-2026-08-14.md) |
| 公開配布 | commit `6a51986`をtag `v0.6.0`としてLatest Releaseへ公開。installer、blockmap、`latest.yml`の匿名HTTP 200とdigest一致、本番10/10、installed 0.6.0、profile 58 files不変を確認。public feedのtoken必須gateは修正済み。未署名のSmartScreen警告と、隔離Windowsを要するv0.5.0→v0.6.0実更新受入は残る | [v0.6.0 release](docs/reports/v0.6.0-public-release-2026-08-26.md) |
| Graph直近slice | CP1-B-02で実在Markdownノートにも`フォルダで表示`を接続。公式production updateの全529 tests／10 checksを通して本番反映済み | [CP1-B-02](docs/reports/cp1-b-02-note-folder-reveal-2026-08-13.md) |
| 直近の性能評価 | 同じ起点3件でTSUZUNEなし／ありを比較。固定4問は1/4→4/4、出典追跡0/3→3/3。Context構築medianは0.021ms→149.685msで、絶対追加約150ms | [benchmark](docs/reports/tsuzune-with-without-benchmark-2026-08-09.md) |
| 最優先Track | 現在のPrimary／Nextと実行順は[PLAN.mdのCurrent Decision](PLAN.md#current-decision)を参照する。P0-1〜P0-7の選択済み範囲は2026-09-05本番受入済み。以下の機能別件数・日付は各区切りの証拠として扱う | [互換性台帳](.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md) |
| Obsidian plugin候補検出 | `.obsidian/plugins/*/manifest.json`だけを信頼IPC経由でread-only検出し、Settingsにmanifest状態、`main.js`／`styles.css`の有無、desktop境界を表示する。この候補scannerはplugin codeを読込・実行しない。別の明示選択済み経路として、固定Calendar 1.5.10だけをhash検証・sandbox・限定bridgeで提供する。汎用互換とは表示しない。active Vaultの2026-08-29観測は候補0件。無改造community plugin runtimeはHeld | [scanner](src/main/obsidian-plugins.ts)／[tests](tests/obsidian-plugins.test.ts)／[receipt](docs/reports/production-update-latest.json) |
| 直近4項目 | 左右sidebar独立開閉、既定offのDrive削除伝播、通常更新の履歴生成停止／legacy履歴保護、明示5ノート分類applyを完了。旧履歴の圧縮は行わず、不活性なlegacyデータとして扱う | [Drive deletion](docs/reports/drive-deletion-propagation-acceptance-2026-08-17.md)／[history evidence](docs/reports/history-compaction-preview-2026-08-16.md)／[classification](docs/reports/classification-production-gate-2026-08-17.md) |
| 直近UX区切り | R4でFileTreeのtreeitem／roving tabindex／Arrow・Home・End・typeahead／IME境界を、R5でWorkspace Tabsのkeyboard／ARIA／close後focusを本番反映。Daily Workspace Phase Bで100%表示、High Contrast、Narrator、主要focus境界もinstalled binary上で確認した | [R4 evidence](docs/reports/daily-workspace-phase-a-2026-08-22.md)／[R5 acceptance](docs/reports/workspace-tabs-r5-2026-08-22.md)／[Phase B](docs/reports/daily-workspace-phase-b-2026-08-22.md) |
| Quick Switcher P0-1 | `Ctrl+O`、session MRU、タイトル／path／本文検索、重複path表示、Arrow／Home／End、Enter／Ctrl+Enter、作成先確認、Escape focus復帰を本番反映。10,000ノート30 queryでp95 26.1ms、隔離Electron 2 viewport、Markdown不変を確認 | [acceptance](docs/reports/quick-switcher-2026-08-17.md)／[performance](docs/reports/assets/quick-switcher-2026-08-17/performance-result.json) |
| Command Palette P0-2 | `Ctrl+P`、日本語label／英語keyword検索、12件の既存action、shortcut／現在状態／disabled reason、keyboard／focus／単一modalを本番反映。全755 PASS／1 SKIP、隔離Electron wide／最小幅、Markdown不変を確認 | [acceptance](docs/reports/command-palette-2026-08-17.md)／[UI evidence](docs/reports/assets/command-palette-2026-08-17/capture-result.json) |
| Full-text Search P0-3/R3 | `Ctrl+Shift+F`でpersistent searchをreveal／focusし、`Ctrl+K`互換を維持。既存operatorに加えてexact `category:`／`topic:` facetをsource実装し、結果を「知識」「情報源」「受信箱」「その他」の排他的4群で表示する。派生知識ではカテゴリ／トピックchipを表示し、未分類ノートも「その他」から消さない。installed一致は最新receiptを正本とする | [acceptance](docs/reports/full-text-search-2026-08-18.md)／[現行計画](.agent/requirements/20260831-note-organization-video/plan.md#v5-category-aware-derivation-continuation--2026-09-01)／[receipt](docs/reports/production-update-latest.json) |
| PCTX-A1設計受入 | 初回AC1 FAIL／AC2・AC3 PASSを受けてartifact契約を補正。別の自然作業「右コンテキスト3タブ化」で独立したno-retry受入を行い、AC1／AC2／AC3すべてPASS。製品機能の追加は不要と判断 | [要件](.agent/requirements/20260817-0510-portable-context-handoff/4_requirements.md) |
| 起動安全性 | Electronのsingle-instance lockを本番反映。後続起動は終了し、既存windowを表示・復元・focusする。installed appの2回連続起動で主プロセス1件・同一PIDを実測 | [single-instance acceptance](docs/reports/single-instance-startup-2026-08-15.md) |
| Graph／Excluded files checkpoint | P0-1〜P0-7の選択済み範囲は本番受入済み。P0-1単独のsource-only記録は当時の証拠で、現在の未反映判定には使わない。surface別の互換差、未確認事項とinstalled受入は互換性台帳とVaultの同一campaignで確認する | [現行互換性台帳](.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)／[当時のP0-1 Evidence](.agent/requirements/20260905-obsidian-compatibility-program/results/p0-1-excluded-files.md) |
| Context checkpoint | X1-M1は`type: moc`を全タイトル一覧へ投影し、X1-D1はbaseline candidate集合を変えず通常本文だけを質問で優先する。X1-S1aはstable scanで同一canonical creation-time sidecarを再書込みせず、X1-S1bはmatching revisionと同一本文のAI自律更新を履歴なしno-opにして本番反映した。X1-T1は`build_context`だけをstructured-onlyにし、Codex Desktop local stdioで意味指標不変・wire 54.7%減・p95非悪化、fixture 12/12、回答品質4/4、source trace 3/3、future leakage 0、write 0を確認して本番反映した | [X1-T1 report](docs/reports/x1-t1-structured-only-transport-2026-08-12.md) |
| MCP runtime | 公開toolとapproval設定はcatalog、各操作の契約はMCP integrationへ集約する。`autonomous_update_note`は取得時revision必須。runtime freshnessとsource／receipt一致は別々のread-only toolで確認する。Drive applyと単一Markdown moveは既存本体bridgeの確認付き経路を維持し、停止中はfail-closed | [tool catalog](src/mcp/tool-catalog.json)／[MCP integration](docs/mcp-integration.md)／[Delivery info](docs/reports/delivery-info-implementation-2026-08-18.md) |
| Google Drive current baseline | 既定の片側削除preserveは維持し、明示opt-in時だけlocal→Drive trash／remote→local `.trash`を伝播する。隔離実Driveでrestart収束まで受入済み。本番分類5件は同じremote objectのmetadata relocationとPath Alias同期を完了 | [Drive deletion](docs/reports/drive-deletion-propagation-acceptance-2026-08-17.md)／[classification](docs/reports/classification-production-gate-2026-08-17.md)／[receipt](docs/reports/production-update-latest.json) |
| MCP retrieval observation | MCP-R1の履歴近似重複を受け、通常discoveryからの`50_履歴`除外と同一本文no-opは本番反映済み。既存履歴のread-only圧縮previewは153/153 targetsが旧形式で連鎖検証不能のため未適用 | [history preview](docs/reports/history-compaction-preview-2026-08-16.md) |
| Context remaining | host usageはrolloutからtask別に再取得済み。single-worker pairのfresh側88.58%減は一対だけで一般化しない。CP1-B 3件はFAIL／PASS／BLOCKED、sample 3もinput 2,303,178・cached 96.06%。source／revision／range単位の再読と実費は未観測。X1-C2はContext bundle量が次の主要因と判明するまでheld。Stale runtime write guardは公開mutation 8件をfail-closed化。Delivery infoは18〜21-byte応答、646-byte schema増分、repository外cwd／非書込みfixtureで実装済み。installed同一性はreceiptを正本とする。2026-08-31にTSUZUNE内部のInbox fact-only Hookは利用者選択で設計laneへ昇格したが、Codex Lifecycle Hookによるsemantic自動書戻しは未採用 | [AI文脈エンジン設計](.agent/requirements/20260831-note-organization-video/context-engine-v4.md)／[Stale guard implementation](docs/reports/stale-runtime-write-guard-implementation-2026-08-18.md) |

2026-08-12のdelivery-boundary checkpointでは、現行sourceの58 files／519 tests、MCP smoke、X1-T1 fixture 12/12を再確認した。installed executable／app.asar hashはreceiptと一致するが、通常利用後のproduction profile digestはreceipt時点と異なる。これは現在のprofileを受領書の不変性で主張しないための記録であり、P0はprofile、installer、releaseを変更していない。[詳細](docs/reports/delivery-boundary-checkpoint-2026-08-12.md)

## 実装済みの基盤

- ローカルMarkdown編集、folder、Wiki link、backlink、検索、添付preview。
- MCPによる検索、取得、backlink、Context、directory inventory、runtime／delivery境界、明示作成、revision付きで履歴を作らない更新、狭いpatch、承認待ちなしの派生知識作成、Drive同期preview／apply、単一Markdownのpreflight／move。Drive同期とmoveは起動中本体へ委譲する。`40_情報源`はAIの作成・編集を拒否し、派生知識作成ではread-only原典としてだけ参照する。legacy `50_履歴`はmoveを含め不変で、通常導線から外す。
- Path Alias読取基盤。旧pathを現行ノートへ一意に解決しつつ、実在する旧path、壊れた設定、MCP revision、bookmark／last noteの整合性を保護する。
- Temporal Memory Lite M0〜M5。valid-timeとknowledge-timeを分け、過去時点への未来情報混入を保守的に抑制する。
- Local／Global Graph、円形node、Canvas edge、Force runtime、Graph設定、Groups、検索、Animate、状態復元のcheckpoint実装。
- Google OAuth、基本profile、Google Drive手動同期。
- Windows installer、アプリ内更新、本番更新gate、installed hash検証、MCP再登録。
- Obsidian pluginのmanifest-only候補検出と、明示選択済みの固定Calendar 1.5.10互換経路。後者はhash検証・sandbox・限定bridgeを使用する。任意main.jsや汎用Obsidian API互換は提供しない。
- `90_テンプレート`のMarkdown雛形、custom template追加、filesystem最終更新日／`review_after`による非破壊の鮮度表示（本番反映済み）。
- 通常ノートのアプリ内新規作成、Daily／Ideaのテンプレート集約、定型Markdownの安全なフォーム再編集、最小Markdown書式ツールバー（本番反映済み）。
- アプリ内名前変更ダイアログと影響確認、Graphのzoom／fit操作、添付の既定アプリ／フォルダ表示を既存の安全なIPC経路で提供（本番反映済み）。

X1-M1のread-only本番Vault比較では、`00_入口/知識地図.md`のContextを15,000文字／included 9／omitted 21から、1,130文字／included 1／omitted 0へ削減しました。MOC原本、リンク先本文、通常ノートのContext経路は変更せず、時間指定時の本文省略も維持します。92.47%はContext Markdown文字数の削減であり、model-visible token削減率ではありません。実装は`installed-and-verified`の本番へ反映済みです。

X1-D0の将来案にあったscore 0候補の除外は撤回しました。X1-D1では、queryが通常候補本文の展開優先順だけを変え、本文を見送った候補も`omitted_ids`から追加取得できます。MOC全タイトル順、query有無のcandidate到達性、Temporal／provenance／warning、最大500文字queryでもContext予算を消費しない境界、2k／4k／6k／8k／15k sweepを回帰固定し、`e2d8621`から本番反映しました。structured-only搬送はRecallと分離したX1-T1で評価し、Codex Desktop local MCPの固定fixtureと通常本番runtimeで受入を完了しました。ChatGPT remote MCPは別Trackです。

2026-08-13のcurrent source監査では、direct serverの拡張後に`build_context`がlegacy text blockを再び重複していたことを検出しました。専用transportへ戻し、通常／query付きの`content: []`と他ツールのlegacy形状を再固定しました。2026-08-14のDrive bridge追加後もこの契約を維持し、direct 13ツールsmokeとCodex登録10ツールを検証対象にしています。これはwire契約であり、model-visible tokenまたは実費削減の新しい証明ではありません。

## 検証済みだが、完了と言わない範囲

### Classification Migration

O2-P2では、明示JSON planを入力するread-only CLIで本番Vaultを2回検査しました。5 moves／11,027 bytes、Wiki参照39件（active 24、source 4、history 11）／28 files、MCP backlink 39件を確認し、移行前後のWiki、Graph、Context投影は同値でした。

本番Vault全301 files／9,727,936 bytesのfingerprintは`C97351EF6D99F628AA099374961217008153E6E136351C418C92D76BB3FBF875`で2回不変、manifest SHA-256も`789384A9845CB9CBCAC49AF97F5EDEC6E4FE89A5F9891C1FEB309AF563540992`で一致しました。Path Alias sidecarは存在せず、Vault write、物理move、Markdown write、Drive操作は0件です。

O2-P3では匿名一時Vaultだけを使うtest-only prototypeをHEAD `560b54d`へ収録し、directory、reference、move、sidecarの4段階mutation、失敗注入、自動rollback、exact-byte復元を13 testsで固定しました。関連7 files／107 tests、全60 files／564 tests、typecheck、diff checkは実装時にPASSしています。これは本番apply経路ではありません。

CP1-C-03では残る`DRIVE_PATH_ALIAS_UNSUPPORTED`を、O2-P4Aのsidecar同期とO2-P4Bの既存Drive file IDによる明示remote relocationへ分割しました。先にP4Aだけをfake remoteで実装し、P4B、live Drive、本番Vault applyへ自動的に進みません。

CP1-C-04ではO2-P4Aをtest-only prototypeとして実装しました。local-only create、remote-only download、equal no-op、clean ledgerに基づく片側変更、履歴不足・両側変更・version driftのconflict、unique ownership、exact-byte transfer、preview/apply再検証、ledger失敗時のlocal preimage復元を16 testsで固定しました。関連5 files／69 tests、全61 files／585 tests、typecheckはPASSしています。実Drive、P4B remote relocation、製品entry point、本番Vault applyが未実施というのは2026-08-13時点のprototype境界で、後続gateは2026-08-17に完了しました。

CP1-C-05ではO2-P4Bをtest-only prototypeとして実装しました。明示planだけを対象に既存Drive file ID、content hash、parentを保ったmetadata relocation、local P3／remote notes／remote alias／両ledgerのcombined recovery、remote／alias／ledger failpoint、remote／local rollback drift時のpacket保持と再実行block、完了時のremote再取得を12 testsで固定しました。関連3 files／43 tests、全62 files／608 tests、typecheckはPASSしています。実Drive、OAuth、製品entry point、本番Vault applyが未実施というのは2026-08-13時点のprototype境界で、後続gateは2026-08-17に完了しました。

CP1-C-06では実Google資格情報と受入専用disposable Drive fixtureを使い、MarkdownとPath Alias objectの同一file ID、parent、private path metadata、version、exact bytesのforward／reverse roundtripをPASSしました。新規作成したfolder／Markdown／Aliasの3件は3/3でゴミ箱へ移し、既存Drive Vaultと本番Vaultは変更していません。`DRIVE_PATH_ALIAS_UNSUPPORTED`のlive契約blockerはclosedですが、本番classification applyは別承認です。

CP1-C-07ではTSUZUNE writeback履歴まで含む当時の本番Vaultをread-onlyで再解析し、5 moves／15,601 bytes、140 Wiki参照、23 rollback preimages、547-file Vault fingerprintを固定しました。dry-run前後は不変です。当時のpaired remote root／sync baseline不足というblockerは、2026-08-16の本番同期で解消しました。

2026-08-17にfresh production gateを作り、現在の5 sources／20,001 bytes、remote identity／version／parent／content hash、Path Alias、両ledger、rollback preimagesを再凍結しました。失敗注入相当の実行時不具合3件はいずれもfail-closedで復元・監査した後に根因修正し、最終applyで5件を`30_知識/ソフトウェア開発/`へ同一byteで移動しました。remote 5 objects、Path Alias 5件、pending move 0、recovery／rollback packet消去を再取得で確認済みです。

- [O2-P2 Classification Migration Dry-run](docs/reports/o2-p2-classification-migration-dry-run-2026-08-10.md)
- [O2-P2 explicit plan](docs/migrations/o2-p2-operations-plan.json)
- [O2-P3 test-only prototype](docs/reports/cp1-c-02-o2-p3-prototype-2026-08-13.md)
- [O2-P4 Drive Path Alias contract](docs/reports/cp1-c-03-drive-path-alias-contract-2026-08-13.md)
- [O2-P4A test-only sidecar sync prototype](docs/reports/cp1-c-04-o2-p4a-sidecar-sync-prototype-2026-08-13.md)
- [O2-P4B test-only relocation／recovery prototype](docs/reports/cp1-c-05-o2-p4b-relocation-recovery-prototype-2026-08-13.md)
- [O2 production classification gate](docs/reports/classification-production-gate-2026-08-17.md)

### Graph

GP6-0Wでは公式Obsidian Desktop 1.13.4と同じfixture、viewport、DPR、themeで、7 Markdown、8 node、12 directed edge、8 undirected pairの構造一致を確認しました。操作、保存、設定、視覚の完全互換は未判定です。

GP0-3b-aでは、未保存のGlobal Graphを初めて開いたときに設定パネルが表示される公開挙動を一致させました。Obsidian 1.13.4の`close: false`に対し、TSUZUNEのVault scope既定を`settingsOpen: true`としました。Local既定と利用者が明示保存した開閉状態は変更していません。

GP0-3b-bでは、Global GraphのSearch filesへ`path:"10_projects"`を入力し、Graph再表示と別プロセスによるアプリ完全再起動後まで検索条件が保持されるかを比較しました。Obsidian 1.13.4とTSUZUNEはいずれも入力直後を含む3観測点で2 node／1 unique visible edgeを維持しました。このqueryとライフサイクルだけを`matched`とし、ピクセル一致、他query、起動時のGraph workspace自動復元は主張しません。

GP0-3b-cでは、Global Graphへ制御された論理wheel `deltaY=-120`と背景drag `+96,+64 CSS px`を与え、Graph再表示と別プロセスによるアプリ完全再起動後を比較しました。Obsidian側はCDPマウス入力、TSUZUNE側は隔離オフスクリーンのDOM合成入力です。両製品ともzoom `1.5`を保持し、panは中央へ戻りました。6/6比較が`matched`だったため、TSUZUNEへpan永続化などの製品変更は加えていません。物理マウス／trusted event、ピクセル一致、zoom easing、Local Graph、fit／reset、zoom限界、workspace leaf自動復元は未証明です。

GP0-3b-dでは、同じ画面条件で`00_Home.md`を`+96,+64 CSS px`ドラッグし、押下中、pointerup直後、250ms後、settled、Graph再表示後、アプリ完全再起動後を比較しました。両製品とも押下中だけnodeを一時固定し、pointerupで固定を解除してForce simulationへ戻り、Graph再表示／再起動へnode座標・pinを保存しません。意味契約5/5は`matched`で、製品source修正は不要です。Obsidianの再シード座標とTSUZUNEの決定的baselineは永続化契約の差ではありません。物理マウス／trusted event、ピクセル単位のForce軌跡、Local Graph、touch／penは未証明です。

GP0-3b-eでは、Global Graphの`00_Home.md`を右クリックし、項目、順序、無効状態を固定比較しました。対象ラベル、先頭文言、削除操作は一致しましたが、Obsidian 1.13.4は11操作、TSUZUNEは2操作で、先頭操作もTSUZUNE側では無効でした。6比較中3一致・3差分の`different`であり、今回の製品修正は最初の公開差である文言を`新規タブに開く`へ合わせる一項目だけです。残るmenu操作、submenu、種別別open、物理マウス、見た目の完全一致は未証明です。

GP0-3b-fでは、その先頭操作を実際に有効化しました。note nodeは編集可能なworkspace tabを新規作成してactive化し、attachment nodeはアプリ内preview tabで表示します。TSUZUNEから既定アプリを開くのはpreview内の明示操作だけです。Obsidian 1.13.4とのnote比較ではtab作成・active化は一致しましたが、Obsidianは元Graph leafを保持し、TSUZUNEはGraph表示を閉じるため全体は`partial`です。Obsidian側attachment nodeの同操作は未証明です。

GP0-3b-gでは、この残差だけを閉じました。Global Graphをworkspace tabとして作成・保持し、noteを新規tabで開いた後もGraph tabを再選択して元のGlobal Graphへ戻れます。Obsidianはnote新規tab後もGraph leaf 1、TSUZUNEはGraph tab保持・復帰を固定fixtureで確認したため対象差は`matched`です。タブ復元・分割・並べ替えとObsidian attachment実動作は未証明です。

GP0-3b-hでは、公開フィルタの「添付書類」を有効化して`attachments/diagram.svg`を表示し、添付nodeの`新規タブに開く`を比較しました。Obsidian 1.13.4とTSUZUNEはいずれも内部preview tabを作成・active化し、元Global Graph tabを保持して復帰できるため対象差は`matched`です。製品コード変更はありません。添付context menuの網羅性はObsidian 11対TSUZUNE 2で未達です。

GP0-3b-iでは、添付nodeの`新規ウィンドウで開く`を比較しました。両製品とも2つ目のトップレベルウィンドウを生成し、`attachments/diagram.svg`をOS外部アプリではなく内部画像ビューで表示し、元Global Graphを保持してcontext menuを閉じるため対象動作は`matched`です。TSUZUNEの独立ウィンドウは最小shellであり、Obsidianのworkspace装飾との視覚一致と残るcontext menu操作は未達です。

GP0-3b-jでは、添付nodeの`ファイルを移動…`を取消、通常移動、同名衝突の3シナリオで比較しました。両製品とも通常移動後に埋め込み`![[attachments/diagram.svg]]`を自動書換えせず、旧pathを未解決node、新pathを実在する孤立attachment nodeとしてGraph再表示／アプリ再起動後まで保持します。同名衝突では既存`20_knowledge/diagram.svg`を上書きせず、移動元を`diagram 1.svg`へ自動採番します。中核動作は`matched-core-behavior`です。移動先選択はObsidianのtypeahead promptに対してTSUZUNEはselect/buttonで、context menu全体も11対4の既知差です。

GP0-3b-kでは、添付nodeの`ブックマーク…`を取消、作成、同一path再編集の3シナリオで比較しました。両製品とも取消では保存せず、作成後は対象pathのbookmarkをちょうど1件保持し、再編集では重複を作らず同じbookmarkをupsertして`ctime`を保持します。Graph再表示と別プロセス再起動後もbookmarkと対象attachment nodeを保持し、Markdown／Vault内容は変更しません。中核動作は`matched-core-behavior`です。Obsidianのgroup selectorに対するTSUZUNEのplain text input、context menu全体11対5、Bookmarks side panel／一覧／並べ替え／group階層は未一致または未証明です。

GP0-3b-lでは、添付nodeの`パスをコピー`をURL、Vault相対path、system絶対pathの3シナリオで比較しました。親menuと3件のsubmenuの文言・順序・有効状態、選択ごとのplain-text write 1回、選択後のmenu close、共通検証範囲であるGraph検索条件・node集合・Vault内容のGraph再表示／別プロセス再起動までの保持を満たし、中核挙動は`matched-core-behavior`です。URLとVault相対pathは完全一致し、system pathは各隔離Vault rootから同じ相対suffixでした。両captureともOS clipboard実writeをinterceptしたため別applicationへのpaste roundtripは未証明です。固定参照は右端から左、TSUZUNE captureは中央から右へsubmenuを開いており、TSUZUNE実画面の右端左開きはこのcaptureでは未観測です。context menu全体も11対6の既知差です。

GP0-3b-mでは、添付nodeの`リンクされたビューを開く`を比較しました。両製品のsubmenuは唯一の有効操作`バックリンクを開く`で一致し、対象添付pathと参照元を示すviewを開いた後もGlobal Graphを保持しました。起動中の操作と、Graph再表示／別プロセス再起動後のGraph構造保持を`matched-core-behavior`としています。linked-view自体はTSUZUNEで再起動後に復元せず、Obsidianは`バックリンク`tab shellを保持するものの対象添付へのbindingは未証明です。全496 tests、typecheck、build、MCP smokeをPASSしました。TSUZUNEはworkspace tab、Obsidianはbacklink leafを使うため分割paneと視覚shellの1:1一致は未証明です。context menu全体は11対7の既知差です。

- [GP6 comparison report](docs/reports/graph-gp6-production-comparison-2026-08-02.html)
- [GP6 working-tree evidence](docs/reports/assets/graph-gp6/tsuzune-working-tree/manifest.json)
- [GP7 initial settings comparison](docs/reports/graph-gp7-global-settings-default-2026-08-03.html)
- [GP0 search persistence comparison](docs/reports/graph-gp0-search-persistence-2026-08-03.html)
- [GP0 camera persistence comparison](docs/reports/graph-gp0-camera-persistence-2026-08-03.html)
- [GP0 camera machine-readable comparison](docs/reports/assets/graph-gp0-camera-persistence/comparison.json)
- [GP0 node drag persistence comparison](docs/reports/graph-gp0-node-drag-persistence-2026-08-04.html)
- [GP0 node drag machine-readable comparison](docs/reports/assets/graph-gp0-node-drag-persistence/comparison.json)
- [GP0 node new-tab comparison](docs/reports/graph-gp0-node-new-tab-2026-08-09.html)
- [GP0 node new-tab machine-readable comparison](docs/reports/assets/graph-gp0-node-new-tab/comparison.json)
- [GP0 attachment file-move comparison](docs/reports/graph-gp0-attachment-file-move-2026-08-09.html)
- [GP0 attachment file-move machine-readable comparison](docs/reports/assets/graph-gp0-attachment-file-move/comparison.json)
- [GP0 attachment bookmark comparison](docs/reports/graph-gp0-attachment-bookmark-2026-08-09.html)
- [GP0 attachment bookmark machine-readable comparison](docs/reports/assets/graph-gp0-attachment-bookmark/comparison.json)
- [GP0 attachment path-copy comparison](docs/reports/graph-gp0-attachment-path-copy-2026-08-09.html)
- [GP0 attachment path-copy machine-readable comparison](docs/reports/assets/graph-gp0-attachment-path-copy/comparison.json)

### Performance

500件／2000件の疎グラフfixtureを各3回測定しました。主ボトルネックはGraph構築ではなく、継続Force simulation、毎フレーム描画、watcher後の全体再反映です。これは改善前後を比べるbaselineで、合格値や一般Vault性能の証明ではありません。

- [Large Vault performance report](docs/reports/tsuzune-large-vault-performance-2026-08-03.html)
- [Machine-readable public summary](docs/reports/assets/large-vault-performance-2026-08-03/summary-public.json)

### Temporal Memory

M5固定dogfoodでは時間整合性が1/4から4/4、State NoteからSourceへの一致が0/3から3/3へ改善しました。これは根拠Bundleの改善であり、モデル本体の一般知能、人間の主観時間、エントロピー認識の実現ではありません。

2026-08-09の本番Vault実測では、時間対応Contextの構築＋安全分析は要求単位snapshot indexの導入前median 151.123ms／p95 180.404ms、導入後median 35.934ms／p95 47.798msでした。改善後も現在Context 33,412文字／24ノート、過去Context 3,585文字／6ノート、未来情報混入0、出典6／3組を維持し、生成MarkdownのSHA-256も一致しています。Vault scan、MCP通信、AI生成、UI描画はこの値へ含めていません。

- [M5 dogfood](docs/m5-dogfood.md)
- [TSUZUNEあり／なし benchmark](docs/reports/tsuzune-with-without-benchmark-2026-08-09.md)

## 正本の優先順位

1. 実行中の事実: インストール済み本体と最新のproduction receipt。
2. 実装の事実: source、tests、fixture、machine-readable artifacts。
3. 製品境界: `PRODUCT.md`、`DESIGN.md`、`AGENTS.md`。
4. 実行順: `PLAN.md`のCurrent StateとCurrent Transition Queue。
5. 本番TSUZUNE Vault: 現在地への検索導線、判断履歴、日付付きEvidence。repo仕様の複製ではない。

SemVerやHEADだけで同一性を判断しません。現在の本番commit、source fingerprint、clean/dirty状態、EXE／`app.asar` hashは[production-update-latest.json](docs/reports/production-update-latest.json)を唯一の正本とし、この段落へ可変値を複製しません。

## 優先キュー

現在のPrimary／Nextは[PLAN.mdのCurrent Decision](PLAN.md#current-decision)を正本とします。候補の評価履歴は[改善・未達成項目 実行台帳](docs/reports/tsuzune-improvement-ledger-2026-08-23.md)を参照し、この節では可変なNextを複製しません。

1. **P0 completed delivery:** frozen 245-file inventoryをC0〜C4、C5 exact-pin復旧、4 mixed-path解消、C6/C9 documentation、H1不採用削除へ分離してpushし、clean source `b2fd6bf`を公式`production:update`で本番受入した。
2. **P1 completed acceptance:** Drive Sync S1を本番反映し、旧ledger warm-up後の差分なし再確認が実機で約1〜2秒となりPASS。
3. **P1 completed live acceptance:** S2 Drive Changes APIを全617 tests／10 checksで本番反映し、installed app連続previewは初回bootstrap約7秒、2回目Changes差分経路約1秒で受入PASS。
4. **P1 completed live acceptance:** S3 Explicit Note Moveを全624 tests／10 checksで本番反映。2026-08-15にinstalled app内の単一ノート移動をpreview移動1件→apply移動1件→再preview 0件で受入PASS。
5. **P1 background runtime completed and live-accepted:** 通知領域常駐を本番反映し、×で隠した後もprocess／MCPが生存。背景状態のDrive previewは送信12／受信0／移動0／競合0／保持16でPASSし、applyは未実施。
6. **Early-closed observation:** O1 7-day dogfoodは2026-08-16にDay 2で終了。7日完遂とは扱わず、未解決repeat 2件以上は0。
7. **P1 completed and installed:** 独立sidebar、Drive削除伝播、通常更新の履歴生成停止とlegacy保護を実装し、削除伝播は隔離実Drive、legacy領域は本番read-only digestで受入した。旧履歴の圧縮は廃止し、実施しない。
8. **P1 completed production apply:** 明示5 notesの分類移動、remote relocation、Path Alias、両ledger、recovery clean-upを本番で完了した。
9. **P1 completed and installed:** 右コンテキストをリンク／バックリンク／時間の3タブへ整理し、全725 tests、隔離UI、10/10 production checksで受入完了。PCTX-A1の補正後受入もAC1／AC2／AC3すべてPASSし、新しい製品機能は不要と判断した。
10. **P0-4/R4 and R5 completed and installed:** FileTree keyboard／ARIAとWorkspace Tabs keyboard／ARIAを全770 PASS／1 SKIP、隔離Electron、10/10 production checksで本番受入した。Phase Bのinstalled実機境界も確認済み。
11. **互換性の判断履歴:** P0-1〜P0-7の選択済み範囲は受入済み。現在のPrimary／Nextは[PLAN.mdのCurrent Decision](PLAN.md#current-decision)を参照し、ここへ複製しない。

## 過去の区切り（当時のsource確定記録）

以下の完了条件・承認・未反映表現は記録時点のもの。現在状態や次の作業として扱わない。

### 2026-09-06 観測宙域の終了・製品撤去

利用者の「では諦めよう。本番TSUZUNEからも観測宙域を消そう」により、観測宙域とLife Weather派生試作の継続を終了。製品のナビゲーション、コマンド、専用タブ、粒子描画・simulation・CSS・専用受入scriptを削除した。通常のノートとグラフを維持し、Vaultの研究ノート・履歴・試作成果は削除しない。既存の主操作テストで入口とコマンドの不在、通常グラフ操作を確認し、App安全性99 tests PASS。Ponytail Reviewで不要な残存処理・新規抽象化なし。

完了条件は (1) 製品から専用機能がなくなる、(2) 通常操作の回帰検証が通る、(3) 本番更新でpackaged／installed一致と本番profile不変を確認すること。本番反映の結果は、このsourceを含む[最新production receipt](docs/reports/production-update-latest.json)と既存Vault実施記録へ保存する。gate後はこのsourceを変更しない。撤去は本番更新まで承認済み、Git公開は今回の対象外。再開には利用者の新たな明示選択が必要。

### 2026-09-05 P0-7 参照元リンク追従の現在地

P0-7の参照元リンク追従を実装・source検証済み。単一Markdownノートの名前変更・移動にWiki／Markdown／frontmatter参照が追従し、別名・見出し・コメント・BOM・改行を保持する。32件の安全性test、実画面の4操作と再起動後の全file一致、隔離先userData／sessionDataの実測、本番profile 273 files不変を確認した。独立reviewのblocking findingは解消済み。本番反映の完了は、このsource fingerprintに対応する最新production receiptとinstalled実画面検証を記録した既存Vault campaignを正本とする。repo内記録はgate前に確定し、gate後に結果を重複追記しない。P0-6のprofile差分は原因未特定の過去証拠として保持する。 [実装・検証証拠](.agent/requirements/20260905-obsidian-compatibility-program/results/p0-7-lossless-link-maintenance.md)。以下は各区切りの記録。

## CheckpointとWorking treeの扱い

Graph検索保持の製品コード、tests、fixture、再現script、report assetsは`ad26532`へ収録済みです。GP0-3b-cとGP0-3b-dは比較harness、raw observation、画像、比較表、HTMLレポートだけを追加し、製品sourceは変更していません。C0-A〜C1-CはGit管理外の`work/`へ個人本文とreviewを出す開発用CLI／純粋coreであり、Electron本番UI・packaged runtimeへは接続していません。C1-Cは既知誤検出を止めた一方、rule別review 10件未満のため自動適用を解禁せず、人物プロフィール5ノートへのwriteは0です。O1-W0／O1-W1のbaselineはElectron UIへ接続し、2026-08-09のproduction update gateでこのPCの本番へ反映済みです。GP0-3b-jは`b47671a`、production testの2-worker gateは`9bec872`／`4051f9f`として同名originへpushし、12:54 JSTにclean sourceから本番へ反映済みです。GP0-3b-kは`efe52ea`として同名originへpushし、19:58 JSTに同commitのclean sourceから全438 tests、packaged／installed smoke、hash一致、production profile不変、MCP再登録を確認して本番へ反映済みです。GP0-3b-lとMarkdown不要な自由入力拡張は`b927171`としてpushし、2026-08-10 00:25 JSTにclean sourceから全453 tests、packaged／installed smoke、build／installed hash一致、production profile不変、MCP再登録を確認して本番へ反映済みです。O2-P1 Path Alias Foundationは`0aacecf`／`df9146e`としてpushし、02:16 JSTにclean sourceから全486 tests、packaged／installed smoke、build／installed hash一致、production profile不変、MCP再登録を確認して本番へ反映済みです。GP0-3b-m Attachment Linked Viewsは`cb56cdf`としてpushし、04:18 JSTに同commitのclean sourceから全496 tests、packaged／installed smoke、build／installed hash一致、production profile不変、MCP再登録を確認して本番へ反映済みです。X1-M1 MOC Title Routerは`601b94e`としてpushし、05:41 JSTに同commitのclean sourceから全502 tests、packaged／installed smoke、build／installed hash一致、production profile不変、MCP再登録を確認して本番へ反映済みです。X1-D1 Recall-safe Query Bridgeは`e2d8621`としてpushし、14:03 JSTに同commitのclean sourceから全508 tests、packaged／installed smoke、build／installed hash一致、production profile 57 files不変、MCP再登録を確認して本番へ反映済みです。GP0-3b-n Attachment Default Appは`49ac0f3`としてpushし、20:50 JSTに同commitのclean sourceから全508 tests、10/10 checks、packaged／installed smoke、build／installed hash一致、production profile 57 files不変、MCP再登録を確認して本番へ反映済みです。GP0-3b-o Attachment Folder Revealとテンプレート／名前変更／Graph操作拡張は`2ee914c`としてpushし、2026-08-11 05:00 JSTにclean sourceから全509 tests、10/10 checks、packaged／installed smoke、build／installed hash一致、production profile 57 files不変、MCP再登録を確認して本番へ反映済みです。実Explorer起動、Obsidian別process再起動、model-visible token削減は引き続き未証明です。

- 次のsliceでも、sourceだけ、reportだけの機械的な分割commitをせず、共有型、App、Vault、testsを含む機能契約単位で切る。
- fixture、日付付きreport、machine-readable artifactは比較の証拠として保持し、生成ゴミと決めつけて一括削除しない。
- `work/`は再計測用のローカル作業領域。耐久する性能証拠は`docs/reports/assets/large-vault-performance-2026-08-03/summary-public.json`を参照する。

## 再開時の確認

```powershell
git status --short
npm run typecheck
npm test
npm run check:mcp
git diff --check
```

製品コードを本番へ反映する区切りでは、通常の検証後に`npm run production:update`を実行します。文書・調査だけの変更では、同じbinaryを再インストールしません。

資料全体の案内は[docs/INDEX.md](docs/INDEX.md)を参照してください。
