# TSUZUNE Product Plan

現在の本番、working tree、検証済み範囲、次の一手は[PROJECT_STATUS.md](PROJECT_STATUS.md)を入口とする。このPLANは長期方向、Active Track、完了履歴、受入契約を保持する実行計画であり、現在値だけを読むDashboardではない。資料全体は[docs/INDEX.md](docs/INDEX.md)から辿る。

## Product Direction: Obsidian Parity + AI-Native Memory

決定日: 2026-08-01
状態: 採用
対象: v0.5以降

TSUZUNEを、Obsidianの主要機能を可能な限り備えたローカルファーストの知識ワークスペースへ育て、その上でContext Compiler、時間付き記憶、出典管理、個人データ取込、AI向け文脈評価を統合する。

製品全体はMarkdown Vaultを失わず移行できる機能互換を基礎とする。ただしGraph viewだけは2026-08-02の追加決定により基準を引き上げ、Obsidian Desktop 1.13.4の公開画面、表示対象、設定、操作、状態遷移を同一fixtureで徹底的に再現する。「近い」「似ている」「同等用途」ではGraph parityを完了にしない。非公開の内部コードまで複製するのではなく、利用者が観測できる結果を一致させる。Local Graphの可変Depthを入れないことだけは、過去の明示指示による唯一の互換例外とする。Obsidian固有の有料クラウドサービスは、Google Drive同期や静的サイト出力などTSUZUNE向けの代替で同じ利用目的を満たす。

以前の「MVPではグラフ、同期、プラグイン、独自DBへ広げない」という記述は、各マイルストーンの停止条件としては維持するが、製品全体の恒久的な除外方針としてはこの決定で置き換える。機能範囲は広げるが、一度に実装するのは常に1つの検証可能な縦切りだけとする。

### North Star

1. **Obsidian互換の知識基盤**: Markdown、YAML properties、Wikiリンク、添付、Canvasなど、アプリ外でも読める原本を守る。
2. **毎日使える操作性**: 書く、探す、つなぐ、並べる、振り返る、復元する、同期する作業をTSUZUNEだけで完了できる。
3. **AIが使える記憶**: AIへVault全体を無差別に渡さず、質問に必要な根拠だけをContext Compilerが組み立てる。
4. **本人専用の進化**: Google、ChatGPT export、将来の選択取込から得た情報を、出典と時刻を保った候補として育てる。
5. **説明できる賢さ**: AIが何を読んだか、なぜ選んだか、いつ有効な情報か、どの原典へ戻れるかを確認できる。

### Product Guardrails

- Markdownと添付原本を正本とし、SQLite、FTS、ベクトル索引、グラフ索引は削除して再構築できる補助データに限る。
- 既存Vaultを独自形式へ強制移行しない。対応する公開形式がある場合はMarkdown、YAML、JSON Canvasなどを優先する。
- 名前変更、移動、同期、変換、AI提案ではpreview、衝突検出、復元経路を持ち、黙って情報を失わせない。
- AIは通常の知識・プロジェクトノートをユーザー承認なしで作成・更新できる。原文・会話ログは不変とし、更新前の本文、出典、理由、改訂情報を`50_履歴/AI更新`へ保存する。削除・移動・強制上書きは別の明示操作とする。
- 個人利用、ローカル動作、オフライン継続を既定にし、Google接続、同期、外部取込、公開は明示操作にする。
- コア機能を先に安定させ、プラグイン機構は権限、Restricted Mode、障害分離を備えてから有効にする。
- 「ある」だけで完了にせず、実Vault dogfood、アクセシビリティ、性能、データ非破壊を受入条件へ含める。
- TSUZUNE自身の開発では、本番Vaultを開発記憶としてdogfoodする。開始時に登録済みMCPでプロジェクトノートを検索・取得・Context化し、検証済みの区切りごとに出典ノートとプロジェクト状態をrevision検査付きで書き戻す。fixtureや隔離profileは比較入力に限り、本番知識源とは扱わない。

### AI Write Policy

- AI自動更新を標準経路とし、人間の確認は毎回の承認ではなく、設定した保護対象・競合・高影響変更に限定する。
- `autonomous_update_note`は、通常ノートをrevision検査付きで更新し、旧本文を`50_履歴/AI更新`へ保存する。
- すべての自動更新にactor、reason、source_refs、previous_revisionを付与し、いつでも旧版へ戻せるようにする。
- `40_情報源`などのraw sourceは自動更新せず、派生要約・リンク・メタデータだけを別ノートへ生成する。
- フォルダまたはノート単位で`auto`、`review`、`immutable`を切り替えられるようにする。

### Parity Levels

| Level | 定義 |
|---|---|
| P0 | 未対応または計画のみ |
| P1 | 既存形式を安全に読み、最低限の表示・移動ができる |
| P2 | 個人の日常運用でObsidian相当の作業を完了できる |
| P3 | TSUZUNE固有の時間、出典、AI連携によってObsidian相当を超える |

全機能群を最低P2へ上げることを互換ロードマップの完了条件とする。Obsidian Sync、Publish、Mobile、Community plugin APIのようにサービスまたは外部生態系へ依存する領域は、利用目的を満たすTSUZUNE版をP2とし、完全なプロトコル互換を必須にしない。

`P0-1`〜`P0-4`は既存Graph Explorerで使っているdelivery slice IDであり、この表のParity Levelとは別物である。新規sliceは`O1-1`、`X1-1`のようにstage名を接頭辞にして混同を避ける。

### Official Obsidian Baseline

2026-08-01時点の公式仕様を基準に機能台帳を維持し、各ステージ開始時に再確認する。

