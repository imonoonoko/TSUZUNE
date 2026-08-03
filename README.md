# TSUZUNE

**書いて、つないで、あとで尋ねる。**

TSUZUNEは、ローカルのMarkdownファイルをそのまま扱う、Windows向けの個人用メモアプリです。v0.2ではCodexとChatGPTデスクトップからVaultを参照・更新するMCP連携、v0.3では時間付き記憶、v0.4では1-hopグラフと手動Google Drive同期を追加しました。v0.5では、現在ノートの直接リンクに固定したローカルグラフ、孤立ノートを含むVault内の全Markdown表示、絞り込み、ズーム、パン、全体表示、関係凡例、接続強調、AI自動更新と更新履歴に加え、Windowsインストーラーとアプリ内更新を使えます。

開発中の現在地、本番v0.5.0とv0.6開発checkpointの境界、検証済み範囲、次の作業は[PROJECT_STATUS.md](PROJECT_STATUS.md)に集約しています。資料全体は[docs/INDEX.md](docs/INDEX.md)から辿れます。

## v0.1でできること

- ローカルフォルダをVaultとして開く
- Markdownノートとフォルダを作成する
- ノートを自動保存する
- ノート・フォルダの名前を変更する
- ノートを別フォルダへ移動する
- 削除対象をVault内の`.trash`へ移動する
- `[[ノート名]]`、`[[フォルダ/ノート名]]`、`[[ノート名|表示名]]`を使う
- リンク先、バックリンク、未作成・曖昧・無効リンクを確認する
- ファイル名・パス・本文を日本語で検索する
- 最後に開いたVaultとノートを復元する
- 外部エディタで変更された場合に、上書きせず競合を通知する

ノート本文は普通の`.md`ファイルです。TSUZUNEがなくても、一般的なテキストエディタで読み書きできます。

2026-08-03の製品最適化では、外部変更通知のバッチ化、入力中の全Vault再計算の抑制、`Ctrl+K`検索、compact desktop shell、移動ダイアログのキーボード操作、Vault画像プレビュー、TSUZUNE専用マークと共通線アイコンを追加しました。設計基準は[PRODUCT.md](PRODUCT.md)と[DESIGN.md](DESIGN.md)、画面と検証結果は[Product Optimization HTML Report](docs/reports/tsuzune-product-optimization-2026-08-03.html)で確認できます。

## 使い始める

1. Releasesまたは配布された`TSUZUNE-Setup-0.5.0.exe`を起動します。
2. ユーザー単位のインストール完了後、スタートメニューまたはデスクトップの「TSUZUNE」を起動します。
3. 「Vaultを開く」から、メモを保存したいローカルフォルダを選びます。
4. 「＋ ノート」で最初のMarkdownノートを作成します。

現在の個人用ビルドはコード署名していないため、Windowsが「発行元不明」の警告を表示する場合があります。ファイルの入手元を確認してから実行してください。通常のインストール先は`%LOCALAPPDATA%\Programs\tsuzune`で、アンインストールしてもVaultと`%APPDATA%\TSUZUNE`の設定・Google接続状態は削除しません。

## 開発

必要環境:

- Windows
- Node.js 22
- npm 11

```powershell
npm install
npm run dev
```

主な確認コマンド:

```powershell
npm run typecheck
npm test
npm run check:mcp
npm run build
npm run pack:win
npm run check:installer
npm run check:packaged
```

## v0.5: Windowsインストーラーとアプリ内更新

`npm run pack:win`は、ユーザー単位のNSISインストーラー、差分更新用blockmap、`latest.yml`を`dist`へ生成します。アプリのヘッダーから次の順に更新できます。

`npm run check:installer`は、実際の`app.asar`も読み、`electron-updater`のCommonJS互換import、更新メタデータ、アプリアイコンがElectron既定へ退行していないことを検査します。`npm run check:packaged`は、パッケージ版を非表示で起動し、レンダラーの読み込み完了まで確認します。

このPCで開発中の検証済みworking treeを本番へ反映する場合は、個別コマンドではなく次を実行します。

```powershell
npm run production:update
```

型検査、全テスト、MCP検査、パッケージ作成、隔離起動、silent install、インストール物のhash照合、production profile非変更、Codex MCP再登録までを一度に行います。本番TSUZUNEが起動中なら強制終了せず停止します。結果は`docs/reports/production-update-latest.json`に保存されます。

