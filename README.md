# TSUZUNE

**書いて、つないで、あとで尋ねる。**

TSUZUNEは、普通のMarkdownファイルを原本にするWindows向けの個人用知識ワークスペースです。人はMarkdown記法を覚えなくてもメモを残せ、CodexやChatGPTは出典とrevision境界を保ちながら必要な知識を読み書きできます。

| ノートを自然に書く | 知識をGraphでたどる |
|---|---|
| ![TSUZUNEのノート編集画面](docs/reports/assets/optimization-2026-08-03/01-editor-shell.png) | ![TSUZUNEのGlobal Graph](docs/reports/assets/graph-gp0-attachment-bookmark/create/tsuzune-working-tree/00-baseline.png) |

## TSUZUNEでできること

- **自然に書く** — 通常ノートをすぐ編集画面で開き、Daily／Ideaを含む自由に増やせるテンプレートと簡易書式ツールバーを使えます。
- **分類せず受け取る** — `Ctrl+P`の「受信箱へメモを作成」で、選択中の場所に関係なく`01_受信箱`へ空のメモを作り、そのまま書き始められます。
- **Webを分類せず受け取る** — Chrome／EdgeのBrowser Clipperから、表示中のWebページやYouTubeを出典情報付きMarkdownで`01_受信箱`へ保存できます。通常Webは記事本文を抽出し、YouTubeは画面上の文字起こしから検証済み字幕トラック、取得不能または途中の場合のローカル`yt-dlp`まで順に探して取得状態も残します。初回だけTSUZUNEの通知領域で6桁コードを使ってペアリングします。[Browser Clipper](docs/browser-clipper.md)
- **Markdownのまま残す** — ノートは`.md`、添付は通常ファイル。TSUZUNEがなくても一般的なeditorで読めます。
- **知識をつなぐ** — `[[Wiki link]]`、backlink、未解決link、ブックマーク、Local/Global Graph。
- **すばやく開く** — `Ctrl+O`のQuick Switcher、`Ctrl+P`のCommand Palette、複数ノートを行き来できるworkspace tab。
- **必要なノートを探す** — `Ctrl+Shift+F`で「内容を検索」を開き、AND、除外、`tag:`／`path:`／`file:`／`category:`／`topic:`、完全phraseで絞り込めます。結果は知識・情報源・受信箱・その他の固定順に分け、各group内では関連度順を保ちます。
- **安全に整理する** — 一覧の右クリックから名前変更、移動、`.trash`への退避。衝突時は上書きしません。
- **画面を広く使う** — 左右のsidebarを独立して閉じ、必要な側だけ再表示できます。
- **古さに気づく** — 最終更新日時と任意の`review_after`から、再確認の目安を非破壊で表示。
- **時間を区別する** — 現在・過去・未来、情報が有効だった時点とAIが知った時点を分離。
- **AIと共有する** — MCP経由で検索、取得、Context構築、revision競合を防ぐ履歴なし更新。
- **任意で同期する** — Google接続と専用Drive folderへの手動preview/apply。ローカル利用だけでも動作します。
- **Windowsで使い続ける** — user単位installer、アプリ内更新、packaged/installed smokeを含む本番更新gate。

## 現在地

