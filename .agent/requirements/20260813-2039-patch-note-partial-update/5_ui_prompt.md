# UI Prompt — patch_note

## AIエージェント向け説明文 (server.ts に記載する内容)

`patch_note` — 既存ノートの**部分更新**。1行のリンク修正・単語の差し替えを全文書き換えなしで行う。

- 使い方: まず `fetch` で現在の内容と `expected_revision` を取得し、`operations` に find/replace を渡す
- `find` は **ちょうど1件** 一致すること (複数ある場合は `replace_all: true` を付ける)
- 全 operation が成功した場合のみ書き込まれる (原子的)。1件でも失敗すると何も変わらない
- 変更内容は `50_履歴/AI更新` に監査記録される
- 書き込み不可フォルダ (40_情報源 / 50_履歴) と stale revision は拒否される
- 行末は自動処理されるので、find は普通の LF で書いてよい
