# TSUZUNE Product Plan — 日常の知識再利用

更新日: 2026-09-10（JST）

この文書は、TSUZUNEの採用済み方針を日常の改善へつなぐ実行正本です。製品価値の中心は「自分の知識を手元に置き、日常の中でAIと安心して使い続けられること」。本人が2026-09-06に現状評価を方針として採用したことに基づき、日常利用の価値を現在のPrimaryとします。

後段のCurrent-State Compiler R0〜R10は過去の設計・Held候補です。現在の実行順はCurrent Decisionだけで決め、構想の章立てを実装queueへ読み替えません。

現在の本番状態は[PROJECT_STATUS.md](PROJECT_STATUS.md)、変わりにくい製品原則は[PRODUCT.md](PRODUCT.md)、画面規約は[DESIGN.md](DESIGN.md)、実装証拠は[docs/INDEX.md](docs/INDEX.md)、最新の本番同一性は[production-update-latest.json](docs/reports/production-update-latest.json)を正本とします。

## 1. 結論と現在の実行境界

### Program Goal

利用者と交換可能な外部AIが、Markdownの原典・判断・時間・制約を見失わず、次の5点を短時間で確認できる状態を作ります。

1. 今、何が正しい状態なのか。
2. 前回から何が変わったのか。
3. なぜ変わったのか。
4. どの証拠に基づくのか。
5. 不明・矛盾・未確認は何か。

### Current Decision

| 区分 | 現在地 |
|---|---|
| 選択済み実装 | **Contextの読取境界はsource実装・隔離検証済み（2026-09-10）。** [実装・受入証拠](docs/reports/context-reading-boundary-2026-09-10.md)のとおり、tool説明2文字列と既存利用案内を修正し、固定6件の最終実AI受入を満たした。baselineも6件を満たすため、一般的な行動改善は未確認。本番反映は対応する最新receipt、fresh MCPと最終同期は既存Vault記録で判定する。新metadata・原資料2件の別案・他候補の実装は未選択。既存のPrimary／Nextは変更しない |
| Complete | Context Compiler、Temporal Memory、MCP revision／patch／read-only、保護領域、通常更新の履歴生成停止、Inbox capture、Browser Clipper、category-aware派生知識と検索facets、production gate。S1検索一致抜粋（receipt 2026-09-08T18:38:35.980Z）、利用者選択によるAI承認廃止・直接保存（同19:09:31.514Z）、[欠落タブ通知・前回配置の整理](docs/reports/missing-tab-notice-2026-09-09.md)（同19:39:46.42Z）、[S2 Context本文変換種別](docs/reports/context-content-mode-2026-09-09.md)（同20:34:23.366Z）は本番反映・最終Vault同期済み。S2は再接続後のfresh MCP確認と追加reviewも完了した。Obsidian互換性P0-1〜P0-7の選択済み範囲は本番反映・隔離installed受入・GitHub main統合済み。正確な受入時点と範囲はreceipt・既存Vault campaign・[互換性台帳](.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)で確認する |
| Primary | **日常の知識再利用**。評価軸は、分類せず書き始められる、以前の考えと根拠へ戻れる、外部AIへ背景を説明し直す手間が減る、の3点。Obsidian互換はその土台とし全面互換を完了条件にしない |
| Next | **A6の一部「Basesを一覧から選んで開く」はsource実装・検証済み。** [実装・受入](.agent/requirements/20260908-bases-design/implementation.md)の境界に従い、このsourceのproduction gate、隔離installed受入、fresh MCP確認、最終Vault同期で今回を完了とする。結果は最新receiptと対応するVault実施記録が所有し、全条件を満たした後の新しい製品変更は未選択。次の推奨検討候補はB3の短いリンクpreviewだが自動着手しない。formula・他view・セル編集・Git公開は今回の範囲に含めない |
| 日常利用の確認 | 本人はAIとの再利用まで行えていると報告済み。[S0の初回実AI評価](docs/reports/ai-reuse-s0-evaluation-2026-09-06.md)で、隔離8ノート・5問の本文到達と回答根拠が対応し、適用項目は全PASS。R2は4ケースPASS・E3条件未成立のN/A。既存tool＋[読取契約](.agent/requirements/20260906-0410-ai-reuse-contract/design.md)で成立し、この試行から製品修正は必要にならなかった。日常で生じた実際の質問について必要本文・時点・制約と回答を照合し、失敗があれば検索・呼出し方・原資料・回答生成へ原因を分ける。今回を日常全般の成功や契約配布完了とはしない。R6の版変更時の実callerは未検証。S1・S2と欠落タブ通知の本番受入はCompleteを参照し、本人の日常操作の受入や誤答減少の効果とは区別する。自動監視・ログ収集は追加しない |
| Held | R1〜R10、Compact Decision Envelope、独立Harness runtime、新DB、Vector DB、全Vault ingestion、永続派生ビュー、BM25/cache、multi-note transaction、広域Graph拡張、無改造Obsidian community pluginの実行runtime／API shim／任意`main.js`読込、独立review queue、全Vault batch整理、既存ノートへのbulk分類write、例外案件のAI自動承認、日次整理契約外の原典移動／削除、fact-only Hook実装、新規schedule、semantic Codex Lifecycle Hook、LLM／embeddingによる再編、Idea Proposal、未承認の広範な自律書込み。採用済みの受信箱日次整理・通常ノートのrevision付き更新はこのHeldへ含めない |
| Ended | 観測宙域／Life Weather派生試作。2026-09-06に利用者が終了と製品撤去を選択。成果資料は参考証拠として保持する |
| Research | exact rollout usageの明示添付、exclusionと完全修飾IDを機械検査できる最小transient形式、意味的no-op、owner候補支援、projection、event sourcing、background maintenance。Phase 1で同型摩擦が独立2件以上観測されるまで実装へ昇格しない |

未実装案の範囲・再開条件・完了／終了済みとの区別と、利用者の依頼に基づく推奨検討順は[2026-09-09の整理](docs/reports/tsuzune-unimplemented-ideas-2026-09-09.md)を参照する。S1・S2を外し、Supermemory公開SDKを参考にしたContext整理のC10をHeld／Researchへ追加して29候補群。A6候補一覧の実装後に残る上位5件の検討順は維持する。現在の実行範囲と次の作業は上表だけを正本とする。

### ワークフロー改善第3段階 — 2026-09-08（3種連続試行完了）

親Agent `CEO-01`が調査・判断資料作成・検証・本番Vault統合を担当するPlanned作業。このCurrent Decisionを状態所有先とし、同じ根拠を再利用する連続作業なので分業しない。使用Skillは`tsuzune`と`tsuzune-execution-record`。

