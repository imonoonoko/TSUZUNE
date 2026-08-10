# TSUZUNE Product Plan

更新日: 2026-08-11（JST）

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
| 完了した直近slice | GP0-3b-o Attachment Folder Reveal。同じfixture fileの親フォルダ要求1回、menu close、Graph／Vault保持を実Explorer起動なしで固定比較し、添付menuへ最小実装した |
| 現役slice | GP0-3b-oとテンプレート／名前変更／Graph操作拡張を本番反映済み。GP0-3b-pは固定参照を試行したが受入packet未生成のためblocked。次のmenu操作はハーネス事前待機を直してから一度だけ再判定し、製品変更へ自動拡張しない |
| Context checkpoint | X1-M1 MOC Title RouterとX1-D1 Recall-safe Query Bridgeを本番反映済み。質問はbaseline候補を削除せず、通常本文の展開順だけを変える |
| 現役Primary Track数 | 1。Google intakeとChatGPT candidate applyは保留 |

### Current Transition Queue

1. **Completed — GP0-3b-o closeout:** `フォルダで表示`の製品テスト、隔離capture、比較report、未証明境界を固定し、commit `2ee914c`から本番反映済み。実Explorer起動とObsidian別process再起動は未証明のまま残す。
2. **Now — GP0-3b-p reference blocked:** `ファイルエクスプローラでファイルを表示`の初回観測は内部File Explorer遷移を示したが、訂正後の最終2試行は対象クリック前のcontext-menu待機で停止し、受入packetを生成していない。[Discussion log](.agent/requirements/20260811-0257-attachment-file-explorer-reveal/discussion_log.md)に境界を固定する。製品実装・比較report・本番反映は未開始。
3. **Next after the block — GP0-3b-p preflight:** 事前のGraph context-menu検出だけを安定化し、同じ隔離fixtureで一度だけfresh captureを行う。再び対象クリック前に失敗したら、製品変更なしでこのsliceをblockedとして閉じる。
4. **After Graph checkpoint:** アクセシビリティ、Personal Google Intake、AI write policyのどれを次の独立Trackにするか再選択する。

新しいSupporting Trackを割り込ませる場合は、目的、停止条件、元Trackへ戻る条件をこの節へ先に記録します。

**Completed bounded supporting slice — X1-D1:** `build_context`へ任意queryを渡し、query無しbaselineのcandidate集合を変えず、通常ノート本文の展開順だけを優先します。MOC全タイトル、Temporal、provenance、warningを保持したままcommit `e2d8621`から本番へ反映しました。X1-T1、embedding、要約、multi-seed APIへ拡張せず、Primary Queueへ戻しました。

分類Trackを次に選ぶ場合のGateは、匿名一時Vaultだけでapplyとrollbackを往復するO2-P3、またはDriveがPath Alias sidecarを扱う契約判断です。どちらを先にするかを決めるまでCurrent Transition Queueへ割り込ませず、本番Vaultへのapplyは許可しません。

### Completed GP0-3b-o — Attachment Folder Reveal

- 状態: `matched-core-behavior`。固定Obsidian captureは29/29、TSUZUNE隔離captureは23/23 assertionを通過した。両方とも実Explorerを起動せず、OS境界hookを復元した。
- 実装は添付nodeのmenuへ`フォルダで表示`を追加し、既存のtrusted IPC→Vault validation→`shell.showItemInFolder`経路を再利用した。新しい外部依存、DB、Explorer自動起動は追加していない。
- 中核一致は同じ`attachments/diagram.svg`の親フォルダ要求1回、menu close、Graph／Vault保持、同一process内Graph再表示での非再生。TSUZUNEは別process再起動でも0回を追加確認し、Obsidianの別process再起動は安全境界上未観測とした。
- 未証明: Windows Explorerの実起動・表示結果、物理入力、screen reader、High Contrast、multi-DPI、pixel identity。context menu全体はObsidian 11項目、TSUZUNE 9項目の残差である。
- 正本: [要件](.agent/requirements/20260811-0006-attachment-folder-reveal/4_requirements.md)、[比較report](docs/reports/graph-gp0-attachment-folder-reveal-2026-08-11.html)、[machine-readable comparison](docs/reports/assets/graph-gp0-attachment-folder-reveal/comparison.json)

## Completed Supporting Slice: X1-M1 MOC Title Router

