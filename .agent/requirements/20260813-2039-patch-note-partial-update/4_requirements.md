# Requirements — patch_note

## ツール仕様

```
patch_note(id, expected_revision, operations)
  id: string              ノートのVault相対パス
  expected_revision: string  fetchで取得したrevision (必須)
  operations: [          1〜20件
    { find: string, replace: string, replace_all?: boolean }
  ]
```

## 機能要件

| ID | 要件 |
|---|---|
| R1 | `operations` は1〜20件まで。0件または21件以上はエラー |
| R2 | **原子的**: 1件でも find 不一致・複数一致 (replace_all なし) なら、**全体を拒否**し何も書き込まない |
| R3 | find 一致は **ちょうど1件** を既定とする。複数一致はエラー (replace_all: true のときのみ全置換を許可) |
| R4 | `expected_revision` は必須。stale (不一致) なら拒否 |
| R5 | 不変path (40_情報源 / 50_履歴) への書き込みは拒否 |
| R6 | reviewモード設定時は提案のみ返し、ファイルには書き込まない |
| R7 | **履歴を記録する**: 変更後、`autonomous_update_note` 方式で `50_履歴/AI更新` に監査記録を保存 (revision・出典・変更前後の該当箇所) |
| R8 | **no-op拒否**: 全operation適用後の結果が元の内容と同一なら拒否 (無駄な書き込み・履歴汚染防止) |
| R9 | **CRLF対応**: find はLF正規化 (CRLF→LF) した内容に対して照合する。書き出し時は元ファイルの行末スタイル (CRLF) を復元する |
| R10 | 結果は `AutonomousUpdateOutput` 互換の形で返す (applied / history 記録パス / preview 等) |

## エラーケース

| ケース | 挙動 |
|---|---|
| find が0件一致 | エラー (どのoperationが失敗したか、何番目のoperationsかを返す) |
| find が2件以上一致 & replace_all=false | エラー (曖昧一致を拒否。replace_all を促す) |
| id が存在しない | エラー (既存fetchと同じ) |
| 不変path | エラー (AIから変更できない旨) |
| stale revision | エラー (再fetchを促す) |
| no-op | エラー (変更不要の旨) |
