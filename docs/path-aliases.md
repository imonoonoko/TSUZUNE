# Path Alias

更新日: 2026-08-10

Path Aliasは、分類変更でMarkdownノートのpathが変わっても、古いWikiリンクやMCP IDを現在の正本へ解決するための非表示sidecarです。旧pathと新pathの二重ノートを作らないため、redirect用Markdownは置きません。

## 保存形式

Vault直下の`.tsuzune/path-aliases.json`へ、旧pathから現在のpathへの対応をJSON objectで保存します。

```json
{
  "30_知識/旧分類/手順.md": "30_知識/ソフトウェア開発/手順.md"
}
```

- pathはVault相対、Markdownファイル限定です。
- `/`区切りを正規形とし、検索時は大文字小文字を区別しません。
- 複数段の対応はcanonicalな終端まで解決します。
- 同じ旧pathに実ファイルが再作成された場合は、その実ファイルをaliasより優先します。
- canonical終端が存在しない場合は、存在するノートとして扱いません。

## 適用範囲

同じ解決契約をWikiリンク、リンク先、バックリンク、Graph、Context、時間情報、MCPの取得・更新・バックリンク・Context、bookmark、最後に開いたノートへ適用します。MCP検索結果には現在のcanonical pathだけを返します。

`#見出し`、`#^block`、`|表示名`はpathと分離して保持します。Graphにはalias専用nodeを追加せず、旧リンクからcanonical nodeへ直接edgeを張ります。

## Fail-closedと復旧

unsafe path、非Markdown path、大文字小文字を区別しない衝突、自己参照、循環、壊れたJSON、symlink化されたsidecarは拒否します。異常な設定を推測で一部適用せず、Vault scan全体を停止します。

復旧時はTSUZUNEを閉じ、`.tsuzune/path-aliases.json`を退避してから、移行manifestまたはバックアップに基づいて修正します。外部の旧MCP IDや改変しない履歴が残る間は、対応するaliasを削除しません。

## 現在の制限

O2-P1は読取・解決基盤だけです。通常のmove／renameはsidecarやMarkdown本文を自動更新しません。

Drive同期は現在Markdownノートだけが対象で、このsidecarは同期されません。sidecar同期またはremote rename方針が決まるまで、分類目的の物理移動とDrive applyは禁止します。

## O2-P2 dry-run

O2-P2では、[明示plan](migrations/o2-p2-operations-plan.json)とread-only CLIで本番Vaultを2回検査しました。5 moves／11,027 bytes、参照39件／28 files、MCP backlink 39件を確認し、移行前後のWiki、Graph、Context投影は同値でした。全301 files／9,727,936 bytesのVault fingerprintとmanifest SHA-256は2回一致し、Vault write、物理move、Markdown write、Drive操作は0件でした。

この結果はpreviewの再現性を示すだけで、applyを許可しません。現在の`applyAllowed`は`false`で、次の3 blockerが残ります。

- `DRIVE_PATH_ALIAS_UNSUPPORTED`
- `REFERENCE_REWRITE_NOT_APPLIED`
- `ROLLBACK_PREIMAGES_NOT_CAPTURED`

詳細値と検証境界は[O2-P2 report](reports/o2-p2-classification-migration-dry-run-2026-08-10.md)を参照してください。次の分類Gateは匿名一時Vaultだけでapply／rollbackを往復するO2-P3、またはDrive sidecar契約の判断です。本番Vaultへは適用しません。
