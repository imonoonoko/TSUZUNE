# Orchestration

## Packet A — MCP check isolation

- Objective: `npm run check:mcp` が登録済み `out/mcp/server.js` を更新しないようにする。
- Ownership: `scripts/build-mcp.mjs`、MCP checker scripts、必要な専用test、`package.json`。
- Do not: server freshness契約やproduction registrationを変更しない。
- Acceptance: check用bundleから全checkerがPASSし、既存registered bundleのmtime/hashが不変。

## Packet B — content revision save guard

- Objective: 同一size・同一mtimeの外部変更も保存前に検出する。
- Ownership: `src/shared/types.ts`、`src/main/vault.ts`、保存callerの必要最小配線、関連tests。
- Do not: watcher、DB、lock serviceを追加しない。
- Acceptance: 保存開始前とtemp write後の同一metadata変更を両方拒否する。

## Packet C — AI history commit semantics

- Objective: 正本保存失敗時に未適用AI revisionを通常の適用履歴として残さない。
- Initial ownership: read-only design/test seam review。Packet B統合後に親が編集範囲を確定する。
- Do not: 50_履歴のdelete/rollback、単純な順序反転、新DB。
- Acceptance: fail-first testが監査意味を固定し、成功時の既存history contractを維持する。

## Integration

親agentが現在sourceとtestで各提案を再検証し、重複・競合を解消する。Packet完了だけを全体完了証拠にしない。