利用者がMOCを「ノートタイトルを羅列した地図」と定義したため、valid frontmatterが`type: moc`のノートだけを軽量な二段階routerとして扱います。`build_context`はMOC本文の説明やリンク先・バックリンク本文を展開せず、解決済みWiki linkを記述順のタイトル一覧へ投影します。原本Markdownと`fetch`結果は変更しません。

インストール済み本番をread-onlyで使った固定比較では、`00_入口/知識地図.md`の15,000文字Contextが1,130文字になり、includedは9件からMOC 1件、omittedは21件から0件になりました。削減は13,870文字、92.47%です。これはContext Markdown文字数の比較であり、model-visible token削減は未計測です。

時間指定時の本文省略、Path Alias、未解決link、source fence、通常ノートのquery無し経路を維持します。MOCから選んだノート本文は、次の`fetch`または`build_context`で初めて読みます。query bridgeと本文budget priorityはX1-D1として本番反映し、MCP structured-only transportは独立したX1-T1へ残します。

## Revised Design Checkpoint: X1-D0 Recall-safe Progressive Context

第一段階ではMOCの全タイトルを記述順で返し、第二段階で選択したノート本文だけを`fetch`または`build_context`します。queryは通常候補本文の展開優先順にだけ使い、score 0を理由に候補やMOCタイトルを削除しません。query無しbaselineのcandidate集合を保ち、文字予算で本文を見送った候補も`omitted_ids`から追加取得できる設計を[requirements package](.agent/requirements/20260810-0440-query-aware-compact-context/4_requirements.md)へ固定しました。

回答に十分な根拠がなければMOCまたは`omitted_ids`へ戻って追加取得し、最初のtop-kだけで「情報がない」と結論しません。MCP二重搬送はsource recallと独立したX1-T1とし、実Codex／ChatGPT Desktop gateを通る場合だけ`build_context`をstructured-onlyへ狭く変更します。wire削減をmodel-visible token削減とは呼びません。

外部の永続code graphであるIxは設計比較だけを行い、X1-D0へ導入しません。code再読込の損失が別の固定課題で測定された場合だけ隔離比較します。判断根拠と変動する外部状態は[Alternatives](.agent/requirements/20260810-0440-query-aware-compact-context/2_alternatives.md)へ分離しました。

X1-D0自体は設計だけで停止しました。その後の明示認可により、R1〜R3を独立したX1-D1 supporting sliceとして実装し、MOC全タイトル順、query有無のcandidate到達性、Temporal／provenance／warning、最大500文字query、2k／4k／6k／8k／15k budget sweepを検証して本番反映しました。固定4問の回答品質、model-visible token、X1-T1 transportは未証明のまま分離し、Primary Queueへ復帰しました。

## Completed Supporting Track: O2-P2 Classification Migration Dry-run

分類候補を物理移動する前に、[明示plan](docs/migrations/o2-p2-operations-plan.json)とread-only CLIで本番Vaultの現在値を検証しました。CLIは移行を実行せず、Vault外へ監査manifestを出力します。詳細は[O2-P2 report](docs/reports/o2-p2-classification-migration-dry-run-2026-08-10.md)を正本とします。

### Result

- 5ノート、合計11,027 bytesの候補を検査した。
- Wiki参照は39件。内訳はactive 24、source 4、history 11で、28ファイルに分布した。MCP backlinkも39件で一致した。
- 移行前後を投影したWiki、Graph、Contextは同値で、旧path専用Graph nodeは生成されなかった。
- 本番Vault全301 files／9,727,936 bytesのfingerprintは2回とも`C97351EF6D99F628AA099374961217008153E6E136351C418C92D76BB3FBF875`で不変だった。
- 2回のmanifest SHA-256は`789384A9845CB9CBCAC49AF97F5EDEC6E4FE89A5F9891C1FEB309AF563540992`で一致した。Vault write、物理move、Markdown write、Drive操作はすべて0件だった。
- `.tsuzune/path-aliases.json`は本番Vaultに存在しない。`applyAllowed`は`false`を維持した。

### Remaining blockers

- `DRIVE_PATH_ALIAS_UNSUPPORTED`
- `REFERENCE_REWRITE_NOT_APPLIED`
- `ROLLBACK_PREIMAGES_NOT_CAPTURED`

過去のPhase2監査に記録された38参照は当時の履歴として改変せず、2026-08-10のlive dry-runで得た39参照を現在の移行入力として優先します。

## Completed Supporting Track: O2-P1 Path Alias Foundation

