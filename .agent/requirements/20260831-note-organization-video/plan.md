# TSUZUNE文脈エンジン型ノート整理 実行計画 v5

## Status

- 動画・指定タスク・現行Vault・現行実装の再調査: 完了
- AI文脈エンジン四層設計: 完了（v4 historical design）
- v5製品開発: category-aware派生知識proposal、検索facet、排他的group表示をTDD実装済み
- D21独立反証検証: 初回REVISEの全指摘を修正し、再review PASS
- 本番Vaultへのbulk分類適用: 未実施・別判断gate
- インストール済み本番への反映: D22実行中
- 現在の状態: active（D18〜D21完了、D22本番更新待ち）

## Historical Task Contract — v4 / 2026-08-31

- objective: 人間は分類を考えず受信箱へ放り込み、AIが定期的に整理・正本化・索引更新し、例外だけを人間へ返すTSUZUNE文脈エンジンを実装可能な形で設計する。
- deliverables: MCP、Hooks、schedule、TSUZUNEの各契約、統合sequence、failure matrix、段階的実装slice、acceptance tests。
- constraints: この設計phaseではPonytailを使わない。Markdown正本、no-history、`knowledge.md`保護、Raw／秘密／巨大Rawの非自動更新、dirty worktree保全を守る。product code、本番install、実schedule、本番Vault整理は行わない。
- success:
  1. 四層のowner、input、output、idempotency、failure behaviorが一意に追える。
  2. routineで安全な整理は自動完了し、曖昧・競合・機微・原典・不可逆候補はzero-lossでInboxへ残る。
  3. 最初の実装sliceが対象file、公開挙動、acceptance command、未提示境界を含むpacketとして切り出せる。
- lane: Orchestrated。既存workflowをstate ownerとして再開し、四層を独立trackで批判検証して親Agentが統合する。
- evidence: `packets/D12-D15-four-layer-design.md`、current code/tests、canonical TSUZUNE notes、動画transcript、ゲームブック、各track result。
- stop: 統合設計と正本同期の検証完了時。product code実装、production update、schedule作成、実Vault整理へは進まない。

この選択は、旧Continuationの「実利用摩擦まで自動整理をHeld」とする判断を上書きする。利用者がAI自動整理・Hook・定期実行を明示選択したため、機能の再開条件は成立済みである。以後の反証は選択を未選択へ戻すためではなく、実装方法と安全境界を改善するために使う。

## v4 design completion — 2026-08-31

- integrated contract: `context-engine-v4.md`
- independent tracks: D12 MCP、D13 Hooks、D14 schedule、D15 information model
- adversarial verification: D16 initial `REVISE`; eight findings corrected before persistence
- original philosophy guard: D17 PASS after lease、Raw、reason-code clarification
- canonical TSUZUNE: integrated design noteを作成し、入口、Project Dashboard、運用契約、思想、システム設計、ロードマップ、MCP roadmapから7 backlinksを確認
- next: Slice A manual shadow。既存MCPとisolated fixtureだけを使い、本番Inbox、product code、Hook、automationは変更しない

## Historical Task Contract — v3 capture-and-move（非現行）

The following capture-and-move contract is retained only as decision history. The current authorized contract is `v5 category-aware derivation continuation` below.

- objective: 捕捉した情報を、人間とAIが必要な時に必要な部分だけ読めるTSUZUNE文脈へ変換する。
- deliverables: 文脈構造、受信箱処理フロー、最小の製品実装、公開挙動test、隔離fixture検証、安全境界。
- constraints: root `knowledge.md` を変更しない。Processed / Archive / Historyを新設しない。原典とユーザーデータを失わない。物理整理や自動化を目的にしない。
- success:
  1. 人間が分類を考えず受信箱へ書いた一件から、AIが保存先・理由・原典保持境界を提案できる。
  2. 承認された一件だけを既存のpreflight / move経路で正本化し、未承認時はzero-writeである。
  3. 履歴コピー、重複、内容欠損、新規破損リンク、`knowledge.md` の変更がゼロである。
