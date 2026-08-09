# TSUZUNE Product Plan

更新日: 2026-08-09（JST）

この文書は、TSUZUNEの「今から何を、どの順序で、どこまで作るか」を決める実行計画です。現在の本番状態と最新検証は[PROJECT_STATUS.md](PROJECT_STATUS.md)、変わりにくい製品原則は[PRODUCT.md](PRODUCT.md)、画面規約は[DESIGN.md](DESIGN.md)、日付付き証拠は[docs/INDEX.md](docs/INDEX.md)を正本とします。

完了sliceの長い経緯、test件数、commit、画面証拠はPLANへ複製しません。Git履歴と`docs/reports/`へ残し、ここには現役の順序、受入条件、再開条件だけを置きます。

## 1. Product Contract

### North Star

> 普通に書けるローカルMarkdownノートを土台に、知識の関係、時間、出典をAIが安全に再利用できる個人用知識基盤を作る。

TSUZUNEは、まず毎日使えるWindows用メモアプリであり、その上でCodexやChatGPTが根拠付きの文脈を読み書きできる外部記憶になります。

### Guardrails

1. Markdownと添付ファイルを原本とし、アプリ専用DBを正本にしない。
2. 1人・Windows・ローカル利用を既定とし、Google接続とDrive同期は任意にする。
3. 通常ノートはAIが追加・更新してよいが、出典、変更理由、旧版を履歴へ残す。
4. 原典、監査ログ、履歴、認証情報はAIの自律更新対象にしない。
5. Raw Source、派生資料、知識ノートを分け、ChatGPTの回答を本人確認済み事実へ自動昇格しない。
6. 削除、上書き、同期、更新適用は復元可能性と事前確認を守る。
7. 新しい基盤は、現実の詰まりを既存コードと既存依存で解決できない場合だけ追加する。
8. 「Obsidianと同じ」という明示要件は維持し、Ponytailは機能範囲ではなく実装方法を単純化するために使う。

### Obsidian Parity Contract

Graph parityはObsidian Desktop 1.13.4を固定参照版とします。同一fixture、viewport、DPR、theme、入力、設定、再表示、アプリ再起動を比較し、次の4段階を区別します。

| Level | 意味 |
|---|---|
| P0 | 未実装、計画のみ、または固定比較なし |
| P1 | 基礎挙動を実装したが、固定参照版との完全比較は未完 |
| P2 | 固定条件の中核挙動が一致。未証明境界を明記 |
| P3 | 対象surfaceの公開挙動、状態、UI、アクセシビリティ、性能境界まで固定比較済み |

Local Graphの可変Depthだけは製品判断として採用しません。現在ノートの直接リンクとバックリンクに固定します。それ以外の差は、未一致、意図的差分、未証明のいずれかとして記録します。詳細契約は[Obsidian Graph Parity Reference](docs/obsidian-graph-parity-reference.md)を参照します。

## 2. Current Execution

### Current State

| 対象 | 状態 |
|---|---|
| インストール済み本番 | v0.5.0。最新の正確なcommit、hash、検証結果は[production-update-latest.json](docs/reports/production-update-latest.json)を参照 |
| 開発checkpoint | v0.6 Obsidian Graph Parity |
| 完了した直近slice | GP0-3b-l attachment path copy比較 |
| 現役slice | GP0-3b-m attachment nodeの`リンクされたビューを開く` |
| 現役Track数 | 1。Google intakeとChatGPT candidate applyは保留 |

### Current Transition Queue

1. **Now — GP0-3b-m:** attachment nodeの`リンクされたビューを開く`を固定比較する。
2. **Next — GP0 context menu:** 固定参照版で実在を確認した残る操作を一項目ずつ固定比較する。
3. **Then — Graph closure:** Groups、Animate、Restore defaults、Search/Excluded files境界を一項目ずつ閉じる。
4. **After Graph checkpoint:** アクセシビリティ、Personal Google Intake、AI write policyのどれを次の独立Trackにするか再選択する。

新しいSupporting Trackを割り込ませる場合は、目的、停止条件、元Trackへ戻る条件をこの節へ先に記録します。

## Active Track: v0.6 Obsidian Graph Parity

### Completed GP0-3b-l — Attachment Path Copy

