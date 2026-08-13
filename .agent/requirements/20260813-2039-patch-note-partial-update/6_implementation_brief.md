# Implementation Brief — patch_note

## 実装方針

### src/mcp/service.ts

1. `PatchNoteOperation` 型 (`find: string; replace: string; replace_all?: boolean`) を追加
2. `patchNote(id, expectedRevision, operations, opts)` メソッドを追加:
   - 既存 `updateNote` の検証 (不変path / stale revision / reviewモード) を流用
   - `fetchNote` と同等の読み出しで現在内容 + 行末スタイルを取得
   - 内容を LF 正規化 (CRLF→LF) して照合・置換
   - 各 operation を順に適用し、失敗があれば全体を拒否 (原子的)
   - 適用後、行末スタイル (CRLF) を復元して書き出し
   - 結果が元と同一なら no-op 拒否
   - 履歴記録は `autonomous_update_note` と同じ経路 (`50_履歴/AI更新` に監査ノート作成)

### src/mcp/server.ts

- `patch_note` ツールを登録: schema (`id` / `expected_revision` / `operations[]`) + 説明文 + instructions への追記

### tests/mcp-service.test.ts

fixture ベースで以下をカバー:
- 単一operationの置換成功
- 複数operationの成功 (原子的)
- find 0件一致 → 全体拒否 (何も書き込まれない)
- find 複数一致 & replace_all なし → 拒否
- replace_all: true → 全置換
- stale revision → 拒否
- 不変path (40_情報源 / 50_履歴) → 拒否
- no-op → 拒否
- CRLFファイルのLF find が成功し、書き出し後も CRLF が維持される
- 履歴記録が `50_履歴/AI更新` に生成される

## 検証

- `npx vitest run tests/mcp-service.test.ts`
- `npm run typecheck`
- `npx vitest run` (全体回帰)
- `npm run build` (MCPビルド → 次回起動から反映)