- lane: Orchestrated。動画適合性、Vault構造、実装可能性を別に検証し、本計画へ統合した。
- evidence: `results/video.md`、`results/thread.md`、`results/vault.md`、repositoryのmove/rename/trash/MCP実装、実行時のreadbackとリンク検証。
- stop: success達成、既存機能だけで公開挙動を満たしcode追加が不要、または削除・契約外変更・新規権限が必要になった時。

## Development start — 2026-08-31

利用者は「人間が受信箱へ適当に放り込めること」を中核要件として、本設計の製品開発開始と批判的な複数視点のsubagent利用を承認した。

first sliceは調査前に新toolへ固定しない。次の候補を現在実装と公開挙動で比較し、最小で完全な一つだけを選ぶ。

1. 既存create / search / fetch / preflight_move / moveを束ねる運用だけで成立する。
2. 既存MCPへread-onlyの受信箱整理提案を一つ追加する。
3. UIへ受信箱処理の明示操作を一つ追加する。

選定条件は、分類なしcaptureを守る、未承認zero-write、原典保全、既存move再利用、履歴なし、fixtureで再現可能であること。新DB、LLM内蔵、background organizer、rule engine、embedding、Hookは候補外とする。

### Historical first-slice decision（v5で置換済み）

D1〜D4の独立レビューを統合し、候補3を採用した。Command Paletteへ「受信箱へメモを作成」を一件追加し、選択中folderに関係なく `01_受信箱` へ衝突回避された空ノートを作り、そのまま通常editorを開く。

- 候補1は整理適用の安全経路として採用するが、捕捉時の保存先判断が人間に残るため、それだけでは中核要件を満たさない。
- 候補2は不採用。MCP自身には意味分類能力がなく、既存のsearch / fetchと外部AIの判断を包み直すだけになる。
- 候補3は既存 `createAndOpenNote`、folder作成、case-insensitive衝突回避、作成後readbackを再利用でき、新component、state、shortcut、dependencyを必要としない。

AI側の整理は新APIではなく、既存のread-only調査から `移動先 / 理由 / 反証・懸念 / 原典保持境界 / 未確定事項` を提案し、曖昧なら受信箱に残す。承認された一件だけを既存 `preflight_move_entry → move_entry → readback` で適用する。

## Design decision

全ノートを分類し直す方式は採用しない。動画の本質は、フォルダを完成させることではなく、次の流れを持つ「持ち運べる文脈エンジン」である。

`低摩擦な捕捉 → Rawの保全 → 再利用できる短い文脈 → 目次から必要部分だけ取得 → 利用時に更新`

TSUZUNEでは既存フォルダとMOCがこの責務をほぼ満たす。新しいContextフォルダ、MyContextノート、Processed、Archive、Historyは作らない。

## Protected and out of scope

- root `knowledge.md`: FreebuffのAgents.md。内容読取、変更、整理判定、AI入口への転用を禁止する。未変更確認用hashだけを取得する。
- `50_履歴`: 8件。内容を読まず、通常導線から外した不活性データとして扱う。
- `.trash`、`.tsuzune`、アプリ内部ファイル、秘密情報、巨大Rawデータ。
- 既存ノートの一括改名、一括移動、一括書換え。

## Four-layer structure

### 1. Capture layer

- `01_受信箱`: 意味や保存先が未確定の断片、受信物、着想。
- `02_デイリー`: 日付そのものが意味を持つ観測。日誌を自動履歴として使わない。

捕捉時点では分類精度を求めない。迷ったものは受信箱へ置く。

### 2. Canonical context layer

| 文脈 | 正本位置 | 主責務 |
|---|---|---|
| 現在の仕事 | `10_プロジェクト` | 目的、現在状態、決定、次の一手 |
| 継続的な本人・分野文脈 | `20_分野` | 人物、関心、健康、環境、継続責任 |
| 再利用知識 | `30_知識` | 主張、原則、手順、比較、判断 |
| 原典・証拠 | `40_情報源` | 外部資料、会話原文、取得物、検証証拠 |

一つのノートは一つの主責務を持つ。短さ自体ではなく、AIが無関係な文脈を読まずに済む責務境界を優先する。

### 3. Navigation layer