`パスをコピー`の3形式は、親menu位置、submenu文言・順序・有効状態、copy値、1回のplain-text write、menu close、共通検証範囲であるGraph検索条件・node集合・Vault内容の再表示／別プロセス再起動までの保持を固定比較し、`matched-core-behavior`と判定しました。Obsidian URLとVault相対pathは完全一致し、system pathは各隔離Vault rootから同じ相対suffixです。

固定参照は右端から左、TSUZUNE captureは中央から右へsubmenuを開いたため、同一geometryは主張しません。TSUZUNEの右端左開きはrenderer回帰testにあり、実画面captureでは未証明です。両captureともOS clipboardへの実writeをinterceptしており、別applicationへのpaste roundtripも未証明です。

- [比較report](docs/reports/graph-gp0-attachment-path-copy-2026-08-09.html)
- [機械可読comparison](docs/reports/assets/graph-gp0-attachment-path-copy/comparison.json)

### GP0-3b-m — Attachment Linked Views

#### Question

Obsidian 1.13.4でattachment nodeの`リンクされたビューを開く`を開いたとき、どのsubmenuがどの順序と有効状態で現れるか。固定参照版で確認した先頭の有効操作を1件だけ実行した結果を、TSUZUNEは同じ公開挙動として持つか。

#### Fixed Input

- 既存のGP0固定fixtureと`attachments/diagram.svg`を使う。
- ObsidianとTSUZUNEで同じGraph filter、viewport、DPR、themeを使う。
- 参照版と製品版は隔離Vault、隔離userData、別process再起動で採取する。

#### Acceptance

- [ ] Obsidian 1.13.4から親menuの位置、有効状態、hover／click後のsubmenu文言・順序・有効状態を採取する。
- [ ] 固定参照版で実在を確認した先頭の有効な子操作を1件だけ選び、開くview、workspace状態、menu closeを記録する。
- [ ] Global Graph tab、query、camera、表示nodeと対象viewが、Graph再表示／別プロセス再起動でどう扱われるか記録する。
- [ ] Markdown、添付、内部設定を含むVault digestが意図しない変化をしないことを確認する。
- [ ] 差がある場合だけ既存のworkspace tabとcontext menuを再利用して最小修正する。
- [ ] 差を検出できるtargeted testを追加し、全回帰、typecheck、MCP検査を通す。
- [ ] 参照版とTSUZUNEのraw observation、画像、comparison JSON、HTML reportを同じsliceへ保存する。

#### Stop Condition

対象の親submenu契約と、参照版から選んだ子操作1件を`matched`、`matched-core-behavior`、`different`のいずれかで根拠付き判定し、未証明境界を明記したら止めます。2件目の子操作、次の親menu操作、Plugin APIへ同時に進みません。

### Remaining Graph Work

| Area | 現在 | 完了条件 |
|---|---|---|
| Context menu | 新規tab、新規window、file move、bookmark、path copyまで比較済み | `リンクされたビューを開く`から、残る操作、submenu、note/tag/attachment別挙動を一項目ずつ固定比較 |
| Workspace state | Global query、zoom/pan境界、node drag、Graph tab保持の一部を比較済み | Local、fit/reset、zoom限界、workspace leaf復元を固定比較 |
| Filters/Search | Search、tags、attachments、unresolved、excluded基礎を実装済み | malformed query、Manage UI、全surfaceへのExcluded files効果を比較 |
| Groups | ordered groups基礎を実装済み | 作成、編集、順序、色、保存、復元、既定状態を比較 |
| Display/Forces | sliders、円形node、Canvas edge、Force runtimeを実装済み | 既定値、表示式、slider境界、Restore defaultsを比較 |
| Animate | timeline基礎を実装済み | 開始、途中、終了、取消、再表示、再起動を比較 |
| Accessibility | DOM nodeと一部keyboard操作あり | 実Windows keyboard、screen reader、High Contrast、100〜200% DPIで受入 |
| Performance | 500/2000件のbaselineあり | 実Vaultで入力・pan・zoom・watcherが日常利用を妨げない基準を決めて回帰化 |

Graph parity全体は、P2/P3へ到達していない領域が残る限り完了と呼びません。固定比較で差がないsliceには製品コードを追加しません。

## 3. Roadmap

### Obsidian Parity Stages

