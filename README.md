# TSUZUNE

**書いて、つないで、あとで尋ねる。**

TSUZUNEは、ローカルのMarkdownファイルをそのまま扱う、Windows向けの個人用メモアプリです。v0.2ではCodexとChatGPTデスクトップからVaultを参照・更新するMCP連携、v0.3では時間付き記憶、v0.4では1-hopグラフと手動Google Drive同期を追加しました。

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

## 使い始める

1. Releasesまたは配布された`TSUZUNE-0.4.0-portable.exe`を起動します。
2. 「Vaultを開く」から、メモを保存したいローカルフォルダを選びます。
3. 「＋ ノート」で最初のMarkdownノートを作成します。

ポータブル版なのでインストールは不要です。Windowsが未署名アプリの警告を表示した場合は、ファイルの入手元を確認してから実行してください。

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
```

## v0.2: Codex・ChatGPTデスクトップ連携

TSUZUNEで使いたいVaultを一度開いた後、次を実行します。

```powershell
npm run mcp:register
```

ChatGPTデスクトップを再起動し、入力欄で`/mcp`を実行すると、`tsuzune`が表示されます。TSUZUNEで別のVaultを開くと、次のツール呼び出しから新しいVaultを参照します。

連携から使える機能は次の6つです。

- `search`: タイトル・パス・本文の検索
- `fetch`: 指定したMarkdownノートの取得
- `get_backlinks`: 指定したノートへのバックリンク取得
- `build_context`: 起点ノートと1段先の関連ノートを、文字数上限付きでまとめる
- `create_note`: 既存フォルダ内へ新規Markdownノートを作る
- `update_note`: 取得時の改訂トークンが一致するノートだけを更新する

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

### 1-hopグラフ

ノートを開いて「グラフ」を選ぶと、選択中のノートと、直接つながっているリンク先・バックリンクだけを表示します。

- 選択中のノートを中心にした1段階の関係だけを表示する
- ノードをクリックまたはキーボードで選択して、そのノートを開く
- 未保存の編集中Wikiリンクも表示へ反映する
- グラフDBや別の索引を持たず、現在のMarkdownとWikiリンクから都度組み立てる

Vault全体を力学シミュレーションするグラフではありません。日常的に「このノートの近くに何があるか」を確認するための小さな表示です。

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

TSUZUNE標準のDesktop OAuthクライアントIDを組み込んだ配布版では、利用者がOAuth JSONを用意する必要はありません。

1. ヘッダーで「Google / 同期」を開きます。
2. 「Googleでログイン」を押し、システムブラウザで権限を確認します。
3. Vaultを開いた状態で「同期内容を確認」を押し、内容を確認してから「この内容で同期」を押します。

自分のGoogle Cloudプロジェクトを使いたい場合だけ、「詳細設定を開く」から「独自のOAuth JSONを選ぶ」を使えます。選択した設定は標準クライアントIDより優先され、既存の更新トークンは混用しないよう消去されます。

別PCで既存Vaultを受信する場合は、同じTSUZUNE配布版で同じGoogleアカウントへログインし、空のローカルVaultを開きます。「既存のDrive Vaultを探す」で対象を選び、「このDrive Vaultを使う」を押してから同期内容を確認してください。すでに同期済みのローカルVaultを別のDrive Vaultへ付け替える操作は拒否します。

### 標準ログインを組み込んでビルドする

このリポジトリには実際のGoogle OAuthクライアントIDを含めません。配布担当者が次の準備を行います。

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成または選択します。
2. Google Drive APIを有効にし、OAuth同意画面を構成します。
3. OAuthクライアントIDを「デスクトップアプリ」として作成します。
4. 公開値であるクライアントIDだけを`MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID`へ設定してビルドします。client secret、更新トークン、アカウント情報は組み込みません。

PowerShellの例:

```powershell
$env:MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID='発行されたクライアントID'
npm run pack:win
```

`.env.example`を参考にローカルの`.env`へ設定することもできます。値はビルド時にmain processへ埋め込まれるため、既に作成済みのEXEへ後から`.env`を置いても反映されません。

OAuth同意画面がExternalかつTestingのままだと、Googleの仕様により更新トークンは原則7日で失効します。継続利用する場合は、同意画面と公開要件を確認したうえでPublishing statusをIn productionへ移してください。

独自のOAuthクライアントJSONを選んだ場合だけ、その設定をローカルに保持します。更新トークンはVaultやMarkdownへ書かず、Electronの`safeStorage`を通してWindowsの暗号化機構で保護します。アクセストークンは永続保存しません。

手動同期は複数端末で同時に実行せず、1台のpreview/applyが終わってから次の端末で実行してください。Drive版はアップロード直前に再確認しますが、Google Drive APIの版確認と更新は単一の原子操作ではありません。複数端末による同時applyを調停する常駐サーバーや分散ロックも実装していません。

現在の自動テストは、組み込みクライアントIDと独自JSONの優先順位、OAuth、暗号化保存、Drive APIクライアント、同期判定、同期適用、グラフをモックまたはローカルfixtureで確認しています。実際のクライアントIDはまだ発行・組み込みされていないため、Googleアカウントでの認証・Drive往復は未確認です。

Google公式仕様:

- [OAuth 2.0 for Desktop apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

## v0.2 MCPの境界

MCP連携からできる書き込みは、新規ノート作成と競合検知付きの本文更新だけです。削除、移動、名前変更、フォルダ作成、強制上書きは公開していません。v0.4のグラフとGoogle Drive同期はデスクトップアプリの明示操作で使う機能であり、MCPからGoogle認証や同期を実行することはできません。アプリ内AIチャット、ChatGPT Webへの公開、プラグイン、モバイル版、共同編集も対象外です。

## データ保護

- 保存前にファイルの更新時刻を照合し、外部変更を検知します。
- 保存は同じフォルダ内の一時ファイルを経由します。
- 名前変更・移動では、同名の既存項目を上書きしません。
- 削除ごとに`.trash`内へ専用の退避先を作り、同名の削除済みノートもすべて残します。
- ドットで始まる内部フォルダとシンボリックリンクはVault一覧から除外します。

## ライセンス

Private personal project. All rights reserved.