分類を人間に見やすく細分化するには物理pathの整理が必要ですが、現行のmove／renameはMarkdown本文、履歴、外部MCP IDを自動更新しません。そこで旧pathをMarkdownダミーとして残さず、sidecarだけでcanonicalな新pathへ解決する最小基盤を先に作ります。

### Acceptance

- [x] Vault相対の`old.md -> new.md`をcase-insensitiveに検索し、canonicalな新path表記を返す。
- [x] unsafe path、非Markdown、自己参照、case-insensitive重複、循環、曖昧な連鎖をfail-closedで拒否する。
- [x] `#heading`、`#^block`、`|表示名`を壊さず、Wiki link、backlink、Graphで旧pathが新nodeへ解決される。
- [x] MCPのfetch／update／backlinks／contextは旧IDを受けても新IDを返し、searchは新IDだけを返す。古いrevisionでの更新拒否は維持する。
- [x] bookmarkと最後に開いたノートは旧pathから新pathへ復元でき、sidecarや本文を無言で書き換えない。
- [x] 匿名fixture、targeted tests、全回帰486件、typecheck、build、MCP検査をPASSする。
- [x] このsliceでは本番Vaultの物理移動、履歴書換え、redirect Markdown、DB、新依存を追加しない。

実装契約と復旧方法は[Path Alias](docs/path-aliases.md)を正本とします。Drive同期はsidecarをまだ扱わないため、O2-P2はdry-runだけで完了し、分類目的の物理移動とDrive applyは実行していません。

### Stop Condition

同じ旧pathがUI、Graph、MCPで一意に同じ新pathへ解決され、循環・衝突fixtureがfail-closedになったら止めます。分類移動は別sliceのmanifest、rollback、Drive previewを通してから実行します。

## Active Track: v0.6 Obsidian Graph Parity

O2-P1／O2-P2の安全な分類基盤を閉じ、GP0-3b-oまで完了しました。次はGP0-3b-pの対象を選び、固定参照と安全境界の設計から開始します。

### Completed GP0-3b-l — Attachment Path Copy

`パスをコピー`の3形式は、親menu位置、submenu文言・順序・有効状態、copy値、1回のplain-text write、menu close、共通検証範囲であるGraph検索条件・node集合・Vault内容の再表示／別プロセス再起動までの保持を固定比較し、`matched-core-behavior`と判定しました。Obsidian URLとVault相対pathは完全一致し、system pathは各隔離Vault rootから同じ相対suffixです。

固定参照は右端から左、TSUZUNE captureは中央から右へsubmenuを開いたため、同一geometryは主張しません。TSUZUNEの右端左開きはrenderer回帰testにあり、実画面captureでは未証明です。両captureともOS clipboardへの実writeをinterceptしており、別applicationへのpaste roundtripも未証明です。

- [比較report](docs/reports/graph-gp0-attachment-path-copy-2026-08-09.html)
- [機械可読comparison](docs/reports/assets/graph-gp0-attachment-path-copy/comparison.json)

### Completed GP0-3b-m — Attachment Linked Views

#### Question

Obsidian 1.13.4でattachment nodeの`リンクされたビューを開く`を開いたとき、どのsubmenuがどの順序と有効状態で現れるか。固定参照版で確認した先頭の有効操作を1件だけ実行した結果を、TSUZUNEは同じ公開挙動として持つか。

#### Fixed Input

- 既存のGP0固定fixtureと`attachments/diagram.svg`を使う。
- ObsidianとTSUZUNEで同じGraph filter、viewport、DPR、themeを使う。
- 参照版と製品版は隔離Vault、隔離userData、別process再起動で採取する。

#### Acceptance

- [x] Obsidian 1.13.4から親menuの位置、有効状態、hover／click後のsubmenu文言・順序・有効状態を採取する。
- [x] 固定参照版で実在を確認した先頭の有効な子操作を1件だけ選び、開くview、workspace状態、menu closeを記録する。
- [x] Global Graph tab、query、camera、表示nodeと対象viewが、Graph再表示／別プロセス再起動でどう扱われるか記録する。
- [x] Markdown、添付、内部設定を含むVault digestが意図しない変化をしないことを確認する。
- [x] 差がある場合だけ既存のworkspace tabとcontext menuを再利用して最小修正する。
- [x] 差を検出できるtargeted testを追加し、全回帰、typecheck、MCP検査を通す。
- [x] 参照版とTSUZUNEのraw observation、画像、comparison JSON、HTML reportを同じsliceへ保存する。

