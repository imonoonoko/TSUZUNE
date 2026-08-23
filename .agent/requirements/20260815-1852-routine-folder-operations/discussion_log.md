# Discussion log

## 2026-08-15 — initial design

### User intent

- TSUZUNEを常用する際、新しいフォルダが必要になった時や、既存情報を整理したい時など、多様な場面でフォルダを自然に扱えるようにする。
- 設定項目を増やすこと自体ではなく、日常利用で迷わず安全に使えることを優先する。

### Current evidence

- アプリUIは既に、フォルダ作成、項目の名前変更、ノート・添付・フォルダの移動、ゴミ箱への移動を持つ。
- MCPは`create_directory`を持つ。direct serverには単一Markdownノート向け`move_note`とpreflightがあるが、Codex向け公開面には現時点で移動ツールがない。
- `VaultService.moveEntry`はフォルダを配下ごと移動でき、Vault外、内部管理領域、symlink、自分自身の配下への移動を拒否する。
- アプリのDrive移動台帳は、移動結果の旧pathが`.md`である時だけ記録される。そのためフォルダ移動・改名では配下Markdownの移動が台帳へ記録されず、同一Drive file IDを保つ契約が成立していない。
- 通常のアプリ内移動はリンク影響を事前表示するが、リンク本文の自動書換えは行わない。
- `40_情報源`へのAI移動許可は別要件として固定済みだが、O1 dogfood終了（2026-08-21）後まで製品変更を行わない境界がある。`50_履歴`は全AI操作で保護を維持する。

### Decisions

- フォルダを権限設定の中心にしない。任意の「AI不変フォルダ」設定は復活させず、操作種別と固定システム領域で安全性を決める。
- 専用の「フォルダ管理画面」や自動分類器は作らない。既存ファイルツリーと単一項目操作を常用の中心にする。
- 実装順は、既存フォルダ移動の安全化、構造の読取り、単一項目の作成・移動・改名、回復性の順とする。
- `rename_directory`のような重複ツールは作らず、改名は同一親内への`move_entry`として扱う。
- AIによるフォルダ移動は、配下全件のpreflight、変更検知、Drive移動台帳、監査が同じ経路で成立するまで公開しない。
- まとめて自動整理する`organize_vault`、ルールエンジン、バックグラウンド自動移動は反復利用で必要性が観測されるまで作らない。

### Open validation items

- フォルダ移動時、配下ノートのDrive台帳を一括・原子的に記録し、失敗時に中途半端な台帳を残さない最小実装を確認する。
- ゴミ箱からのアプリ内復元経路がない現状を、常用上どの段階で補うか実装前に再確認する。
- `40_情報源`宛移動は既存の2026-08-21以降ゲートと統合し、この設計だけで前倒ししない。


## 2026-08-15 — 批判的レビュー反映（実コード確認）

設計ノート（`30_知識/TSUZUNE-常用フォルダ操作設計-2026-08-15.md`）と本要件資料へ、実コード確認に基づく穴の反映を行った。設計ノート側はヴォルトMCPでrevision付き更新済み。

### 反映した穴と決定