| Stage | 到達目標 | 状態 / 次のGate |
|---|---|---|
| O0. Graph Parity | Local/Global Graph、filter、group、display、force、interaction、保存、アクセシビリティを徹底比較 | **Active**。GP0-3b-mから一項目ずつ進める |
| O1. Daily Writing & Navigation | Markdownを知らなくても作成・編集・日次運用できる | Daily/Ideaフォーム、toolbar、template、freshnessは実装済み。7日通常運用と残るnavigationは未完 |
| O2. Organization & Retrieval | folders、tags、properties、outline、bookmarks、search、commandsを日常利用できる | 基礎あり。Graph checkpoint後に不足surfaceを棚卸し |
| O3. Structured Views | Markdown/frontmatter原本のtable/card/list view | Planned。実用queryと編集契約を固定してから開始 |
| O4. Canvas & Rich Media | freeform canvas、embed、PDF/audio/video、properties view | Planned。O2/O3の保存契約後 |
| O5. Recovery, Sync, Import & Publish | recovery、version history、import/export、optional sync/publish | `.trash`、AI history、Drive手動同期、ChatGPT preview基礎あり。往復dogfoodとrecovery UIは未完 |
| O6. Customization & Plugin Platform | theme、hotkeys、commands、safe plugin API | Planned。実利用で安定したcore surfaceだけ公開 |
| O7. Parity Closure | 対象機能の差分表、回帰fixture、移行ガイドを閉じる | Planned。O0〜O6の未一致を明示的に判定 |

O0〜O7はGraphだけの計画ではありません。Obsidian 1.13.4の公式機能群を、固定比較済みのP2以上または根拠付きのTSUZUNE代替として閉じます。Web ClipperはO5、URI・CLI連携とhotkey/command拡張はO6、Mobileは同期・端末制約を含めてO5〜O7で扱い、無言で対象外へ落としません。

### O1 Follow-up — Human Note Capture

実装済み:

- `今日のノート`: `02_デイリー/YYYY-MM-DD.md`へ同日一件。既存なら開く。
- `アイデアを追加`: 本文、理由、関連project、自由メモ、複数の次の一歩をフォーム入力し、通常Markdownへ保存。
- 通常ノートは名前と自由な複数行本文を同じアプリ内フォームで新規作成。
- 作成フォームとeditorで見出し、太字、list、checkの最小書式ボタンとVaultノート選択によるWiki link挿入。
- Daily／Ideaはparse→renderが元Markdownと一致するときだけフォームへ戻すround-trip guard。
- 同名／作成失敗では入力と画面内エラーを保持し、入力途中のアプリ終了は確認して未保存内容を保護。
- `90_テンプレート`とcustom template読込。
- filesystem更新日時と`review_after`による非破壊の鮮度表示。

未完:

- [ ] 7日間、既存Vaultを通常運用し、Daily/Idea/通常ノート作成の摩擦を記録する。
- [ ] 7日で作成したノートが検索、Wiki link、backlink、Graph、MCPへ自然に接続されることを確認する。
- [ ] 画面幅720px未満、Windows 200%拡大、keyboard-onlyで主要captureを受入する。
- [ ] 自動分類・link提案は、実ノートの未接続率と誤提案率を測ってから独立sliceとして決める。

### Intelligence Stages

| Stage | 目的 | 導入Gate |
|---|---|---|
| X1. Context Compiler 2.0 | keyword、graph、time、provenanceを組み合わせ、質問ごとに根拠Bundleを作る | 固定質問で関連性、出典、時間整合性がbaselineを上回る |
| X2. Provenance-backed Personalization | 会話や資料から本人情報候補を抽出し、出典・確認状態を保つ | raw/derived/knowledge分離、stable source ID、再取込重複0、本人確認導線 |
| X3. Temporal Memory Lifecycle | valid time、knowledge time、review due、supersedesを日常運用する | 現在/過去の誤混入0、状態更新の手作業が負担にならない |
| X4. AI-assisted Maintenance | 通常ノートの整理、更新、矛盾候補、link候補をAIが行う | 履歴、出典、policy、rollback、失敗fixtureを用意 |
| X5. Retrieval Quality Evaluation | TSUZUNEあり/なしと変更前後を継続比較する | 固定corpus、質問、期待source、latency、character budgetを保存 |

AI機能は「モデルが賢くなった」と表現せず、回答精度、出典追跡、時間整合性、再現性、追加latencyで評価します。既存benchmarkでは固定4問が1/4から4/4、出典追跡が0/3から3/3へ改善し、Context構築の絶対追加は約150msでした。これはモデル本体の一般知能や主観時間を証明しません。

## 4. Paused Tracks And Resume Conditions

### Contextual Tasks And Quick Capture — Planned