#### Stop Condition

対象の親submenu契約と、参照版から選んだ子操作1件を`matched`、`matched-core-behavior`、`different`のいずれかで根拠付き判定し、未証明境界を明記したら止めます。2件目の子操作、次の親menu操作、Plugin APIへ同時に進みません。

#### Result

両製品のsubmenuは唯一の有効操作`バックリンクを開く`で一致しました。TSUZUNEは対象添付pathと参照元を表示するworkspace tabを追加し、元のGlobal Graph tabを保持します。起動中の操作と、Graph再表示／別プロセス再起動後のGraph構造保持を`matched-core-behavior`と判定します。linked-view自体はTSUZUNEで再起動後に復元せず、Obsidianは`バックリンク`tab shellを保持するものの対象添付へのbindingは未証明です。分割pane、workspace装飾、バックリンク本文の視覚一致、物理入力、実OSアクセシビリティは未証明です。添付context menu全体はObsidian 11項目、TSUZUNE 7項目の残差があります。

- [比較report](docs/reports/graph-gp0-attachment-linked-view-2026-08-10.html)
- [機械可読comparison](docs/reports/assets/graph-gp0-attachment-linked-view/comparison.json)

### Completed GP0-3b-n — Attachment Default App

#### Question

Obsidian 1.13.4でattachment nodeの`デフォルトアプリで開く`を実行したとき、menu lifecycle、外部起動要求、Graph workspace、Vault内容はどう変化するか。TSUZUNEの既存attachment previewからの外部起動契約と同じ公開挙動にできるか。

#### Acceptance

- [x] [要件、UI、安全境界、実装brief](.agent/requirements/20260810-1941-attachment-default-app/4_requirements.md)を固定し、実装前に設計checkpointで停止した。
- [x] 固定fixtureと隔離profileで、Obsidianの11項目menu、対象itemの有効状態、`window.open(file URL, "_external")`要求、menu closeを採取する。
- [x] action直前にfail-closed hookを検証し、実外部アプリを起動せず、対象pathと呼出回数1だけを比較して必ず復元する。
- [x] Global Graph tab／leaf、query、camera、node／edge集合、Vault content digestの前後と同一process内のGraph再表示での不変・request非再生を確認する。固定Obsidianの別processは起動せず、再起動時の非再生は未観測と明記する。
- [x] 固定参照が設計と一致する場合だけ、実在attachmentのmenuから既存`onOpen`／`openVaultFile`経路を再利用して最小修正する。新IPC、preload API、serviceは追加しない。
- [x] 既存backendのunsupported／directory guardを再確認し、external-open failureのApp回帰、targeted test、typecheck、comparison JSON、HTML reportを通す。
- [x] 全508 tests、typecheck、MCP検査を通す。
- [x] `git diff --check`を通す。
- [x] feature commit `49ac0f3`をpushし、clean sourceから本番更新して`installed-and-verified`、10/10 checks、built／installed hash一致、production profile不変を確認する。

#### Stop Condition

対象操作一件を根拠付きで判定したら止めます。hookを確認できなければclickせず、実OSの既定アプリを可視起動せず、次の`フォルダで表示`へ同時に進みません。

#### Result

Obsidianは`window.open(file URL, "_external")`、TSUZUNEは既存trusted IPCとVault validationの後に`electron.shell.openPath(absolute filesystem path)`を使います。API表現は異なりますが、同じ`attachments/diagram.svg`を1回だけ要求し、menu close、Graph／Vault保持、同一process内のGraph再表示でのrequest非再生を満たしたため`matched-core-behavior`と判定しました。固定Obsidian raw observationのquery、camera、node ID集合、edge signature、Graph tab／leafはbuilderが直接gateしています。

実OS既定appの選択・起動、chooser／cancelは未証明です。Obsidianは安全境界により別processを起動せず、再起動時の非再生も未観測です。TSUZUNEの別process再起動0回は追加証拠であり、共通parity判定には使いません。物理入力、screen reader、High Contrast、multi-DPI、pixel identityも未証明です。添付context menu全体はObsidian 11項目、TSUZUNE 8項目の残差があります。

- [比較report](docs/reports/graph-gp0-attachment-default-app-2026-08-10.html)
- [機械可読comparison](docs/reports/assets/graph-gp0-attachment-default-app/comparison.json)

### Remaining Graph Work