| 対象 | 状態 |
|---|---|
| インストール済み本番 | [Project Status](PROJECT_STATUS.md)と最新production receiptを参照 |
| 現在の開発slice | [Product Plan](PLAN.md#current-decision)のCurrent Decisionを参照 |
| Repository | [Public repository](https://github.com/imonoonoko/TSUZUNE) |

本番commit、検証済み範囲、未証明境界は[PROJECT_STATUS.md](PROJECT_STATUS.md)を正本とします。現在のPrimary／Nextと実行順は[PLAN.mdのCurrent Decision](PLAN.md#current-decision)、資料とEvidenceは[docs/INDEX.md](docs/INDEX.md)から辿れます。

## 使い始める

現在のrepository／package versionは`0.6.0`です。[TSUZUNE v0.6.0](https://github.com/imonoonoko/TSUZUNE/releases/tag/v0.6.0)からWindows x64 installerを取得できます。公開v0.6.0は2026-08-26時点の配布物で、このREADMEの最新source機能や手元の本番更新をすべて含むとは限りません。最新sourceから起動する場合は下記の開発手順を使用してください。

インストール済みbinaryを使う場合:

1. 入手元を確認したTSUZUNEのinstallerまたはportable版を起動します。
2. Start menuまたはdesktopの「TSUZUNE」を開きます。
3. 「Vaultを開く」から、Markdownを保存するfolderを選びます。
4. 「ノート」で空のノートを開くか、選択欄からテンプレートを選んで書き始めます。

現在の個人用buildはcode signingしていないため、Windowsが発行元不明の警告を出す場合があります。入手元を確認して実行してください。通常のinstall先は`%LOCALAPPDATA%\Programs\tsuzune`です。uninstallしてもVaultは削除しません。

## 毎日の書き方

### Markdownを知らない場合

- 「受信箱へメモを作成」は、分類・タイトル・タグを先に決めず、同名衝突を避けた空のメモを`01_受信箱`へ作って編集画面で開きます。
- 「ノート」は同名衝突を避けた空のノートを作り、モーダルを挟まず通常の編集画面で開きます。
- 「今日のノート」はテンプレートから選び、日付入りのDailyを同日一件だけ作ります。
- 「アイデアメモ」はテンプレートから選び、見出し入りのノートを通常編集画面で開きます。
- 見出し、太字、list、checkは書式ボタンから挿入でき、関連ノートはVault一覧から選べます。
- 「テンプレートを追加」で編集可能な雛形を作れます。`90_テンプレート`内のMarkdownは自動的に選択肢へ加わります。

裏側では通常のMarkdownへ保存するため、検索、Wiki link、Graph、MCPとの互換性を失いません。TSUZUNEが生成した既存の定型Daily／Ideaが完全一致する場合だけ、再編集用フォームも利用できます。手書きの見出しや追記がある場合はMarkdownソースを維持して内容を落としません。詳しくは[Templates and Freshness](docs/templates-and-freshness.md)を参照してください。

### Wiki linkを使う場合

```markdown
# プロジェクト概要

関連:
- [[開発方針]]
- [[10_プロジェクト/TSUZUNE|TSUZUNE]]
```

link先、backlink、未作成・曖昧・無効linkを右panelで確認できます。Local Graphは現在ノートの直接linkだけ、Global Graphは孤立ノートを含むVault全体を表示します。

### 検索演算子を使う場合

通常検索では、Obsidian Desktop 1.13.4との固定比較に基づく次の演算子を利用できます。

| 入力例 | 意味 |
|---|---|
| `Project active` | 両方を含むノート（AND） |
| `Project -paused` | `Project`を含み、`paused`を含まないノート |
| `tag:project` | `#project`またはその子tagを持つノート |
| `path:10_projects` | Vault相対pathで絞り込み |
| `file:alpha` | ファイル名で絞り込み |
| `category:知識管理` | frontmatterの主カテゴリ完全一致で絞り込み |
| `topic:"原典,追跡"` | frontmatterのtopic完全一致で絞り込み |
| `"Project Alpha"` | 連続したphraseの完全一致 |

演算子名、tag、path、file、category、topic、通常語の大文字小文字は区別しません。空白で区切った条件はANDになります。一つの空白なし日本語自然文は文中の区切り候補をORとして順位付けします。`category:`と`topic:`はデスクトップ画面とMCP検索で同じ検索処理を使います。Graph検索は既存契約を維持します。

## Codex Desktopと連携する

TSUZUNEで使うVaultを一度開いた後、開発repositoryで次を実行します。

```powershell
npm run mcp:register
```

Codex Desktopへ登録するMCP toolは19個です。

| Tool | 用途 |
|---|---|
| `runtime_info` | MCPのversion・起動時刻・更新状態・匿名化Vault IDを確認 |
| `delivery_info` | runtime freshnessとは分離して、sourceとlatest receiptのstatus（match／mismatch／unknown）のみを確認。更新推奨・path・hashは返さない |
| `search` | title、path、本文、category、topicを検索 |
| `fetch` | Markdown noteとrevisionを取得 |
| `get_backlinks` | backlinkを取得（legacy `50_履歴`は除外、path cursorで継続可能） |
| `build_context` | 起点と関連noteを文字数上限付きで構築し、query付きの長い通常起点は関連見出し節を投影して、各sourceのrevision／更新時刻を返す |
| `list_directory` | 本文を含めずfolder・note・添付metadataを最大200件取得し、複数ページの同時変更をfingerprintで検出 |
| `preview_drive_sync` | 起動中のTSUZUNE本体でDrive同期内容を確認 |
| `create_directory` | 既存folderへ新規folderを作成 |
| `create_note` | 既存folderへ新規noteを作成 |
| `create_derived_note` | 受信箱原典を概念単位へ分け、カテゴリ付き派生知識を直接作成 |
| `propose_derived_note` | `01_受信箱`／`40_情報源`を変えず、カテゴリ付き派生知識をAI Reviewへ提案 |
| `update_note` | revision一致時だけ更新 |
| `autonomous_update_note` | 通常noteを更新（同一本文はno-op、revision一致時だけ変更） |
| `patch_note` | revision一致時だけ狭い範囲を更新 |
| `preflight_move_entry` | 起動中アプリで単一Markdown移動を事前確認 |
| `move_entry` | fingerprint一致時だけ単一Markdownを移動 |
| `trash_entry` | 明示依頼時だけ、リンク元のない受信箱原典をrevision一致で復元可能な`.trash`へ移動 |
| `apply_drive_sync` | 確認済みDrive同期planを再検査して適用 |

AI更新は履歴を生成せず、revision一致時だけ通常ノートを更新します。指定した`expected_revision`が古い場合は先に拒否し、本文が完全に同一なら`unchanged: true`を返します。既存の`50_履歴`はlegacyデータとして読み書き対象から除外・保護します。原典の`40_情報源`もMCPの作成・通常更新・自動更新を拒否します。設定の「AIレビュー対象パス」では、これらのツールを即時適用せずVault外の提案へ切り替え、Settingsから承認・取消できます。

受信箱整理では、AIが原典を非信頼データとして最後まで読み、0〜複数の再利用可能な概念へ分けます。各概念は安定した`derivation_key`、`30_知識/TSUZUNE分類と保存基準.md`の現行主カテゴリ1件、topic 1〜3件を持ちます。同じ原典revisionでも異なる概念keyなら複数ノートを作れ、同じkeyだけを重複として拒否します。既存知識の本文は自動置換せず、関連知識へのWikiリンクを派生ノート側に置きます。同一概念に新しい知識がなければノートを増やさず、受信箱地図の処理済みrevisionだけを更新します。権限衝突、採否不明、機微・危険情報は地図で保留します。通常は原典を保ち、利用者が明示した場合だけ、出典URL・revisionを派生知識へ残してリンク元を解消した後に`trash_entry`で復元可能な`.trash`へ移します。`40_情報源`、`knowledge.md`、`50_履歴`は対象外です。

通常のCodex登録面には、永久削除、強制上書き、Google認証を含めません。`trash_entry`は利用者の明示依頼、`01_受信箱`、revision一致、Wiki-link参照ゼロを要求し、MCPから直接、復元可能なVault内`.trash`へ移します。`create_directory`は既存親フォルダの直下だけを確認付きで作成します。一般ノートの移動は、起動中アプリへ`preflight_move_entry`で事前確認し、そのfingerprintを確認付き`move_entry`へ渡した場合だけ実行します。一般moveのアプリ不在時fallbackや旧`move_note`はありません。Drive同期も起動中アプリのloopback bridgeを通し、Google tokenはMCPへ渡しません。direct server専用の`suggest_links`と`add_link`は通常のCodex登録面には公開しません。

登録解除:

```powershell
npm run mcp:unregister
```

詳細は[MCP Integration Guide](docs/mcp-integration.md)を参照してください。

## Google接続は任意

Googleへ接続しなくても、local Vault、Graph、MCPを使えます。標準接続は基本profileと`drive.file`に限定し、TSUZUNE専用Drive folderを手動でpreview/applyします。Calendar読取を有効にした場合だけ、`calendar.events.readonly`を追加で要求します。

Windowsでウィンドウの×を押すと、保存確認後に通知領域へ隠れてTSUZUNE本体とDrive同期MCP bridgeは動作を続けます。通知領域のTSUZUNEから再表示または明示終了できます。自動同期は行いません。

- Google広告profile、検索履歴、他appのDrive全体は取得しません。
- token、OAuth JSON、account情報をVaultやGitへ保存しません。
- 既定では片側削除を伝播せず、残存側をpreserveします。
- 隔離2 profileでのDrive roundtrip（別Vault受信、更新、競合、再起動、削除非伝播）は2026-08-16に受入済みです。[受入証拠](docs/reports/drive-vault-roundtrip-acceptance-2026-08-16.md)
- Settingsで削除伝播を明示有効化した場合だけ、確認付き手動applyでlocal削除をDrive trash、remote削除をlocal `.trash`へ移します。tombstone、stale-plan、再起動収束は隔離実Driveで受入済みです。[受入証拠](docs/reports/drive-deletion-propagation-acceptance-2026-08-17.md)

OAuth build、credential保存、update/releaseの運用は[Windows Production Guide](docs/windows-production.md)を参照してください。

## データ保護

- 保存前に更新時刻を照合し、外部変更との競合を通知します。
- 保存は同じfolder内の一時fileを経由します。
- renameとmoveは既存項目を上書きしません。
- deleteはVault内`.trash`へ退避します。
- dot folderとsymbolic linkはVault一覧から除外します。
- cache、index、GraphはMarkdownと添付から再構築可能に保ちます。

## 開発する

必要環境:

- Windows
- Node.js 22
- npm 11

```powershell
npm ci
npm run dev
```

主な検証:

```powershell
npm run typecheck
$env:NODE_OPTIONS='--max-old-space-size=6144'
npx vitest run --maxWorkers=1
npm run check:mcp
npm run build
```

installerの作成と確認:

```powershell
npm run pack:win
npm run check:installer
npm run check:packaged
```

`npm run production:update`は、対象PCの既存installationとproduction profileを検査・更新するmaintainer向けコマンドです。通常の開発や文書変更では実行しません。

## Documentation

- [Project Status](PROJECT_STATUS.md) — 現在の本番、最新検証、次の一手
- [Product Plan](PLAN.md) — 実行順、受入条件、保留Track、長期roadmap
- [Product Definition](PRODUCT.md) — 製品原則と非目標
- [Design System](DESIGN.md) — GUI、brand、accessibility
- [Documentation Index](docs/INDEX.md) — 機能別guideとEvidence
- [Obsidian Graph Parity Reference](docs/obsidian-graph-parity-reference.md) — 固定比較契約と未証明境界
- [Windows Production Guide](docs/windows-production.md) — installer、update、release
- [Security Policy](SECURITY.md) — 脆弱性を公開Issueにせず報告する方法

## License

Copyright (c) Im_onoko. All rights reserved.

このrepositoryは公開されていますが、現時点でオープンソースライセンスは付与されていません。
