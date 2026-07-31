# Codex・ChatGPTデスクトップ連携

TSUZUNE v0.2以降は、現在開いているローカルVaultを、CodexとChatGPTデスクトップから検索・参照し、依頼に応じてノートを作成・更新できるMCPサーバーを含みます。

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

```text
「10_プロジェクト/TSUZUNE.md」を起点に、
2026-07-22時点の文脈を作って。当時不明なことは推測しないで。
```

```text
「10_プロジェクト/TSUZUNE.md」を起点に、
2026-07-22までにAIが知っていた情報だけで文脈を作って。
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

`build_context`が辿るのは、起点ノート、リンク先最大5件、バックリンク最大3件の1段だけです。無制限にVault全体を読み込みません。関連するState NoteとEvent Noteがあれば、時間判定と選定理由も返します。

任意入力:

- `as_of`: ISO 8601の日付またはタイムゾーン付き日時。指定時点で有効だった状態と、その時点までに発生した出来事を選びます。
- `include_history`: `true`にすると、過去状態や置き換え済みの記録も候補へ含めます。
- `temporal_perspective`: 既定の`valid-time`は「その時点で実際に有効・発生していた情報」、`knowledge-time`は`observed_at`を使って「その時点までにTSUZUNEまたはAIが知っていた情報」を選びます。`knowledge-time`で`observed_at`がなければ推測せず省略します。

出力には`as_of`、`temporal_perspective`、`temporal_status`、`selection_reasons`、`warnings`が含まれます。明示した過去時点では、有効時点を持たない通常ノート本文を現在知識として遡及利用しません。該当本文は省略し、`content_omitted: true`と`UNSCOPED_NORMAL_CONTENT_OMITTED`警告で対象Pathを示します。起点自身が未来のState/Event Noteまたは指定knowledge-timeで未観測なら、その本文も省略します。該当するState Noteがなければ、通常ノートの更新日時から過去状態を推測せず「不明」と扱います。

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
- MCPからGoogle認証やDrive同期を実行することはできません。Drive同期はデスクトップアプリで利用者がpreview／applyを明示した場合だけ動きます。
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
