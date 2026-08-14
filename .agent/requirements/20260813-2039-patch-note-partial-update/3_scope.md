# Scope — patch_note

## 変更対象

| ファイル | 変更 |
|---|---|
| `src/mcp/service.ts` | `PatchNoteOperation` 型・`patchNote` メソッド (LF正規化照合・原子的適用・履歴記録) |
| `src/mcp/server.ts` | `patch_note` ツール登録 (schema + 説明文) |
| `tests/mcp-service.test.ts` | patch_note のテストを追加 |

## 影響範囲 (スライス境界)

- **対象**: MCPの `patch_note` のみ
- **非対象**: `update_note` / `autonomous_update_note` の既存挙動 (無変更・互換維持)
- **非対象**: UI (renderer) — コア関数 (`searchNotes` 等) には手を入れない
- **非対象**: 他のMCPツール (search / fetch / move / links / build_context)

## 既存保護の継承

`patch_note` は既存writeツールと同じ保護を適用する:

- **不変path拒否**: `40_情報源` / `50_履歴` (DEFAULT_AI_IMMUTABLE_PATHS) への書き込みを拒否
- **reviewモード**: 設定に応じて提案のみ (apply しない)
- **revision照合**: `fetch` で取得した revision を必須とし、stale なら拒否
- **CRLF実ファイル対応**: ボールトの `.md` はCRLF行末 (実測: 110〜619 CR を含む) のため、LF正規化で照合し、書き出し時に行末スタイルを復元する