- **親暗黙作成の挙動変更**: 現行MCP `move_note`は`ensureDirectory`で移動先の親フォルダを暗黙作成する（`src/mcp/service.ts`）。「destination parent既存必須」はこの挙動からの**変更**であり、`move_entry`統合時に廃止する（R3、3_scope Release boundary）。
- **暗黙連番の主体差**: 現行UI `moveEntry`は`findAvailableMoveDestination`で衝突を自動採番する（`src/main/vault.ts`、GP0-3b-jでObsidian互換として検証済み）。暗黙連番禁止は**AI面（`move_entry`）だけの契約**とし、UIの自動採番は維持する。操作主体で挙動を分け、R7の主体差明示に沿う（P1、R3）。
- **人間UIの移動可否**: 保護（`isAiImmutablePath`）はMCP層`assertAiWritable`のみ。人間のアプリUIは`50_履歴`/`40_情報源`を移動できる現状を維持し、AI操作との差として明示する（R7、3_scope Release boundary）。
- **trash→復元のDrive契約**: `.trash`への移動は`pendingMoves`に載らないため、復元でDrive file ID断絶になり得る。復元は移動と同じ台帳経路（一括設定＋1回の`writeLedger`）に載せ、Drive契約をP0のスコープ決定時に確定する（P2、R8）。
- **台帳原子記録**: 配下全件の旧path→新pathを`pendingMoves`へ一括設定して**1回の`writeLedger`**で原子記録する（N回呼びの部分記録はしない）。台帳保存失敗時はファイル移動を成立させずtreeと台帳を操作前状態へ戻す（P0、R5）。
- **tree fingerprint定義**: path集合＋サイズ＋mtimeとし全内容hashは取らない。既存`rootRevision`と併用し、単一ノートはrevisionを変更検知に使う（P0、R4）。
- **`move_note`統合**: 既存`move_note`（1ツール＋preflight_only）は`preflight_move_entry`/`move_entry`へ統合して廃止する。tool surface（freebuff 11 tools等）と`scripts/check-mcp.mjs`の期待値を更新する（P1、Tool surface）。
- **公開順序**: `move_entry`は単一ノート・添付から公開し、フォルダはP0成立後に公開する（P1、R3）。
- **検証経路**: acceptance 2〜7は`move_entry`（新契約）経路で検証し、UI経路の自動採番・Obsidian互換は回帰テストとして別に維持する（Acceptance criteria）。

### Open validation items（更新）

- フォルダ移動時、配下ノートのDrive台帳を一括・原子的に記録し、失敗時に中途半端な台帳を残さない最小実装を確認する（`pendingMoves`一括設定＋1回の`writeLedger`のfailpoint）。
- ゴミ箱からのアプリ内復元経路がない現状を、常用上どの段階で補うか実装前に再確認する（復元のDrive契約はP0のスコープ決定時に確定）。
- `40_情報源`宛移動は既存の2026-08-21以降ゲートと統合し、この設計だけで前倒ししない。


## 2026-08-15 — 常用前提の具体化と再レビュー

### Newly confirmed code facts

- アプリIPCの通常操作queueとGoogle操作queueは分離しており、現行`recordMovedMarkdown`は通常queue内からDrive台帳を直接更新する。このままではDrive preview/applyとの同時実行を防げない。
- MCP `move_note`はVaultを直接変更する一方、Drive同期は起動中アプリの認証付きloopback bridgeを使う。移動だけ直接実行を残すと入口別の一貫性が崩れる。
- `rootRevision`はVault切替時のrevisionであり、tree内容revisionではない。
- `50_履歴`保護はpath-based MCP判定であり、人間UIで外へ移すとAI保護を迂回できる。

### Decisions changed

- 人間UIが`50_履歴`を移動できる現状維持案を撤回し、アプリUIでも移動・改名・trashを禁止する。`40_情報源`の人間による再分類は維持する。
- MCPのmove applyは直接Vaultを変更せず、起動中TSUZUNE本体の共通coordinatorへ委譲する。アプリ不在時のfallbackは設けない。
- 例外rollbackだけでは電源断を覆えないため、一件だけのoperation journalを採用する。汎用DBやtransaction frameworkは作らない。
- fingerprintはMarkdownのcontent revision、添付のpath/size/mtime、directory path、destinationと方針versionから作る。`rootRevision`を内容検知に使わない。
- AI添付単体移動とtrash復元を初期releaseから外した。folder treeの子として添付を運ぶことだけM2に含める。
- folder mapping全件をtool responseや監査へ複製せず、root mapping、件数、fingerprint、限定例で表現する。

### Residual risks accepted