タスクの正本は専用DBではなく、発生元ノートにあるMarkdown checkboxとします。`Today`、`Upcoming`、`Inbox`は再構築可能な投影にし、一覧からの完了・期限変更はrevision一致時だけ元Markdownへ書き戻します。

開始条件と最小順序:

1. O1の7日dogfoodで、checkboxの横断確認またはquick captureが実際の上位摩擦として観測される。
2. 既存Markdown parserからtask行、期限、priority、source位置を抽出する純粋coreを作る。
3. Today/Upcoming/Inboxと元ノートへの移動、競合検知付きwrite-throughを実装する。
4. 既存MCP create/update経路を再利用して、desktop quick captureから既定見出しへ追記する。
5. タスク単独と発生元文脈を含むContextを固定評価し、改善がある場合だけAI整理へ進む。

汎用query language、専用task DB、常駐server、Discord bot、mobile app、Google Tasksを同時に作りません。

### Personal Google Read-only Intake — Paused

順序は次で固定します。四機能を同時実装しません。

1. G1 Google Tasks read-only
2. G2 Google Drive selected-file intake
3. G3 YouTube read-only
4. G4 Google Data Portability
5. G5 Google Calendar read-onlyは既存認可基盤を保持したまま保留

共通契約:

- 最小scope、明示認可、preview、apply、source URL/ID/time/hash、重複防止を一機能ずつ完了する。
- Google広告profile、検索履歴、他アプリのDrive全体走査は対象外。
- token、OAuth JSON、account detailsをVaultやGitへ保存しない。
- Graph Current Transition Queueを閉じ、次Trackの再選択時にだけ再開する。

### Google Drive Roundtrip Acceptance — Pending

Google Sign-Inと40件の初回手動同期は基礎実装済みですが、次を終えるまで「同期の実運用確認済み」としません。

- [ ] 空の別端末相当Vaultで既存Drive Vaultを選び、40件を受信する。
- [ ] local-only、drive-only、同一変更、競合、削除保持をpreview/applyする。
- [ ] 競合noteと台帳が再起動後も一致する。
- [ ] 複数端末から同時applyせず、端末ごとに完了させる。

### ChatGPT Export Candidate Apply — Paused

C0-A〜C1-Cのread-only preview、branch復元、provenance、candidate eligibility、安全回帰は実装済みです。Raw exportと個人本文はGit/Vaultへ複製せず、ローカル`work/`だけで扱います。

再開条件:

- `profile.explicit_self_statement`、`preference.explicit_expression`、`life.explicit_consideration`ごとに高信頼review例を10件以上確保する。
- precision gateを満たさないruleは自動applyせず、人間確認候補へ降格する。
- `is_do_not_remember=true`は候補から除外し、nullはprivacy reviewを要求する。
- C1-Dを始めるまで人物profileノートへの自動writeは0を保つ。

詳細契約は[ChatGPT Export Intake](docs/chatgpt-export-intake.md)を参照します。

### AI Write Policy UI — Paused

MCPの`autonomous_update_note`は通常ノートの履歴付き更新まで実装済みです。ノート/フォルダ単位の`auto`、`review`、`immutable`切替UIは未実装です。

再開時は、既存更新経路を再利用し、policy解決、表示、rollback、Raw Source拒否を一つのvertical sliceで確認します。別のagent frameworkやqueueは追加しません。

### Installer And Updater Follow-up — Pending

- [ ] private GitHub Releaseへ次版metadata、installer、blockmapを公開し、0.5.0から実更新する。
- [ ] 保存失敗時に再起動しないことを本番fixtureで再確認する。
- [ ] コード署名の費用とSmartScreen効果を判断し、採用時だけ署名工程を追加する。

### NotebookLM / External Research Intake — Planned

NotebookLMや外部資料は、原典package、派生要約、更新対象知識noteを分離します。URLや生成回答だけを根拠に人物情報へ自動昇格せず、source ID、取得日、引用可能な根拠、変更理由を保存します。

## 5. Shared Definition Of Done

すべてのdelivery sliceで次を使います。