- 完了: (1) 日常の知識再利用を中心とする2026-09-06採用判断と現行方針を照合、(2) 既存の3評価軸から今回の改善判断メモを作成、(3) 根幹思想ノートに残っていた「AI更新履歴」「履歴付き書込み」の現行実装説明を、履歴を生成しない通常更新契約へ訂正した。思想と過去判断は保持した。
- 成功条件: (1) 主要主張と原文・取得revisionへ戻れ、過去と現行・推論・不明を区別する、(2) 判断資料が既存の評価軸と権限境界を保持し、問題と追加変更の要否を説明する、(3) 通常ノートの更新を直前fetch・revision guard・全文read-back・一意検索・リンク確認で閉じる。
- 観測範囲: 利用者の明示依頼に基づく同一task内の3種の連続試行。自然発生した独立3件、普段の使い勝手、全般的な成功率、時間・料金削減を証明しない。背景の再説明要求、不要な再取得、原資料の古い記述、実行失敗を区別する。
- 検証: 主要主張と原文の照合、必要箇所だけの文書差分検査、既存`check:workflow --checks current-decision`、本番Vaultの保存後確認。新しい検査基盤・監視・自動化は追加しない。
- 境界: 製品コード・本番binary・既存dirty差分、原典、哲学的な採用内容、過去実施記録は保持する。受信箱のtrash・move、日次整理実行、設定・schedule変更、Git公開は行わない。文書変更だけなので本体を再インストールしない。
- 観測と判断: 必要な採用根拠は取得でき、同じ根拠を判断メモへ再利用できた。一方、広い根幹思想を起点にしたContextには今回使わない索引・研究資料も含まれた。取得不能や回答誤りとは分け、この一例だけで新しい検索基盤・cache・rankingを追加しない。原資料の古い実装説明はその場で訂正した。
- 完了証拠: Vault `30_知識/TSUZUNE-ワークフロー改善第3段階-3件連続試行-実施記録-2026-09-08.md`に判断メモ、根拠revision、検証範囲、保存確認を一件に統合する。最初の日常利用確認の全場面や利用者受入を、この連続試行だけで完了へ変更しない。

### ワークフロー改善第2段階 — 2026-09-08（文書実装完了）

親Agent `CEO-01`が実施・検証・最終統合を所有し、このCurrent Decisionを唯一の進行管理先とする。既存の読取契約・Harness・終了手順を再利用する文書中心のPlanned作業とし、分業は行わない。

- 実装済み: `AGENTS.md`から`docs/mcp-integration.md`の短い読取・検証・終了手順へ接続した。Vaultの既存「開発開始と区切りの標準ループ」を運用正本とし、最終同期と検証結果は下記の一件の実施記録へ集約する。
- 実作業一件: MCP案内の受信箱整理・原典保持／退避の説明を、取得した現行AI整理運用契約に照らして修正した。原典は操作せず、設定・schedule・運用契約の権限も変更していない。
- 成功条件: (1) 現行根拠と取得revisionから修正した主要主張へ戻れ、過去・推論・未確認を区別できる、(2) 既存Harnessの選択checkと原文照合を分け、各検証が証明する範囲が分かる、(3) 対象文書と必要なVault正本を最終同期し、未完了があれば成功済み工程を繰り返さず再開できる。
- 検証: 文書のリンク・禁止境界・差分、`npm run check:workflow -- --task tsuzune-workflow-hardening-phase2-20260908 --checks current-decision`、本番Vaultへの書込み後の全文read-back・一意検索・導線確認。Harnessは文書の意味的一致や実AIの読取遵守を保証しない。
- 境界: 新しいSkill、check基盤、DB、cache、Hook、daemon、監視、全Vault整理、S1／S2の製品変更は含めない。長文取得中の版変更は今回の実作業で発生しない限り実AI未検証のまま残す。第1段階の本番反映後の停止・再起動・未同期分だけの再開を既存の終了証拠として使い、故意の本番障害は作らない。
- 本番区分: 文書のみなら既存binaryを再インストールしない。repository文書差分により`delivery_info`が`mismatch`でも、製品差分・runtime freshnessとは区別し、`match`へ戻すためだけのproduction gateは実行しない。
- 完了証拠: Vault `30_知識/TSUZUNE-ワークフロー改善第2段階-実施記録-2026-09-08.md`。第1段階の証拠は既存記録のまま保持し、同じ工程を再検証・再記録しない。

### ワークフロー改善第1段階 — 2026-09-08（完了）

初期実行者・統合責任は親Agent `CEO-01`。既存のservice／schema／callerを最小変更し、更新安全性の独立reviewと並行して関係文書を整合する。進行状態はこのCurrent Decisionに置き、別runtime・DB・Hook・管理台帳は作らない。

成功条件は (1) revisionなし・空値・古いrevisionは本文やReview提案を変更せず、matching revisionの更新／no-opが成立する、(2) 優先順位は本節、本番同一性はreceipt、運用判断は該当Vault正本へ到達し、過去証拠を現在の指示にしない、(3) typecheck・全test・MCP検査・production gateと最終Vault同期を完了すること。

採用済みの日次整理はVaultの`30_知識/TSUZUNE-AI整理運用契約.md`を権限正本とする。通常の低risk案件は概念単位の直接派生とする。当時の例外Review経路は2026-09-09の利用者依頼で廃止し、未承認の重要判断だけ必要なら会話で確認する。出典移管・参照ゼロ・exact revision等の条件を満たす処理済み受信箱Web／YouTube原典だけが復元可能trashの対象で、全Vault整理、通常原典move、永久削除、一般的な自律書込みの承認ではない。設定・schedule・trashの実行は行わない。

本番昇格元は直前のverified receiptと一致するexact source archiveに今回の差分だけを加えた境界として検証する。fingerprint対象の文書をgate前に確定し、結果と再開点は`docs/reports/production-update-latest.json`およびVaultの`30_知識/TSUZUNE-ワークフロー改善第1段階-実施記録-2026-09-08.md`へ置く。stale MCP時は書込みを止め、Codex再起動後のfreshness確認から未同期分だけ再開する。

Basesの追加修正（Properties一覧の除外・重複キー診断）は先行する本番受入区切りで完了済み。詳細は[Bases契約](.agent/requirements/20260908-bases-design/plan.md)とVaultの`30_知識/TSUZUNE-Bases読み取り専用表・本番受入-2026-09-08.md`を参照し、本段階の未完作業へ戻さない。