- `00_入口/ホーム.md`: 人間とAIの共通到着口。
- `00_入口/現在地.md`: 今必要な文脈。
- プロジェクト地図、分野地図、知識地図、情報源地図: 領域別の読む順。
- 子MOC: 既存閾値を満たし、繰り返し探索の摩擦が観測された時だけ作る。

動画のMyContext相当は一枚の新規ノートではなく、`ホーム → 現在地/各地図 → 必要な原子ノート → 原典` という既存の経路で実現する。本文を入口へ複製しない。

### 4. Discovery layer

- 名前・語句が分かる時: 通常検索。
- 明示関係を辿る時: Wikiリンクとbacklink。
- 時点・複数根拠が必要な時: `build_context`。
- 語句の異なる未知候補: Smart Connections系の意味検索。

意味検索は候補発見までとし、`探索 → プレビュー → 人間確認 → 有用なものだけ明示リンク` を守る。

## Inbox consumption flow

通常処理は一件ずつ行う。

1. 受信箱ノートを読み、主責務と原典価値を判断する。
2. 保存先を一つ決める。
   - 現在の仕事なら `10_プロジェクト`。
   - 継続文脈なら `20_分野`。
   - 再利用できる主張なら `30_知識`。
   - 外部原典または複数要素を含むRawなら `40_情報源`。
   - まだ決められなければ受信箱に残す。
3. 同じノートを安全なmoveで最終フォルダへ移す。コピーを作って元をProcessedへ残さない。
4. Rawを `40_情報源` へ置いた場合だけ、必要な短い派生ノートを `10/20/30` に作り、`derived_from` で原典へ戻す。
5. 最終ノートを既存MOCまたはプロジェクトから到達可能にする。
6. destination、内容、outlink、backlinkをreadbackし、受信箱側に重複がないことを確認する。

### No-history rule

- 処理済みコピー、移動ログ、日次整理ログをVaultへ残さない。
- 一件を別ノートへ丸ごと複製してから元を放置しない。
- 通常処理はmoveを優先し、削除を必要としない。
- 不要・重複ノートの破棄は通常処理へ混ぜず、別の明示判断とする。

## Current implementation boundary

- UIにはcreate、rename、move、trashが既にある。trashは物理削除ではなく `.trash` への可逆退避である。
- MCPにはcreate/updateと単一Markdownの `preflight_move_entry → move_entry` がある。
- MCPにrename/trashは公開されていない。通常の受信箱処理は、既存名のまま一件ずつmoveする範囲なら新規実装なしで行える。
- ファイル名変更や破棄が必要なら作業を広げず、UI操作または別承認へ戻す。

## Existing Vault strategy

現在の観測値はTSUZUNE管理対象516件だが、実行開始時に再集計する。全516件へ人手で意味判定を付けない。

### 全件へ行うこと

- path、機械的リンク、broken link、既存MOCからの到達性をread-onlyで確認する。
- 検出された例外だけを候補一覧へ出す。

### 内容を読む対象

- `00_入口` と既存MOC。
- `現在地` から辿れる活動中プロジェクト・分野。
- 破損、未到達、重複疑い、複数責務が観測されたノート。
- 自然な利用中に触れたノート。

### 内容を一括で読まない対象

- `30_知識` 412件の全件意味監査。
- 原典・証拠として問題なく到達できる `40_情報源`。
- 旧 `50_履歴` とroot `knowledge.md`。

## Execution plan

### Phase 0 — 現行基準線

- 現行件数を再集計する。
- `knowledge.md` の未変更確認用hashを取る。
- ホームから各地図と代表ノートへ辿るread-only smokeを行う。
- 代表シナリオは「現在の仕事」「本人文脈」「再利用知識」「原典確認」の4件とする。

入口で迷わず到達できる領域は変更しない。

### Phase 1 — 入口の最小整合

Phase 0で不足が確認できた箇所だけrevision-checkedで更新する。

1. `00_入口/ホーム.md`: 現在地、プロジェクト、分野、知識、情報源への読む順。
2. `00_入口/情報源・履歴地図.md`: 旧履歴は不活性、新規生成なし、通常導線ではないこと。
3. `30_知識/TSUZUNE分類と保存基準.md`: 受信箱から正本へmoveするフローとNo-history rule。

