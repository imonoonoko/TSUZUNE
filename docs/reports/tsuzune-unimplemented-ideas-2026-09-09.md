# TSUZUNE 未実装案の整理 — 2026-09-09

## 結論と読み方

現在の実行方針は[PLAN.mdのCurrent Decision](../../PLAN.md#current-decision)が所有する。S1・S2の本番反映と最終同期、S2の追加review後の「優先順位整理」に基づく順位を示す。続く「設計開始」「開始」で選択された**Basesを一覧から選んで開く操作（A6の一部）**はsource実装・検証済み。[実装・受入](../../.agent/requirements/20260908-bases-design/implementation.md)と対応receipt・Vault記録を参照する。日常価値の評価軸は「分類せず書き始める」「以前の考えと根拠へ戻る」「外部AIへの背景説明を減らす」。全面Obsidian互換や機能数を完成条件にしない。

- **未実装候補:** 選択すると何を作るか説明できる案。設計済みでも実装承認済みとは限らない。
- **Held（保留）:** 需要・比較・権限などの条件が成立するまで着手しない。
- **Research（研究）:** 仕様や有効性を先に確認する。実装queueに入れない。
- **Complete／Ended:** 完了済みの機能と、終了・撤回した構想。未実装案として再掲しない。

以下は現在確認できたrepo設計・互換性台帳・Vault roadmapの候補索引。推奨する検討順は第7節へ集約し、以下の行番号順・旧P番号を現在の実装順にはしない。旧ロードマップだけに残る案はその旨を明示した。すべての過去会話、全syntax、実機動作を網羅監査したものではない。

2026-09-09 S2完了後の再整理: A1／S1とA2／S2は第6節のComplete。S2はreceipt `2026-09-08T20:34:23.366Z`、fresh MCPと最終Vault記録で本番受入を確認した。Supermemory公開SDKを参考にしたC10の追加後、未実装は**29候補群**（A群4、B群11、C群10、D群4）。第7節はA6候補一覧を除いた上位5件の検討順。AI承認廃止と欠落タブ通知改善も本番反映済みであり、残工事へ数えない。A6候補一覧は実装済みへ移し、formula等の未実装部分が残るためA6候補群は保持する。

## 1. 具体化している未実装候補

| ID | 案・利用者にとっての変化 | 既存機能との差／未実装部分 | 状態・着手条件 | 根拠 |
|---|---|---|---|---|
| A3 | Propertiesの型をVault全体で管理する | 使用箇所・型混在を見るInventoryと読取UIは実装済み。未実装は明示型Registry、保存形式、空値・混在値・型変更契約 | **Held。** Inventoryで全体管理需要が成立した後、Step 4の型管理契約を決め、Step 5を別sliceで設計する | [Properties plan Step 3〜5](../../.agent/requirements/20260908-properties-global-management-design/plan.md#step-4--型管理契約の決定ゲート未着手) |
| A4 | Property名・値を複数ノートでそろえる | 全体リネーム、型変換、値の正規化。単一ノートのProperties編集とは別機能 | **Held・別承認。** dry-run、対象数、各revision、衝突拒否、失敗時保全を先に固定する | [Properties plan Step 6](../../.agent/requirements/20260908-properties-global-management-design/plan.md#step-6--複数ファイル変更別承認) |
| A5 | Basesの表からノートのPropertyを編集する | 固定profileの読み取り専用表・filter・sort・再読込・ノート遷移は実装済み。未実装はcell editと安全な書戻し | **Held。** 編集機能を明示選択し、既存のrevision／atomic write／保護境界を使う別sliceを定義する | [Bases plan](../../.agent/requirements/20260908-bases-design/plan.md)、Vault `TSUZUNE-O1-O4-知識操作互換` |
| A6 | Basesの表示を広げる | formula、cards／list等の他view、summary／group。候補一覧と既存read-only tableは実装済み | **残る拡張はHeld／Research。** 高度関数、date arithmetic、完全YAML、規模性能、複数view保存は先に調査 | [候補一覧の実装・受入](../../.agent/requirements/20260908-bases-design/implementation.md)／[既存Bases plan](../../.agent/requirements/20260908-bases-design/plan.md) |

## 2. 日常操作・Obsidian互換の候補

共通の根拠は[互換性台帳](../../.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)。`different`は機能が一部あること、`not_proven`は比較不足であり、丸ごとの未実装を意味しない。互換差の全件解消は採用していない。

| ID | 候補群 | 現在あるものと、残る範囲 | 次に必要な境界 |
|---|---|---|---|
| B1 | Live Preview・Markdown構文の操作 | Source編集・preview・保存はある。Live Previewと未対応syntaxの操作拡張が候補 | 日常で必要なsyntaxを一つ選び、非破壊保存と比較fixtureを定義 |
| B2 | 検索・リンク候補の互換差 | 全文検索、operators、抜粋、リンク候補はある。grammar／history／collapseや候補順位の残差 | 具体的な差分を再現。完了済みS1の一致抜粋fallbackを再計上しない |
| B3 | 未リンク言及・hover preview | バックリンクとpreviewはある。本文中の未リンク言及の一覧、リンクhover時のbounded previewは未実装 | 対象範囲、除外規則、表示と遅延の契約を決める |
| B4 | Outline・Bookmarksの拡張 | 見出しjump、bookmark保存はある。Outlineの操作一式、heading／search bookmark、group／order UIが候補 | 既存機能で足りない操作を一つ選ぶ |
| B5 | 日常の入力・呼出し | Daily notes、Templates、Command Palette、固定shortcutはある。custom hotkeys、slash commands、unique note creator、word count、footnotes viewは未実装候補 | 各機能を個別に選択。template property merge／cursor挙動は非破壊契約を先に固定 |
| B6 | ワークスペース配置の拡張 | 名前付き保存／開く／更新／削除、Vault別の前回状態復元は完了。分割pane・可変sidebar幅などは旧O1案に残る範囲 | 名前付きworkspaceの残工事とせず、必要な配置を別選択。Obsidianとの全面比較は未確認 |
| B7 | 添付・Graphの操作差 | 添付preview／move／外部open、Local／Global Graphはある。全context menu、pane、Local depth/filter、見た目の残差が候補 | 対象surfaceを選び、最新sourceのpaired fixtureを採る。広域Graph拡張へ自動昇格しない |
| B8 | Canvas | `.canvas`を扱う製品surfaceが未実装 | card／edgeとround-tripの最小契約。視覚表現よりデータ保全を先に決める |
| B9 | 復旧・変換・ノート編集の拡張 | 安全保存、衝突拒否、trash、Drive同期はある。file recoveryのsnapshot／復元UI、format converter、note composerは未実装候補 | **Held／Research。** 保全・変換fixtureと別契約が必要。廃止したAI更新履歴の復活は含めない |
| B10 | 音声録音・Slides・Web viewer | 対応する専用surfaceは未実装。Browser Clipperは一般Web viewerではない | **Held。** 用途とmedia／device／networkの範囲を明示選択 |
| B11 | Theme・CSS snippets・設定移行・拡張API | 旧O6ロードマップに残る候補。Night Workshopと固定Calendar経路は既存 | **旧候補・再調査から。** 今回は各APIの実装有無を全量監査していない。汎用plugin runtimeや権限拡張を前提にしない |

## 3. AI・MCP・構造探索の保留案

| ID | 候補群 | 未実装／再検討する範囲 | 再開条件・今回の分類 |
|---|---|---|---|
| C1 | 1ノートlink health | missing／self-link等の確認をまとめる読取tool | **Held。** 旧自然5件では実欠陥0、単純duplicate判定の誤検出4/5。duplicateを欠陥扱いしない仕様に直し、別の自然5件で誤検出1/5以下と実欠陥検出を確認 |
| C2 | 目的に合わせた部分取得・一覧metadata | cursor分割fetchは実装済み。旧bounded fetch案の目的別縮減、list_directoryの限定frontmatter追加が残る | **Held。** 大型ノート10件で根拠欠落なしの縮減、または全件監査でcall削減の反復証拠。検索match理由はA1と関連するが同じ仕様とは限らない |
| C3 | 複数seedのContext統合 | multi-seed context／build_context_set。全体予算・重複除去・seed別理由 | **Held。** cross-domain課題20件で1-seedよりRecall／重複／wrong-contextが改善 |
| C4 | 局所構造から原典への導線 | STRUCT-NAV、Graph Inspector／inspect_graph、階層MOC、軽量Graph再順位付け | **Held／Research。** 既存Wiki／backlink／Local Graph／source pathで解けない反復摩擦を確認し、固定評価で一案だけ比較。これらを一括採用しない |
| C5 | Context量・検索性能の改善 | X1-C2、BM25／cache／index、vector検索 | **Held。** Context量が主要ボトルネック、または既存検索が固定scaleでSLO未達という実測が必要 |
| C6 | 現在状態コンパイラの拡張 | R1〜R10、Compact Decision Envelope、static compilation、永続派生view、multi-note transaction | **Held。** single-ownerで解けない実例とrollback要件等を確認。Envelopeは完全修飾ID・明示除外の安全gate全PASS、総量が通常文以下。旧設計順を現在のqueueにしない |
| C7 | Inbox内部fact-only Hook | 保存・source disposition等の成功事実を扱う旧Hook案。proposal／approvalを前提にした旧event設計は現行の直接保存経路と不一致 | **設計選択の履歴あり・製品実装Held。** 採用済みの日次整理とは別物。選択時に承認撤去後の経路へ最小event、保持、privacy、停止、比較を再定義する。承認機能を復活させない |
| C8 | 意味判断Hook・自律整理の拡張 | semantic Codex Lifecycle Hook、利用event log、ranking学習、co-occurrence、自動MOC／実施記録、Idea Proposal、全Vault batch／bulk分類 | **Held。** 既存Skill・最終同期で防げない具体的反復失敗と限定trialが先。新規schedule、例外自動承認、広範な原典move／deleteを今回追加しない |
| C9 | 外部Code Graph MCPとrefresh | TSUZUNE外のprovider評価。compact caller欠落とghost nodeのfresh誤認が未解消 | **Research／Held。** content-hash divergence guard／verified rebuildと、省略しないcompact結果の両方を確認してから比較再開 |
| C10 | 出典を保つContext重複表示の整理・所有ブロックの差し替え | Supermemory公開SDKを参考に、同一出力内の重複表示と、hostが構成する次のモデル入力の整理を別々に検討。複数seed取得のC3や検索基盤のC5とは分ける | **表示整理はHeld、host側差し替えはResearch。** 下記の再開条件で一方だけを選択可能。参考実装の確認と候補登録は製品実装の採用を意味しない |

根拠: [PLAN Held／Research](../../PLAN.md#9-complete--held--research-ledger)、Vault `30_知識/TSUZUNE-MCP改善案-2026-08-13.md`、`TSUZUNE-シナジー実装ロードマップ.md`、`TSUZUNE開発ロードマップ.md`。旧シナジーP0 query-aware ContextとP1の履歴除外／revision保護は実装済みで、この表へ再計上しない。

### C10の範囲と再開条件 — 2026-09-09追加

利用者の「未実装案に追加」に基づく候補登録。Supermemory公開source `5258cb74c895c5297fbfff594935741aeb14a915`（2026-09-07）で確認した実装を参考にしたTSUZUNE向け提案であり、TSUZUNEの実装済み機能とは扱わない。

- **C10-a／Held: 出典を保つ重複表示の整理。** まず既存Context出力の中だけで、正規化後に同文となる記述をまとめて表示する案。参照元ごとのID・path・revision・時点と、相反する記述・省略情報は保持する。日付や否定、条件差を消して同一扱いせず、意味的な自動mergeは含めない。再開条件は、同じ事実の反復が実際のContext利用で摩擦になった証拠と、少数の日本語fixtureで現行出力と比較する契約。比較では重複表示量、根拠追跡、時点・矛盾の識別を確認し、根拠欠落0を必要条件にする。複数seed化、新DB、vector／cache、Profile新設は前提にしない。
- **C10-b／Research: hostが所有するContextブロックの差し替え。** 次のモデル入力を構成できる既存hostがある場合に、専用ブロックだけを最新の取得結果へ置き換える案。再開条件は、その入力経路を実際に制御できることと、過去の自分のブロックだけが除去され、他のsystem指示・本文・タグ境界を保持する隔離検証。MCPサーバーだけで既存Codex会話のtool結果を消せるとはしない。host新設、常駐runtime、会話履歴の削除はこの候補から自動着手しない。

参考実装は[SDKの文字列正規化・モード別重複排除](https://github.com/supermemoryai/supermemory/blob/5258cb74c895c5297fbfff594935741aeb14a915/packages/tools/src/tools-shared.ts#L321-L440)、[所有ブロックの除去・境界エスケープ・置換](https://github.com/supermemoryai/supermemory/blob/5258cb74c895c5297fbfff594935741aeb14a915/packages/tools/src/shared/memory-context.ts#L1-L41)、[Vercelのモデル入力への適用](https://github.com/supermemoryai/supermemory/blob/5258cb74c895c5297fbfff594935741aeb14a915/packages/tools/src/vercel/memory-prompt.ts#L65-L100)。SDKの重複排除は優先側の文字列を残す方式で、全出典を保持する上記契約まで実装しているわけではない。中核エンジン全体のsource、配布条件、日本語品質、Windows実動作は未確認で、Supermemory導入は未採用。類似検索に基づく自動forget、ノート本文の自動削除・統合は参考範囲に含めない。

## 4. 取込・配布の旧候補

| ID | 候補群 | 整理した範囲 | 着手条件・根拠 |
|---|---|---|---|
| D1 | Google Tasks読取・Drive選択取込・Data Portability | Drive手動同期は既存。個別serviceからの任意・手動取込は旧ロードマップの保留案。一般Web／YouTube取込はBrowser Clipperで実装済み | 明示需要とsource/provenance契約。旧Tasks→Drive→YouTubeの順を現在のqueueへ戻さない。Vault `TSUZUNE-Google・ChatGPT・配布ロードマップ` |
| D2 | ChatGPT Export候補の自動適用 | preview／正規化／候補評価は実装・評価済み。C1-D Vault Applyが未開始。Export取込全体を未実装扱いしない | 2026-08-09のC1-C記録ではrule別最低10件未達。新しいreview証拠を確認してから判断。[intake contract](../chatgpt-export-intake.md) |
| D3 | NotebookLM等の選択取込 | 旧Held候補。今回、専用connector／アプリ実装の全量監査はしていない | provenanceと明示需要。[PLAN Held](../../PLAN.md#held--再開条件まで着手しない) |
| D4 | コード署名・配布受入の残差 | Windows installer、更新feed、公開Release、production gateは既存。署名は運用文書上未導入。二版間updaterなどの追加受入は機能実装と分ける | 外部配布scopeを選ぶ時だけ現物と証明書要件を再確認。[Windows production](../windows-production.md)、[v0.6.0受入](v0.6.0-public-release-2026-08-26.md) |

一般community plugin runtime、Obsidian Sync／Publish模倣、cloud／account、複数端末・共同編集、独自DBは現行の個人・一台利用から外れるHeld。既存Google接続・Drive同期や、固定Calendar 1.5.10を未採用扱いしない。

## 5. Researchと、機能未実装に含めない確認

**Research:** semantic no-op、owner候補支援、projection freshness、event sourcing、background maintenance、model／host差、exact rollout usageの明示添付、exclusionと完全修飾IDを検査できる最小transient形式。型Registryの保存形式・完全YAML・Bases高度formula等は各候補の設計研究へまとめる。新DB／daemon／cacheを研究の前提にしない。

次は「未実装機能」ではなく、既存機能の評価・比較に残る境界である。

- 日常の回答に必要な本文・時点・制約が反映されたか。S0隔離5問と第3段階3種試行の成功を日常全般へ一般化しない。
- 読取契約の版変更時の実caller（R6）、通常利用での適用範囲。共通読取手順の文書実装と実callerの全ケース遵守は別証拠。
- 名前付きworkspaceの長時間利用、Propertiesの全体管理需要、Basesの利用者確認など。完了済み実装の再開待ち条件に戻さない。
- Obsidianとの未比較surface、P0-6のprofile差分、表示倍率・実機accessibilityの未測定範囲。`not_proven`から未実装を推定しない。

## 6. 未実装一覧から外したもの

| 区分 | 対象 | 除外理由・根拠 |
|---|---|---|
| Complete | A1／S1 検索一致箇所の抜粋改善 | 本番反映・隔離installedの検索表示確認済み。再起動後のMCPもfreshを確認。[実装証拠](search-matching-excerpts-2026-09-09.md)、Vault `TSUZUNE-S1検索一致抜粋-実装本番受入-2026-09-09`。以前の1位を現在順位へ残さない |
| Complete | A2／S2 Context本文の変換種別 | 4種をcore／MCPへ追加し、本番10/10・再接続後のfresh MCP・最終Vault同期まで完了。追加reviewもblocking findingなし。[実装証拠](context-content-mode-2026-09-09.md)、Vault `TSUZUNE-S2本文変換種別-実装本番受入-2026-09-09` |
| Complete | AI承認廃止・直接保存 | 承認画面・IPC・待機処理を撤去し、検証後の直接保存へ移行済み。原典・revision・衝突の保護は維持。旧Reviewを未実装案として復活させない。[MCP契約](../mcp-integration.md)、Vault `TSUZUNE-AI承認廃止・直接反映-実施記録-2026-09-09` |
| Complete | 欠落タブ通知・前回配置の整理 | 通知表示と欠落参照を外す明示操作を本番反映済み。対応receipt `2026-09-08T19:39:46.42Z` と最終Vault記録を照合。本人の新操作の受入とは区別する。[実装証拠](missing-tab-notice-2026-09-09.md)、Vault `TSUZUNE-欠落タブ通知改善-実施記録-2026-09-09` |
| Complete | 名前付きワークスペース | source実装に加え、2026-09-08 Vault受入記録で本番・隔離installed・本人操作・実機日本語IME確認まで完了。設計時のmissingを解除。[implementation source](../../src/main/workspaces.ts)、Vault `TSUZUNE-名前付きワークスペース実装・本番受入-2026-09-08` |
| Complete | Properties Inventory／読取一覧 | Step 1〜2の実装済み。型Registry／複数file変更だけをA3〜A4へ分離。最新receiptと既存campaignが本番証拠を所有。[plan](../../.agent/requirements/20260908-properties-global-management-design/plan.md) |
| Complete | A6 Bases候補一覧 | 両入口・検索・更新・手入力をsource実装・検証済み。本番完了は対応receipt・隔離installed・最終Vault記録で判定する。[実装・受入](../../.agent/requirements/20260908-bases-design/implementation.md) |
| Complete | Bases読み取り専用表 | 固定profileを実装・本番受入済み。対応外syntaxを全面互換とはしない。[plan](../../.agent/requirements/20260908-bases-design/plan.md)、Vault `TSUZUNE-Bases読み取り専用表・本番受入-2026-09-08` |
| Complete | MCP／AI再利用の既存基盤 | delivery_info、stale runtime guard、revision／patch／read-only、cursor fetch、query-aware Context、Temporal、state lineage、通常更新の履歴停止は実装済み。[MCP contract](../mcp-integration.md)、[status](../../PROJECT_STATUS.md) |
| Complete | 日常の入口と既存拡張 | Inbox capture、Browser Clipper、AI派生知識、採用済み日次整理、検索／Quick Switcher／Command Palette、選択済みProperties／Excluded files／rename・move追従、Drive同期、固定Calendar。残差だけを候補へ残す |
| Ended | 観測宙域／LIFE Weatherと派生試作 | 2026-09-06に終了・製品撤去。旧Gate 3Dや美的受入を未完作業として戻さない。存在相理論自体や保存研究資料の終了を意味しない。[PRODUCT](../../PRODUCT.md#adopted-direction--2026-09-06)、[終了計画](../../.agent/requirements/20260903-0032-existence-phase-observatory-mvp/implementation-plan.md) |
| 廃止 | AI更新履歴の圧縮・履歴機能復活 | 通常更新の履歴生成は廃止。旧HELD-01 chain検証待ちを現在候補にしない。legacy `50_履歴`は保護したまま保持。[status](../../PROJECT_STATUS.md#優先キュー) |
| 歴史索引 | 旧repository closeout、旧Graph closure待ち | 2026-08-23等の当時のNextであり、現在の実行指示ではない。必要なら現在の依頼で再選択する |

## 7. 推奨優先順位 — 2026-09-09

A6候補一覧の実装後、残る5件の相対順を維持する。B3は既存の閲覧機能へ接続する範囲に限定する。順位づけは後続機能の実装承認を意味しない。候補固有の再開条件は各表、現在の実行状態はPLAN.mdのCurrent Decisionが所有する。

判断基準は、日常の知識再利用への近さ、設計・根拠の具体性、既存経路を使える範囲、本文書換えと依存の負担。効果・工数の実測値はないため、点数や日数は付けず、設計境界に基づく比較判断とする。実際のデータ損失・保存失敗・根拠欠落が見つかった場合は、その再現と修正をこの新機能順位より優先する。

### 次に検討する1件

| 順位 | 候補 | この順にする理由 | 選択した時の最小範囲 |
|---|---|---|---|
| **1** | **B3の一部: リンク先の短いpreview** | 既存のWikiリンク解決とクリック遷移に、移動前の確認を加える。過去の考えへ戻る読み方に直結するが、表示と操作の契約が必要 | まず表示対象を既存Markdown previewのWikiリンクへ限定し、hoverとkeyboardで同じ短い本文へアクセスする。長さ・遅延・閉じ方・欠落・除外を決め、未リンク言及の索引は作らない |

A6候補一覧は既存の表を開く入口へ狭く接続して実装した。Basesの利用頻度、時間削減、S2の日常の誤答減少は未計測である。B3以降は明示選択後に着手する。

### その次の4件

| 順位 | 候補 | 理由と範囲 |
|---|---|---|
| **2** | **B5の一部: custom hotkeys** | よく使う操作へのアクセスを本人に合わせられる。既存commandに対する割当・衝突表示・初期値復元へ絞る。IME、OS shortcut、設定保存の確認が必要 |
| **3** | **A5: Basesの単一セル編集** | 表を眺めるだけでなく、その場で作業できる。ただしノートを書き換えるため読取改善より後。単一セル・単一ノートの既存Property契約、revision、atomic write、保護領域に限定し、bulk編集を混ぜない |
| **4** | **A3: Propertiesの型管理契約** | Inventoryで見えた混在を扱う次の一歩。ただし利用需要と型の意味・保存形式を先に確定する必要がある。順位は契約決定ゲートに対して付け、Registry実装を直ちに承認しない |
| **5** | **B4: Outline／Bookmarksの操作拡張** | 以前の考えへ戻る経路を増やせる。既存の見出しjumpとbookmarkで足りない一操作を選び、専用管理画面一式には広げない |

A5に全体型Registryを一律の前提条件として追加しない。既存の単一ノートProperty編集契約で成立する範囲を選択時に確認する。A3とA4も分離し、型表示の指定を複数ノートの値変換へ直結させない。

### 後続候補と条件待ち

| 優先区分 | 対象 | 後ろへ置く理由／繰り上げ条件 |
|---|---|---|
| **後続: 必要な日常操作を選ぶ** | B1 Live Preview、B2のS1以外の検索差、B3未リンク言及、B5の他の小機能、B6分割pane／可変幅、B7の狭い添付・Graph操作差 | 個々の需要がまだ絞れていない。特にLive Previewは編集・IME・保存へ影響する。具体的な反復摩擦があれば上位へ繰り上げる |
| **後続: 利用目的を定める** | A6のformula／別view／group等、B8 Canvas | 既存の表やリンクでできない作業を先に決める。表現力は広がるが、syntax・保存・操作の範囲が大きい |
| **条件待ち: 書換え・復旧** | A4一括リネーム／型変換、B9 recovery／converter／composer | 原本を広く変える、または新たな保存責務が生じる。具体的対象・dry-run・保全・復旧契約が必要。実際の損失や復旧不能の問題があれば最優先へ繰り上げる |
| **条件待ち: AI・MCP基盤** | C1〜C9 | link healthの誤検出、multi-seedの比較不足、性能の未達未観測、Compiler／Hookの既存責務との重複など、候補固有の条件が残る。C群を一括導入せず、具体的な不足に対応する限定改善を個別に選ぶ |
| **条件待ち: 外部連携・拡張** | B10、B11、D1〜D4、汎用plugin、cloud／account／複数端末 | 目的・権限・保守の負担が増える。取込元や配布用途の明示需要が出た時だけ一件再評価する |
| **Research維持** | 第5節の意味的no-op、owner候補、projection、event sourcing等 | 現時点で製品仕様と効果が確定していない。実装順位を付ける前に既存方式との比較が必要 |

A6候補一覧のsource実装と検証は[実装・受入](../../.agent/requirements/20260908-bases-design/implementation.md)、現在の完了条件はPLAN.mdが所有する。残るHeld／Researchの候補は自動着手しない。

## 8. 整理時点の証拠と検証範囲

以下はA6実装前、S2完了後の優先順位再整理で確認した範囲。後続のA6製品実装・test・本番受入は前節の実装資料へ分離する。S2自体の実装・本番反映の証拠は[S2実装記録](context-content-mode-2026-09-09.md)と対応Vault記録に分離する。

- 調査日: 2026-09-09 JST。repoの未commit変更を含むsource、最新設計、互換性台帳、production receipt、MCPで取得した本番Vaultの判断・受入記録を照合した。
- S2の本番受入・再接続・同期記録を照合し、PLANのNextと古い29候補／上位7件の記述を完了後の現在値へ更新した。上位2件はsourceを限定確認。その他は既存の型管理・Bases計画と互換性台帳を使い、全候補を実機で再監査した結果ではない。
- A6の根拠: [Baseを開く処理](../../src/renderer/App.tsx)、[明示path入力](../../src/renderer/components/BasePathDialog.tsx)、[snapshot型](../../src/shared/types.ts)。B3の根拠: [MarkdownのWikiリンク描画](../../src/renderer/components/MarkdownPreview.tsx)、[リンク解決](../../src/core/links.ts)。利用頻度・時間削減は未計測。
- source実装の確認は既存コード・testの読取による。本件でtypecheck／製品test／実機比較を再実行していない。既存testの記載を今回の実行結果とは扱わない。
- 文書更新のみ。新機能、依存、設定、schedule、Git公開、本番binaryは変更しない。文書差分もsource fingerprint対象なので、今回の整理から最新sourceとinstalledの一致は主張しない。
- 完了確認: 変更文書の差分・リンク先存在・現在判断の所有先検査、本番Vaultへのrevision付き同期とread-back、一意検索・backlink確認。結果は今回のVault実施記録に保存する。

関連索引: [docs/INDEX](../INDEX.md)、[2026-08-23の候補判断履歴](tsuzune-improvement-ledger-2026-08-23.md)、[現在の実行方針](../../PLAN.md#current-decision)。
