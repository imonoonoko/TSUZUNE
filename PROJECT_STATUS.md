# TSUZUNE Project Status

## 2026-09-05 P0-7 参照元リンク追従の現在地

P0-7の参照元リンク追従を実装・source検証済み。単一Markdownノートの名前変更・移動にWiki／Markdown／frontmatter参照が追従し、別名・見出し・コメント・BOM・改行を保持する。32件の安全性test、実画面の4操作と再起動後の全file一致、隔離先userData／sessionDataの実測、本番profile 273 files不変を確認した。独立reviewのblocking findingは解消済み。本番反映の完了は、このsource fingerprintに対応する最新production receiptとinstalled実画面検証を記録した既存Vault campaignを正本とする。repo内記録はgate前に確定し、gate後に結果を重複追記しない。P0-6のprofile差分は原因未特定の過去証拠として保持する。 [実装・検証証拠](.agent/requirements/20260905-obsidian-compatibility-program/results/p0-7-lossless-link-maintenance.md)。以下は各区切りの記録。

更新日: 2026-09-06（JST）

この文書は、TSUZUNEの「今」を一枚で確認するための入口です。実行順と将来計画は[PLAN.md](PLAN.md)、製品の不変条件は[PRODUCT.md](PRODUCT.md)、画面・ブランド規約は[DESIGN.md](DESIGN.md)を正本とします。完了証拠は[docs/INDEX.md](docs/INDEX.md)から辿ります。

## 現在地

Obsidian互換性はP0-7までの選択済み範囲を本番反映・隔離installed受入済み。2026-09-06にGitHub main統合と、レビューで選んだ保守へ進んだ。保守のsource証拠は[保守結果](docs/reports/review-maintenance-2026-09-06.md)、本番完了はそれに対応する最新receipt・Vault実施記録を参照する。