1. 作業開始前に本番TSUZUNE、`PROJECT_STATUS.md`、関連source/test/reportを読む。
2. 一度に一つの公開挙動または一つのデータ契約を対象にする。
3. まず固定fixtureで現在挙動と失敗を再現する。
4. 削除、既存再利用、標準/OS機能、既存依存、最小新規実装の順で解決する。
5. 要求されていない抽象化、将来用interface、dependency、background serviceを追加しない。
6. 非自明な変更には失敗を検出できる最小testを残す。
7. targeted test、全test、typecheck、`check:mcp`、`git diff --check`を変更範囲に応じて実行する。
8. UI変更は隔離Electronで画面と再表示/再起動を確認する。offscreen evidenceを実OS keyboard/screen reader受入と呼ばない。
9. Graph parityは参照版raw observationと製品版raw observationを別々に保存し、比較を機械可読にする。
10. 製品コードを変更した区切りだけ`npm run production:update`を通す。文書・調査だけなら同じbinaryを再インストールしない。
11. commit、push後に判断、検証、残課題、次の一手をTSUZUNEへ書き戻す。
12. `@ponytail-review`で差分の過剰実装を確認してから次sliceへ進む。

## 6. Decision Rules

- SQLite、vector DB、Graph DBは、計測でMarkdown走査/indexの限界が出るまで導入しない。
- Graphのnode/edge固定上限やDepthで要件を縮めない。重い場合は描画、simulation、incremental updateを計測して直す。
- Plugin APIは、core surfaceと保存契約が安定し、実際に複数機能が同じextension pointを必要とした時だけ始める。
- AI提案はprecision/recallと出典で評価し、便利そうという理由だけで自動applyしない。
- 情報の古さは真偽と分ける。filesystem更新日や`review_after`は再確認の手掛かりであり、古い情報を自動削除しない。
- 未来時点の情報を過去Contextへ混ぜない。valid timeとknowledge timeを分ける。
- 安全、データ損失防止、security、accessibility、利用者が明示した互換水準はPonytailで省略しない。

## 7. Completed Foundation Ledger

完了経緯は次の正本へ集約します。

| Foundation | 現在の意味 | Evidence / Contract |
|---|---|---|
| v0.1 Local Markdown Notes | 作成、編集、folder、Wiki link、backlink、search、trash、競合検知 | [README](README.md)、[v0.1 scope](docs/v0.1-scope.md) |
| MCP Integration | search/fetch/backlinks/context/create/update/autonomous updateの7 tools | [MCP Guide](docs/mcp-integration.md) |
| Temporal Memory Lite M0-M5 | valid/knowledge time、review due、supersedes、as-of context、source trace | [M5 Dogfood](docs/m5-dogfood.md) |
| Context Snapshot Index M5-C | request内の重複parse/indexを削減し、出力同一性を保持 | [PROJECT_STATUS](PROJECT_STATUS.md) |
| Human Capture O1-W0/W1 | template、freshness、通常作成、Daily/Idea、toolbar | [Templates and Freshness](docs/templates-and-freshness.md) |
| Google v0.4 Foundation | Desktop OAuth、profile、Drive manual preview/apply、local graph | [README](README.md) |
| Windows v0.5 Foundation | installer、updater、packaged/installed smoke、production gate | [Windows Production](docs/windows-production.md) |
| Graph GP0-a〜l | settings、search/camera/drag、tabs、attachment open/move/bookmark/path copyの固定比較 | [Parity Reference](docs/obsidian-graph-parity-reference.md) |
| TSUZUNE Benchmark | TSUZUNEあり/なしの品質とlatencyを分離計測 | [Benchmark](docs/reports/tsuzune-with-without-benchmark-2026-08-09.md) |
| ChatGPT Export C0-A〜C1-C | read-only normalization、provenance、candidate preview、安全回帰 | [Intake Contract](docs/chatgpt-export-intake.md) |

## 8. Documentation Ownership

| 文書 | 役割 |
|---|---|
| [README.md](README.md) | 初見の利用者・開発者向け入口 |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | 本番receipt、現在commit、最新検証、次slice |
| [PLAN.md](PLAN.md) | 現役順序、受入条件、保留Track、長期roadmap |
| [PRODUCT.md](PRODUCT.md) | North Star、product principles、anti-reference |
| [DESIGN.md](DESIGN.md) | GUI、brand、accessibility、component規約 |
| [docs/INDEX.md](docs/INDEX.md) | 機能別仕様、運用guide、日付付きEvidenceへの索引 |
| `docs/reports/` | raw observation、comparison、画像、benchmark、production receipt |

完了結果をPLANへ再掲せず、日付付きEvidenceを現在値へ書き換えません。正本が食い違う場合は現物と最新receiptを確認し、DashboardとTSUZUNEを更新します。