### Phase 2 — 受信箱の一件試行

- 現在の受信箱から、自然に整理価値のある一件だけを選ぶ。
- `preflight_move_entry → move_entry` で最終配置へ移す。
- 必要なら派生ノートとMOCリンクを最小限作る。
- 原文欠損、重複、破損リンク、受信箱残留がないことを確認する。

ここで流れが成立しなければ全件整理へ広げない。

### Phase 3 — 機械的な全体到達性監査

- 全管理対象のpath/linkを機械的に監査する。
- broken、未到達、重複疑い、複数責務候補だけを抽出する。
- 全件意味台帳や全件書換えは作らない。

### Phase 4 — 観測された候補だけ修正

- 活動中・高価値・繰り返し迷う候補から小batchで直す。
- 既存MOCへの明示リンクを優先し、移動や分割は必要性が確認された場合だけ行う。
- ノートが既に役割を満たす場合は `keep` と記録せず、そのままにする。

### Phase 5 — 意味検索の試行

- 構造整理後、自然に利用する最大10ノートだけで候補発見を試す。
- 判断への寄与、重複防止、有用な明示関係のいずれも観測できなければ停止する。
- プラグイン導入、自動リンク、常駐index更新をこの計画から自動着手しない。

### Phase 6 — 最終検証

- 代表4シナリオの到達性を再実行する。
- 新規broken link 0、内容欠損 0、受信箱重複 0、新規履歴 0を確認する。
- `knowledge.md` のhashが基準線と一致することを確認する。
- 最終境界で影響を受けた運用標準とMOCだけを各1回更新する。

## Authorization boundary

現在承認されているのは、この動画方式に沿う製品source・test・隔離fixtureの開発。本番Vaultのupdate/move/createは実行しない。

本番Vaultでの一件試行は、source実装、隔離検証、必要なproduction updateが完了した後に別の利用者確認で行う。rename、trash、物理削除、新規プラグイン、常駐処理は別承認とする。

## Stop conditions

- 既存のホームと地図だけで代表シナリオを迷わず完了でき、更新価値がない。
- moveのpreflightが競合、衝突、保護境界、実行中状態で失敗する。
- 原典と派生知識の区別、または移動先を確信できない。
- 新規broken link、内容欠損、本文複製が発生する。
- `knowledge.md` のhash確認、または `50_履歴` の存在確認を越えて触れる必要がある。
- rename、trash、削除、外部依存、常駐処理が必要になる。
- 整理自体が目的化し、実際の文脈到達性を改善しない。

## Continuation contract — 2026-08-31

- objective: 元の人間優先・知識循環・構造探索を守りながら、受信箱captureの次の最小スライスを証拠から選び、承認済みのsource範囲だけ実行する。
- deliverables: 原思想guardianの反証、production delivery境界、現在のcapture摩擦、親Agentの採用／不採用判断。コード変更は観測差があり、既存経路で解けない時だけ。
- constraints: `knowledge.md`と本番Vaultを変更しない。legacy `50_履歴`を読まない／動かさない。dirty worktreeの本件外変更を本番へ昇格しない。新DB、organizer runtime、Hook、daemon、batch自動整理を追加しない。
- success:
  1. 元の思想から見た「次に作るべきでないもの」と、必要なら最小の次sliceを明示できる。
  2. installed productionへ安全に反映できるかを、現在のdirty差分とproduction gate契約から判定できる。
  3. 追加実装する場合は公開挙動testを先に失敗させ、独立reviewと関連gateを通す。
- lane: Orchestrated。
- evidence: canonical philosophy、current source、dirty boundary、production receipt、public behavior test。証明層はsourceを既定とし、installed mutationは別承認まで行わない。
- stop: 新権限、本番変更、広いdirty sourceの昇格、または元思想と衝突する機能追加が必要になった時。

## Continuation integration result

