# Scope

## In scope

- `src/mcp/service.ts`: `search()` に `includeHistory`(既定 false)を追加し、false のとき `DEFAULT_SEARCH_EXCLUDED_PATHS = ['50_履歴']` でフィルタしてから `searchNotes` へ渡す。
- `src/mcp/server.ts`: `search` の inputSchema に `include_history`(optional, default false)を追加。description と instructions に履歴除外と include_history の説明を追記。
- `tests/mcp-service.test.ts`: 履歴除外 / include_history / 履歴のみヒットの空結果 / 40_情報源維持 / tag: クエリ / limit のテストを追加。
- `.agent/requirements/20260813-2035-search-history-exclusion/` の要件文書。

## Out of scope(別スライス)

- `build_context` からの AI revision 除外(既に include_history と temporal 警告を持つ)。
- Graph 読取APIの新設(現状 MCP に Graph API なし)。
- `--vault` モードでの userIgnoreFilters 共有(既知ギャップ。本スライスは既定ルールとして独立)。
- UI 検索(renderer)の挙動変更。
- `get_backlinks` / `fetch` の履歴アクセス変更(監査用途を維持)。
