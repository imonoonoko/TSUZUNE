# Implementation Brief

## Changed files

### `src/mcp/service.ts`

- import 追加: `isExcludedFilePath` (`../shared/excluded-files`)
- 定数追加: `DEFAULT_SEARCH_EXCLUDED_PATHS = ['50_履歴']`(export 済み)
- `search(query, limit = 10, includeHistory = false)` に変更
  - `includeHistory` が false のとき `snapshot.notes.filter((note) => !isExcludedFilePath(note.path, DEFAULT_SEARCH_EXCLUDED_PATHS))` を `searchNotes` へ渡す
  - `tag:` クエリも notes 単位のフィルタにより同一挙動

### `src/mcp/server.ts`

- `search` の inputSchema に `include_history: z.boolean().optional().default(false)` を追加
- description に履歴除外の説明を追記
- handler: `vault.search(query, limit, include_history)`
- instructions に使い分けを追記

### `tests/mcp-service.test.ts`

新規5テスト:
1. 既定で 50_履歴 を除外し、40_情報源は残る
2. `include_history=true` で履歴を含む
3. 履歴のみにヒットするクエリは既定で空
4. limit は履歴除外後に適用
5. `tag:` クエリでも履歴を除外

## Verification

- `npm run typecheck`: PASS
- `npx vitest run tests/mcp-service.test.ts`: 36 tests PASS
- `npm test`: 61 files / 585 tests PASS

## Notes

- 動作反映には `npm run build` 後の MCP 再起動(新セッション)が必要。
- 本スライスは search のみ。Graph・Context の AI revision 除外と userIgnoreFilters 共有は別スライス。