| 対象 | 現在の状態 | 正本 |
|---|---|---|
| インストール済み本番 | 最新のstatus、source fingerprint、packaged／installed hash、profile不変性、MCP再登録はmachine-readable receiptを唯一の正本とする。製品source変更後は、その変更を含む`production:update`のreceiptが`installed-and-verified`になるまでinstalled productionと同一視しない | [production-update-latest.json](docs/reports/production-update-latest.json) |
| Obsidian互換性Program | 現行Primary。P0-1 Excluded files、P0-2文字列に続きP0-3数値／単純list Propertiesをsource実装・検証。型区別、周辺byte／コメント保持、revision保護と再読込を確認。focused 117／全体1099 tests PASS（1 SKIP）、typecheck／独立review PASS。P0-2で先行したOOMの原因解消は未証明。P0-5のチェックボックス型Propertiesは追加・切替・削除・preview・保存・再読込をsource実装し、全体1124 tests PASS（1 SKIP）、隔離した固定Obsidian 1.13.4との実機26検査をPASSした。真偽値の切替・再起動後の状態は一致。新規未チェック値（TSUZUNE=false／Obsidian=空欄）とコメント／BOM／改行の保存は異なり、TSUZUNEの非破壊保存を維持する。再起動後にMCPの記録同期を完了し、既存campaignと3入口をrevision付きで更新、読み戻し・一意検索・相互リンクを確認した。Ownerが2026-09-05に現source全体を既存の検証・更新手順で導入することを明示承認した。対象はExcluded files、各型Properties編集、Context利用・状態由来レシートを含む現tree。導入結果はdocs/reports/production-update-latest.jsonの本承認後のreceiptとdelivery_infoを正本にし、既存campaignへ受入証拠を保存する。新機能やGit公開は自動着手しない。本番反映・Git deliveryは未実施。fresh GUI比較は固定Obsidian 1.13.4とcurrent-source TSUZUNEの5ケースに限定して完了 | [互換性Program](.agent/requirements/20260905-obsidian-compatibility-program/plan.md)／[台帳](.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)／[P0-4 Evidence](.agent/requirements/20260905-obsidian-compatibility-program/results/p0-4-properties-paired-comparison.md) |
| 観測宙域MVP | 初回の全量Graph／camera prototypeは利用者鑑賞受入で不採用。R2では明示Wiki linkからroot最大3枝・depth 2・最大9星／8本の局所treeを場面ごとに構成し、全量背景、global layout、camera、Canvas、技術件数captionを表示経路から除去した。全974 testsとbuild-bound Electronのdense 589/4175・singleton 1/0受入はPASS。sourceは検証済みで、利用者鑑賞受入待ち。本番未反映 | [開発計画](.agent/requirements/20260903-0032-existence-phase-observatory-mvp/implementation-plan.md)／[機械的受入結果](.agent/requirements/20260903-0032-existence-phase-observatory-mvp/acceptance-result.json) |
| 受信箱capture first slice | Command Paletteから現在のfolderや分類を問わず`01_受信箱`へcollision-safeな空メモを作成して開くsource実装を完了。このcapture操作自体には分類DB・Hook・background処理・履歴を追加していない。typecheck、全test、MCP check、独立reviewはPASS。本番反映は最新receiptのsource fingerprintがcurrent sourceと一致する時だけ成立する | [実装・検証packet](.agent/requirements/20260831-note-organization-video/packets/D5-D6-implementation-verification.md)／[receipt](docs/reports/production-update-latest.json) |
| Browser Clipper | Chrome／Edgeの明示操作でWeb／YouTubeを出典付きMarkdownとして`01_受信箱`へcreate-only保存するsource実装を完了。通常WebとYouTube字幕はクリップ時に文字数・64 KiBで切らず、10万文字超の原典はMCP `fetch` cursorでAIがrevisionを保ったまま分割読取できる。Mozilla Readability 0.6.0をローカル同梱し、YouTubeは可視文字起こし、パネル展開、現在動画IDと一致する字幕トラック、取得不能時のローカル`yt-dlp`の順に探す。`yt-dlp`は設定・Cookie・remote componentを読まず、一時字幕を変換後に削除する。固定拡張ID、6桁pairing、OS暗号化token、exact Origin／Host、一回8 MiBの入力上限、同時冪等性、衝突非上書きを維持し、広域host権限、cloud文字起こし、汎用履歴、新しい`50_履歴`は追加しない。installed一致は最新receipt、実ブラウザのtoolbar操作は利用者確認を別に判定する | [利用方法](docs/browser-clipper.md)／[強化packet](.agent/requirements/20260901-browser-clipper-existing-tech/plan.md)／[receipt](docs/reports/production-update-latest.json) |
| AI派生知識整理 | `01_受信箱`または`40_情報源`の一件をAIが非信頼入力として読み、既存主カテゴリ1件・トピック1〜3件・exact source revision・Wiki原典linkを持つ`30_知識`候補をAI Reviewへ登録するsource実装を完了。承認前は派生ノートを作らず、原典は変更しない。同じsource path＋revisionの重複候補、stale revision、destination衝突を拒否する。独立反証reviewはPASS、source必須checkもPASS。自動承認、原典の移動／削除、bulk分類、Hook、scheduleは実装していない。installed一致は最新receiptを正本とする | [現行計画](.agent/requirements/20260831-note-organization-video/plan.md#v5-category-aware-derivation-continuation--2026-09-01)／[実装packet](.agent/requirements/20260831-note-organization-video/packets/D20-D22-integration.md)／[receipt](docs/reports/production-update-latest.json) |
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
| Graph／Excluded files checkpoint | CP0-T05のMCP除外境界を保ったまま、P0-1でrenderer snapshotの早すぎる除外を解消。current sourceではFile Explorer visible/open、Search/Graph hidden、Quick Switcher/link suggestion deprioritizedを固定した。linked backlinks、実GUI、installed runtimeは未確認 | [P0-1 Evidence](.agent/requirements/20260905-obsidian-compatibility-program/results/p0-1-excluded-files.md)／[historical CP0-T05](docs/reports/cp0-t05-excluded-files-mcp-retrieval-2026-08-12.md) |
| Context checkpoint | X1-M1は`type: moc`を全タイトル一覧へ投影し、X1-D1はbaseline candidate集合を変えず通常本文だけを質問で優先する。X1-S1aはstable scanで同一canonical creation-time sidecarを再書込みせず、X1-S1bはmatching revisionと同一本文のAI自律更新を履歴なしno-opにして本番反映した。X1-T1は`build_context`だけをstructured-onlyにし、Codex Desktop local stdioで意味指標不変・wire 54.7%減・p95非悪化、fixture 12/12、回答品質4/4、source trace 3/3、future leakage 0、write 0を確認して本番反映した | [X1-T1 report](docs/reports/x1-t1-structured-only-transport-2026-08-12.md) |
| MCP runtime | `build_context`のtransport契約を維持し、Codex／Freebuff共通17ツール、direct 19ツール（read 10／write 9）。追加した`propose_derived_note`はsource exact revisionを要求し、原典を変更せずAI Review proposalだけを登録する。`delivery_info`はsourceとlatest receiptのstatus一つだけを明示呼出しで返す。Drive preview／確認付きapplyと単一Markdownのpreflight／moveは起動中本体へ委譲し、本体停止中はfail-closed | [MCP integration](docs/mcp-integration.md)／[Delivery info](docs/reports/delivery-info-implementation-2026-08-18.md)／[Drive bridge](docs/reports/drive-sync-mcp-bridge-2026-08-14.md) |
| Google Drive current baseline | 既定の片側削除preserveは維持し、明示opt-in時だけlocal→Drive trash／remote→local `.trash`を伝播する。隔離実Driveでrestart収束まで受入済み。本番分類5件は同じremote objectのmetadata relocationとPath Alias同期を完了 | [Drive deletion](docs/reports/drive-deletion-propagation-acceptance-2026-08-17.md)／[classification](docs/reports/classification-production-gate-2026-08-17.md)／[receipt](docs/reports/production-update-latest.json) |
| MCP retrieval observation | MCP-R1の履歴近似重複を受け、通常discoveryからの`50_履歴`除外と同一本文no-opは本番反映済み。既存履歴のread-only圧縮previewは153/153 targetsが旧形式で連鎖検証不能のため未適用 | [history preview](docs/reports/history-compaction-preview-2026-08-16.md) |
| Context remaining | host usageはrolloutからtask別に再取得済み。single-worker pairのfresh側88.58%減は一対だけで一般化しない。CP1-B 3件はFAIL／PASS／BLOCKED、sample 3もinput 2,303,178・cached 96.06%。source／revision／range単位の再読と実費は未観測。X1-C2はContext bundle量が次の主要因と判明するまでheld。Stale runtime write guardは公開mutation 8件をfail-closed化。Delivery infoは18〜21-byte応答、646-byte schema増分、repository外cwd／非書込みfixtureで実装済み。installed同一性はreceiptを正本とする。2026-08-31にTSUZUNE内部のInbox fact-only Hookは利用者選択で設計laneへ昇格したが、Codex Lifecycle Hookによるsemantic自動書戻しは未採用 | [AI文脈エンジン設計](.agent/requirements/20260831-note-organization-video/context-engine-v4.md)／[Stale guard implementation](docs/reports/stale-runtime-write-guard-implementation-2026-08-18.md) |

2026-08-12のdelivery-boundary checkpointでは、現行sourceの58 files／519 tests、MCP smoke、X1-T1 fixture 12/12を再確認した。installed executable／app.asar hashはreceiptと一致するが、通常利用後のproduction profile digestはreceipt時点と異なる。これは現在のprofileを受領書の不変性で主張しないための記録であり、P0はprofile、installer、releaseを変更していない。[詳細](docs/reports/delivery-boundary-checkpoint-2026-08-12.md)

## 実装済みの基盤

- ローカルMarkdown編集、folder、Wiki link、backlink、検索、添付preview。
- MCPによる検索、取得、backlink、Context、directory inventory、runtime／delivery境界、明示作成、revision付きで履歴を作らない更新、狭いpatch、Review-gated派生知識proposal、Drive同期preview／apply、単一Markdownのpreflight／move。Codex／Freebuff共通17、direct 19ツール。Drive同期とmoveは起動中本体へ委譲する。`40_情報源`はAIの作成・編集を拒否し、派生知識proposalではread-only原典としてだけ参照する。legacy `50_履歴`はmoveを含め不変で、通常導線から外す。
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
11. **Current Primary:** Obsidian互換性。P0-1 Excluded filesとP0-2〜3文字列／数値／単純list Propertiesはcurrent-source検証済み、本番未反映。工房主承認順は、データを壊さない互換性 → 毎日の操作互換性 → 構造表現の互換性 → 選択した拡張だけの互換性。P0-5のチェックボックス型Propertiesは追加・切替・削除・preview・保存・再読込をsource実装し、全体1124 tests PASS（1 SKIP）、隔離した固定Obsidian 1.13.4との実機26検査をPASSした。真偽値の切替・再起動後の状態は一致。新規未チェック値（TSUZUNE=false／Obsidian=空欄）とコメント／BOM／改行の保存は異なり、TSUZUNEの非破壊保存を維持する。再起動後にMCPの記録同期を完了し、既存campaignと3入口をrevision付きで更新、読み戻し・一意検索・相互リンクを確認した。Ownerが2026-09-05に現source全体を既存の検証・更新手順で導入することを明示承認した。対象はExcluded files、各型Properties編集、Context利用・状態由来レシートを含む現tree。導入結果はdocs/reports/production-update-latest.jsonの本承認後のreceiptとdelivery_infoを正本にし、既存campaignへ受入証拠を保存する。新機能やGit公開は自動着手しない。Canvas／Graph差分は第3層、BasesはProperties安定後、実利用pluginは工房主選択後に限定する。community plugin無制限runtime、cloud Sync／Publish模倣はHeld。

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