1. 「更新を確認」で非公開GitHub Releasesを確認する
2. 新版があれば「TSUZUNE x.y.zを取得」でダウンロードする
3. 「TSUZUNE x.y.zを適用」で編集中のノートを保存し、再起動して更新する

更新適用前の保存に失敗した場合は再起動せず、編集内容を画面に残します。更新確認とダウンロードはノート保存キューを塞ぎません。更新用GitHub tokenはEXEや設定ファイルへ保存せず、実行時の`GH_TOKEN`、`GITHUB_TOKEN`、またはこのPCの`gh auth token`からプロセス内だけで取得します。

非公開リポジトリのため、現在の更新機能はGitHub CLIで`imonoonoko/TSUZUNE`を読めるこの個人用PCが対象です。Releaseへ`latest.yml`、インストーラー、blockmapを公開して初めて自動更新の配信が成立します。ビルド、公開、署名を含む運用手順は[Windows本番運用ガイド](docs/windows-production.md)を参照してください。

## v0.2: Codex・ChatGPTデスクトップ連携

TSUZUNEで使いたいVaultを一度開いた後、次を実行します。

```powershell
npm run mcp:register
```

ChatGPTデスクトップを再起動し、入力欄で`/mcp`を実行すると、`tsuzune`が表示されます。TSUZUNEで別のVaultを開くと、次のツール呼び出しから新しいVaultを参照します。

連携から使える機能は次の7つです。

- `search`: タイトル・パス・本文の検索
- `fetch`: 指定したMarkdownノートの取得
- `get_backlinks`: 指定したノートへのバックリンク取得
- `build_context`: 起点ノートと1段先の関連ノートを、文字数上限付きでまとめる
- `create_note`: 既存フォルダ内へ新規Markdownノートを作る
- `update_note`: 取得時の改訂トークンが一致するノートだけを更新する
- `autonomous_update_note`: ユーザー承認を待たずに通常ノートをAI更新し、旧本文を`50_履歴/AI更新`へ保存する

`autonomous_update_note`は、NotebookLMや外部資料から得た情報を知識・プロジェクトノートへ反映するための機能です。原文・会話ログは自動更新せず、更新理由、出典、旧版の改訂情報を履歴へ記録します。必要な場合は、ノートまたはフォルダ単位の書込ポリシーで`auto`、`review`、`immutable`を切り替えます。

登録解除:

```powershell
npm run mcp:unregister
```

詳細は[Codex・ChatGPTデスクトップ連携ガイド](docs/mcp-integration.md)を参照してください。

## v0.3: Temporal Memory Lite

重要な状態や出来事だけに任意のYAML frontmatterを付けると、TSUZUNEは通常のMarkdownを原本のまま、現在・過去・未来・再確認期限超過・置き換え済みとして読み分けます。

- 右パネルのTemporal Inspectorで時間判定と警告を確認する
- `build_context`の`as_of`で指定日時点の文脈を作る
- `temporal_perspective`で、実際の有効時点と当時の知識時点を選ぶ
- `include_history`で過去・置き換え済みの記録も含める
- State Noteから`source`の根拠ノートを追跡する
- 過去時点では、有効時点を持たない通常ノート本文を推測材料にせず、省略警告を返す

Starter Vaultを使った比較では、時間対応Contextが固定4問で4/4、State Noteから出典への一致が3/3となり、過去への未来情報漏えいは0件でした。詳細は[M5 Starter Vault Dogfood](docs/m5-dogfood.md)を参照してください。

## v0.4: グラフとGoogle Drive手動同期

### グラフ（現在仕様）

ノートを開いて「グラフ」を選ぶと、選択中のノートを中心に、直接つながるリンク先・バックリンクを表示します。ローカルグラフは直接リンクだけに固定し、深度1／2の切替と2段先の探索は行いません。

- 選択中のノートを中心に、直接つながるリンク先・バックリンクだけを表示する
- ローカルグラフと、解決済みリンクでつながるVault全体グラフを切り替える
- Vault全体表示では、孤立ノートを含むVault内の全Markdownを既定で表示する
- 必要な場合だけ「孤立ノートを表示」を外すか、ノート名・パス検索で表示を絞る
- ノート名またはパスで表示対象を絞り込む
- 60〜180%へ拡大縮小する
- 背景ドラッグまたは矢印キーで表示位置を動かす
- 「全体表示」で表示中の円形ノードとラベルを余白付きで画面内へ収める
- 現在、リンク先、バックリンク、相互リンク、関連ノートを凡例と色で見分ける
- ノードのhoverまたはkeyboard focusで、直接つながるノートとリンクを強調する
- 固定件数の上限でMarkdownを切り捨てず、Vault全体グラフへ全ノートと全Wikiリンクを渡す
- ノードをクリックまたはキーボードで選択して、そのノートを開く
- 未保存の編集中Wikiリンクも表示へ反映する
- グラフDBや別の索引を持たず、現在のMarkdownとWikiリンクから都度組み立てる
- 全リンクを1枚のCanvasへまとめて描画し、ノートはクリック・フォーカス・キーボード操作できるDOM要素として重ねる

