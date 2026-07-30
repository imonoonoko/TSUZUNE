# TSUZUNE

**書いて、つないで、あとで尋ねる。**

TSUZUNEは、ローカルのMarkdownファイルをそのまま扱う、Windows向けの個人用メモアプリです。v0.2では、CodexとChatGPTデスクトップからVaultを参照し、依頼に応じてノートを作成・更新できるMCP連携を追加しました。

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

1. Releasesまたは配布された`TSUZUNE-0.2.0-portable.exe`を起動します。
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

## v0.2の境界

MCP連携からできる書き込みは、新規ノート作成と競合検知付きの本文更新だけです。削除、移動、名前変更、フォルダ作成、強制上書き、アプリ内AIチャット、ChatGPT Webへの公開、グラフビュー、クラウド同期、アカウント、プラグイン、モバイル版、共同編集は対象外です。実際にTSUZUNEを使い、必要になった機能だけを次の版で追加します。

## データ保護

- 保存前にファイルの更新時刻を照合し、外部変更を検知します。
- 保存は同じフォルダ内の一時ファイルを経由します。
- 名前変更・移動では、同名の既存項目を上書きしません。
- 削除ごとに`.trash`内へ専用の退避先を作り、同名の削除済みノートもすべて残します。
- ドットで始まる内部フォルダとシンボリックリンクはVault一覧から除外します。

## ライセンス

Private personal project. All rights reserved.