- Explorer等の外部操作はTSUZUNEの保護とjournalを通らない。persistent IDやfilesystem filterは個人用local softwareには過剰なため、保証外として明記する。
- 添付は全内容hashを取らないため、同じsizeかつmtime復元を伴うbyte変更はfingerprintで検知できない。moveが添付本文を変更しない前提で受容し、実測後に再評価する。
- 複数ファイルをまたぐ真のatomic commitはWindows filesystemとJSON/Markdownだけでは作れない。operation journal、直列化、決定不能時fail closedで現実的に補う。

### Final hole fixes

- `list_directory`の200件上限だけでは同一folderの残りを取得できないため、保存状態を持たない`after`/`next_after`ページングを追加した。
- Drive未連携Vaultはlocal move時の台帳処理をskipする。Drive連携済みledgerが読めない時だけfile ID保護のためfail closedとする。ネットワークとGoogle再認証はlocal moveの前提にしない。
- app queue外のdirect MCP更新がfresh preflight直後へ割り込む可能性に対し、filesystem rename直後・Drive台帳更新前にdestination treeを再検証し、不一致ならrenameを戻す。

## 2026-08-15 — Freebuffレビュー採用と文書間契約の修正

### Review input

- Freebuffの再レビューで、旧`move_note`前提の`40_情報源`ゲート、Drive未追跡ノート、queue順序、journal durability、crash test、pagination同時変更の説明不足が指摘された。

### Adopted corrections

- `40_情報源`ゲートを`move_entry`へ移し、destinationだけでなくsource側も評価する。領域内から領域外へのAI持出しは禁止する。
- Drive追跡済みは同一file IDのmove、未追跡は新pathの`upload/new_local`とし、台帳に根拠のない旧remoteとの同一性を推測しない。
- queueは既存`drive:pairVault`と同じ通常queue→Google queue順を再利用し、逆順待ちを作らないことをtestで固定する。新しいqueue abstractionは作らない。
- journalは一時ファイルをwrite後に`FileHandle.sync()`してrenameする。process crashを必須回復対象とし、電源断はbest effort、判断不能時はfail closedとする。
- crash testはstage hookで終了するNode child processとparent recoveryで行い、単なるPromise rejectionやElectron本体killで代用しない。
- `list_directory`のstateless paginationは同時変更時に重複・取漏れがあり得ること、厳密な棚卸しは先頭から再取得することを明記する。

### Additional holes found during reconciliation

- 現行`move_note`はsource/destination双方へAI書込み保護を適用するため、`40_情報源`の物理整理には「destinationを許可」だけでなく「sourceが40ならdestinationも40の場合だけ許可」という専用move規則が必要である。
- 旧ゲート資料の将来案だった任意のフォルダ別AI権限UIは、常用設計の固定システム領域＋操作別保護と矛盾するため撤回する。
- 現行Path Alias readerがあっても通常の`move_note`/`move_entry`はmappingを自動生成しない。`40_情報源`物理整理は、明示的な旧→新alias packet、適用経路、read-back、rollbackが検証されるまでblockedとする。alias機能を通常moveへ混ぜない。

## 2026-08-15 — AIへ「全部いい感じに整理して」と任せる目標

### User intent

- 利用者は、AIへVault全体の整理を自然言語で依頼し、常用できる状態を最終目標として明示した。
- Codex Desktop再起動後、新MCP面の`list_directory`、`preflight_move_entry`、`move_entry`が利用可能であることと、production Vault rootをread-only取得できることを確認した。

### Decision

- 最初から専用`organize_vault`、分類モデル、rule engine、常駐自動移動は作らない。
- M3の第一段階は、既存toolをAIが合成して「全体調査→変更なし整理案→人間の一括承認→一件ずつfresh preflight／apply→進捗記録」を行う。
- 全Vaultを一つのatomic transactionにせず、一件単位のM1 journalを再利用する。途中失敗時は後続を止め、完了済みを維持して再開可能にする。
- 無承認のバックグラウンド自動整理は、承認付き運用で誤分類率と戻し需要が観測されるまで行わない。