v0.6開発版では固定リングを継続するForce simulationによる不規則配置へ置き換え、中心力、反発力、リンク力、リンク距離をその場で調整して再起動後も復元できます。ローカルグラフだけ現在ノートを中心へ固定し、Vault全体グラフは自由配置します。大量のリンクごとにDOMやSVG要素を増やさないよう、辺は単一Canvas層へ集約し、操作対象のノートだけをDOMとして維持するハイブリッド描画へ移行しました。各Markdownは円形ノードとして表示し、Wikiリンクの線は円周間へ接続します。「全体表示」は表示中ノードとラベルの実寸範囲を自動計測し、60〜180%の範囲で余白付きに収めます。P0-4で導入した50ノート・200リンクの表示上限は、GP1-5で「Vault内の全Markdownを表示する」という現在要件に合わせて撤廃しました。以前の深度1／2切替と上限制御は過去の実装記録として[Graph Explorer P0-4 HTML Report](docs/reports/graph-explorer-p0-4-2026-08-01.html)へ残し、現在の比較契約は[Obsidian Graph Parity Reference](docs/obsidian-graph-parity-reference.md)で確認できます。

### GoogleログインとDrive同期

Google接続は任意です。ログインしなくても、従来どおりローカルVaultの閲覧・編集とMCP連携を使えます。

- GoogleのシステムブラウザでDesktop OAuth 2.0認証を行う
- 要求する権限は`openid email profile`と`drive.file`だけ
- ログインから取得する個人情報は、名前・メールアドレスなどの基本プロフィールだけ
- ローカルMarkdownを原本とし、専用のDriveフォルダと手動で同期する
- 「同期内容を確認」で送信・受信・競合・保持をプレビューし、「この内容で同期」で適用する
- ローカルまたはDrive側でノートが消えても、削除を相手側へ伝播しない
- 両側で同じノートが変更された場合、ローカル版を元のパスへ収束させ、変更前のDrive版をローカルとDriveの競合ノートとして残す
- TSUZUNEが作成・管理するファイルだけを対象にし、Drive全体を走査しない
- Drive側の版とパスを適用直前に再確認し、古いプランやWindows上で衝突するパスを拒否する
- 別PCでは「既存のDrive Vaultを探す」から、以前に同期したVaultを明示選択して紐付ける

Google内部の広告プロファイル、Google検索履歴、他アプリが作成したDriveファイルは、このログインや同期では取得しません。GoogleログインだけでTSUZUNEのパーソナライズ情報が自動的に増えるわけではありません。

### Googleでログインする

TSUZUNE標準のDesktop OAuthクライアントを組み込んだ個人用ビルドでは、利用者がOAuth JSONを用意する必要はありません。

1. ヘッダーで「Google / 同期」を開きます。
2. 「Googleでログイン」を押し、システムブラウザで権限を確認します。
3. Vaultを開いた状態で「同期内容を確認」を押し、内容を確認してから「この内容で同期」を押します。

自分のGoogle Cloudプロジェクトを使いたい場合だけ、「詳細設定を開く」から「独自のOAuth JSONを選ぶ」を使えます。選択した設定は標準クライアントIDより優先され、既存の更新トークンは混用しないよう消去されます。

別PCで既存Vaultを受信する場合は、同じTSUZUNE配布版で同じGoogleアカウントへログインし、空のローカルVaultを開きます。「既存のDrive Vaultを探す」で対象を選び、「このDrive Vaultを使う」を押してから同期内容を確認してください。すでに同期済みのローカルVaultを別のDrive Vaultへ付け替える操作は拒否します。

### 標準ログインを組み込んでビルドする

