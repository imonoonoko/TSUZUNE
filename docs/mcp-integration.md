# Codex・ChatGPTデスクトップ連携

TSUZUNE v0.2は、現在開いているローカルVaultを、CodexとChatGPTデスクトップから検索・参照し、依頼に応じてノートを作成・更新できるMCPサーバーを含みます。

## 最初の設定

1. TSUZUNEを起動し、AIから参照したいVaultを開きます。
2. TSUZUNEリポジトリでPowerShellを開きます。
3. 依存関係とMCPサーバーを確認します。

   ```powershell
   npm install
   npm run check:mcp
   ```

4. Codexの共通設定へTSUZUNEを登録します。

   ```powershell
   npm run mcp:register
   ```

5. ChatGPTデスクトップを再起動します。
6. ChatまたはCodexの入力欄で`/mcp`を実行し、`tsuzune`が接続済みであることを確認します。

登録処理は`~/.codex/config.toml`に、コメントで囲んだTSUZUNE専用ブロックだけを追加します。既存設定がある場合は、同じ場所へタイムスタンプ付きバックアップを作ります。
検索・参照は自動利用でき、`create_note`と`update_note`は実行前に確認を出す設定で登録します。

## 使い方

たとえば、次のように頼めます。

```text
TSUZUNEで「ONOKO」を検索して、関係するノートを教えて。
```

```text
TSUZUNEの「00_入口/プロジェクト地図.md」を起点に文脈を作り、
現在動いているプロジェクトを整理して。
```

```text
「10_プロジェクト/TSUZUNE.md」へのバックリンクを調べて。
```

```text
今の会話を「01_受信箱/Codex連携メモ.md」として新規保存して。
```

```text
「10_プロジェクト/TSUZUNE.md」を読んでから、
今回決まった連携方針を追記して。
```

最初に`search`で候補を探し、必要なノートだけを`fetch`または`build_context`で読むのが基本です。

既存ノートの更新では、`fetch`で完全な本文と改訂トークンを取得してから、`update_note`で本文全体を置き換えます。取得後に外部編集やVault切替が起きた場合は更新を拒否するため、再取得が必要です。

## 公開する6ツール

| ツール | 用途 | 上限 |
|---|---|---|
| `search` | タイトル・相対パス・本文を検索 | 最大50件 |
| `fetch` | Markdownノートを1件取得 | 本文10万文字 |
| `get_backlinks` | 指定ノートへのリンク元を取得 | 最大50件 |
| `build_context` | 起点と関連ノートをMarkdownへまとめる | 既定1万5千文字 |
| `create_note` | 既存フォルダ内へ新規ノートを作成 | 本文10万文字 |
| `update_note` | 改訂トークンが一致する既存ノートの本文を更新 | 本文10万文字 |

`build_context`が辿るのは、起点ノート、リンク先最大5件、バックリンク最大3件の1段だけです。無制限にVault全体を読み込みません。

## Vaultの切り替え

MCPサーバーは、各ツール呼び出し時にTSUZUNEの設定を確認します。TSUZUNEアプリで別のVaultを開けば、次の呼び出しからそのVaultへ切り替わります。

固定したVaultを使う場合は、MCPサーバーを直接次のように起動できます。

```powershell
node out/mcp/server.js --vault "C:\path\to\Vault"
```

## データと安全境界

- `search`、`fetch`、`get_backlinks`、`build_context`は読み取り専用です。
- `create_note`は既存ノートを上書きせず、親フォルダも自動作成しません。
- `update_note`は`fetch`で得た改訂トークンが一致する場合だけ、本文全体を更新します。
- 10万文字を超えるノートは途中までしか取得できないため、MCPからの更新を拒否します。
- MCP経由では削除・移動・名前変更・フォルダ作成・強制上書きができません。
- Vault外の相対パス、絶対パス、シンボリックリンクは既存のVault境界で拒否します。
- OpenAI APIキーは不要です。
- TSUZUNE自身がVaultをクラウドへ同期することはありません。
- AIがツールを呼んだとき、その検索結果や取得本文は回答用コンテキストとして利用中のモデルへ渡ります。

## 登録解除

```powershell
npm run mcp:unregister
```

TSUZUNEが追加したコメント付きブロックだけを削除し、変更前の設定をバックアップします。反映にはChatGPTデスクトップの再起動が必要です。

## ChatGPT Webについて

ChatGPT Webはローカルの`~/.codex/config.toml`やSTDIOサーバーを直接読みません。Web対応には、後の段階でリモートMCP化またはSecure MCP Tunnelが必要です。v0.2では、ローカルデータを外部公開しないCodex・ChatGPTデスクトップ連携を完成地点とします。

公式資料:

- [Model Context Protocol](https://developers.openai.com/codex/mcp)
- [Secure MCP Tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