- original philosophy: 現在のInbox actionは人間優先・知識循環・構造探索・慎重な書込みに一致する。実利用摩擦が未観測なので、追加コードは停止する。
- capture UX: `Ctrl+P`または「操作」から選び、そのまま入力する3段階。既存のfocus、keyboard、collision、readback経路がある。専用shortcutや画面を足す根拠はまだない。
- documentation: `PLAN.md`に残っていたVault履歴ノート前提を、response provenance／result receipt／readbackへ置換した。
- delivery: 現行`production:update`はInbox差分だけでなくtracked/untrackedを含むcurrent source全体をfingerprint・build・installする。現在はmismatchなので、実行には利用者の明示承認が必要。
- isolation: runtime変更は`src/renderer/App.tsx` 2ハンクと`tests/app.safety.test.tsx` 2ハンクの計4ハンクだけでGit基準へ独立できる。ただし前回installed productionはdirty sourceから作られ、そのexact source snapshotが残っていないため、Git HEAD＋4ハンクは検証用であって安全なproduction baseではない。
- stop: 新機能追加なし。本番昇格判断または自然利用で同型摩擦が観測されるまで停止する。

## Historical v4 Roadmap

### 完了

- 動画方式の原則抽出と再解釈。
- 指定タスク、現行Vault、現行move実装の確認。
- 全件意味分類を廃止し、文脈エンジン型へ再設計。
- Command Paletteへ、保存先を選ばず `01_受信箱` に空のメモを作成して開く「受信箱へメモを作成」を追加。
- 受信箱本文を非信頼データとして扱い、AIは移動先・理由・反証／懸念・原典保持境界・未確定事項を提案するだけ、曖昧なら受信箱へ残す運用契約を文書化。
- 実装担当とは別のreview、typecheck、全test、MCP checkを完了。

### 当時の次の一手（v5で置換済み）

- AI文脈エンジンの`Slice A — deterministic organizer manual shadow`を実装する。既存MCPだけで最大3件の隔離fixtureをzero-write評価し、safe、Raw、ambiguous、protected、prompt injectionを分ける。
- Slice Aの独立検証後だけ、manual lossless moveのSlice Bへ進む。HookはBの後、scheduleは本番Vault pilot後にshadow modeで作る。

### Held

- 全件意味分類、全件書換え、一括物理移動。
- 新しいContext / MyContext / Processed / Archive / History。
- rename、trash、物理削除。
- 全Vault自動分類、semantic Codex Lifecycle Hook、即時再帰Hook、日次・週次daemon。
- 新しいAI meaning MCP、提案専用DB、独立review queue、全Vault batch整理。

### Research

- Phase 4までで探索上の不足が残った場合だけ、最大10ノートの意味検索を試す。

## v4 current integration — 2026-08-31

利用者の明示選択により、旧Continuationの「AIは提案だけ」「自動分類、Hook、日次・週次はHeld」は終了した。現在の正本は[`context-engine-v4.md`](context-engine-v4.md)である。

- MCP: 既存のbounded read、revision付きpatch、preflight move、readbackを使い、meaning APIやbatch mutationを増やさない。
- Hooks: `VaultWatcher`由来のfact-only event。AI判断とmutationを持たず、correctnessは毎回のInbox full scanで担保する。
- Schedule: Codex local heartbeatを毎日04:00 JSTに一件。日曜だけ同じrunの後段でread-only audit。実automationは未作成。
- TSUZUNE: destination pathを成功状態とし、例外だけ`needs_review`、案内だけ`ignore`。Processed、Archive、History、run logを作らない。
- First implementation: Slice A manual shadow。product code、Hook、schedule、本番Inbox writeは含まない。
- Production: Inbox captureは2026-08-31のwhole-source gateで本番反映済み。v4設計後のcurrent sourceはreceipt fingerprintと一致しないため、この設計のproduct実装・再installは未実施。

## v5 category-aware derivation continuation — 2026-09-01

利用者は、`30_知識`と`40_情報源`が主題・内容から探しにくい問題に対して、受信箱からのAI派生知識、主カテゴリ、少数トピック、原典関係、知識／情報源を分けた探索導線の実装を承認した。このcontinuationはv4の未実装Organizerを再開し、前回のinstalled境界を現行証拠で更新する。