- [Core plugins](https://obsidian.md/help/plugins)
- [Views and editing mode](https://obsidian.md/help/edit-and-read)
- [Internal links](https://obsidian.md/help/links)
- [Properties](https://obsidian.md/help/properties)
- [Tags](https://obsidian.md/help/Editing%2Band%2Bformatting/Tags)
- [Templates](https://obsidian.md/help/Plugins/Templates)
- [Daily notes](https://obsidian.md/help/plugins/daily-notes)
- [Search](https://obsidian.md/help/plugins/search)
- [Graph view](https://obsidian.md/help/plugins/graph)
- [Bases](https://obsidian.md/help/bases)
- [Canvas](https://obsidian.md/help/Plugins/Canvas)
- [Attachments](https://obsidian.md/help/attachments)
- [File recovery](https://obsidian.md/help/plugins/file-recovery)
- [Community plugins](https://obsidian.md/help/community-plugins)
- [Themes](https://obsidian.md/help/themes)
- [Sync](https://obsidian.md/help/sync)
- [Publish](https://obsidian.md/help/publish)
- [Web Clipper](https://obsidian.md/help/web-clipper)
- [Import](https://obsidian.md/help/import)
- [Mobile](https://obsidian.md/help/mobile)
- [CLI](https://obsidian.md/help/cli)
- [URI](https://obsidian.md/help/uri)

### Capability Coverage

| 機能群 | Obsidian相当の対象 | 現在 | 目標 |
|---|---|---:|---:|
| Vault・ファイル | Explorer、作成、移動、改名、trash、外部変更検知 | P2 | P3 |
| 編集・表示 | Source、Live Preview、Reading、Markdown補完、undo/redo | P1 | P2 |
| リンク | Wiki/Markdown link、見出し・block、alias、embed、自動更新 | P1 | P2 |
| 関連情報 | outgoing、backlink、unlinked mention、outline、footnotes、page preview | P1 | P2 |
| 移動・レイアウト | tabs、split panes、workspaces、quick switcher、commands、hotkeys | P0 | P2 |
| 検索 | 本文検索、演算子、property/tag/task検索、履歴、埋込query | P1 | P2 |
| Properties・Tags | 型付きYAML、properties view、tag view、rename、絞込 | P1 | P3 |
| Graph | local直接リンク／global全`.md`、filter、groups、display、forces、navigation、Canvas＋DOM描画 | P1 | P3 |
| 日常運用 | templates、daily notes、unique note、bookmarks、random note | P0 | P2 |
| 文脈内タスク・Capture | Markdown checkbox、Today／Upcoming／Inbox、元ノート更新、quick capture、自然言語期限 | P0 | P3 |
| 構造化ビュー | Basesのtable/list/cards/map、sort、filter、group、formula | P0 | P3 |
| Visual thinking | JSON Canvas、cards、groups、labels、media/web、embed | P0 | P3 |
| Media | 添付paste/drop、画像、PDF、音声、動画、録音、slides、web viewer | P0 | P2 |
| 復旧・履歴 | snapshots、file recovery、version history、監査ログ | P0 | P3 |
| 同期 | Google Drive手動同期、選択同期、状態表示、競合、履歴 | P1 | P3 |
| 取込・出力・公開 | Importer、Web Clipper、format converter、可搬Markdown/PDF・backup export、静的Publish | P0 | P3 |
| 外観 | themes、CSS snippets、icons、表示密度、アクセシビリティ | P1 | P2 |
| 拡張 | core module toggle、plugin API、Restricted Mode、権限、更新 | P0 | P3 |
| 自動化・アプリ間連携 | CLI、deep-link URI、commands、MCPによる同等操作 | P1 | P3 |
| Mobile | 閲覧・編集・検索・quick capture・同期・mobile toolbar相当 | P0 | P2 |
| AI記憶連携 | MCP、Context Compiler、時間、出典 | P2 | P3 |
| 個人データ知識化 | Google・ChatGPT取込、候補、承認、評価 | P0 | P3 |

### Obsidian Parity Delivery Stages

#### O0. Obsidian Graph Parity（最優先）

P0-4までの安全な探索基盤は完了した。2026-08-02の優先指示により、Personal Google Intakeより先に、**Obsidian Desktop 1.13.4（Windows 11、Default theme）**を固定参照版として、公開UIから観測できる配置、操作、設定、表示を互換にする。「似た見た目」や静止画1枚の一致では完了にしない。同一Vault、同一入力、同一設定に対して、同じ力学的規則、表示対象、設定効果、操作結果になることを要求する。乱数、tick時刻、GPU描画に左右されるピクセル座標そのものは一致条件に含めない。

過去の明示指示により、Local Graphの可変Depthだけは意図的な互換例外とする。TSUZUNEは現在ノートの直接リンクだけを表示し、Depth sliderを復活させない。それ以外のLocal Graph設定と操作は、固定参照版に合わせる。

- GP0 Reference Contract: 参照版1.13.4、公式仕様、比較Vault、機能対応表、実機操作記録、スクリーンショット条件を固定する
- GP1 Force Runtime Parity: Center／Repel／Link force／Link distance、継続simulation、再加熱と収束、node drag、設定保存を参照版と同じ観測可能な規則にする
- GP2 Renderer And Display: 全辺を単一Canvas層へ描画し、操作可能なノートをDOMで重ねるハイブリッド描画、矢印、文字フェード、ノードサイズ、リンク太さ、被参照数によるノード径
- GP3 Filters And Groups: Search files、Tags、Attachments、Existing files only、Orphans、Excluded files、複数色グループ
- GP4 Interaction Parity: hover、click、right-click、wheel／`+`／`-`、背景drag／矢印／Shift+矢印、node drag、Local Graphの直接リンク固定例外
- GP5 Time-Lapse And Scale: 作成日時順animation、大規模Vault、段階描画、必要な場合だけWebGLまたは再構築可能な索引を評価する
- GP6 Parity Closure: 同一Vaultで構造比較、設定別画像、操作動画、性能値、Markdown不変条件をHTMLレポートへまとめる

公式文書で範囲や優先順位が定義されていないスライダー数値、group重複時の色優先、node pin、zoom限界、設定保存単位などは参照版1.13.4の実機比較で決め、未確認の推測を互換要件へ混ぜない。2020年に公開された`d3-force`／PixiJSと位置非保存の説明は歴史的参考であり、1.13.4の内部実装保証として扱わない。

Gate:

1. 参照版1.13.4のFilters、Groups、Display、Forces、navigation、time-lapseを機能対応表で100%説明し、Local GraphのDepth撤廃だけを意図的な差異として記録できる。
2. 比較Vaultに対するnode／directed edge包含結果が、同じ設定の参照版と一致する。
3. Force slider、node追加・削除・drag、filter変更に対して、同じ再配置規則と収束方向を示す。固定リング、path順レーン、黄金角の静止配置、固定tick後の静止画を互換実装として認めない。
4. hover、click、right-click、wheel／key zoom、背景drag／key pan、node drag、Restore defaultsの操作結果が参照版と一致する。
5. pointer、keyboard、screen reader向けのノード操作を壊さず、色だけに依存しない。
6. 大規模fixtureで操作不能にならず、参照版にない固定上限でnode／edgeを省略しない。
7. グラフ操作前後でMarkdownと添付原本を変更しない。

#### O1. Daily Writing And Navigation

- Source、Live Preview、Readingの一貫した編集体験
- headings、lists、tasks、tables、callouts、code、math、Mermaid、comments、footnotes、folding、spellcheckの編集・表示
- tabs、split panes、pinned tabs、workspaces、前後移動、最近使ったノート
- quick switcher、command palette、hotkeys、slash commands
- heading/block links、aliases、embeds、link autocomplete、自動リンク更新
- outline、footnotes view、page preview、word count
- 画像と添付のpaste/drop、保存先規則、基本media preview

##### O1-T. Contextual Tasks And Capture

調査日: 2026-08-03

根拠: [「大先輩のObsidianタスク管理術」](https://www.youtube.com/watch?v=Ld8_OM3Gwfo)、[Tasks User Guide](https://publish.obsidian.md/tasks/)

動画の運用から採用する原則は、タスクを専用DBや中央ノートへ移すことではなく、発生したMarkdownノートへ残し、Today／Upcoming／Inboxを再構築可能な投影として生成することである。グラフ表示そのものではなく、低摩擦の記録、文脈を保つ原本、横断集約、AIによる検索と保守を日常利用の価値へつなげる。

Design contract:

- タスクの正本は、議事録、プロジェクトノート、デイリーノートなど発生元にあるMarkdown checkboxとする。タスク索引、期限別一覧、通知は削除して再構築できる派生データに限る。
- `Today`は本日期限と期限超過、`Upcoming`は本日より後から7日以内、`Inbox`は未完了かつ期限なしを既定投影とする。プリセットは後から編集可能にするが、最初から汎用query languageを作らない。
- 一覧上の完了、期限変更、優先度変更は、元ファイル、行または安定ID、revisionを示し、競合がなければ元Markdownへwrite-throughする。外部変更と競合した場合は黙って上書きしない。
- 1行で済む作業はcheckboxのまま保持し、手順、資料、判断履歴が必要な作業はWikiリンク先の通常ノートへ展開する。1タスク1ファイルを必須にしない。
- Daily Noteは日記、仕事、タスクを日々の入口とし、完了タスク、当日作成・更新ノートを再構築可能なactivity logとして表示する。
- Capture Gatewayは既存MCP、CLI／global hotkey、将来のmobile adapterから同じappend契約を利用し、対象ノート、見出し、時刻、actor、sourceを記録する。Discordや常時起動PCを必須構成にしない。
- 「今日」「明後日」などの自然言語期限はpreviewで正規化結果を確認でき、日付だけの期限に存在しない時刻を推測しない。
- AIは初期分類を完璧にするためではなく、蓄積後のtag、folder、link、見出し、task metadataの一括保守へ使う。通常ノートはAI Write Policyに従って更新し、raw sourceは不変、変更前本文と差分、理由、出典、復元経路を残す。
- Context Compilerはタスク本文だけでなく、発生元ノート、直接リンク、期限、状態、source、変更履歴を候補へ含め、動的一覧自体を知識の正本として重複投入しない。

Delivery slices:

1. `O1-T1 Task Core`: Markdown checkbox、状態、期限、優先度、source位置を純粋関数で解析し、Vault走査からメモリ上の再構築可能な索引を作る。性能測定で必要性が出るまで独自DBを追加しない。
2. `O1-T2 Task Views`: Today／Upcoming／Inbox、元ノートへの移動、revision検査付きwrite-throughを実装する。
3. `O1-T3 Daily Operations`: Daily Note template、日記／仕事／タスクの入口、完了タスクと作成・更新ノートのactivity logを実装する。
4. `O1-T4 Capture Gateway`: 既存MCPへappend-to-heading契約を追加し、desktop quick captureから同じ経路を利用する。mobile／chat adapterはこの契約のdogfood後に1つずつ評価する。
5. `O1-T5 AI Vault Operations`: Vault質問、task context bundle、batch reorganizationを既存のContext CompilerとAI Write Policyへ接続し、固定質問と変更fixtureで有効性を比較する。

Gate:

1. 任意のMarkdownノートにある対象checkboxが、重複せず元パス付きで正しい期限別投影へ現れる。
2. 一覧からの変更が元Markdownへ反映され、外部変更またはrevision不一致時は本文を保持して競合を説明する。
3. 詳細ノートへリンクしたタスクを開くと、タスク行、発生元ノート、詳細ノートを相互に辿れる。
4. Desktop quick captureから3操作以内で既定見出しへ追記でき、時刻、actor、sourceを追跡できる。
5. Context Compilerがタスク単独より発生元文脈を含む方が改善することを、同一モデル、質問、budgetの固定評価で確認する。
6. 7日間の本番Vault dogfoodで、Today／Upcoming／Inboxの確認、capture、完了、再起動、外部編集を行い、Markdown損失と復元不能な変更が0件である。

Non-goals for the first slice:

- 1タスク1ファイルの強制、専用task DBを正本にすること、複雑なプロジェクト階層、汎用query言語、常時起動サーバー、Discord専用Bot、独自mobile app、通知・カレンダー・Google Tasksの同時実装。
- TaskForge、Raycast、Discordは利用体験の参考に留め、初期依存または必須経路にしない。

Gate:

1. 既存Markdownを破壊せず、主要記法を編集・表示・移動できる。
2. Obsidianを開かずに7日間の通常メモ運用を完了する。
3. タブ、分割、キーボード操作を含む再起動復元が通る。
4. O1-Tの各sliceは直前sliceのGateを満たしてから進み、Task Core、Views、Daily、Capture、AIを同時実装しない。

#### O2. Organization And Retrieval

- 型付きproperties editorと全Vault properties view
- nested tags、tag rename、tag view
- search operators、regex、property/tag/task検索、検索履歴、埋込query、Explain
- templates、daily notes、unique note creator、bookmarks、random note
- unlinked mentions、note composer、format converter
- 必要性を測定した場合だけSQLite/FTSを再構築可能な索引として導入する

Gate:

1. 2,000ノートfixtureで検索、タグ、property一覧が実用速度で動く。
2. property変更とnote composerが原本損失なしでundoまたは復元できる。
3. Daily/Template運用を1週間dogfoodし、手作業の重複を減らす。

#### O3. Bases-Compatible Structured Views

- file-backedなview定義
- table、list、cardsを先行し、必要性確認後にmapを追加する
- propertyの表示・編集、sort、filter、group、formula、summary
- Markdownへの埋込とsaved view
- Temporal State/Event、source、freshnessを通常propertiesと同じ仕組みから利用する

Gate:

1. viewを消してもMarkdownとpropertiesが失われない。
2. 主要な`.base`相当データを読み書きし、未対応項目を黙って捨てない。
3. プロジェクト、読書、人物、資料の4 fixtureで表・カード運用を確認する。

#### O4. Canvas And Rich Media

- open JSON Canvasの読込・保存・round-trip
- text、note、image、PDF、audio、video、web cards
- directed edge、label、color、group、selection、duplicate、swap
- pan、zoom、fit、selection navigation、Canvas embed
- audio recorder、PDF/media viewer、slides、web viewer

Gate:

1. JSON Canvas fixtureを往復して未知フィールドを失わない。
2. 100 cards fixtureで編集と移動が実用速度で動く。
3. Canvasから元ノートと出典へ戻れ、Canvasだけに重要情報を閉じ込めない。

#### O5. Recovery, Sync, Import And Publish

- file recovery snapshots、version history、restore preview、監査ログ
- Google Drive同期の往復、選択同期、状態表示、競合履歴、再試行
- Importer、Web Clipper、外部Markdown/HTML/JSON取込、format conversion
- 選択ノートまたはVaultの可搬Markdown/PDF・backup exportと、復元前のmanifest検証
- 静的HTMLによる選択ノートPublish、リンク・添付・検索索引の出力
- 個人利用で必要になった時だけ暗号化、別端末常時同期、mobile companionを評価する

Gate:

1. 編集、改名、削除、同期競合を履歴から復元できる。
2. import、clip、publishの全成果から原URLまたは原ファイルへ戻れる。
3. オフラインやGoogle障害でもローカル編集と原本読取を継続できる。

#### O6. Customization And Plugin Platform

- themes、CSS snippets、icon/color/density settings
- core機能のenable/disableとcommand registry
- TSUZUNE CLIとdeep-link URIを、既存MCP commandの権限境界を再利用して提供する
- plugin manifest、commands、views、settings、read/write Vault API
- permission declaration、Restricted Mode、per-plugin disable、crash isolation
- local package installを先行し、署名またはcurated registryは実需要後に検討する
- Obsidian community plugin API互換層は調査対象とし、全プラグイン互換を無条件には約束しない

Gate:

1. plugin無効化で通常起動へ復帰できる。
2. Vault外、Google、ネットワーク、MCP writeは権限なしに利用できない。
3. sample pluginでcommand、view、設定、限定Vault read/writeを検証する。

#### O7. Parity Closure

- 公式Core plugins台帳を1項目ずつP2以上へ更新する
- 既存Obsidian Vaultのread-only auditと移行preview
- accessibility、2,000/10,000ノート性能、起動、メモリ使用量、壊れたMarkdownの耐性
- help、shortcuts、migration、recovery、troubleshooting文書
- mobile、hosted publish、collaborationは個人利用価値を再評価し、実装または明示的なTSUZUNE代替を確定する
- Mobileを実装する場合は閲覧、編集、検索、quick capture、同期、mobile toolbar相当を同一Vault fixtureで検証する

Gate:

1. 公式Core plugins台帳に未分類項目がない。
2. Starter Vaultと実Vaultで30日間dogfoodし、Obsidianを通常運用に必要としない。
3. 未対応形式や機能を起動時またはimport previewで説明できる。

### Beyond Obsidian: Intelligence Stages

#### X1. Context Compiler 2.0

- keyword、property、Wiki graph、time、sourceを併用して候補を集める
- token/文字数budget、重複除去、多様性、freshness、confidenceで順位付けする
- `explain_retrieval`で採用・除外理由と原典を表示する
- current-only、historical、as-of、project packを用途別に生成する
- task contextではタスク行、発生元ノート、直接リンク、期限、状態、sourceを一つのbundleとして扱い、Today／Upcoming／Inboxの投影を原典として重複投入しない

#### X2. Provenance-Backed Personalization

- Google Tasks、Drive選択取込、YouTube、Data Portability、ChatGPT exportをsourceとして扱う
- raw source、derived artifact、knowledge noteを分離し、knowledge noteは自動更新可能にする
- 元ID、時刻、hash、role、取得方法を保持し、再取込で重複しない
- 単発行動やAI回答を恒久的な本人プロフィールへ反映する場合は、ノートごとの書込ポリシーと履歴を適用する

#### X3. Temporal Memory Lifecycle

- occurred/observed/valid/recorded time、freshness、review dueを統合する
- supersession、矛盾、状態変化、当時の信念、現在の信念を区別する
- 古い記憶を破壊せず検索優先度を弱め、再確認候補を出す
- Memory InspectorとMemory Unit Testsで誤った現在化や未来情報漏えいを検出する

#### X4. AI-Assisted Knowledge Maintenance

- link、tag、property、要約、重複、矛盾、古い情報を通常ノートへ自動反映する
- Inboxから既存ノートへの追記、新規ノート、保留、却下をAIが実行し、変更履歴と出典を残す
- 初期taxonomyは単純に保ち、蓄積後のtag、folder、link、heading、task metadata再編を履歴付きbatch operationとして実行する
- `auto`、`review`、`immutable`の書込ポリシーを明示でき、削除・移動・強制上書きは別の明示操作とする
- ユーザーへ日常的な分類、採点、重複整理を要求しない

#### X5. Retrieval Quality Evaluation

- `モデルのみ`、`現在ノートのみ`、`全文検索`、`リンク展開`、`Context Compiler`を固定質問で比較する
- 正答、根拠一致、時間漏えい、矛盾、文脈量、応答時間を測る
- グラフ、ベクトル検索、AI整理は評価で改善した場合だけ既定へ昇格する
- 「賢くなった気がする」ではなく、どの情報が回答を改善または悪化させたかを記録する

#### Intelligence Gates

1. X1はM5 dogfoodの固定質問4/4、出典追跡3/3を維持し、質問または単一起点から複数subjectの必要文脈を文字数budget内で再現する。
2. X2は取込ノートからraw sourceへ100%戻れ、自動更新されたknowledge noteに出典・履歴・旧版への復元経路がある。
3. X3はcurrent、historical、knowledge-timeのfixtureで未来情報漏えい0件を維持し、supersessionとconflictを説明する。
4. X4は通常ノートへ事前の分類作業を要求せず、autoポリシーの更新を履歴付きで適用し、immutableポリシーと競合時は本文を変更しない。
5. X5は同じ質問集合、モデル、時点、budgetで比較し、精度または根拠一致を改善しない複雑な方式を既定化しない。

### Execution Rules

1. 一度に実装するのは1つのdelivery sliceだけとし、次の基盤を同時追加しない。
2. 各sliceは公開挙動の失敗テスト、最小実装、全回帰、実Electron dogfood、文書更新で閉じる。
3. parity機能は公式仕様と実Vaultを基準にし、見た目だけのモックを完了扱いにしない。
4. X系AI機能は比較評価を先に固定し、改善が確認できない方式を複雑さだけで採用しない。
5. 既存のGoogle、Temporal、MCP機能を壊さず、未コミット変更を機能単位で分離する。
6. 新しい長期計画があっても、現在のsliceの停止条件を満たす前に次へ進まない。

## Completed Foundation: Temporal Memory Lite

作成日: 2026-07-30
状態: 完了（M0〜M5）
対象: v0.2のCodex・ChatGPTデスクトップ連携を基礎にしたv0.3開発

Temporal Memory Liteは完了済みの基盤として保持する。以下のM0〜M5は履歴と回帰条件であり、上記の長期方向によって削除しない。`docs/v0.1-scope.md`も初期スコープの履歴として残す。

## Active Track: v0.6 Obsidian Graph Parity

更新日: 2026-08-03
状態: 継続Force runtime、円形ノード、Canvas辺、Display 4項目、Obsidian準拠の白いGraph surface、右上浮動設定パネル、Local／Globalの独立入口、未解決リンク、tag、attachment、Search filesの主要構文・配列property・入力途中の寛容な解釈・binary attachment境界、Files and links共通のExcluded files設定、順序付きGroups、論理createdAt、node右クリックと種別別open、Local／Global別のscale・panel・section状態、unique neighbor数とLocal root特別値を使うnode径、zoom連動のnode／label／line／arrow描画、Animate／time-lapse、選択ノートなしのGlobal Graphまで実装済み。Animate中は表示prefixだけをsimulationへ渡し、通常のlive topology更新でも生存node座標を保持してForceを再加熱する。狭いtestと隔離Electron captureで`0 → 1 → 7`件のMarkdown増分表示まで検証済み。これは実装状況であり、Obsidian 1.13.4固定参照版とのGP6比較を通過した`matched`判定ではない。固定版との操作比較、保存境界、性能値を引き続き検証する

### Current Transition Queue

2026-08-02の最新指示によりGraph parityを先行する。一度に実装するのは常に1つの検証可能な縦切りとする。黄金角seed、固定tick、対称percent正規化は廃止し、継続する`d3-force` runtime、node drag、再加熱、camera分離へ置換した。これは実装基盤の完了であり、Obsidian 1.13.4実機との一致証拠ではない。今後は同一fixtureの実機観測を正本にし、未観測項目を「同じ」と判定しない。

GP6-0として公式Obsidian Desktop 1.13.4のGlobal Graph既定画面を、固定fixture、1265×768、DPR 1、Default light theme、隔離profileで採取した。結果は7 Markdown、未解決1件を含む8 node、renderer上の有向link 12本、無向pair 8組で、fixture原本、隔離Vaultの保護対象、`obsidian://`登録がすべて不変である。証拠は`docs/reports/assets/graph-gp6/manifest.json`、同階層のenvironment／observation／PNGを正本とする。

GP6-0Pではインストール済み本番TSUZUNE 0.5.0を同じfixture／viewport／themeで隔離採取し、公式1.13.4との差を`not-matched`として記録した。Markdown数は7対7、既存Markdown間の有向Wikiリンク11本は完全一致した一方、表示nodeは8対6、有向edgeは12対11、無向pairは8対7で、本番0.5.0には孤立ノート`90_orphan/Orphan.md`、未解決node`Missing Note`、`00_Home.md -> Missing Note`が表示されない。視覚面も公式の円形node／Force由来の不規則配置／既定矢印なし／右上浮動設定パネルに対して、本番0.5.0はpill node／規則配置／矢印あり／inline controlsで一致していない。fixture原本、隔離Vault、本番通常profileはすべて不変である。比較正本は`docs/reports/assets/graph-gp6/comparison.json`、人間向け証拠は`docs/reports/graph-gp6-production-comparison-2026-08-02.html`とする。この判定は配布済み0.5.0だけを評価したもので、後に`5c0f4bb3`へ収録されたGP6-0W実装の判定ではない。

1. GP6-0Wとして採取時のdirty working tree（Git HEAD `93a8502f103b86a92a1bf1f3af96f0192173b1f8`）を隔離buildし、同一fixture／1265×768／DPR 1／light themeで背景非フォーカス採取した。7 Markdown、8 node、12 directed edge、8 undirected pairは公式1.13.4と一致し、Canvas初回描画、8 node全件の有限geometry、fixture原本・隔離Markdown・製品source・capture中のbuild不変も確認した。製品source SHA-256は`CD0522CBADE425CE01C49197DAA52D354492D3524CA34995EB65F9AC260AE253`、build SHA-256は`65F943B538C521BA6009FB151338F46B41C46EF9ECC1FB5B9C1FBEDF0850F4E7`。構造一致だけで完全互換とは判定せず、製品chrome／canvas領域、色・強調、未解決nodeの内部ID、操作・保存境界は`not-matched`または未判定としてGP0-3b／GP1-7へ残す。正本は`docs/reports/assets/graph-gp6/tsuzune-working-tree/manifest.json`、同階層のenvironment／observation／PNGとする
2. [x] GP0-3b-a: 固定fixtureで最初に観測できた公開差はGlobal Graph初回表示の設定パネルだった。Obsidian 1.13.4の`close: false`に合わせ、TSUZUNEは未保存のVault scope既定だけを`settingsOpen: true`へ変更した。Local既定と明示保存済み状態は維持する。公開UIのRED→GREEN、全362 tests、隔離captureの`settingsPanelVisibleByDefault: true`を確認し、この一項目だけを`matched`とする。比較レポートは`docs/reports/graph-gp7-global-settings-default-2026-08-03.html`。
3. [x] GP0-3b-b: Global GraphのSearch filesへ`path:"10_projects"`を入力し、Graphを閉じて再表示した後と、別プロセスによるアプリ完全再起動後に同じ検索条件が復元される公開挙動を比較した。Obsidian 1.13.4とTSUZUNEはいずれも3観測点で2 node／1 unique visible edgeを維持し、この検索条件保持だけを`matched`とする。TSUZUNEは`GraphViewState.query`をLocal／Global別に保存し、旧設定では空文字へ補完する。全368 tests、build、MCP smoke、隔離capture 11/11を通し、比較レポートは`docs/reports/graph-gp0-search-persistence-2026-08-03.html`とする。ピクセル一致、他query、起動時のGraph workspace自動復元は未証明。
4. [x] GP0-3b-c: 空query、8 node、1265×768、DPR 1、light theme、隔離profileを固定し、Global Graphへ制御された論理wheel `deltaY=-120`と背景drag `+96,+64 CSS px`を与えた。Obsidian側はCDPマウス入力、TSUZUNE側は隔離オフスクリーンのDOM合成入力である。Obsidian 1.13.4とTSUZUNEはいずれもzoom `1.5`をGraph再表示後・別プロセスのアプリ完全再起動後まで保持し、panは両時点で中央へ戻った。比較6項目がすべて`matched`であり、panを永続化すると参照版から乖離するため製品コードは変更していない。証拠は`docs/reports/assets/graph-gp0-camera-persistence/comparison.json`、人間向けレポートは`docs/reports/graph-gp0-camera-persistence-2026-08-03.html`とする。物理マウス／trusted event、ピクセル一致、zoom easing、Local Graph、fit／reset、zoom限界、workspace leaf自動復元は未証明。
5. 次の一項目はGP0-3b-dとして、node drag直後・Graph再表示後・アプリ再起動後のnode位置／固定状態を同条件で採取する。その後、context menu、Groups、Animate開始・途中・終了、Restore defaultsの保存境界を一項目ずつ採取する
6. 両者の画像、操作結果、node／directed edge／settings JSON、Markdown SHAを同じ比較表へ並べ、各項目を`matched`、`different`、`missing`、唯一の`intentional exception`へ分類する
7. `different`または`missing`になった公開挙動だけを1件ずつ修正し、同一captureを再実行する
8. GP6の計測で必要性が確認された場合だけ、大規模Vaultの性能改善とviewport cullingを追加する。未計測の推測だけではWebGL、独自DB、固定表示上限を導入しない

Google Calendarの追加認可基盤とGoogle Tasks／Drive選択取込／YouTube／Data Portabilityの長期計画は残すが、Graph parityのCurrent Transition Queueを閉じて次の優先順位を再選択するまで保留する。Google Drive同期の往復確認は既存データ保護の確認として残すが、新機能開発の主トラックにはしない。この順序は長期の機能範囲を狭めるものではなく、未完了sliceを増やさないための実行順である。

2026-08-03のObsidianタスク運用動画調査を`O1-T Contextual Tasks And Capture`へ反映した。これは現在のGP6比較へ割り込ませず、Graph parityのCurrent Transition Queueを閉じた後に、Google G1を含む候補と再比較して着手順を決める。着手する場合も`O1-T1`から1 sliceずつ進め、Task Views、Daily Note、Capture、AI batch maintenanceを同時に開始しない。

### Graph Explorer Goal

Vault全体の構造と、選択ノートの直接近傍を行き来できるようにする。Obsidian Desktop 1.13.4の公開Graph UIを固定比較基準とし、同一Vault、入力、設定でnode／directed edge包含、力学的規則、設定効果、操作結果、表示更新を互換にする。ピクセル座標の完全一致は要求しないが、「視覚的傾向」だけの主観判定も認めない。Local Graphは過去の明示指示により直接リンクだけに固定し、可変Depthだけを採用しない。

- ローカルグラフは現在ノートと直接つながるリンク先・バックリンクだけを表示する
- ローカルグラフとVault全体グラフを切り替える
- Vault全体グラフは孤立ノートを含む全`.md`を既定で表示する
- 辺はviewport固定の単一Canvas層へまとめ、ノートはworld stage上のクリック・フォーカス・キーボード操作できるDOM要素として重ねる
- 各`.md`を円形ノードで表し、Wikiリンクの線をノードの円周間へ接続する
- ノート名・パスで表示対象を絞り込む
- ズーム、パン、全体表示への復帰
- 選択ノート、リンク先、バックリンク、相互リンクを見分ける
- ノードからノートを開き、開いたノートを新しい中心にする

P0-3／P0-4当時は力学シミュレーション、グラフDB、GraphRAG、グラフ上でのノート編集、無制限な全Vault描画を入れず、表示件数に安全な上限を置いた。この上限はGP1-5で現在要件により撤廃した。Markdownと既存Wikiリンクresolverを原本にする境界は維持する。

### Graph Explorer Delivery Slices

- [x] P0-1（履歴・現在は廃止）: ローカルグラフの1段・2段切替
- [x] P0-2: Vault全体グラフとローカルグラフの切替、孤立ノート表示の選択
- [x] P0-3: ノート絞り込み、ズーム、パン、全体表示
- [x] P0-4: Starter Vaultで操作性と表示上限をdogfood
- [x] GP0-1: 公式Graph／Local Graph機能を互換契約へ反映
- [x] GP0-2: Obsidian比較Vaultと設定別capture手順を追加
- [x] GP0-3a: 公式1.13.4配布artifactのSHAを照合し、Graph色、設定箱寸法、公開設定の既定値とrangeを固定する
- [x] GP6-0: 公式1.13.4 Global Graph既定画面を固定fixture／viewport／DPI／themeで採取し、artifact hash、node／directed edge、設定、Markdown不変、protocol復元を証拠化する
- [x] GP6-0P: インストール済み本番TSUZUNE 0.5.0を同一fixtureで採取し、公式1.13.4との差を`not-matched`として証拠化する
- [x] GP6-0W: 採取時のdirty working treeを隔離build／同一captureし、構造8 node／12 directed edge／8 undirected pairの一致と、視覚・操作差が残る`not-matched`境界を証拠化する
- [x] GP1-1: 4つのForce設定モデル、既定値、初期値復元を追加
- [x] GP1-2: Force設定をアプリ設定へ保存し、再起動時に復元
- [x] GP1-3: 固定リング配置を力学レイアウトへ置換
- [x] GP1-4: 狭いcomponent test、App設定復元test、型検査、実Electron smokeを通す
- [x] GP1-5: Vault全体で孤立ノートを既定表示し、固定描画上限による`.md`の欠落をなくす
- [x] GP2-1: 全辺を単一Canvas層へ集約し、操作可能なDOMノートと同期する
- [x] GP2-2: 円形ノード、円周間の接続線、表示中ノードの実寸に基づくfit-to-boundsを実装する
- [ ] GP0-3b: Obsidian Desktop 1.13.4の実機操作を採取し、node drag、camera、context menu、Animate、保存境界を固定する（初回設定パネル、Global検索条件保持、Global camera zoom／pan保持境界は完了）
- [x] GP1-6: path順、黄金角、固定tick、対称正規化を廃止し、継続Force runtimeへ置換する
- [ ] GP1-7: slider、node drag、graph更新、再起動復元の観測可能な操作結果を参照版と一致させる（実装済み、実機一致証拠待ち）
- [x] GP2-3: Arrows、Text fade threshold、Node size、Link thicknessと保存を追加する
- [x] GP2-4実装: unique undirected neighbor数とLocal root特別値30を使うnode径、`sqrt(1 / zoom)`のnode／label scale、低zoomで強調labelを`1 / zoom`へ保つ規則、`lineSize / zoom`の線幅、`2 * sqrt(lineSize) / zoom`の矢印scale、相互edgeを1本へまとめた両方向arrowを実装（固定参照版の画像一致判定はGP6待ち）
- [x] GP2-5: CanvasをCSS scaleされるworld stageの外へ移し、viewport固定Canvasへworld-to-screen camera transformを適用する。低倍率のbitmap clippingを解消し、同styleの辺を一つのpathへまとめる
- [x] GP3-1: 右上浮動設定パネル、折り畳みFilters／Display／Forces、検索／Orphans統合、全体Resetを追加する
- [x] GP3-2a: Markdown／unresolvedのkindと存在状態を持つGraph core入力モデル（既定互換を保つopt-in）
- [x] GP3-2b: unresolvedをUIとExisting files onlyへ接続し、OrphansとLocalのOutgoing／Incoming／Neighbor linksを保存可能なFilter設定へ統合する
- [x] GP3-2c: tag／attachment／createdAtを持つGraph入力モデル（論理createdAtの永続化はGP5前提）
- [x] GP3-3実装: line／block／section／task、scalar・配列property、入力途中のquote／括弧／operator／regex／propertyを寛容に扱うSearch files、binary attachmentを通常termから除外し`file:`／`path:`では検索できる境界、Files and links共通のExcluded files設定を実装（固定fixture一致判定はGP6待ち）
- [x] GP3-4実装: 複数Groups、query、色、順序、先に一致したグループの優先、保存、Reset、色スウォッチのdrag reorder（Windows実操作と固定参照版の一致判定はGP6待ち）
- [x] GP4-1: Obsidian準拠のGraph surfaceとLocal／Globalの独立入口
- [x] GP4-2実装: node右クリックメニュー、tag検索、attachment／file-backed nodeの種別別open、Local／Global別のscale・設定panel開閉・section折り畳み保存。Globalの非空queryとcameraは固定参照版比較を終え、zoom保持／pan非保持を`matched`とした。Local、他query、menu項目はGP6待ち
- [x] GP5-1実装: 論理createdAt順のAnimate／time-lapse UIと表示prefix
- [x] GP5-2実装: Animateの増分graph feed、Force再加熱、通常のlive topology更新を狭いtestと隔離Electron captureで検証。固定参照版との開始・途中・終了の一致判定はGP6で行う
- [ ] GP6: 実機比較closure

旧GP1の受入条件（履歴。厳密互換要求により再オープン）:

1. 既定設定で現在ノートを含む既存グラフが欠落せず、固定リングではないリンク依存の配置になる。
2. Center force、Repel force、Link force、Link distanceをラベル付きsliderで変更でき、変更方向が公式説明と一致する。
3. 「初期設定に戻す」で4項目が既定値へ戻る。
4. 変更したForce設定を`settings.json`へ保存し、再起動時に同じ値を復元する。
5. Force変更はMarkdown、リンク、選択ノート、保存状態を変更しない。
6. 既存のhover、focus、click、pan、zoom、凡例を維持する。
7. GP1-5では全Markdown表示だけを追加し、GraphRAG、グラフDB、Search構文、Groups、time-lapseを同時に追加しない。

この旧GP1は固定リングを除去した中間成果であり、厳密互換の完了証拠ではない。GP1-6以降ではpath順の黄金角seed、固定180 tick、対称percent正規化、未確認のLocal中心pinを互換仕様から除外する。「初期設定に戻す」は最終的にFilters、Groups、Display、Forcesを含むGraph設定全体を参照版既定値へ戻す。比較Vaultとcapture手順は`fixtures/obsidian-graph-parity-vault`と`docs/obsidian-graph-parity-reference.md`を正本とする。

GP1検証結果（2026-08-02）:

- `npm test`: 29 files／220 tests PASS
- `npm run typecheck`: PASS
- `npm run check:mcp`: 4 read tools／3 write tools PASS
- `npm run build`: PASS
- 非表示の実Electron capture: 4 Force既定値50、Center 100で配置変化、設定保存、Markdown 7件の複合SHA-256前後一致
- 証跡: `docs/reports/graph-explorer-gp1-2026-08-02.html`

GP1-5の受入条件:

1. Vault全体へ切り替えた直後から、リンクを持たないノートを含む全`.md`を表示する。
2. 50ノート・200リンクを超えても、固定上限を理由にノードやリンクを省略しない。
3. 「孤立ノートを表示」を外した場合と検索を入力した場合だけ、利用者の明示操作として絞り込む。
4. ローカルグラフは現在ノートと直接つながるノートだけを表示し、深度切替を持たない。
5. グラフ表示はMarkdown、リンク、選択ノート、保存状態を変更しない。

GP1-5検証結果（2026-08-02）:

- TDD RED: Vault全体の孤立ノート欠落と、52ノート中50件での切り捨てを再現
- `npm test`: 29 files／218 tests PASS
- `npm run typecheck`: PASS
- `npm run check:mcp`: 4 read tools／3 write tools PASS
- `npm run build`: PASS
- UI test: Vault全体へ切り替えた直後から孤立ノートを表示
- dense component test: 52ノート／51リンクを省略なしで描画

GP2の現在描画契約:

1. 可視範囲の全辺をviewport固定の1枚のCanvasへまとめ、リンク数に比例してDOMまたはSVG要素を増やさない。
2. ノートはworld stage上のDOM要素のままCanvas上へ重ね、pointer、keyboard、screen readerから開ける操作性と現在ノートの状態を維持する。
3. Canvas自体へCSS zoomを掛けず、world-to-screen変換をCanvas contextへ適用する。hover、focus、選択、ズーム、パンの状態はCanvasの辺とDOMノートで同期する。
4. Vault全体では孤立ノートを含む全`.md`を入力とし、ローカルグラフでは現在ノートの直接リンクだけを入力とする。
5. ハイブリッド描画への変更前後でMarkdown、添付、選択ノート、未保存の編集内容を変更しない。

GP2-1検証結果（2026-08-02）:

- `npm test`: 30 files／219 tests PASS
- `npm run typecheck`: PASS
- `npm run check:mcp`: 4 read tools／3 write tools PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- 実Electron captureでCanvas辺、矢印、DOMノート、hover強調を確認し、Markdown 7件の複合SHA-256前後一致
- 証跡: `docs/reports/assets/graph-gp1/01-force-defaults.png`

GP2-5検証結果（2026-08-03）:

- 保存倍率13.17%、749×613 viewportで、旧CSS変換stageは98.63×80.72に縮小していた一方、修正後Canvasは749×613を維持
- 78ノード／267辺の隔離Electron captureで、旧bitmap境界による線欠落がないことを確認
- 同じ色・太さ・透明度の辺を一つのpathへまとめ、Canvas stroke回数を削減
- `npm run test:production`: 44 files／360 tests PASS
- `npm run production:update`: typecheck、MCP、installer、packaged／installed smoke、installed hash、profile不変を含めPASS
- 証跡: `docs/reports/graph-edge-viewport-2026-08-03.html`

### Completed Slice: GP2-2 円形ノード／実寸fit-to-bounds

目的:

Vault全体の全`.md`を表示しても、利用者がパンやズームで迷子になった後に「全体表示」1回で可視グラフへ戻れるようにする。現在の100%・原点リセットではなく、表示中ノードの実寸範囲をキャンバスへ収める。

Scope:

1. 全`.md`を円形ノードとして描画し、WikiリンクのCanvas線を円周から円周へ接続する。
2. 現在の力学レイアウト結果とDOMノートの実寸から、表示中グラフの境界を求める。
3. 表示中グラフをviewportへ収めるzoomとpanを計算する。余白、zoom範囲、単一ノートの扱いは参照版1.13.4の実機観測で上書きする。
4. 「全体表示」はTSUZUNE拡張として残せるが、Obsidian互換のwheel／key zoomと背景panを妨げない。
5. Canvas辺とDOMノートは同一のcamera状態を共有する。Canvasはviewport固定でcontextへcamera transformを適用し、DOMノートはworld stageへCSS transformを適用する。Force runtimeが持つworld座標をcamera操作で正規化し直さない。
6. fitはMarkdown再解析やgraph topology変更を起こさない。Force simulationの継続・収束はcamera操作と独立させる。

Non-goals:

- node drag、右クリックメニュー、Groups、Filter構文
- Text fade threshold、Node size、Link thicknessなど他のDisplay設定
- WebGL、Worker、グラフDB、新しい依存パッケージ
- 自動fitを検索文字の入力ごとに実行すること

受入条件:

1. パンとズーム後に「全体表示」を押すと表示中ノードがviewportへ収まる。固定24px余白や60〜180%をObsidian互換条件として要求しない。
2. Local Graph、Vault全体、単一ノート、検索後の可視集合で同じ動作になる。
3. fit前後でCanvas辺の端点とDOMノートの中心がずれない。
4. fit操作によってworld座標、Markdown書込み、ノート選択、未保存編集の変更を起こさない。
5. pointer、keyboard、screen reader向け操作を維持し、zoom入力と限界は参照版1.13.4の観測値でテストする。
6. component test、型検査、全テスト、MCP検査、build、実Electron capture、Markdownハッシュ比較を通す。

GP2-2検証結果（2026-08-02）:

- TDD RED: 円形marker未描画、円周端点関数未実装、100%・原点へ戻すだけの全体表示を個別に再現
- `npm test`: 31 files／224 tests PASS
- `npm run typecheck`: PASS
- `npm run check:mcp`: 4 read tools／3 write tools PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- 非表示の実Electron captureで円形DOMノード、円周間Canvas線、実寸fitを確認
- 比較FixtureのMarkdown 7件は複合SHA-256が前後一致
- 証跡: `docs/reports/assets/graph-gp1/03-vault-circular-fit.png`
- HTMLレポート: `docs/reports/graph-explorer-gp2-2-2026-08-02.html`

実装順:

1. viewportとnode boundsからzoom／panを返す小さな純粋関数を作り、境界値を先にテストする。
2. グラフキャンバスとノードの実寸を取得し、「全体表示」へ接続する。
3. 現在ノート切替時の100%リセットを同じfit処理へ置換する。
4. Local／Vault／単一ノートを実Electronで撮影し、Markdown不変を確認する。

停止条件:

上記受入条件を満たしたためGP2-2は完了した。厳密互換要求により、当時予定していたGP2-3への直行は停止し、GP0-3／GP1-6／GP1-7を先行する。

### Completed Implementation Slice: GP2-3 Display Controls

Arrows、Text fade threshold、Node size、Link thicknessを公式公開範囲の設定として追加し、App settings／IPC／preloadを通して保存する。被参照数に応じた円径、拡大率に応じたラベル透明度、可変円径に応じた線の両端をCanvasとDOMで同期した。狭いtestと実Electron captureは通過したが、既定値、色、寸法、slider操作のObsidian 1.13.4実機一致はGP0-3の比較証拠が揃うまで未証明とする。

### Completed Implementation Slice: GP3-1 Floating Graph Settings

歯車から右上へ重なる浮動設定パネルを開き、Filters、Display、Forcesを個別に折り畳めるようにした。既存のSearch files相当入力とOrphansをFiltersへ移し、Restore default settingsは検索、Orphans、Display、Forcesを一括で戻して保存する。このslice時点ではGroups、Tags、Attachments、Existing files only、Excluded files、Animateの空UIを置かず、Existing files onlyとLocal固有Filtersは後続GP3-2bで実装した。

### Completed Implementation Slice: GP3-2a Unresolved Link Core Model

全Markdownノードを`kind: note`／`exists: true`として明示し、`buildWikiGraph(notes, { includeUnresolved: true })`を選んだ場合だけ未解決Wikiリンクを`kind: unresolved`／`exists: false`として追加できるようにした。曖昧なbasename、無効なtarget、自己リンク、重複edgeは除外する。このslice時点ではUI未接続だったが、後続GP3-2bで`Existing files only`と同時に公開した。

### Completed Implementation Slice: GP3-2b Filters And Unresolved UI

未解決Wikiリンクを既定でGraphへ含め、参照版の`#ababab`・opacity 0.5で表示し、クリック時は既存の未作成リンク作成経路へ接続した。`存在するファイルのみ表示`を有効にすると未解決ノードを除外する。Vault全体の`オーファン`、Local Graphの`出ていくリンク`、`入ってくるリンク`、`ネイバーリンク`を同じFilter設定モデルへ統合し、参照版既定値（Existing off、Orphans on、Outgoing on、Incoming on、Neighbor off）をsettings／IPC／preload経由で保存・復元する。このslice時点のSearch filesはノート名・パスの単純部分一致であり、Tags、Attachments、Excluded filesも未実装だった。後続GP3-2cでSearch基盤、Tags、Attachmentsを追加した。

### Completed Implementation Slice: GP3-2c Tags, Attachments And Graph Query Foundation

Markdown本文とfrontmatterからtagを抽出し、Tags有効時に`#08b94e`のtag nodeとnote→tag edgeを追加する。Vault scanは画像、音声、動画、PDFの対応拡張子を添付として収集し、Attachments有効時に`#e0ac00`のattachment nodeと埋め込み／Wikiリンクedgeを追加する。`[[Note#Heading]]`と`[[Note#^block-id]]`は基底ノートへ解決する。Search filesはimplicit AND、OR、括弧、否定、phrase、regex、file／path／content／tag／case演算子へ置換した。このsliceで後続へ残したline／block／section／task／property演算子とFiles and links共通のExcluded filesはGP3-3、論理createdAtの永続化とAnimate接続はGP5-1で実装した。

### Completed Implementation Slice: GP3-3 Search Boundaries And Excluded Files

Search filesへline／block／section／task、scalar・配列property、入力途中のquote／括弧／operator／regex／propertyを寛容に扱う解釈を追加した。binary attachmentは通常termでは一致せず、`file:`／`path:`では検索できる。Files and links共通のExcluded filesをアプリ設定として追加し、保存後にVault snapshotを再取得する。固定参照版のManage UI、全機能共通効果、malformed query fixtureの一致判定はGP6へ残す。

### Completed Implementation Slice: GP3-4 Ordered Groups

複数Groups、query、色、順序、先に一致したグループの優先、保存、全体Reset、色スウォッチのdrag reorderを実装した。Windows版Electronでの実操作と固定参照版の優先規則・drag結果はGP6で確認する。

### Completed Implementation Slice: GP4-1 Graph Surface And Separate Entries

Graph内にあったTSUZUNE独自の見出し、scope切替bar、zoom button列、説明文を除去し、白いGraph canvasへ240pxの設定panelを上／右12pxで重ねるsurfaceへ変更した。設定名は固定参照版の日本語表記へ合わせ、Local Graphは現在ノートのaccent強調を維持し、Global Graphはhover／focusしていない時に全体をニュートラル表示する。hover／focus中だけ対象ノートと接続edgeを強調し、解除後はニュートラルへ戻す。編集画面には`ローカルグラフ`と`グラフビュー`の独立入口を置き、Local／Globalの選択をGraph canvas内へ重ねない。keyboard zoom／panは維持する。Global Graphは左ペインの専用入口から選択ノートなしでも開ける。このsliceで残したnode context menuとscope別view stateは後続GP4-2で実装した。

### Completed Implementation Slice: GP4-2 Node Actions And Scope View State

file-backed nodeの右クリックメニュー、tag検索、attachment／noteの種別別openを実装した。Local／Global別にscale、設定panelの開閉、Filters／Groups／Display／Forces sectionの折り畳みを保存・復元する。pan／query／node位置を含む正確な保存単位、menu項目・順序・無効状態はGP6の固定参照版比較で確定する。

### Completed Implementation Slice: GP5-1 Animate Timeline

Vault内sidecarの論理createdAtを作成日時順へ並べ、Animate／time-lapse UIから表示prefixを進める実行操作を実装した。Animateは永続設定に含めない。増分graphをForce simulationへ渡す挙動、再加熱、通常のlive topology更新はGP5-2の狭いtestと隔離Electron captureで検証済みであり、固定参照版との一致判定はGP6まで行わない。

P0-1当時の受入条件（深度切替は現在仕様から廃止済み）:

1. 既定値は現在互換の1段である。
2. 2段を選ぶと、現在ノートから無向距離2以内のノートと、その集合内のリンクだけを表示する。
3. 深さを切り替えてもMarkdown、リンク、選択ノートを変更しない。
4. 孤立ノートは深さに関係なく中心ノートとして表示する。

2026-08-01 P0-1 verification:

```text
npm run typecheck    PASS
npm test             PASS: 24 files / 189 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
git diff --check     PASS
```

P0-2当時の受入条件（3はGP1-5で置換済み）:

1. 既定値はローカルグラフのままである。
2. Vault全体表示は、解決済みリンクに参加する全ノートと、そのリンクを表示する。
3. 孤立ノートは既定で隠し、明示した場合だけ追加する。
4. 現在ノートが孤立していても中心ノートとして維持する。
5. 範囲や孤立ノート表示を切り替えてもMarkdown、選択ノート、保存状態を変更しない。

2026-08-01 P0-2 verification:

```text
npm run typecheck    PASS
npm test             PASS: 24 files / 191 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
git diff --check     PASS
real Electron smoke  PASS: 4 graph states / synthetic Vault
```

機能別スクリーンショットと検証対応は[Graph Explorer P0-2 HTML Report](docs/reports/graph-explorer-p0-2-2026-08-01.html)に残す。

P0-3当時の受入条件（3の100%・原点復帰はGP2-2で実寸fitへ置換予定）:

1. ノート名またはパスの大文字小文字を区別しない部分一致で絞り込み、現在ノートは中心として維持する。
2. 絞り込み後は、両端のノートが表示されるWikiリンクだけを描画する。
3. 60〜180%のズーム、背景ドラッグと矢印キーによるパン、100%・原点へ戻す全体表示を使える。
4. 現在ノートを切り替えた時はズームとパンを既定値へ戻す。
5. 絞り込み、ズーム、パン、全体表示はMarkdown、選択ノート、保存状態を変更しない。

2026-08-01 P0-3 verification:

```text
npm run typecheck    PASS
npm test             PASS: 24 files / 194 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
git diff --check     PASS
real Electron smoke  PASS: filter / zoom 140% / pan 90x55 / fit 100%
Markdown invariant   PASS: 42 files, capture前後の複合SHA-256一致
```

機能別スクリーンショット、実測値、未受入の境界は[Graph Explorer P0-3 HTML Report](docs/reports/graph-explorer-p0-3-2026-08-01.html)に残す。

P0-4の受入条件:

1. 絞り込み後の表示を最大50ノート・200リンクに制限し、現在ノートを必ず残す。
2. 現在ノート、直接接続、残りのパス順で表示対象を決定し、入力順やUnicode表記差に依存しない。
3. 上限超過時は表示件数と省略件数を`role="status"`で説明し、絞り込み後に上限未満なら通知を消す。
4. 現在、リンク先、バックリンク、相互リンク、関連ノートの凡例を表示する。
5. pointer hoverまたはkeyboard focusで対象ノートと直接接続を強調し、見えていない古いhover状態はfocusを妨げない。
6. パン、hover、focusだけでは全Vaultの絞り込み・sort・配置を再計算しない。
7. Starter Vaultと高密度fixtureの実Electron確認前後で、元VaultのMarkdownを変更しない。

2026-08-01 P0-4 verification:

```text
npm run typecheck    PASS
npm test             PASS: 24 files / 200 tests
npm run check:mcp    PASS: 4 read tools / 3 write tools
npm run build        PASS
git diff --check     PASS
real Electron smoke  PASS: legend / hover / 50 nodes / 200 edges / filter
Markdown invariant   PASS: final Starter Vaultのcapture前後で件数・複合SHA-256一致
```

実Electronの4画面、密集fixtureの省略数、検証境界は[Graph Explorer P0-4 HTML Report](docs/reports/graph-explorer-p0-4-2026-08-01.html)に残す。実OSのスクリーンリーダー、High Contrast、物理キーボード、複数DPIはこの自動確認だけでは受入済みにしない。

### X4-0 AI Autonomous Write

更新日: 2026-08-01
状態: MCPサービスとsmoke testを実装。通常ノートの自動更新、旧本文保存、出典・理由記録まで完了。ノート単位の`auto`、`review`、`immutable`ポリシーUIは次slice。

- [x] `autonomous_update_note`をMCPへ追加
- [x] revision検査付きの自動更新
- [x] 更新前本文を`50_履歴/AI更新`へ保存
- [x] actor、reason、source_refs、previous_revisionを返す
- [ ] ノート・フォルダ単位の書込ポリシーを追加
- [ ] AI自動更新のElectron dogfood
- [ ] NotebookLM Research Package取込と接続

Gate:

1. ユーザー承認なしで通常ノートを更新できる。
2. raw sourceは自動更新せず、旧本文と更新理由へ戻れる。
3. 外部変更時はrevision競合として本文を保持する。

### X4-1 Windows Production Installer + Updater

更新日: 2026-08-02

状態: 0.5.0のCommonJS/ESM起動不具合を修正し、app.asar検査とrenderer ready smokeを追加してこのPCへ再インストール済み。次版Releaseを使う実更新dogfoodとコード署名は未完了。

- [x] ポータブル配布からユーザー単位NSIS one-clickへ移行
- [x] app ID `jp.tsuzune.app`とユーザーデータ非削除を固定
- [x] 非公開GitHub Releases向け`latest.yml`、blockmap、更新providerを追加
- [x] tokenを保存せず、環境変数または`gh auth token`から一時取得
- [x] 更新確認、明示ダウンロード、進捗、再起動適用をヘッダーへ追加
- [x] 適用前に編集中ノートを保存し、失敗・競合時は更新を中止
- [x] `npm run check:installer`でversion、SHA-512、blockmap、feedを検査
- [x] packaged `app.asar`で`electron-updater`のCommonJS互換importを検査
- [x] renderer ready fileでpackaged / installed版の実起動を確認
- [x] このPCへ修正版0.5.0を上書きインストール
- [x] 同一版再インストールで既存状態58ファイルの変更0件を確認
- [ ] 0.5.1以降を非公開Releaseへ公開し、二版間の実更新を受入
- [ ] Windowsコード署名証明書とTSUZUNE用`.ico`を設定

Gate:

1. install / update / uninstallでVaultと`%APPDATA%\TSUZUNE`を失わない。
2. 保存に成功した場合だけ`quitAndInstall`へ進む。
3. Releaseのinstaller、blockmap、`latest.yml`が同じversionとSHA-512を指す。
4. 一般配布完了とは、署名と二版間更新を通すまで表現しない。

### X4-2 Product Optimization

更新日: 2026-08-03

状態: 実装・隔離fixture検証・このPCの本番反映を完了した。Graph検索条件保持は`ad26532`へ収録して同名originへpushし、2026-08-03 20:11 JSTに同コミットのclean sourceから本番へ導入した。Windows本番環境への反映結果は`docs/reports/production-update-latest.json`を正とする。500件／2000件のcontrolled sparse fixtureを各3回、隔離copy／fresh profileで実測して性能baselineを固定した。GP6-0Wでは採取時のdirty working treeを同一fixture／viewport／themeで採取し、7 Markdown、8 node、12 directed edge、8 undirected pairの構造一致を確認した。Global Graph検索条件`path:"10_projects"`は入力直後、Graph再表示、アプリ完全再起動後の3点でObsidian 1.13.4と同じ保持結果になった。GP0-3b-cではGlobal cameraへ同じ制御論理wheel／背景dragを与え、両製品ともzoomをGraph再表示・アプリ再起動後まで保持し、panを中央へ戻すことを6/6比較で確認したため製品修正は不要だった。ただし物理マウス／trusted event、性能基準の合格、Obsidian完全互換、実OSアクセシビリティは未完了。次はnode dragの保存境界を同条件で比較する。

- [x] 100ms以内のVault外部変更をpath単位で集約し、20イベントを1回のsnapshot refreshへまとめる
- [x] 外部エディタのunlink→add形式のファイル置換を選択中ノートへ再読込し、更新を取りこぼさない
- [x] 編集中本文と保存済みVaultの派生計算を分離し、検索・バックリンク・グラフ向け全体計算を毎打鍵から外す
- [x] TSUZUNE専用thread-and-node markと共通線アイコンをヘッダー、起動、空状態、主要操作へ適用
- [x] 1120px／900pxを境に3列幅、操作折返し、表示密度を調整するcompact desktop shellを実装
- [x] MoveDialogへdialog semantics、初期フォーカス、Tab trap、Escape、フォーカス復帰、背景inertを実装
- [x] `prefers-reduced-motion`と保存状態のlive notificationへ対応
- [x] Vault内の埋め込み画像を検証済みIPC経由でMarkdownプレビューへ表示し、添付を未作成ノートとして扱わない
- [x] 通常のMarkdown画像URLは既存表示を保ち、Vault assetだけを検証済みIPCへ送る
- [x] 隔離fixtureで編集画面、MoveDialog、プレビューのElectron証跡を保存
- [x] Windows packageがElectron既定アイコンへ退行していないことを検査するinstaller gateを追加
- [x] silent installで置換されたapp.asarの読取cacheを破棄してから、本番bundleのversionとhashを再検証する

検証結果:

```text
npm run typecheck           PASS
対象回帰                    PASS: 4 files / 60 tests
npm run test:production     PASS: 44 files / 356 tests
Watcher burst               PASS: 20 events / 1 snapshot refresh
npm run build               PASS
Electron capture            PASS: brand mark / 14 icons / focus / inert / embedded image
```

証跡: [Product Optimization HTML Report](docs/reports/tsuzune-product-optimization-2026-08-03.html)

大規模Vault実測（aggregate median、各size 3 Electron trial）:

| 観測項目 | 500件 | 2000件 |
|---|---:|---:|
| Global Graph first usable | 261.6 ms | 1147.5 ms |
| synthetic inputからdouble rAF | 37.1 ms | 96.8 ms |
| autosave完了 | 664.8 ms | 1022.9 ms |
| 20 Markdown追加がGlobal Graphへ可視化 | 372.8606 ms | 2172.2159 ms |
| 20 Markdown削除がGlobal Graphへ可視化 | 476.3172 ms | 2030.247 ms |
| animation frame p95 | 25.0 ms | 164.4 ms |

耐久する計測正本: `docs/reports/assets/large-vault-performance-2026-08-03/summary-public.json`。`work/large-vault-performance/summary.json`は再計測用のローカル作業出力。

計測境界: fixtureは概ね次数4の疎グラフで、OS cacheはwarm。入力はforegroundを奪わないoff-screen Electron synthetic inputであり、物理キーボード遅延ではない。Watcher値は生のfilesystem event時刻ではなくGlobal Graph DOMが期待件数へ到達するまで、animation frame値はrenderer schedulingのproxyでGPU／Canvas描画時間ではない。したがって、この値は改善前後を比較するbaselineであり、性能thresholdの合格やObsidian parityを意味しない。

残作業:

- [x] 500件・2000件Vaultで入力遅延、外部変更burst、グラフ切替を実測し、aggregate medianと計測境界を固定する
- [x] GP6-0Wで採取時のdirty working treeを隔離buildし、公式Obsidian 1.13.4と同一fixture／viewport／themeで採取する
- [x] GP0-3b-bでGlobal Graph検索条件のGraph再表示／アプリ再起動後保持を同条件で採取し、狭い`matched`判定を固定する
- [x] GP0-3b-cでcamera zoom／panのGraph再表示／アプリ再起動後の保存境界を同条件で採取し、zoom保持／pan中央復帰の6/6比較を`matched`として固定する
- [ ] 次: GP0-3b-dでnode drag直後／Graph再表示後／アプリ再起動後のnode位置・固定状態を同条件で採取・比較する
- [ ] 720px未満と200% zoomはsidebar・関連欄の折畳みを含めて別sliceで対応する
- [ ] ファイルツリーへtreeitem semanticsと矢印キー操作を追加する
- [ ] 標準prompt／confirmをアプリ内ダイアログへ段階的に置換する
- [ ] 実Windows keyboard、screen reader、High Contrast、複数DPIを確認する
- [x] 2026-08-03 20:11 JSTに`ad26532`をこのPCの本番TSUZUNEへ反映し、packaged／installed smoke、hash一致、profile不変、MCP再登録を確認する

Gate:

1. 外部変更burstはpathごとの最新状態へ集約され、選択中ノートの更新を失わない。
2. 編集中の毎打鍵でVault全体の検索・バックリンク・グラフ向け全体計算を再構築しない。
3. MoveDialogをキーボードだけで操作・取消でき、終了後は元の操作へ戻る。
4. Windows packageのアプリアイコンがElectron既定アイコンと異なる。
5. Markdown原本、atomic save、revision競合契約を変更しない。

### Personal Google Intake Order

- [ ] P1: Google Tasks読取
- [ ] P2: Google Drive選択取込
- [ ] P3: YouTube読取
- [ ] P4: Google Data Portability

各Pを認可、preview、apply、出典保持、重複防止、実アカウントdogfoodまで完了してから次へ進む。4機能を同時実装せず、次機能向けの抽象化を先回りしない。

## Completed Track: v0.4 Google Drive Manual Sync + Local Graph

更新日: 2026-07-31
状態: 実Google認証・初回Drive送信40件完了（Drive往復確認は未完了）

v0.4では、実運用でノート同士の近傍を確認しやすくする1-hopグラフと、ローカルMarkdownを原本のまま別端末へ運べる手動Google Drive同期だけを扱う。Googleデータ取り込みによるパーソナライズ、プラグイン、独自DB、バックグラウンド同期は同時に実装しない。

### v0.4 Progress

- [x] 要求権限、削除、競合、原本、非対象データを要件として固定
- [x] 選択ノート中心の1-hopグラフを純粋coreとSVG＋HTMLボタンで実装
- [x] Desktop OAuth JSON解析、PKCE、loopback callback、token exchangeを実装
- [x] 個人用ビルドへDesktop OAuthクライアントIDとclient secretをビルド時だけ組み込み、通常UIを「Googleでログイン」へ短縮
- [x] 独自OAuth JSONは詳細設定へ移し、保存済みJSONを標準設定より優先
- [x] 更新トークンの`safeStorage`向け暗号化保存を実装
- [x] `drive.file`で専用VaultフォルダとMarkdownだけを扱うDrive APIクライアントを実装
- [x] 送信・受信・競合・保持を決める削除非伝播の同期plannerを実装
- [x] デスクトップ画面へGoogle接続、同期preview/apply、グラフの操作面を追加
- [x] main processで認証、Driveクライアント、Vault、同期ledgerを接続
- [x] 別端末から既存Drive Vaultを一覧・検証・明示ペアリングできる操作を追加
- [x] 同期途中の成功操作を都度ledgerへ確定し、再試行時の不要な競合を防止
- [x] mock/fixtureによる同期適用テストと全回帰確認
- [x] TSUZUNE用Desktop OAuthクライアントを発行し、IDとclient secretを個人用ビルドへ組み込む
- [x] 組み込みOAuth設定を使った実Google認証と基本プロフィール表示
- [x] Drive同期の読み取り専用preview（送信40件、受信0件、競合0件、保持0件）
- [x] 「この内容で同期」による初回apply（送信40件）
- [ ] 別端末相当の受信、競合コピー、削除非伝播を含むDrive往復確認

Google Cloudプロジェクト`TSUZUNE`でDrive APIを有効化し、External / Testingの同意画面、テストユーザー、Desktop appクライアントを構成した。このDesktopクライアントではtoken exchangeにクライアントIDとclient secretの両方が必要なため、両値をビルド時だけ渡し、Gitへ保存していない。2026-07-31に実Google認証が成功し、`%APPDATA%\TSUZUNE\google\google-account.json`と暗号化された`refresh-token.json`の保存を確認した。Driveの読み取り専用previewは送信40件、受信0件、競合0件、保持0件で成功し、その後に利用者が初回applyを実行した。同期台帳の完了時刻は2026-07-31 14:42:24 JSTで、40件すべてに固有のDrive file IDがあり、ローカル・Driveハッシュも40/40件で一致している。現在のローカルMarkdownも40/40件で同期時ハッシュと一致し、欠損はない。ただし別端末相当の受信や競合解決を含むDrive往復はまだ確認していない。

ローカル検証結果:

```text
npm run typecheck    PASS
npm test             PASS: 23 files / 177 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
npm run pack:win     PASS: dist/TSUZUNE-0.4.0-portable.exe
bundle credential check PASS: ID + client secret（値は表示しない）
```

## Progress

- [x] M0: v0.2基準（`0c66af8`）の型検査、56テスト、MCP smoke、ビルドを確認
- [x] M1: State/Event契約、正常値、失敗値、時間境界をテストで固定
- [x] M2: 非破壊frontmatter parser、時間判定、再確認期限、`supersedes`、subject別タイムラインを純粋coreとして実装
- [x] M3: 時点・質問・知識時点を考慮し、根拠と警告を付けるContext Compiler
- [x] M4: MCPと右パネルのTemporal Inspector
- [x] M5: Starter Vaultでdogfood

M4では、既存MCPの後方互換性を保ったまま`as_of`と`include_history`を公開し、右パネルへ読み取り専用のTemporal Inspectorを追加した。不正な時間メタデータがあっても、ノート編集は継続できる。M5の公開前監査で、MCPにも`temporal_perspective`を追加し、既定のvalid-timeと明示的なknowledge-timeを呼び分けられるようにした。

M4完了時点の検証:

```text
npm run typecheck    PASS
npm test             PASS: 13 files / 102 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
git diff --check     PASS
```

M4の公開済みチェックポイント:

```text
branch: agent/tsuzune-mcp-integration
commit: 4b35765 Add temporal memory context and inspector
remote: origin/agent/tsuzune-mcp-integration
visibility: private
```

M5ではStarter Vaultへ3対象、State Note 5件、Event Note 3件、追加出典ノート1件を投入し、起点だけ、従来1段Context、時間対応Contextを同じ固定質問で比較した。

```text
固定4問の厳密正答        A: 1/4  B: 1/4  C: 4/4
State Note → Source一致 A: 0/3  B: 0/3  C: 3/3
過去への未来State/Event C: 0
過去への時点不明本文     C: 0
再確認警告               C: 2
安全性プローブ           PASS: 4/4
```

dogfood中に、過去時点Contextへ後日の通常ノート本文が露出する問題を発見した。明示された過去の`as_of`では、有効時点を持たない通常ノート本文を保守的に省略し、stub、`content_omitted`、`UNSCOPED_NORMAL_CONTENT_OMITTED`警告を返すよう最小修正した。詳細は`docs/m5-dogfood.md`に記録した。

M5完了時点の検証:

```text
npm run typecheck    PASS
npm test             PASS: 14 files / 113 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
npm run dogfood:m5 -- "<Starter Vault path>" 2026-07-31 2026-07-22
                       PASS
git diff --check     PASS
```

M5の実装・検証結果は、このブランチの次の公開チェックポイントとして確定する。

## 1. Objective

Markdownノートへ任意の時間情報と出典を付け、TSUZUNEとCodexが次を区別できるようにする。

- 現在有効な状態
- 過去に有効だった状態
- ある日に起きた出来事
- 最後の確認から時間が経ち、再確認が必要な情報
- 新しい情報によって置き換えられた情報

最初の完成形は「人間のような主観時間」ではない。

> 古い状態を消さず、指定時点で有効な情報を選び、その根拠を示せるローカルMarkdown記憶

を完成させる。

## 2. Current State

2026-07-31に現在のリポジトリで確認した状態:

- `main`はv0.1.0の基礎メモアプリ（`cf24860`）
- 現在の`agent/tsuzune-mcp-integration`ブランチは、v0.2.0基準（`0c66af8`）へTemporal Memory Lite M0〜M4を加えた`4b35765`上でM5を完了した
- `4b35765`はprivate remoteへpush済みだが、まだ`main`へ統合していない
- Markdownが原本で、アプリ固有DBはない
- Vault走査結果は`NoteDocument[]`としてメモリ上で扱う
- Wikiリンク、バックリンク、文字列検索が純粋なcore処理として分離されている
- MCPは検索、取得、バックリンク、文脈構築、作成、改訂確認付き更新の6ツール
- `build_context`は起点、リンク先最大5件、バックリンク最大3件を文字数上限付きで構築する
- MCPからの削除、移動、名前変更、フォルダ作成、強制上書きは公開していない
- frontmatter、時間断面、知識時点、再確認期限、置き換え、出典警告を純粋coreで判定する
- Context Compilerは質問一致を1段リンクの上限適用前に順位付けする
- Context本文は参照データ境界で囲み、ノート内の命令文をシステム命令として扱わない方針を明示する
- MCPの`build_context`は任意の`as_of`と`include_history`を受け取り、時間判定、選定理由、警告を返す
- MCPの`build_context`は任意の`temporal_perspective`でvalid-timeとknowledge-timeを選べる
- 右パネルは現在、過去、未来、出来事、再確認期限超過、置き換え済みを読み取り専用で表示する
- 過去の`as_of`では、有効時点を持たない通常ノート本文を採用せず、内容省略と対象Pathを構造化して返す
- Starter Vault dogfoodの比較、誤判定、手作業負担、修正結果は`docs/m5-dogfood.md`に固定した
- v0.4では1-hopグラフ、Google Desktop OAuth、暗号化token store、`drive.file`限定Driveクライアント、削除非伝播の同期planner、main process、画面とpreload APIを接続済み
- 同期適用はDrive版の直前再確認、危険な相対パス拒否、Windows上の大文字小文字衝突拒否、stale plan拒否、競合コピーを含む
- v0.4の実Googleアカウント認証、読み取り専用preview、初回送信40件のapplyは確認済みで、Drive往復の手動確認が未完了

確認済みの基準:

```text
npm run typecheck    PASS
npm test             PASS: 10 files / 56 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
```

## 3. Temporal Memory Lite M0-M5 Rules

この節の版指定ルールは完了済みM0〜M5の実装境界であり、文書先頭の将来ロードマップを禁止しない。後続版でSQLite、プラグイン、同期などを採用する場合も、Markdownを原本とするProduct Guardrailsと独立したGateを満たす。

1. Markdownを唯一の原本として保つ。
2. 時間情報は任意とし、既存ノートへ追加を強制しない。
3. 時間情報が壊れていても、ノートの閲覧と編集を妨げない。
4. 古い情報を自動削除しない。
5. 「古い」と「誤り」を同じ意味にしない。
6. ファイル更新日時を、出来事の発生日時や事実の有効期間として扱わない。
7. AIが推測した日時を、本人確認済みの日時として保存しない。
8. v0.3では読み取り・判定・説明を優先し、新しい自動書き込みを増やさない。
9. Markdown本文をfrontmatterパーサーで再整形しない。
10. SQLite、ベクトル検索、グラフDB、常駐処理は導入しない。
11. Googleアカウント接続を導入しても、ログインなしのローカル利用を維持する。
12. Google認証、Googleデータ取り込み、Vault同期を別々の機能として設計する。
13. 外部履歴から推測した関心や好みを、本人確認済みプロフィールとして自動確定しない。

## 4. Success Conditions

次の3条件をすべて満たしたら、Temporal Memory Liteを完成とする。

1. プロジェクトの状態が変わっても、以前の状態、期間、変更理由、出典をMarkdownから確認できる。
2. Codexが「現在」と「指定日現在」の文脈を作り分け、採用したノートと理由を示せる。
3. 再確認期限を過ぎた情報を現在の事実として黙って扱わず、警告付きで提示できる。

## 5. Canonical Terms

### Normal Note

時間情報を持たない通常のMarkdownノート。これまでどおり検索、リンク、編集の対象になる。

### State Note

ある対象について、一定期間成立する状態を記録したノート。

例:

- プロジェクトが開発中
- 機能が凍結中
- 現在使っている技術構成

### Event Note

特定の時点で起きた出来事を記録したノート。

例:

- プロジェクトを再開した
- 設計方針を変更した
- 本人が以前の状態を訂正した

### Current

指定時点が`valid_from`以上で、`valid_to`より前にある状態。`valid_to`が空なら終了未確認として扱う。

### Historical

指定時点では有効期間外だが、過去の状態として保持されている情報。

### Review Due

`review_after`を過ぎている情報。誤りとは断定せず、現在も有効か再確認が必要と表示する。

### Superseded

別ノートの`supersedes`によって置き換えられた情報。削除せず、履歴として残す。

## 6. Minimal Markdown Contract

通常ノートはfrontmatterなしで利用できる。時間を扱いたいノートだけ、標準的なYAML frontmatterを付ける。

### State Note

```yaml
---
kind: state
subject: "[[10_プロジェクト/TSUZUNE]]"
status: active
valid_from: 2026-07-30
valid_to:
observed_at: 2026-07-30
verified_at: 2026-07-30
review_after: 2026-10-30
source: "[[40_情報源/会話-新しいソフト作成希望]]"
supersedes:
---
```

### Event Note

```yaml
---
kind: event
subject: "[[10_プロジェクト/TSUZUNE]]"
event: status_changed
occurred_at: 2026-07-30
observed_at: 2026-07-30
source: "[[40_情報源/会話-新しいソフト作成希望]]"
---
```

### Field Rules

| Field | State | Event | Rule |
|---|---:|---:|---|
| `kind` | required | required | `state`または`event` |
| `subject` | required | required | 対象ノートへのWikiリンク |
| `status` | required | - | 状態名。初版では自由文字列 |
| `event` | - | required | 出来事の種類。初版では自由文字列 |
| `valid_from` | required | - | 状態の開始日 |
| `valid_to` | optional | - | 状態の終了日。終了時点は含まない |
| `occurred_at` | - | required | 出来事が起きた日 |
| `observed_at` | optional | optional | TSUZUNEまたはAIが知った日 |
| `verified_at` | optional | - | 現在も正しいと最後に確認した日 |
| `review_after` | optional | - | 再確認を促す日 |
| `source` | recommended | recommended | 根拠ノートへのWikiリンク |
| `supersedes` | optional | optional | 置き換えるノートへのWikiリンク |

日時の初版ルール:

- 日単位は`YYYY-MM-DD`
- 時刻が必要な場合はタイムゾーン付きISO 8601
- 日付だけの値はローカル暦日として比較し、UTC変換で日付をずらさない
- `valid_from`は含み、`valid_to`は含まない
- 「昨日」「先週」などの相対表現はメタデータへ保存しない
- 日付精度が不明な情報は推測せず、本文へ不確実性を書く

## 7. Storage And History Policy

### Current Summary

既存のプロジェクトノートは、読みやすい現在概要やMap of Contentとして保つ。すべてのプロジェクトノートをState Noteへ変換しない。

### Durable History

履歴が必要な状態と出来事だけを、State NoteまたはEvent Noteとして独立したMarkdownへ残す。

- 古いState Noteを編集して現在状態へ変換しない
- 新しいState Noteを作り、必要なら`supersedes`で古いState Noteを参照する
- 状態変更の理由はEvent Noteとして残せる
- 保存場所はVault内であれば固定しない
- Starter Vaultでは`50_履歴`を推奨例として使うが、アプリの必須フォルダにはしない

初版では、状態変更時の複数ノート自動更新を実装しない。人またはCodexが明示的にState Note/Event Noteを作成し、読み取り側の有用性を先に検証する。

## 8. Behavior

### Open A Note

1. Markdown本文を通常どおり表示する。
2. frontmatterがあれば、時間情報を読み取り専用で解析する。
3. 右パネルへ次のいずれかを表示する。
   - 現在有効
   - 過去の状態
   - 未来開始
   - 再確認期限超過
   - 置き換え済み
   - メタデータ不完全
4. エラーがあっても本文編集は継続できる。

### Build Current Context

1. 起点、リンク先、バックリンクを従来どおり収集する。
2. 関係するState NoteとEvent Noteを追加候補にする。
3. 現在有効なState Noteを優先する。
4. 置き換え済みや過去状態は、通常の現在文脈では優先度を下げる。
5. 再確認期限超過は除外せず、警告を付ける。
6. 各ノートに選定理由と時間判定を付ける。

### Build Context As Of A Date

1. `as_of`を指定する。
2. その日付で有効なState Noteを選ぶ。
3. その日付までに発生したEvent Noteを選ぶ。
4. 現在の知識で過去を書き換えず、当時有効だった状態を示す。
5. 該当する時間情報がない場合は「不明」とし、推測で補完しない。
6. 有効時点を持たない通常ノート本文は過去の根拠に採用せず、内容省略と対象Pathを警告する。

### Malformed Metadata

- 日付、型、Wikiリンクが不正でもファイルを変更しない
- 解析できた本文とWikiリンクは従来どおり利用する
- 右パネルとMCP出力へ短い警告を付ける
- 不正値を自動修正しない

## 9. Architecture Plan

```text
Markdown files
      |
      v
VaultService scan
      |
      +--> existing links / backlinks / search
      |
      v
frontmatter parser
      |
      v
temporal resolver
  - current / historical
  - review due
  - superseded
  - as-of selection
      |
      +--> right-side Temporal section
      |
      +--> Context Compiler / MCP
```

Markdown本文は`NoteDocument.content`のまま保持する。時間情報は走査時または利用時に作る派生データであり、別の原本を作らない。

想定する主な追加箇所:

- `src/core/frontmatter.ts`: frontmatterを本文から非破壊で読み取る
- `src/core/temporal.ts`: 時点判定、鮮度、置き換え、対象別タイムライン
- `src/shared/types.ts`: 派生メタデータと判定結果の型
- `src/core/context.ts`: 時点指定と選定理由
- `src/mcp/service.ts`: 時点指定をcoreへ渡す
- `src/mcp/server.ts`: 後方互換な任意引数
- `src/renderer/components/TemporalDetails.tsx`: 右パネルの読み取り表示
- `tests/frontmatter.test.ts`
- `tests/temporal.test.ts`
- `tests/context.test.ts`
- `tests/mcp-service.test.ts`

新しい依存関係を追加する場合は、frontmatterを安全に読むための小さなYAMLパーサー1件までとする。パーサーがMarkdown全体を再出力する使い方はしない。

## 10. MCP Plan

既存6ツールは互換性を保つ。初版では新しい書き込みツールを追加しない。

`build_context`へ後方互換な任意入力を追加する。

```text
as_of?: ISO 8601 date or date-time
include_history?: boolean
```

出力には、既存情報を残したまま次を追加する。

```text
as_of
temporal_status
selection_reason
warnings
```

必要性が実運用で確認された場合だけ、読み取り専用の`get_timeline`を次の小版で検討する。`record_state_change`のような複数ファイル書き込みツールは、読み取り版のdogfoodが終わるまで追加しない。

## 11. Milestones

### M0. Freeze The v0.2 Baseline

Work:

- v0.2 MCP連携の受け入れ状態を確認する
- 現在のMCPブランチを、Temporal機能と混ぜる前に確定する
- 現行fixtureとテスト結果を基準として残す

Gate:

- 型検査、自動試験、MCP smoke check、ビルドが成功する
- 作業ツリーに意図不明な変更がない
- v0.2とTemporal機能の差分が分離されている

### M1. Contract And Fixtures

Work:

- 本文書のfrontmatter契約をテストfixtureへ落とす
- current、historical、future、review due、superseded、不正値を用意する
- 同じsubjectについて複数時点のState NoteとEvent Noteを用意する

Gate:

- 実装前に、期待する現在状態と過去時点状態をfixtureで説明できる
- 必須フィールドと対象外がテスト名から読み取れる

### M2. Pure Temporal Core

Work:

- 非破壊frontmatter parser
- 時点判定
- 再確認期限判定
- `supersedes`解決
- subject単位のタイムライン構築
- 不正メタデータの警告

Gate:

- Electron、React、MCPなしの単体テストで全判定が成功する
- frontmatterなしの既存ノートの結果が変わらない
- 読み取り処理がMarkdownを変更しない

### M3. Time-Aware Context Compiler

Work:

- `buildContextBundle`へ任意の`asOf`を追加する
- 現在文脈と過去時点文脈を作り分ける
- 選定理由、時間状態、警告を出力する
- 質問一致をリンク件数上限の適用前に順位付けする
- valid-timeとknowledge-timeを分離する
- 競合、再確認期限、出典不明、不正メタデータを黙って確定しない
- ノート本文を信頼しない参照データとして境界付けする
- 文字数と1段リンクの上限を維持する

Gate:

- 現在と過去で異なる正しいState Noteが選ばれる
- 再確認期限超過が警告付きで残る
- 未来情報が過去時点へ漏れない
- 当時未観測の情報がknowledge-timeへ漏れない
- 同じ入力と明示時刻から同じBundleが生成される
- 警告が増えても文字数上限を超えない
- 既存の`build_context`呼び出し結果との後方互換性を保つ

### M4. MCP And Inspector

Work:

- MCPの`build_context`へ任意の`as_of`と`include_history`を追加する
- 右パネルへ時間情報の読み取り表示を追加する
- メタデータ不完全時の短い説明を追加する
- キーボードとスクリーンリーダー向けの名前を既存パネルに合わせる

Gate:

- Codexから現在文脈と過去時点文脈を取得できる
- TSUZUNE画面で同じ時間判定を確認できる
- 不正メタデータがあっても編集、保存、リンク、検索が動く

### M5. Starter Vault Dogfood

Result: PASS（2026-07-31）

Work:

- Starter Vaultへ少数の時間付きサンプルを追加する
- 少なくとも2プロジェクト、2回の状態変化、1件の訂正を扱う
- 同じ固定質問を次の3条件で比較する
  - 起点ノートだけ
  - 従来の1段リンクContext
  - M3の時間対応Context
- 次の質問をCodexから実行する

```text
現在動いているプロジェクトは何か。
2026-07-22時点では何が動いていたか。
再確認が必要な情報は何か。
この状態を採用した根拠は何か。
```

Gate:

- 3つのSuccess Conditionsを満たす
- 時間対応Contextが固定質問の正答数と根拠一致率で従来Context以上になる
- 過去時点への未来情報漏洩が0件
- 根拠がない質問では推測せず「不明」または再確認を返す
- 競合状態を一方だけ確定せず、警告と両方の根拠を示す
- 手作業の負担と誤判定を記録する
- 観測されていない便利機能を追加しない

このA/Bは「モデル一般が賢くなった」と証明するものではない。TSUZUNEが、同じモデルへより正確で時点整合的な根拠を渡せるかを検証する。

実測結果、比較回答、dogfoodで発見した過去Contextの本文漏えいと修正、手作業負担は`docs/m5-dogfood.md`を正本とする。

## 12. Verification Baseline

各Milestoneの完了時に、関連テストに加えて次を実行する。

```powershell
npm run typecheck
npm test
npm run check:mcp
npm run build
git diff --check
```

### Production Promotion Gate

製品コードを変更した検証済みMilestoneは、上記の開発検査だけでは完了としない。最後に次の単一コマンドを通し、このPCのインストール済み本番TSUZUNEとCodex MCPを、検証したworking treeへ揃える。

```powershell
npm run production:update
```

このゲートは、起動中の本番TSUZUNEを強制終了せず中止し、型検査、全回帰、MCP、NSIS生成、installer契約、隔離profileでのpackaged／installed起動を順に確認する。インストール後はpackage version、実行ファイル、`app.asar`をbuild成果物と照合し、`%APPDATA%\TSUZUNE`の全ファイルが更新前後で同一であることを確認する。自動smokeはactive Vaultを開かない。

dirty working treeは、現在検証した変更を即座にdogfoodできるよう許可する。ただし未解決merge、`git diff --check`違反、処理中のsource fingerprint変化は本番反映前に停止する。同一versionのローカル再インストールは`app.asar`の完全一致を正本とし、GitHub Releaseによる配信時だけSemVerを必ず上げる。結果は`docs/reports/production-update-latest.json`へ上書きし、秘密値は記録しない。

Google OAuth build値は明示的な環境変数を優先する。未指定時は、既にこのPCへインストールされた個人用production bundleの値をbuild子プロセスへだけ引き継ぐ。値を標準出力、repo、receiptへ保存せず、安全に一意抽出できない場合はbuild前に停止する。

追加で確認する不変条件:

- frontmatterなしの既存Vaultがそのまま開く
- Markdown本文のバイト内容を読み取り処理が変更しない
- malformed frontmatterで起動不能にならない
- 外部変更競合と改訂トークンの保護が維持される
- MCPからVault外へアクセスできない
- 文脈上限を超えて無制限に履歴を読み込まない

## 13. Risks And Controls

### Time Fields Become Busywork

Control:

- 全ノートへ必須化しない
- 最初は重要な状態変化だけに使う
- dogfoodで使われなかったフィールドは次版へ持ち越さない

### Freshness Is Mistaken For Truth

Control:

- `review_after`超過は警告だけにする
- 自動的に誤り、無効、削除とは判定しない

### Current Knowledge Rewrites The Past

Control:

- `as_of`判定を純粋関数とfixtureで固定する
- 当時のState Noteがなければ「不明」と返す

### State And Event Notes Diverge

Control:

- 初版は自動二重書き込みを作らない
- `source`と`subject`を表示し、人が追跡できる状態を優先する
- 自動記録はdogfood後に別計画で扱う

### History Floods The Context

Control:

- 現在文脈ではcurrentを優先する
- historyは明示指定時だけ増やす
- 既存の件数上限と文字数上限を維持する

### Temporal Work Pulls In A Database

Control:

- v0.3は既存のメモリ上走査で実装する
- 現行の500ノート、合計10MB基準で問題が観測されるまでSQLiteを追加しない

## 14. Explicit Non-Goals For Temporal Memory Lite (M0-M5)

次の項目はM0〜M5へ混ぜない。M5後に実際の必要性と独立した受け入れ条件がある場合だけ、別トラックで扱う。

- 主観時間のモデル化
- エントロピー生成や時間反転尤度の推定
- Neural CDEなどの学習型世界モデル
- 常時起動して毎秒状態を更新するサービス
- AIによる日時、状態、出典の無確認な自動抽出
- 古い記憶の自動削除
- ベクトル検索、GraphRAG、グラフDB
- グラフ表示
- クラウド同期
- プラグインAPI
- アカウント、共同編集、モバイル版
- 汎用データベースやNotion風プロパティ編集UI
- MCPからの削除、移動、名前変更、強制上書き

## 15. Historical Next Work（superseded）

この節はTemporal Memory Lite完了時点の判断履歴である。現行の実行順と停止条件は文書先頭の`Active Track: v0.6 Obsidian Graph Parity`を正とする。

M0〜M5は完了した。Temporal Memory Liteは3つのSuccess Conditionsを満たしたため、このトラックでは機能追加を停止した。

次の独立トラックとしてv0.4 Google Drive Manual Sync + Local Graphを選択し、実装、ローカル検証、Desktop OAuth設定の個人用ビルドへの組み込み、実Google認証、読み取り専用preview、初回送信40件のapplyまで完了した。残作業は次の順序に固定する。

1. 別端末相当の受信、競合コピー、削除非伝播、接続解除を手動確認する。
2. 複数端末から同期applyを同時実行せず、端末ごとにpreview/applyを完了してから次の端末で確認する。
3. Drive往復確認後にv0.4の停止条件を判定し、次の独立トラックとしてPersonal Google Read-only Intakeを開始する。
4. Calendar、Tasks、Drive選択取込、YouTube、Data Portabilityを同時実装せず、1本ずつ受け入れ条件を満たしてから次へ進む。

ChatGPTアーカイブもGoogle Takeoutも未提供のまま、非公開履歴を推測取得したり、ログイン、Cookie、画面スクレイピングで代替したりしない。

## 16. Decision Rules After Dogfood

- 時間情報の入力が負担なら、先にテンプレートまたは小さな入力補助を検討する。
- 過去時点の検索が役立たなければ、データモデルを拡張しない。
- 履歴が多すぎる場合は、DBより先に検索範囲と表示方法を見直す。
- 自動状態記録が必要になった場合は、書き込み整合性を別PLANで定義する。
- v0.4グラフは当時1-hopに留めた。その後v0.5 Graph Explorerを独立採用し、P0-2まで完了した。GraphRAGは引き続き対象外とする。
- v0.4同期は明示preview/applyに留め、バックグラウンド同期、削除伝播、Drive Changes APIはdogfood後に別判断する。
- プラグインAPIとSQLiteは、それぞれ独立した困りごとと受け入れ条件が確認された後に別々に計画する。

## 17. Completed Track Detail: v0.4 Google Sign-In, Manual Drive Sync, Local Graph

このトラックはM5完了後の独立トラックである。Google接続を使わないローカルMarkdown運用を標準のまま維持し、認証、同期、パーソナライズ用データ取り込みを混同しない。

### v0.4 Scope

1. 選択中のノートと直接つながるノートだけを示す1-hopグラフ
2. Google Desktop OAuthによる任意のアカウント接続
3. TSUZUNE管理下のMarkdownだけを対象にした、preview/apply式の手動Drive同期

ローカルMarkdownが唯一の原本である。同期ledgerとGoogle接続情報はアプリのuser dataへ置き、Vault本文へアプリ固有の同期メタデータを書き込まない。

### V4-1. Selected-Note 1-Hop Graph

Work:

- 現在選択しているノートを中心にする
- 直接のリンク先とバックリンクだけをノードにする
- ノード操作で既存のノートを開く
- 未保存の編集中Wikiリンクを表示へ反映する
- Markdownと既存Wikiリンクresolverから都度構築し、グラフDBや新しい永続索引を持たない

Gate:

- 選択ノート、リンク先、バックリンクの1段階だけを表示する
- 孤立ノートでも空状態として破綻しない
- マウスとキーボードの両方でノートを開ける
- ノートを開き直すと、そのノートを中心に再構築する
- Vault全体の力学グラフ、GraphRAG、編集可能なグラフへ拡張しない

### V4-2. Optional Google Desktop OAuth

Work:

- Google Cloudで作成したOAuthクライアントの種類をDesktop appに限定する
- 個人用ビルドにはDesktop OAuthクライアントIDとclient secretをビルド時だけ組み込み、通常UIから直接接続する
- 独自OAuth JSONは詳細設定から任意選択でき、保存済みJSONを組み込みIDより優先する
- client secretの実値はGitへ保存しない。ただしEXEへ組み込んだDesktop appのclient secretは抽出可能で、機密情報にはならないため、この方式を個人用ビルド限定とする
- tokenとアカウント情報は配布物へ組み込まない
- システムブラウザ、`127.0.0.1`のランダムloopback port、PKCE S256、state照合を使う
- scopeは`openid email profile https://www.googleapis.com/auth/drive.file`だけにする
- 名前、メールアドレスなどの基本プロフィールだけをアカウント表示に使う
- 更新トークンはElectron `safeStorage`を通してWindowsの暗号化機構へ保存し、アクセストークンは永続保存しない
- 接続解除でローカルの更新トークンを削除し、Drive上のファイルとローカルVaultは残す

Gate:

- Google未設定、未ログイン、オフライン、認証失敗でもローカル編集とMCPが動く
- OAuth callbackのstate不一致とprovider errorを拒否する
- OAuth JSON、token、認可codeをVault、Markdown、Git、通常ログへ書かない。main bundleへ含めるIDとclient secretの実値もGitへ保存しない
- `drive`、`drive.readonly`などの広いDrive scopeを要求しない
- Googleログインだけで検索履歴や広告プロファイルを取得したと表示しない

### Google Cloud Setup Contract

1. Google Cloudプロジェクトを作成または選択する。
2. Google Drive APIを有効にする。
3. OAuth同意画面を構成する。ExternalのTestingを使う場合は利用者自身をtest userへ追加する。
4. OAuth client IDを「Desktop app」として作成する。
5. クライアントIDを`MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID`、client secretを`MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET`へ設定して個人用ビルドを作る。値はビルド時だけ渡し、Gitへ保存しない。
6. TSUZUNEの「Google / 同期」から「Googleでログイン」を押し、システムブラウザでscopeを確認する。

独自のGoogle Cloudプロジェクトを使う場合だけ、詳細設定からDesktop OAuth JSONを選択する。このoverrideを保存した端末では組み込みIDへ暗黙フォールバックせず、異なるクライアントの更新トークンを混用しない。

Desktop appのclient secretは個人用EXEから抽出でき、真の秘密として扱えない。標準ログインは個人用ビルド限定とし、認可フローではシステムブラウザ、`127.0.0.1`のランダムloopback port、PKCE S256、state照合を維持する。

ExternalかつTestingのOAuth同意画面では、Googleの仕様によりrefresh tokenは原則7日で失効する。安定運用では公開要件を確認し、Publishing statusをIn productionへ移す。TSUZUNEは期限切れtokenを回避するためにCookie、ブラウザprofile、別scopeを流用しない。

公式仕様:

- https://developers.google.com/identity/protocols/oauth2/native-app
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://www.electronjs.org/docs/latest/api/safe-storage

### V4-3. Manual Drive Sync

Work:

- `drive.file`でTSUZUNEが作成・管理する専用VaultフォルダとMarkdownだけを扱う
- ローカルとDriveの内容ハッシュ、前回同期ハッシュ、Drive file IDを比較する
- 最初に送信・受信・競合・保持のpreviewを表示し、利用者がapplyした場合だけ変更する
- 片側だけに新規ノートがある場合は、存在する側から存在しない側へコピーする
- 前回同期済みノートが片側で欠落した場合は、削除を伝播せず、残っている側を保持する
- 両側で変更された場合は無言のlast-write-winsを行わず、Drive版をローカルの別ノートとして保存する
- 同期中もローカル原本を上書きする前に版を再確認し、stale previewを拒否する
- 各同期操作が成功するたびにledgerをチェックポイントし、後続操作の失敗後も成功済み状態を保持する
- 別端末ではDrive上の既存TSUZUNE Vaultを列挙し、空で未同期のローカルVaultへ明示ペアリングする
- Drive上のTSUZUNEファイルを削除するAPIは実装しない

Gate:

- 新規送信、新規受信、ローカル変更、Drive変更、両側変更、片側欠落、変更なしをfixtureで再現できる
- previewとapplyの間に内容が変わった場合、古いplanを適用しない
- 競合時にローカル原本、Drive原本、ローカル競合コピーの三者を失わない
- 通信中断または認証切れで既存Markdownを失わない
- 複数操作の途中失敗後に成功済みノートを編集しても、不要な両側競合として扱わない
- 同期済みローカルVaultを別のDrive Vaultへ付け替えない
- `.trash`、ドットフォルダ、シンボリックリンク、OAuth JSON、token、同期ledgerをアップロードしない
- Drive全体を走査せず、他アプリが作成したファイルを取得しない

### V4-4. Verification Boundary

自動テストでは次をモックまたはローカルfixtureで確認する。

- OAuth URL、PKCE、callback、token exchange、refresh
- 暗号化token store
- Drive APIのlist、folder作成、download、create、update
- 同期plannerと同期適用
- 1-hopグラフと操作UI
- v0.1〜v0.3、MCP、Temporal Memory Liteの回帰

実Google確認には発行済みのTSUZUNE用Desktop OAuthクライアントIDとclient secretを組み込んだ個人用ビルドが必要である。2026-07-31に実Google認証と基本プロフィール表示を完了し、`%APPDATA%\TSUZUNE\google\google-account.json`と暗号化された`refresh-token.json`の保存を確認した。Drive同期の読み取り専用previewは送信40件、受信0件、競合0件、保持0件で成功し、その後の初回applyも完了した。同期台帳には2026-07-31 14:42:24 JSTの完了時刻と40件の固有Drive file IDがあり、ローカル・Driveハッシュは40/40件で一致している。次の残項目を実アカウントで完了するまで「Google Drive同期の実運用確認済み」としない。

1. [x] Google認証と基本プロフィール表示
2. [x] 初回preview（読み取り専用）
3. [x] 初回applyとDrive専用フォルダ作成
4. [ ] ローカル変更の送信とDrive変更の受信
5. [ ] 両側変更時のローカル競合コピー
6. [ ] 片側欠落時の削除非伝播
7. [ ] アプリ再起動後のtoken refresh
8. [ ] 接続解除後のローカルVault継続利用
9. [ ] 別端末相当の空Vaultから既存Drive Vaultを選択し、ノートを受信
10. [ ] preview後にDrive側を変更し、古い版の更新を拒否して両内容を保持

### Personalization Data Boundary After v0.4

Googleログインで得る基本プロフィールは、本人の関心、好み、検索行動を増やす材料にはならない。パーソナライズ情報を増やす別トラックでは、利用者が個別に有効化したCalendar、Tasks、Drive選択取込、YouTube、Data Portabilityだけを対象にし、原本、抽出候補、本人確認済みノートを分離する。

- Google内部の完全な広告ターゲティングモデル、関心スコア、推定根拠、予測ロジックを取得できる一般公開APIはない
- Google検索履歴はOAuth基本プロフィールや`drive.file`では取得できない
- 検索履歴などのMy Activityを扱う場合は、通常のGoogle OAuth APIではなく、利用者が明示実行したData Portability exportだけを対象にする
- 検索1回を恒久的な好みとして確定しない
- 候補には根拠レコード、期間、件数、最終観測日を付け、本人確認後だけ通常ノートへ反映する
- My Ad CenterやMy Activityの画面スクレイピング、Cookie流用、Drive全体取得を代替手段にしない

Personal Google Read-only Intakeとパーソナライズ候補生成はv0.4へ含めず、Drive往復確認後の独立トラックとして扱う。

### Explicit Non-Goals For v0.4

- Googleアカウント必須化
- Google内部の広告プロファイル取得
- Google検索履歴、Gmail、Google Photos、位置履歴の取得
- `drive`または`drive.readonly`によるDrive全体取得
- Google Docsの自動取り込み
- バックグラウンド常駐同期、webhook、Drive Changes API
- 削除伝播、Driveファイル削除、無言のlast-write-wins
- Vault全体グラフ、GraphRAG、グラフDB
- プラグインAPI、SQLite、独自クラウド
- 複数人共有、モバイル同期
- ログイン情報からの自動プロフィール確定

## 18. Active Track Detail: Personal Google Read-only Intake

状態: G0ローカル実装・回帰確認完了。利用者指定によりTasks、Drive選択取込、YouTube、Data Portabilityを最優先化
対象: 個人利用、1 Googleアカウント、手動取込
開始: 2026-07-31の利用者指示によりG0を開始。同日の優先順位変更によりCalendar取込を保留し、Tasksから実データ取込を開始する

### Goal

Google上の本人データを無差別に同期せず、利用者が機能、対象、期間を明示選択した時だけ読み取り、TSUZUNEへ出典付きの情報源と候補ノートを追加する。Google上の原データを変更せず、候補を現在の好み、事実、決定として自動確定しない。

採用する機能と順序を次に固定する。

1. Google Tasks読取
2. Google Drive選択取込
3. YouTube読取
4. Google Data Portability
5. Google Calendar読取（保留）

G0の共通基盤を使い、G1〜G4を1本ずつ実装、検証、dogfoodする。次の機能のための抽象化を先回りして追加せず、現在の機能で確認できた共通処理だけを再利用する。Calendar用に作成済みの追加認可UIとテストは削除せず、Calendar API接続だけを保留する。

### Common Contract

- 全機能は任意、手動、読み取り専用とし、Google上の予定、タスク、ファイル、YouTubeデータを作成、変更、削除しない
- Data Portabilityのexport job作成だけは外部状態を作るため、対象データと期間を表示し、実行直前に明示確認する
- 起動時自動取込、バックグラウンド取得、定期ポーリング、webhookを初版へ入れない
- v0.4の初回ログインでは将来機能のscopeを先取りしない
- Desktop appではincremental authorizationが非対応のため、機能を有効化した時だけ既存scopeと必要最小scopeの和集合へ再同意を求め、実際に許可されたscopeを保存、表示する
- 未認可の機能を無言で呼び出さず、Google未接続、権限不足、オフラインでもローカル編集、検索、MCPを維持する
- previewまではVaultを変更しない
- applyはローカルの情報源と候補だけを追加し、既存ノートを無言で上書きしない
- Google側で削除されたデータをローカルへ削除伝播しない
- source kind、Google resource ID、元更新日時、import日時、内容hashを保持する
- 同じ項目またはarchiveを再取込しても重複作成しない
- 候補の承認、却下、訂正が保存済み原本を変更しない
- token、OAuth JSON、Data Portability archiveの機微な原本を通常ノートや通常ログへ書かない
- 個人利用であっても、Googleのscope制限、API利用条件、検証要件を迂回しない

### G0. Scope Expansion And Source Contract

Work:

- [x] 現在の基本＋Drive scopeとCalendar機能scopeを分離する
- [x] Desktop appの制約に合わせ、既存scope＋Calendar scopeの和集合へ再同意する
- [x] refresh token、実許可scope、account subを同じ暗号化credential bundleとして保存する
- [x] 旧版の生refresh tokenを基本＋Drive許可済みとして互換読込する
- [x] Drive同期とCalendar読取の許可状態を画面で区別する
- [x] Drive同期ledgerとは別に、Google情報源のprovenanceと再取込識別を純粋coreで定義する
- [ ] 実GoogleアカウントでCalendar再同意を行い、既存Drive同期が継続することを確認する
- [ ] G5でCalendar adapterのpreview/applyと情報源保存を接続する

Gate:

1. ローカルmockでは既存Drive credentialを保持したままCalendar再同意を要求でき、権限不足時にも旧credentialを保持する。実Google確認は未完了。
2. 認可済み機能と未認可機能を画面で区別できる。PASS。
3. 同じGoogle resource＋同じhashを再取込した時に`same_observation`となる共通fixtureがPASSする。

2026-07-31 verification:

```text
npm run typecheck    PASS
npm test             PASS: 24 files / 187 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
```

G0ではGoogle Calendar APIをまだ呼び出さず、同意UIと情報源の重複判定契約までに止めた。Data Portabilityは通常Google credentialへ混ぜず、G4で別OAuth flowと別保存領域を使う。

### G5. Google Calendar Read-only Intake（保留）

Scope:

- 最小scopeは`https://www.googleapis.com/auth/calendar.events.readonly`
- 利用者が対象カレンダーと有限の期間を選択する
- 繰返し予定はAPIが返したevent instanceを出典付きで扱い、初版で完全な繰返し編集モデルを作らない

Gate:

1. previewで対象カレンダー、期間、件数、日時、タイトルを確認できる。
2. apply後の情報源と候補から元calendar IDとevent IDへ戻れる。
3. 再取込で重複せず、変更された予定を新しい観測として区別し、Google Calendarへ書き込まない。

### G1. Google Tasks Read-only Intake

Scope:

- 最小scopeは`https://www.googleapis.com/auth/tasks.readonly`
- 利用者が対象task listを選択する
- タイトル、期限、完了状態、親子関係を候補化する
- 初回previewでは`showCompleted=true`、`showHidden=true`、`showDeleted=false`で、完了済みを含む現在のタスクを読む
- Tasks APIの`due`は時刻を持たない日付として正規化し、締切時刻を推測しない

Gate:

1. previewで対象list、件数、期限、完了状態を確認できる。
2. apply後も元task list IDとtask IDを保持する。
3. 再取込で重複せず、完了または期限変更を新しい観測として扱い、Google Tasksへ書き込まない。

### G2. Google Drive Selected-file Intake

Scope:

- Drive全体を走査せず、Google Pickerなどで利用者が明示選択したファイルだけを対象にする
- Desktop向けGoogle Pickerは通常接続のcredentialへ混ぜず、`drive.file`だけを要求する専用の一時OAuth flowにする
- Picker認可は`prompt=consent`と`trigger_onepick=true`を使い、callbackの`picked_file_ids`に含まれるファイルだけを対象にする
- `drive`や`drive.readonly`へ拡張せず、既存Drive同期credentialのscope unionにもPicker認可を混ぜない
- TSUZUNE同期Vaultと一般資料取込の保存領域、識別子、ledgerを分離する
- 初版の対応形式を固定し、Google Docs変換を暗黙追加しない

Gate:

1. previewで選択ファイルの名前、種類、サイズ、更新日時、対応可否を確認できる。
2. applyは対応ファイルだけをhash付き原本として保存し、既存ノートを上書きしない。
3. 未選択ファイルとDrive全体を取得せず、同じ版の再取込で重複しない。

### G3. YouTube Read-only Intake

Scope:

- 最小scopeは`https://www.googleapis.com/auth/youtube.readonly`
- 初版は購読チャンネルと、利用者が明示選択したプレイリストまたは項目に限定する
- 通常のYouTube Data APIで視聴履歴、検索履歴、広告嗜好を取得できると表示しない

Gate:

1. previewで出典種別、チャンネルまたは動画名、元ID、更新日時を確認できる。
2. apply後もsubscription、playlist、videoの元IDを保持し、再取込で重複しない。
3. 単発の購読や動画を恒久的嗜好へ自動確定せず、quota超過時も既存ノートを変更しない。

### G4. Google Data Portability

Scope:

- 通常のGoogle接続とは別の認可フローとし、Data Portability scopeをDrive、Calendar、Tasks、YouTubeのscopeと同じ認可要求へ混ぜない
- 初版は`dataportability.myactivity.youtube`の1種類だけに固定し、利用者が明示選択したexportだけを扱う
- Data Portability tokenからGoogleアカウント識別情報を取得できると仮定せず、通常接続の`accountSub`へ自動的に結び付けない
- 常時同期ではなく、明示実行されたスナップショットarchiveの取込として扱う
- My Activity画面スクレイピング、Cookie流用、内部広告プロファイル取得を代替手段にしない

Gate:

1. export job開始前に対象データ、期間、外部処理の発生を表示し、明示確認なしには開始しない。
2. 完了archiveをmanifest、hash、取得日時付きで保存し、原本と抽出候補を分離する。
3. 同じarchiveの再取込で重複せず、API未提供、地域制限、検証未完了時は既存Vaultを変更せず停止する。

Data Portabilityは個人利用でも専用OAuth、対象scope、利用可能地域、Googleの検証要件に従う。通常のGoogle接続だけで検索履歴やMy Activityを取得できるとは扱わない。実装開始時点で公式仕様を再確認し、要件を満たせない場合はCookieや画面操作で迂回しない。

公式仕様:

- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/tasks/auth
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker
- https://developers.google.com/youtube/v3/guides/auth/installed-apps
- https://developers.google.com/data-portability/user-guide/scopes
- https://developers.google.com/data-portability/user-guide/configure-oauth

### Explicit Non-Goals For The First Personal Google Intake Track

- Gmail、Google Photos、People/Contacts
- CalendarまたはTasksへの書き戻し
- Drive全体スキャンとGoogle Docsの無差別自動取込
- YouTube視聴履歴を通常のYouTube Data APIから取得すること
- Google内部の完全な広告プロファイル、関心スコア、予測モデルの取得
- 全scopeの初回一括同意
- バックグラウンド同期、定期取込、Google側削除の伝播
- 5機能の同時実装
- 公開配布、複数利用者、複数Googleアカウント対応

## 19. Future Track: ChatGPT Export Intake

このトラックはM5完了後に着手する。Google連携やChatGPTへのログインとは分離し、ユーザーが明示的に選択したChatGPTデータエクスポートだけをローカルで取り込む。

### Current Intake Status

2026-07-31時点では、ローカルにChatGPT公式データエクスポートのZIP、`conversations.json`、`chat.html`は見つかっていない。現在参照できた会話はStarter Vaultへ出典付きで選択保存したが、全アーカイブ取込とは扱わない。

次の開始条件は、ユーザーが公式エクスポートZIPまたは展開済みフォルダを提供することである。製品内の自動インポーターはM5完了後の別トラックだが、Codexによる一回限りの原本保持型整理はアーカイブ受領後に実行できる。

### Confirmed Availability Boundary

2026-07-31時点のOpenAI公式仕様を基準に、次を前提とする。

- 対象アカウントではChatGPTの設定またはPrivacy Portalからデータエクスポートを要求できる。
- ダウンロードZIPにはチャット履歴と関連アカウントデータが含まれる。
- エクスポートによっては`conversations.json`、番号付き会話JSON、会話で使用したファイルや資産が含まれる。
- TSUZUNEはエクスポートの要求、生成、メール受信、ダウンロードを代行しない。
- ユーザーがアーカイブを提供していない場合、TSUZUNEは非公開会話を取り込めない。
- ChatGPTへのGoogleログイン、OpenAI API key、ブラウザCookieから会話履歴を取得できるとは扱わない。
- 公式エクスポート形式は変更され得るため、実装時にfixtureと公式仕様を再確認する。

公式仕様:

- https://help.openai.com/en/articles/7260999
- https://help.openai.com/en/articles/20001279

### C0. Archive Contract And Source Preservation

Work:

- ユーザーが選択したZIPまたは展開済みエクスポートだけを対象にする
- `conversations.json`、番号付き会話JSON、参照される添付資産を検出する
- 会話ID、メッセージID、role、元時刻、添付参照を保持する
- 原本JSONと添付資産を変更せず、source manifestへハッシュ、import日時、対応状況を記録する
- 原本保存領域と派生候補ノートの保存領域を分ける
- 未対応ファイルは推測して解析せず、原本として保存して警告する
- 同じ会話とメッセージを再取り込みしても重複しない識別方法をfixtureで固定する

Suggested separation:

```text
ChatGPT export source
  - original conversation JSON
  - numbered conversation JSON
  - original attachments
  - import manifest and hashes

Derived TSUZUNE notes
  - conversation source notes
  - extraction candidates
  - user-approved notes
```

Gate:

- アーカイブ未選択時は取込不可を説明し、Vaultを変更しない
- 原本JSONと添付資産のバイト内容を変更しない
- 会話、メッセージ、添付、派生ノートの出典関係を追跡できる
- 同じアーカイブを再取り込みしても原本と候補を重複作成しない
- malformed JSONまたは欠落添付があっても既存ノートを変更しない
- 派生候補の却下や削除が原本と添付を変更しない

### C1. Provenance-Backed Candidate Notes

Work:

- 会話をそのまま現在プロフィールへ変換せず、出典付き候補ノートを作る
- user、assistant、tool、systemなどのroleを失わない
- ユーザー発言も引用、仮定、創作、過去情報を含み得るため、無確認で現在事実へ確定しない
- ChatGPT回答はモデル出力として保持し、本人確認済み事実または一次証拠として扱わない
- 各候補へ会話ID、メッセージID、role、元時刻、source manifestを付ける
- 複数会話から導出した候補には、使用した全出典を付ける
- 本人確認後だけ通常ノート、State Note、Event Noteへ反映する
- 初版の抽出はローカル処理と明示ルールに限定し、原本を外部AIへ自動送信しない

Gate:

- すべての候補から元の会話メッセージへ戻れる
- ChatGPT回答だけを根拠に本人の好み、事実、決定を確定しない
- user発言とassistant回答を混同しない
- 現在情報、過去情報、未確認候補を区別できる
- 候補の承認、却下、訂正が原本を変更しない
- 原本と出典がない候補をactiveな記憶へ昇格させない
- Google由来の候補とChatGPT候補を同じ出典種別として混同しない

### Explicit Non-Goals For The First ChatGPT Export Track

- ChatGPTアカウントへのログイン実装
- ChatGPTセッションCookieや画面スクレイピングによる取得
- OpenAI APIから過去のChatGPT会話を取得すること
- アーカイブ未提供時の会話復元
- ChatGPT Memoryのライブ取得または同期
- エクスポートをChatGPTのサイドバーへ再構築すること
- ChatGPT回答を本人確認済み事実として自動登録すること
- ユーザー発言をすべて現在も有効な事実として扱うこと
- 原本JSONや添付資産の再整形、上書き、削除
- 原本アーカイブの外部AIへの自動送信
- 初版で全アカウントデータ形式へ対応すること
- Google連携、Drive同期、ChatGPT取り込みを一つの認証機能へ統合すること