### 最初の日常利用確認

状態所有先はこの節。方針整備は完了。2026-09-06、本人は「AIと再利用するまで出来ている」と報告したため、入口を未使用とする前提は解除する。個別操作の受入や負担軽減まではこの報告から推定しない。現在の未確認事項は、ノートの根拠が回答へ適切に反映されたか。自動計測、別アプリ、日報、定期taskは追加しない。一件から確認してよいが結果は当該ケースに限定し、基盤の判定には上記の代表条件を揃える。必要本文とrevisionが既にContextにあれば、監査だけの追加fetchは要求しない。

| 場面 | 確認する既存経路 | 成功条件と残す最小証拠 | 状態 |
|---|---|---|---|
| 書き始める | Command Palette → Inbox capture → 本文を書いて保存 → 再読込 | 分類入力を要求されず意図した本文へ戻れる。迷った操作・やり直し・本人の感想を一例で残す | 再利用までの利用報告あり。個別操作の詳細受入は推定しない |
| 以前の考えへ戻る | 検索／Quick Switcher → 対象ノート → 出典・関連ノート／必要なら知識の時間 | 探していた考えとその根拠へ到達し、過去記述と現在判断を取り違えない。検索語・到達先・詰まった箇所を残す | 再利用までの利用報告あり。現在判断との整合を実タスクで確認する |
| AIと再利用する | 実際の継続作業で検索／fetch、必要時だけbuild_context → 回答の根拠へ戻る | 必要本文に到達し、現行と過去を取り違えず、回答の主張と原文根拠を対応付けられる。本人への追加説明要求と負担軽減は別に確認する | 利用者が実行済みと報告。回答への適切な反映は未確認。基盤レビュー完了 |

変更前後を比較できる場面だけ同じ目的で確認する。時間を測っていない場合は速度改善を主張しない。fixture成功を本人の使いやすさの証明にしない。問題がなければ機能を増やさず、3場面の確認でこの受入区切りを閉じる。

次の改善は、再現条件・期待する利用者の変化・最小の変更・確認方法を一件にまとめる。非破壊性とaccessibilityを前提に、データ安全 → 毎日の操作 → 構造表現 → 選択済み拡張の順を維持する。広域refactor、汎用plugin runtime、全Vault自動整理、Hook／schedule、終了した芸術機能の再開はこの方針だけでは承認しない。

### 過去の区切りと証拠（各記載日の状態）

以下の未実施・Next・test件数は当時の記録であり、現在の実行指示ではない。現在は上のCurrent Decisionと最新receiptを参照する。

#### 2026-09-06 観測宙域の終了・製品撤去

利用者の「では諦めよう。本番TSUZUNEからも観測宙域を消そう」により、観測宙域とLife Weather派生試作の継続を終了。製品のナビゲーション、コマンド、専用タブ、粒子描画・simulation・CSS・専用受入scriptを削除した。通常のノートとグラフを維持し、Vaultの研究ノート・履歴・試作成果は削除しない。既存の主操作テストで入口とコマンドの不在、通常グラフ操作を確認し、App安全性99 tests PASS。Ponytail Reviewで不要な残存処理・新規抽象化なし。

完了条件は (1) 製品から専用機能がなくなる、(2) 通常操作の回帰検証が通る、(3) 本番更新でpackaged／installed一致と本番profile不変を確認すること。本番反映の結果は、このsourceを含む[最新production receipt](docs/reports/production-update-latest.json)と既存Vault実施記録へ保存する。gate後はこのsourceを変更しない。撤去は本番更新まで承認済み、Git公開は今回の対象外。再開には利用者の新たな明示選択が必要。

#### 2026-09-05 P0-7 参照元リンク追従の現在地

P0-7の参照元リンク追従を実装・source検証済み。単一Markdownノートの名前変更・移動にWiki／Markdown／frontmatter参照が追従し、別名・見出し・コメント・BOM・改行を保持する。32件の安全性test、実画面の4操作と再起動後の全file一致、隔離先userData／sessionDataの実測、本番profile 273 files不変を確認した。独立reviewのblocking findingは解消済み。本番反映の完了は、このsource fingerprintに対応する最新production receiptとinstalled実画面検証を記録した既存Vault campaignを正本とする。repo内記録はgate前に確定し、gate後に結果を重複追記しない。P0-6のprofile差分は原因未特定の過去証拠として保持する。 [実装・検証証拠](.agent/requirements/20260905-obsidian-compatibility-program/results/p0-7-lossless-link-maintenance.md)。以下は各区切りの記録。

Workflow Verification Harness Phase 1は、新しいAgent runtimeを作らず、既存checkを再利用するread-onlyの証拠収集器として完了しました。Executable Policy Pilot 1で確認した`.tsuzune` creation-time sidecarの別境界は、利用者の明示選択を受けて製品sliceとして閉じました。MCP read-only経路はsidecarを読み取って論理creation timeを維持しますが、cold時の作成、malformed時のrepair、noncanonical JSONの正規化を行いません。通常scanとwrite経路は従来どおりrepairします。Harnessは`.tsuzune`除外を撤去し、宣言済みread-only tool 10件についてVault／profile全体のbyte／metadata／directory不変性と完全coverageを検査します。新しい実装Primaryは置かず、次は自然利用を観測します。[MCP read-only完全化](docs/reports/mcp-readonly-zero-write-2026-08-26.md)、[Pilot 1実装・検証](docs/reports/executable-policy-pilot-1-2026-08-26.md)、[Phase 1実装・検証](docs/reports/workflow-verification-harness-phase1-plan-2026-08-26.md)、既存の[R0 Baseline](docs/reports/current-state-compiler-r0-baseline-2026-08-23.md)を分離して扱います。

2026-08-29に、利用者の明示選択でHeldだったObsidian plugin互換候補を再開し、最小の可逆sliceとして`.obsidian/plugins/*/manifest.json`のread-only候補検出だけを本番反映しました。plugin codeの読込・実行、Obsidian API shim、enable／disable、設定data、CSS適用は含みません。現在のactive Vaultでは候補0件だったため、次は実際に使うpluginと目的が確認されるまで停止します。