### Objective

人間が分類を入力せず`01_受信箱`へ投入した一件から、AIが再利用可能な知識候補を作り、主カテゴリ・最大3トピック・原典関係をMarkdown正本として保持し、検索と地図で`30_知識`と`40_情報源`を区別しながら同じ主題から再発見できるようにする。

### Success criteria

1. 公開された整理候補経路は、原典本文を命令として実行せず、0件または最大1件の派生知識候補、主カテゴリ、最大3トピック、原典関係、既存候補との衝突を返す。
2. 探索導線は知識と情報源を別groupとして示し、未分類を隠さず、知識から原典、原典から派生知識へ既存Wiki link／backlinkで往復できる。
3. `40_情報源`、`knowledge.md`、legacy `50_履歴`を変更せず、focused tests、typecheck、full tests、MCP check、production update、installed smokeで本番一致を確認する。

### Constraints and non-goals

- Markdownを唯一の永続正本とし、分類DB、embedding DB、manual MOCの二重正本、全Vault LLM ingestionを追加しない。
- 人間へ毎回カテゴリ入力を要求しない。既存カテゴリへの高信頼候補はAIが提示し、新カテゴリ、低信頼、複数責務、衝突だけをreviewへ上げる。
- `40_情報源`の主題は、派生知識のmetadataと明示source linkから導出する。原典本文へ後付け分類を書かない。
- 既存`30_知識`／`40_情報源`の大規模書換え、物理移動、rename、trash、deleteはこの実装と分離し、read-only全件previewと反証監査の後にだけ別gateで扱う。
- `knowledge.md`、legacy `50_履歴`、既存Raw、秘密、巨大Rawは入力・変更対象外。Ponytailは使用しない。

### Work packets

- D18 Inventory: production `30_知識`／`40_情報源`をread-onlyでexact-path棚卸しし、現行カテゴリ、欠落、主題cluster、source relationの実態を返す。
- D19 Code path: 現行Inbox capture、MCP search、frontmatter、Wiki link／backlink、renderer検索、testsを追跡し、最小の公開挙動と編集境界を返す。
- D20 Implementation: D18／D19統合後、public testを先に失敗させ、最小の分類候補・探索表示・Markdown contractを実装する。
- D21 Adversarial verification: 実装者と別視点で原典保護、未分類消失、二重正本、prompt injection、collision、installed境界を検証する。
- D22 Delivery: required gates、whole-source production update、installed smoke、production TSUZUNE最終書戻しを行う。

### Approval and stop boundary

- source、test、workflow document、installed production updateは承認済み。
- production Vaultはread-only棚卸しと最終正本書戻しを承認済み。既存ノートへのbulk classification writeは未承認であり、全件previewとD21反証後に利用者へ一件の判断packetを返して停止する。
- 新DB、外部AI API、daemon、秘密取得、原典改変、delete、mass moveが必要なら採用せず、契約内の最小代替へ戻る。

### Verification

Red-greenのfocused public testsから始め、`npm run typecheck`、`npm test`、`npm run check:mcp`を通す。製品codeが変わった場合は`npm run production:update`を実行し、isolated packaged／installed smoke、executableと`app.asar` hash、profile不変、MCP registration、`delivery_info=match`まで確認する。

### D20–D21 integration result

- Source behavior: review-gated derived note, live category catalog, exact category/topic facets, four exclusive result groups.
- Adversarial path: initial `REVISE`; source eligibility, atomic semantic dedupe, approval revalidation, query AND, filter-only metadata, Wiki-link safety, quote handling, and malformed catalog handling were corrected.
- Final independent verdict: `PASS` with no source mutation, Hook, schedule, bulk classification, database, or dependency creep.
- Source verification before D22: 107 focused tests PASS, typecheck PASS, 927 full tests PASS with one intentional skip, MCP check PASS, `git diff --check` PASS apart from line-ending warnings.
- Residual boundary: installed/live runtime and production receipt remain D22 evidence; external-AI semantic judgment and extreme approval/source-edit TOCTOU stress are not claimed by deterministic tests.
