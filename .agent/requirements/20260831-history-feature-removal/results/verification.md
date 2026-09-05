# Verification

## Source

- `git diff --check`（task-owned files）: PASS
- `npm run typecheck`: PASS
- `npm test`: PASS — 91 files passed、1 skipped、867 tests passed、1 skipped
- `npm run check:mcp`: PASS
- entry-move partial-ledger regression: RED確認後、11 tests PASS

## Production

- `npm run production:update`: PASS
- package/installer contract: PASS
- packaged smoke: PASS（isolated user data）
- installed smoke: PASS（isolated user data）
- built/installed executable hash: MATCH
- built/installed `app.asar` hash: MATCH
- production profile: 58 files、digest before/after MATCH
- Codex MCP registration: refreshed

## Final runtime and persistence

- fresh MCP process: `stale_runtime:false`、`delivery_info:match`。
- fresh schema: search／backlink／build_contextに履歴入力なし、patch／moveに履歴出力なし。
- execution record: `30_知識/TSUZUNE-履歴機能廃止・本番受入-実施記録-2026-08-31.md`。一意検索、read-back、6 backlinksを確認。
- 実施記録契約、運用標準、システム設計、ロードマップ、project dashboard、運用・開発入口を各一回更新した。
- 既存`50_履歴`の物理削除は未実施で、別の明示承認gateである。