2026-08-31に、利用者の明示選択で「人間は分類せず受信箱へ放り込める」をPrimaryへ昇格し、Command PaletteのInbox captureを実装・本番反映しました。2026-09-01の再設計では、原典をそのまま移動する方式をやめ、AIが再利用可能な`30_知識`候補を新しく作る方式へ更新しました。現在の最初のwrite sliceは、exact source revision・既存主カテゴリ1件・トピック1〜3件・Wiki原典linkを持つproposalをAI Reviewへ登録し、人間承認後だけ派生ノートを作ります。原典の移動／削除、自動承認、全Vault分類、Hook、scheduleはこのsliceに含めません。[現行計画](.agent/requirements/20260831-note-organization-video/plan.md#v5-category-aware-derivation-continuation--2026-09-01)

2026-09-01に、同じ「分類せず受信箱へ放り込む」入口をChrome／Edgeへ拡張しました。Web／YouTubeクリップは一般的な操作履歴ではなく、URL・取得時刻・取得IDを持つ外部原典スナップショットとして毎回新規作成します。通常Webはローカル同梱したMozilla Readabilityで記事本文を抽出し、短文・特殊ページだけ表示DOMへ戻します。YouTubeは可視文字起こし、パネル展開、現在動画IDと一致する字幕トラックを先に使い、取れない時または途中取得の時だけ設定・Cookieを読まないローカル`yt-dlp`へ一度戻ります。2026-09-02に、通常本文と字幕の16,000文字／48 KiB／64 KiB切断を撤去し、原典は完全保存、10万文字超はrevisionを保った`fetch` cursorでAIが分割読取する境界へ変更しました。専用loopbackは固定拡張ID・明示ペアリング・`01_受信箱`へのcreateだけを許し、一回8 MiBを超える要求は部分保存せず拒否します。既存Drive bridge、更新、任意path、Native Messaging、広域host権限、cloud文字起こし、新しい`50_履歴`を追加しません。[Browser Clipper](docs/browser-clipper.md)

2026-09-03に採用した観測宙域は、複数の表現試作と音楽反応の実現可能性調査を経て、2026-09-06に利用者判断で終了しました。製品から専用機能を撤去し、過去の試作・検証結果は参考証拠として保持します。[終了済み開発計画](.agent/requirements/20260903-0032-existence-phase-observatory-mvp/implementation-plan.md)

2026-09-05に、工房主は「追いつかないと追い抜けない」としてObsidian互換性を現行Primaryへ変更しました。公式Help、現行source、固定Obsidian 1.13.4 evidenceを分離した互換性台帳を作り、最初のP0としてExcluded filesのscan-level一律除外をsurface-specific contractへ変更しました。current sourceではFile Explorer／raw snapshotが対象を保持し、Search／Graphは隠し、Quick Switcher／editor link候補は削除せず後順位にします。MCPのfiltered retrievalは維持します。全986 tests PASS／1 SKIP、typecheck、独立8-file 243-test検証はPASSです。本番反映とGit deliveryは行っていません。工房主は続く優先順位を、(1) データを壊さない互換性、(2) 毎日の操作互換性、(3) 構造表現の互換性、(4) 選択した拡張だけの互換性、と正式決定しました。達成境界は「同じlocal Vaultを内容・metadata非破壊で開き、日常の作成・編集・検索・再開ができること」で、文字列PropertiesはP0-2でsource実装・検証済みです（focused 63／全体1045 tests PASS、1 SKIP、typecheck／独立review PASS）。先行2回の全体runはOOMでFAIL、原因は未確定です。P0-3で数値／単純listのauthoringもsource実装・検証しました（focused 117／全体1099 tests PASS（1 SKIP）、typecheck／独立review PASS）。P0-5のチェックボックス型Propertiesは追加・切替・削除・preview・保存・再読込をsource実装し、全体1124 tests PASS（1 SKIP）、隔離した固定Obsidian 1.13.4との実機26検査をPASSした。真偽値の切替・再起動後の状態は一致。新規未チェック値（TSUZUNE=false／Obsidian=空欄）とコメント／BOM／改行の保存は異なり、TSUZUNEの非破壊保存を維持する。再起動後にMCPの記録同期を完了し、既存campaignと3入口をrevision付きで更新、読み戻し・一意検索・相互リンクを確認した。Ownerが2026-09-05に現source全体を既存の検証・更新手順で導入することを明示承認した。対象はExcluded files、各型Properties編集、Context利用・状態由来レシートを含む現tree。導入結果はdocs/reports/production-update-latest.jsonの本承認後のreceiptとdelivery_infoを正本にし、既存campaignへ受入証拠を保存する。新機能やGit公開は自動着手しない。[互換性Program](.agent/requirements/20260905-obsidian-compatibility-program/plan.md)／[台帳](.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)／[P0-1 Evidence](.agent/requirements/20260905-obsidian-compatibility-program/results/p0-1-excluded-files.md)

### Success Conditions

本Program全体の成功は、機能数ではなく次で判定します。

- silent omission 0
- incorrect apply 0
- protected path mutation 0
- stale overwrite 0
- 適用した判断のsource traceability 100%
- no-op時のMarkdown・履歴・sidecar書込み0
- rollback対象のbyte-level復旧100%
- owner不明・根拠不足・矛盾を成功扱いしない
- 現行方式より利用者の確認時間または訂正回数が悪化しない
- Markdownだけで現在状態を読め、専用DBやUIを失っても知識が残る

## 2. 正本と事実の優先順位

判断が食い違う場合は、次の順で現物を再確認します。

1. 実行中の事実: installed runtime、active MCP、production receipt。
2. 実装の事実: source、tests、fixture、machine-readable artifact。
3. 製品境界: `PRODUCT.md`、`DESIGN.md`、`AGENTS.md`。
4. 実行順: この`PLAN.md`のCurrent DecisionとCurrent Transition。
5. 本番TSUZUNE: 判断、開発知識、運用記録、日付付きEvidence。
6. Git履歴・過去レポート・共有会話: historical evidence。現行仕様へ自動昇格しない。

`git HEAD`、SemVer、dirty working tree、installed appは別の事実です。最新receiptが`installed-and-verified`でも、その後のdirty sourceを本番導入済みとは扱いません。

## 3. Product Contract

### North Star

> TSUZUNEは、本人と交換可能な外部AIがMarkdownの知識を見失わず、根拠と時間を保って再発見・再利用し、次の知識へ循環させるための、人間優先の構造探索基盤である。

### 不変条件

1. Markdownと添付ファイルを正本とし、アプリ専用DBを読むための必須条件にしない。
2. 1人・1台・Windows・ローカル利用を既定とする。
3. 1つの可変な現在状態には、1つのcanonical ownerだけを割り当てる。
4. MOC・一覧・ダッシュボードは入口と関係を持ち、可変状態を複製しない。
5. 原典、監査履歴、認証情報はAIの自律更新対象にしない。
6. AIの意味判断は推論であり、観測可能なsafe gateをすべて満たすInboxのlossless one-note moveだけを自動適用できる。根拠不足・矛盾・owner不明は事実へ昇格せず、人間判断へ返す。
7. 更新前にtarget、base revision、reason、source refsを確定する。
8. 失敗時は利用者データを保持し、成功と部分成功を混同しない。
9. 通常の作成・更新・整理で履歴ノートを生成しない。既存の`50_履歴`はlegacyとして保護し、通常導線とAI更新対象から外す。
10. 新runtime、DB、cache、daemon、外部依存は、既存経路で代替不能な測定証拠が出るまで追加しない。選択済みのHookはInboxのfact-only通知に限定し、意味判断やmutationを持たせない。
11. UIは補助面であり、UIだけに正本・proposal・復旧情報を閉じ込めない。
12. 「探索は大胆に、書込みは慎重に」を全mutationへ適用する。

### Non-goals

- 全Vaultの自動整理
- AIによる自動真偽判定
- 行動履歴の常時収集
- 複数人承認や組織workflow
- cloud前提、account前提、遠隔hosting
- Vector DBやevent sourcingを使うこと自体
- Graphの見た目やリンク数を成果指標にすること
- 全ノートを単一schemaへ一括移行すること
- AIをTSUZUNE内部へ常駐させること

## 4. Target Architecture

```text
Immutable Evidence / Source
            ↓
Existing Context Compiler + Temporal Memory
            ↓
Read-only Current State Packet
            ↓
State Transition Proposal
            ↓
Owner / Evidence / Invariant / Revision checks
            ↓
Canonical Owner 1件だけを更新
            ↓
Response Provenance + Result Receipt（Vault履歴ノートなし）
            ↓
MOC・検索・Contextから必要時に再構成
```

### 4.1 Information Layers

| Layer | 責務 | 永続性 | 書込み境界 |
|---|---|---|---|
| Evidence | 原典、観測、検証結果 | 永続 | 原則immutable |
| Canonical State | 現在の結論、状態、制約、次の境界 | 永続 | owner 1件へrevision付き更新 |
| Navigation | MOC、Wiki link、検索導線 | 永続 | 関係が変わる場合だけ更新 |
| State Packet | 現在状態、根拠、不確実性、omission | 一時 | read-only |
| Proposal | Before / After / Why / Evidence | 承認待ちのみ | 適用前はVault本文を変更しない |
| History / Receipt | 旧版、理由、出典、結果 | 永続 | 製品管理。現在状態の正本ではない |

### 4.2 State Packet Contract

State Packetは最低限、次を持ちます。Phase R1で名称と型を固定するまで公開APIにしません。

```text
target
canonical_owner
base_revision
as_of
temporal_perspective
current_state
observed_change
proposed_state
evidence_refs
uncertainties
conflicts
omitted_ids
freshness
affected_boundary
expected_outcome
```

### 4.3 Outcome Contract

| Outcome | 意味 | 書込み |
|---|---|---|
| `NO_CHANGE` | 完全一致、または人が変更不要と確定 | 0 |
| `PROPOSED` | 根拠付き変更案。未適用 | 0 |
| `BLOCKED` | owner不明、根拠不足、意味不確実、必須入力不足 | 0 |
| `CONFLICT` | 証拠・状態・revisionが競合 | 0 |
| `APPLIED` | guardと再読を通過した正本1件の更新 | 1 canonical。provenance／receiptは応答または外部Evidenceで返し、履歴ノートは作らない |
| `PROJECTION_PENDING` | 正本は成功したが補助導線が未完 | 正本成功をrollbackせず未完了表示 |

意味的no-opをモデルが自動保証するとは定義しません。自動保証は完全本文一致までです。意味が不確実なら`BLOCKED`が正しい結果です。

## 5. Program Operating Model

### 5.1 One-slice Rule

- Primaryは常に1件。
- 各sliceは1つの仮説、1つの主要成果物、固定fixture、明示されたstop conditionを持つ。
- 調査完了、test PASS、候補枯渇だけを理由に次sliceへ自動着手しない。
- Phase出口で利用者の明示選択、またはPLANに記載した再開条件を確認する。

### 5.2 Evidence Packet

各sliceは次のpacketを残します。

- objective / non-goals
- canonical sourceとbase revision
- 変更対象fileと禁止範囲
- fixed fixtureと期待結果
- comparison baseline
- 実行commandと結果
- failure injection結果
- data-loss / security / accessibility / performance境界
- adopted / rejected判断
- rollback手順
- residual risk
- next actionとstop condition

### 5.3 Change Control

- 契約変更はfixtureと期待結果を先に変更し、実装を後から合わせる。
- Phase中に新しい責務が必要になった場合、scopeを広げず次Phase候補へ戻す。
- 既存のdirty変更を整理目的で削除・移動・rewriteしない。
- 生成artifactと手書き正本を分ける。再生成可能なものを仕様正本にしない。
- 日付、test件数、hash、価格、外部仕様は現物を再確認し、PLANへ可変値を重複保存しない。

## 6. Historical Transition Design — R0〜R10（Held）

以下は過去のcompiler構想の設計であり、現在のPrimary／Nextではありません。

### R0 — 現行状態の凍結とPilot選定

**目的:** 新設計を既存機能の再命名にせず、現行能力・不足・本番境界を固定する。

**入口条件**

- dirty worktreeを保存し、今回所有外の変更へ触れない。
- production receipt、active MCP、sourceの一致・不一致を別々に記録する。
- 根幹思想、Context設計、直近監査、現行PLANを取得済みにする。

**作業**

1. Context、Temporal、MCP、Review、Vault save、history、UI、production gateの責務表を作る。
2. 公開mutationと保護pathを列挙する。
3. 状態が複数ノートへ複製されている実例をread-onlyで3件以内調査する。
4. owner候補を`canonical / projection / evidence / history / unknown`へ分類する。
5. Pilotを1プロジェクト、canonical候補1件、evidence 3件、MOC 1件に限定する。

**比較**

- 何もしない。
- 現行full-content / patch運用を明文化するだけ。
- 単一正本・State Packetを試す。
- DB/event sourcingへ全面刷新する。

**検証**

- sourceとtestの対応表
- current productionとdirty sourceの境界
- owner候補の人手review
- 現行方式だけで解決可能かという反証

**出口条件**

- 現行機能と新規責務を説明できる。
- Pilotのowner候補が1件以下。
- 新DB・Hook・全Vault scanなしでR1を実行できる。
- 実装開始前のunknownが一覧化されている。

**Rollback:** 文書・fixture候補だけを破棄し、現行製品へ影響0。

**Kill criteria:** ownerを1件に絞れない、source/runtime境界が不明、既存機能だけで目的を満たすと判明した場合はR1へ進まない。

**2026-08-23結果:** 能力・runtime/source境界・R1 fixture briefは確定した。一方、調査した3候補はcanonical／projection／evidenceの意図的分離であり、防御可能な重複状態の実例は0、Pilot候補はなし。kill criteriaに従いR1は未承認とする。詳細は[R0 Baseline](docs/reports/current-state-compiler-r0-baseline-2026-08-23.md)。

**2026-08-23再開可否比較:** 利用者がTSUZUNEと1つの状態命題を明示選択したため、既存方式と13-field State Packetを同一入力・write 0で比較した。State Packetはsource traceとuncertainty visibilityを改善したが約284%長く、事前登録した増加上限50%を超えた。結論は`NO_CHANGE`で、これはR1の15-case fixtureやschema contractの完了ではない。詳細は[R1 State Packet Comparison](docs/reports/current-state-compiler-r1-state-packet-comparison-2026-08-23.md)。

**2026-08-23 Compact Envelope benchmark:** oracleを隠した5つのsynthetic fixtureで通常文と最小transient envelopeを比較した。Envelopeはutility 10/10対8/10だったが、details内の短縮IDによりexact trace gateを落とし、2,437対935 code pointsで約160.6%長かった。通常文にも明示除外のsilent omissionがあり、両方式の穴を検出したが、採用条件は満たさない。結論は`NO_CHANGE`、R1とEnvelopeはHeld。詳細は[5-case benchmark](docs/reports/compact-decision-envelope-benchmark-2026-08-23.md)。

### R1 — 契約と固定fixture

**目的:** 実装前に正しい停止状態を含む期待結果を固定する。

**成果物:** State Packet schema draft、Outcome state machine、owner判定規則、minimum 15-case fixture、expected-results manifest、no-write digest baseline。

**必須ケース**

1. 完全本文一致。
2. 表現だけ異なる意味的no-op。
3. 実質的な結論変更。
4. 同じ結論を補強する新証拠。
5. 矛盾する証拠。
6. owner不明。
7. owner候補複数。
8. stale revision。
9. target消失。
10. protected path。
11. source refsなし。
12. excluded evidence。
13. omitted_idsあり。
14. 未変更情報を落とすfull rewrite。
15. LF / CRLFだけの差。

**検証:** 期待結果を人が先に確定し、read-only runでVault write 0、`BLOCKED`と`CONFLICT`を正常系として検証します。同じ入力を複数回実行して構造結果を比較します。

**出口条件:** 15/15で期待Outcomeを定義、曖昧ケースの自動適用0、正本以外の変更提案0、source trace欠落0、silent omission 0。

**Rollback:** fixtureとschema draftの削除だけ。製品code・本番Vault変更0。

**Kill criteria:** 期待結果を人が一意に決められないケースを自動化対象から外せない、または意味判定をモデル精度だけへ依存する場合は停止。

### R2 — Read-only Current-State Compiler Prototype

**目的:** 既存Context Compiler出力から、書込みなしでState Packetを再構成できるか検証する。

**実装境界**

- 最初はpure coreまたはtest-owned adapter。
- 新MCP tool、UI、DB、cache、daemonを追加しない。
- `buildContextBundle`、Temporal、revision、warnings、omitted_idsを再利用する。
- semantic classifierを新設しない。不確実なら`BLOCKED`。

**比較対象:** A=`fetch + build_context + 人手判断`、B=logical delta手順、C=read-only State Packet、D=event sourcing案（複雑化の反証のみ）。

**評価指標:** 状態再構成、source trace、silent omission、不正な確定、`BLOCKED`率、Context文字数、wire bytes、latency、確認時間、訂正回数。

**検証:** R1全fixture、同一入力の構造安定性、malformed/future/historical/review_due、100/1,000/10,000 notes、dense backlinks、大量history、budget到達、omitted_ids、secret/local path漏洩を確認します。

**出口条件:** R1の安全指標維持、現行Aよりsource到達性を下げない、read-only digest不変、既存Context Compilerとの責務差が明確、性能の測定範囲が明示されている。

**Rollback:** prototypeを除去して既存Context Compilerへ戻す。

**Kill criteria:** 現行Aより確認が容易にならない、単なる要約の別名、source到達性低下、または誤書込み1件でR3へ進まない。

### R3 — Adversarial Comparison Gate

**目的:** 新方式が現行方式より安全・再構築可能であるかを同一fixtureで反証する。

**敵対境界:** owner同名別path、alias/symlink/大小文字/Unicode、same size、same mtime+sizeの本文変更、fetch後の外部更新、2 agent、watcher、rendererとMCP同時更新、Vault切替、malformed metadata、future leakage、excluded/deleted evidence。

**出口条件:** incorrect apply候補0、silent omission 0、unsafe caseを`BLOCKED`/`CONFLICT`へ分類、少なくとも1実測指標が改善し他の安全指標が悪化しない。

**Rollback:** R2を研究artifactへ戻し、現行運用を継続。

**Kill criteria:** 安全性・確認負荷・再構築性のいずれも改善しない、または比較条件を揃えられない場合は製品化しない。

### R4 — Single-owner Pilot Migration

**目的:** 1プロジェクトだけを、可変状態の単一ownerと導線中心のMOCへ移行できるか確認する。

**入口条件:** R3合格、対象とowner候補を利用者が承認、pre-migration byte manifest/link map/Context baselineを作成、本番Vaultではなく隔離copyで先行。

**手順:** owner候補抽出 → 重複/矛盾一覧 → 人間承認 → canonical確定 → MOC導線化評価 → 隔離preview → search/backlink/Context/Temporal比較 → exact-byte rollback。本番適用は別承認です。

**互換性:** 既存形式を一括変更しない、frontmatterはPilot限定、owner不明を自動統合しない、旧参照を保持し、navigationへ状態を再コピーしない。

**出口条件:** owner 1件、壊れたWiki link 0、search/fetch/build_context到達性維持、時点誤混入0、byte-level rollback 100%。

**Kill criteria:** owner整理不能、link/Temporal/provenance欠落、MOCへの状態複製が必須なら中止。

### R5 — Guarded Single-note Apply

**目的:** Proposalを既存revision・Review・readback経路でcanonical owner 1件だけへ安全に適用する。

**先行安全課題:** 保存直前のcontent hash境界、full rewriteの欠落、空reason/source refs、承認待ち中のtarget変更・Vault切替、成功応答前のreadback失敗。

**必須ガード:** expected revision、target/canonical path、immutable/review policy、reason、evidenceまたは外部Evidenceなしの明示、byte preimage、保持section検証、post-write read-back、valid result receipt、stale runtime guard。

**failure injection:** proposal後、temp write、rename前後、read-back前、receipt前後、process interruption、concurrent edit。

**出口条件:** stale/protected/missing拒否、no-op全書込み0、成功時だけ正本とreadback／result receiptが対応、失敗を成功として返さない、履歴ノート生成0、proposalとread-back一致。

**Rollback:** preimageからcanonical 1件だけをrevision付き復元。

**Kill criteria:** 孤立履歴、same mtime/size競合、情報欠落、部分成功隠蔽を解消できなければread-only proposalへ戻す。

### R6 — MCP Proposal Contract

**目的:** R2/R5を外部Agent向けの最小proposal・承認経路へ接続する。

最初はread-only proposalとし、既存`fetch`、`build_context`、Review store、stale guardを再利用します。common/direct toolを増やす前に既存tool組合せとの差を測り、自動/bulk/background applyを追加しません。

このR6は汎用proposal programの境界である。2026-09-01に選択されたInbox派生知識laneは、専用の`propose_derived_note`で一件のAI Review proposalだけを登録し、人間承認後に`30_知識`へ新規作成する。原典move、自動承認、全Vault、merge、delete、rename、split、意味上の矛盾解消はこの例外に含めない。

**検証:** schema/response size、transport、source refs、revision、omitted_ids、warnings、Vault identity、Codex/Freebuff、stale/protected/write count。

**出口条件:** contract fixture全PASS、既存tool組合せより誤操作または確認負荷が減る、proposal callのwrite 0、異常時fail-closed。

**Kill criteria:** 既存toolの別名、schema負荷が価値超過、host間不一致なら追加しない。

### R7 — Human Review Surface

**目的:** 変更を短時間で監査できるUIを既存Review surface上へ最小追加する。

表示はcurrent/proposed、Before/After、reason/evidence、uncertainty/conflict、revision/freshness、apply不可理由、rollback可能性に限定します。通常は短い結論、異常時だけ詳細を展開し、AI dashboardへ拡張しません。

**検証:** keyboard-only、focus、Escape、720px、Windows 100/125/150/200%、screen reader名、High Contrast、long path/日本語、conflict、stale/apply failure/restart、isolated Electron、Markdown digest不変。

**出口条件:** 適用可否と根拠を誤認しない、現行Reviewより確認時間が悪化しない、accessibility P0=0、意図しないMarkdown変更0。

**Kill criteria:** 確認時間/訂正回数の悪化、情報過多、UIを正本にしないと成立しない場合は撤回。

### R8 — Temporal・Conflict Lifecycle

**目的:** current/historical/future/superseded/review_due/conflictを混同しない。

**検証:** valid/knowledge time、future leakage 0、ended state混入0、conflicting current warnings、unknown observed_at、malformed metadata、訂正/撤回/supersede、履歴なし再構築。

**出口条件:** 時間指定の有無でsource追跡可能、conflictを自動解決しない、stale evidenceを無警告昇格しない。

**Kill criteria:** metadata大量追加、既存Temporalより誤混入増、利用者が時点を理解不能なら拡張しない。

### R9 — Matched-pair Dogfood

**目的:** 革新性をdemoではなく自然な実作業で判断する。

20〜30件の自然taskを同一Vault・同一情報時点で現行方式とmatched pairにし、no-op、変更、補強、矛盾、owner不明、競合を含めます。task success、source trace、omission、incorrect/unnecessary apply、確認時間、訂正数、rollback、Context、latency、history増加を測ります。

**合格条件:** Program Success Conditionsを維持し、最低2回の独立taskで改善再現、確認時間または訂正回数の一方が現行以下、利用者が現在/変更/理由/証拠/不確実を説明可能。

**Kill criteria:** 誤適用1件、silent omission 1件、監査負荷の反復悪化、または日常利用で選ばれなければ全面展開しない。

### R10 — Production Rollout and Closeout

**順序:** targeted tests → `npm run typecheck` → `npm test` → `npm run check:mcp` → `git diff --check` → packaged smoke → installed smoke → EXE/`app.asar` hash → profile digest → MCP registration → receipt → 利用者承認後のbounded live acceptance。

**段階公開:** A=read-only packet、B=proposal、C=review pathだけのsingle-note apply、D=承認済みPilot、E=dogfood合格後の通常利用候補。

**出口条件:** production gate全PASS、source変化/merge conflict/whitespace error拒否、hash一致、profile不変、installed runtimeでread/proposal/applyを分離検証し、PROJECT_STATUS/PLAN/TSUZUNEを最終境界で一度ずつ同期。

**Rollback:** 直前verified installer/receiptへ戻し、新経路を無効化。Vault本文は履歴/preimageから個別復旧。

**Kill criteria:** hash不一致、profile変化、MCP登録失敗、production Vault自動open、active app強制終了、必須gate失敗で出荷停止。

## 7. Verification Architecture

### 7.1 Test Layers

| 層 | 対象 | 主な証拠 |
|---|---|---|
| L0 Static | 型、schema、link、format | typecheck、schema test、Markdown link check |
| L1 Pure contract | Outcome、owner、packet、temporal | deterministic fixture tests |
| L2 Storage | atomic save、history、revision、rollback | temp Vault、failure injection |
| L3 Service | MCP、Review、protected path、stale runtime | service/contract tests |
| L4 UI | review、keyboard、focus、viewport | component + isolated Electron |
| L5 Package | packaged/installed runtime | smoke、hash、profile digest |
| L6 Live | bounded production dogfood | explicit approval、receipt、read-back |

下位testのPASSを上位の代替にしません。UI testはinstalled runtimeを証明せず、installed smokeは意味的正しさを証明しません。

### 7.2 Core Invariants

- canonical以外の本文を変更しない。
- 変更対象外sectionを保持する。
- previous revisionとsource refsを追跡できる。
- no-opは履歴を作らない。
- stale revisionは全書込み0。
- protected pathはalias/symlink経由でも拒否。
- failure時にtemp file、partial projection、成功receiptを残さない。
- restart後にcanonicalから現在状態を再構築できる。
- 履歴がなくても現在状態を読める。
- proposalとapplied contentが一致する。

### 7.3 Comparison Discipline

- A/Bは同一fixture、task、時点、測定範囲で行う。
- wire bytesをmodel-visible token、費用、品質の代理にしない。
- synthetic benchmarkと自然taskを分離する。
- 1件、平均、最良値だけで一般化しない。
- latencyはmedian/p95/worstと測定範囲を残す。
- SKIP、BLOCKED、未比較をPASSへ読み替えない。

### 7.4 Security and Privacy

- Vault外path traversal拒否。
- `40_情報源`と`50_履歴`の自律mutation拒否。
- symlink/alias/大小文字による保護回避拒否。
- secret/OAuth/token/巨大Rawをpacket/historyへ保存しない。
- source refの実在を検査し、由来不明をverified evidence扱いしない。
- AI出力を本人確認済み事実へ自動昇格しない。
- active production Vaultをisolated smokeで開かない。

### 7.5 Performance and Capacity

100/1,000/10,000 notesを固定条件で計測します。大量history、dense backlinks、owner複数、budget上限、omitted_idsを別fixtureにし、scan、Context、packet、proposal、apply、restart reconstructionを分けて測定します。性能改善はR2以降の実測で必要になった場合だけ行い、先行cache/index/DBを作りません。

## 8. Risk Register

| Risk | 兆候 | 予防 | Stop / Recovery |
|---|---|---|---|
| AI意味誤判定 | operatorごとにOutcomeが変わる | uncertainを`BLOCKED` | 自動適用停止 |
| owner曖昧 | 複数候補、重複状態 | R0/R1で人手確定 | migrationしない |
| 情報欠落 | rewrite後にsection消失 | patch優先、保持比較 | preimage復旧 |
| multi-note非原子 | MOCと正本が不一致 | 状態複製をやめる | canonicalを正とする |
| orphan history | historyのみ作成 | failure injection | 未適用識別・復旧 |
| revision race | stale proposal適用 | revision再検査 | write 0で`CONFLICT` |
| source/runtime drift | sourceだけ新しい | receipt/delivery status | production claim停止 |
| 派生情報陳腐化 | 古いsummary残存 | transient packet | projectionを永続化しない |
| UI認知負荷 | 確認時間・訂正増 | progressive disclosure | UI撤回 |
| schema増殖 | frontmatter大量追加 | Pilot限定 | 一括migration停止 |
| performance悪化 | p95増、全Vault scan | bounded context | scope縮小を優先 |
| privacy漏洩 | packet/historyへsecret | 保存禁止 | write停止、artifact破棄 |
| roadmap drift | Heldが自動昇格 | 4状態分類 | 現物から再構築 |

## 9. Complete / Held / Research Ledger

### Complete — 再実装しない

- Markdown編集、検索、Wiki link、backlink、Context。
- Temporal Memory Lite。
- revision付き単一note更新、exact-content no-op、exact patch。
- Review proposalと承認時revision再検査。
- 通常更新の履歴生成停止、legacy provenance読取、protected path。
- stale runtime guard、delivery info。
- Drive preview/apply、Path Alias、単一note move。
- Quick Switcher、Command Palette、Full-text Search、context tabs。
- packaged/installed smoke、hash、profile digest、MCP再登録を含むproduction gate。

詳細は[PROJECT_STATUS.md](PROJECT_STATUS.md)と[docs/INDEX.md](docs/INDEX.md)へ残し、このPLANへ日付付き長文を複製しません。

### Held — 再開条件まで着手しない

| Candidate | Resume condition |
|---|---|
| X1-C2 Context budget | R2でContext量が主要ボトルネックと判明 |
| BM25/cache/index | 既存検索が固定scaleでSLO未達 |
| SQLite/Vector DB | Markdown + bounded indexで正しさ・性能を満たせない証拠 |
| semantic Hooks/co-occurrence | 反復する具体的missとread-only trial合格。選択済みのInbox fact-only Hookは含まない |
| static Knowledge Compilation | transient packetで解決不能な反復摩擦 |
| Compact Decision Envelope | 完全修飾IDと明示除外の機械検査を事前登録し、5-case安全gate全PASSかつ総量が通常文以下 |
| multi-note transaction | single-ownerで避けられない実例とrollback要件 |
| Windows accessibility広域baseline | 対象UI slice選定後に実機測定 |
| Google/ChatGPT/NotebookLM intake | provenanceと明示需要が成立 |
| cross-device/collaboration | 個人1台の前提が明示的に変更 |

### Research — 実装ではない

semantic no-op補助判定、owner candidate ranking、projection freshness、event sourcing比較、vector retrieval、autonomous maintenance、model/host差を研究対象にします。研究成果はEvidenceであり、採用には観測摩擦、比較fixture、最強の反証、最小可逆案、明示された再開条件が必要です。

## 10. Definition of Done

### Documentation / Research

- objective、scope、non-goal、fixture、期待結果がある。
- 現行実装・本番・歴史証拠を分離。
- 比較対象と不採用理由がある。
- read-back可能なartifactとTSUZUNE実施記録がある。
- code変更がなければproduction updateしない。

### Code

- public behaviorを検出する最小testが先にある。
- targeted test、typecheck、関連service testがPASS。
- data-loss、stale、protected path、failure injectionを確認。
- Ponytail reviewで重複責務、新依存、将来足場を除去。
- dirty worktreeの所有外変更を保持。

### MCP

- schema、description、catalog、transportを固定。
- `npm run check:mcp` PASS。
- stale runtime、Vault identity、protected path、write countを確認。
- read-only toolがwrite 0。

### UI

- component testとisolated Electron acceptance。
- keyboard、focus、720px、100〜200%、screen reader名、High Contrast。
- Markdown digest不変、dirty editor保持。
- visual evidenceだけでbehavior PASSにしない。

### Production Milestone

- repository gateを規定順で一度通す。
- packaged/installed hash一致、profile不変、MCP再登録、receipt更新。
- active production Vaultを自動smokeで開かない。
- installed runtimeでbounded acceptance。
- PROJECT_STATUS、PLAN、TSUZUNEを最終境界で一度ずつ同期。

## 11. Next Authorized Slice

現在のPrimary／Nextと日常利用確認の状態は[Current Decision](#current-decision)だけを参照する。過去のP0受入は互換性台帳と日付付きEvidenceに保持する。

今回の方針整備は文書のみ。製品コードと本番binaryは変更せず、再インストールしない。文書もsource fingerprint対象のため、文書更新後のdelivery_infoはmismatchになり得る。本番製品の機能差と混同せず、最新receiptが証明する受入時点を保持する。次の製品変更時は、その時点の文書を確定して通常のproduction gateを通す。