このリポジトリには実際のGoogle OAuthクライアントIDとclient secretを含めません。個人用ビルドの作成者が次の準備を行います。

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成または選択します。
2. Google Drive APIを有効にし、OAuth同意画面を構成します。
3. OAuthクライアントIDを「デスクトップアプリ」として作成します。
4. クライアントIDを`MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID`、client secretを`MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET`へ設定してビルドします。このTSUZUNE用Desktopクライアントではtoken exchangeに両方が必要です。値はビルド時だけ渡し、Gitへ保存しません。

PowerShellの例:

```powershell
$env:MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID='発行されたクライアントID'
$env:MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET='発行されたclient secret'
npm run pack:win
```

`.env.example`を参考にローカルの`.env`へ設定することもできます。値はビルド時にmain processへ埋め込まれるため、既に作成済みのEXEへ後から`.env`を置いても反映されません。

Desktop appのclient secretは、個人用EXEへ組み込んでも抽出可能であり、機密情報として保護できません。この標準ログイン方式は個人用ビルド限定です。認可codeの横取りやcallbackの偽装を防ぐため、システムブラウザ、ランダムなloopback port、PKCE S256、state照合は引き続き使用します。更新トークンとアカウント情報はEXEへ組み込みません。

2026-08-01時点で、TSUZUNE用Google CloudプロジェクトのDrive API、External / Testing同意画面、テストユーザー、Desktop appクライアントを構成し、クライアントIDとclient secretをビルド時だけ渡した`dist/TSUZUNE-Setup-0.5.0.exe`をローカル作成・インストール済みです。両値の実値、OAuth JSON、token、アカウント情報はリポジトリへ保存していません。

OAuth同意画面がExternalかつTestingのままだと、Googleの仕様により更新トークンは原則7日で失効します。継続利用する場合は、同意画面と公開要件を確認したうえでPublishing statusをIn productionへ移してください。

独自のOAuthクライアントJSONを選んだ場合だけ、その設定をローカルに保持します。ログイン後の基本プロフィールは`%APPDATA%\TSUZUNE\google\google-account.json`、更新トークンは`%APPDATA%\TSUZUNE\google\refresh-token.json`へ保存します。更新トークンはVaultやMarkdownへ書かず、Electronの`safeStorage`を通してWindowsの暗号化機構で保護します。アクセストークンは永続保存しません。

手動同期は複数端末で同時に実行せず、1台のpreview/applyが終わってから次の端末で実行してください。Drive版はアップロード直前に再確認しますが、Google Drive APIの版確認と更新は単一の原子操作ではありません。複数端末による同時applyを調停する常駐サーバーや分散ロックも実装していません。

現在の自動テストは、組み込みOAuth設定と独自JSONの優先順位、OAuth、暗号化保存、Drive APIクライアント、同期判定、同期適用、グラフをモックまたはローカルfixtureで確認しています。2026-07-31に実GoogleアカウントでOAuthログインと基本プロフィール表示に成功し、`google-account.json`と暗号化された`refresh-token.json`の保存を確認しました。Drive同期の読み取り専用previewは送信40件、受信0件、競合0件、保持0件で成功し、その後に利用者が初回applyを実行しました。同期台帳には2026-07-31 14:42:24 JSTの完了時刻、40件の固有Drive file ID、40件すべてで一致するローカル・Driveハッシュが記録され、現在のローカルMarkdownも40/40件で同期時ハッシュと一致しています。別端末相当の受信や競合解決を含む同期往復は引き続き未確認です。

Google公式仕様:

- [OAuth 2.0 for Desktop apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

## v0.2 MCPの境界

MCP連携からできる書き込みは、新規ノート作成、競合検知付きの本文更新、通常ノートに限る履歴付きAI自律更新です。自律更新でも旧本文、理由、出典、改訂情報を`50_履歴/AI更新`へ残します。削除、移動、名前変更、フォルダ作成、強制上書き、Raw Sourceの自律更新は公開していません。v0.4のグラフとGoogle Drive同期はデスクトップアプリの明示操作で使う機能であり、MCPからGoogle認証や同期を実行することはできません。アプリ内AIチャット、ChatGPT Webへの公開、プラグイン、モバイル版、共同編集も対象外です。

## データ保護

- 保存前にファイルの更新時刻を照合し、外部変更を検知します。
- 保存は同じフォルダ内の一時ファイルを経由します。
- 名前変更・移動では、同名の既存項目を上書きしません。
- 削除ごとに`.trash`内へ専用の退避先を作り、同名の削除済みノートもすべて残します。
- ドットで始まる内部フォルダとシンボリックリンクはVault一覧から除外します。

## ライセンス

Private personal project. All rights reserved.