| Area | 現在 | 完了条件 |
|---|---|---|
| Context menu | 新規tab、新規window、file move、bookmark、path copy、linked view、default app、`フォルダで表示`まで比較済み | GP0-3b-pとして次の操作、残るsubmenu、note/tag/attachment別挙動を一項目ずつ固定比較 |
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
| O0. Graph Parity | Local/Global Graph、filter、group、display、force、interaction、保存、アクセシビリティを徹底比較 | **Active**。GP0-3b-o完了、次はGP0-3b-pの設計 |
| O1. Daily Writing & Navigation | Markdownを知らなくても作成・編集・日次運用できる | Daily/Ideaフォーム、toolbar、template、freshnessは実装済み。7日通常運用と残るnavigationは未完 |
| O2. Organization & Retrieval | folders、tags、properties、outline、bookmarks、search、commandsを日常利用できる | O2-P1／O2-P2完了。物理applyは禁止を維持し、次Gateは匿名一時VaultのO2-P3またはDrive sidecar契約判断 |
| O3. Structured Views | Markdown/frontmatter原本のtable/card/list view | Planned。実用queryと編集契約を固定してから開始 |
| O4. Canvas & Rich Media | freeform canvas、embed、PDF/audio/video、properties view | Planned。O2/O3の保存契約後 |
| O5. Recovery, Sync, Import & Publish | recovery、version history、import/export、optional sync/publish | `.trash`、AI history、Drive手動同期、ChatGPT preview基礎あり。往復dogfoodとrecovery UIは未完 |
| O6. Customization & Plugin Platform | theme、hotkeys、commands、safe plugin API | Planned。実利用で安定したcore surfaceだけ公開 |
| O7. Parity Closure | 対象機能の差分表、回帰fixture、移行ガイドを閉じる | Planned。O0〜O6の未一致を明示的に判定 |

O0〜O7はGraphだけの計画ではありません。Obsidian 1.13.4の公式機能群を、固定比較済みのP2以上または根拠付きのTSUZUNE代替として閉じます。Web ClipperはO5、URI・CLI連携とhotkey/command拡張はO6、Mobileは同期・端末制約を含めてO5〜O7で扱い、無言で対象外へ落としません。

### O1 Follow-up — Human Note Capture

実装済み:

- `今日のノート`／`アイデアメモ`は専用ボタンを廃止し、テンプレート選択へ集約。Dailyは`02_デイリー/YYYY-MM-DD.md`へ同日一件、Ideaは`01_受信箱/アイデア`へ安全な連番名で作る。
- 通常ノートは同名衝突を避けて即作成し、作成フォームを挟まず通常編集画面で開く。
- editorで見出し、太字、list、checkの最小書式ボタンとVaultノート選択によるWiki link挿入。
- Daily／Ideaはparse→renderが元Markdownと一致するときだけフォームへ戻すround-trip guard。
- 新規作成前に既存編集を保存し、作成失敗時は開いているノートと画面内エラーを保持。
- 内蔵4テンプレート、`90_テンプレート`のcustom template読込、`テンプレートを追加`による編集可能な雛形作成。
- filesystem更新日時と`review_after`による非破壊の鮮度表示。

未完:

- [ ] 7日間、既存Vaultを通常運用し、Daily/Idea/通常ノート作成の摩擦を記録する。
- [ ] 7日で作成したノートが検索、Wiki link、backlink、Graph、MCPへ自然に接続されることを確認する。
- [ ] 画面幅720px未満、Windows 200%拡大、keyboard-onlyで主要captureを受入する。
- [ ] 自動分類・link提案は、実ノートの未接続率と誤提案率を測ってから独立sliceとして決める。

### Intelligence Stages

| Stage | 目的 | 導入Gate |
|---|---|---|
| X1. Context Compiler 2.0 | X1-M1でMOCを全タイトル索引化。X1-D1で候補を消さず本文だけ段階取得するquery bridgeを本番反映。X1-T1 transportは未着手 | expected-source reachability 100%、silent omission 0、固定質問で出典・時間整合性を維持 |
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
| Graph GP0-a〜n | settings、search/camera/drag、tabs、attachment open/move/bookmark/path copy/linked view/default appの固定比較 | [Parity Reference](docs/obsidian-graph-parity-reference.md) |
| Classification O2-P1／P2 | Path Alias読取基盤と、物理移動なしの本番Vault migration dry-run | [Path Alias](docs/path-aliases.md)、[O2-P2 report](docs/reports/o2-p2-classification-migration-dry-run-2026-08-10.md) |
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
