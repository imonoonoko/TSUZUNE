# Orchestration

## Source of truth

- Contract and sequence: `plan.md`
- Machine-readable status: `state.json`
- Delegation contracts: `packets/`
- Returned evidence: `results/`
- Final integrated evidence: `final-report.md`

## Ownership

| Track | Owner | Scope | Write boundary |
|---|---|---|---|
| integration | root | contract, semantic boundary, shared-file edits, TDD, unseen-boundary verification, production and TSUZUNE | repository + production + TSUZUNE final write |
| write-path scout | delegated explorer | history generation call graph, mutation safety, obsolete implementation | read-only |
| contract-scope scout | delegated explorer | MCP schemas/descriptions, tests/scripts/docs, temporal distinction, removal matrix | read-only |
| entry-move implementation | delegated worker | history-free move journal/recovery and focused tests | `src/main/entry-move.ts`, `src/main/mcp-drive-sync-bridge.ts`, `tests/entry-move.test.ts`, `tests/fixtures/entry-move-crash.test.ts` |

## Coordination rules

- Delegates are not alone in the worktree and must not revert or rewrite other changes.
- Scouts do not edit files, run destructive commands, operate production, or write TSUZUNE.
- Root owns all implementation and final semantic choices.
- Findings are evidence, not completion. Root performs an unseen-boundary check after integration.
- Existing`50_履歴`の物理削除、時間文脈全体の廃止、原典保護の緩和が必要なら実装せずrootへ返す。
- Entry-move workerは`src/mcp/server.ts`を編集しない。MCP schema integrationはrootが担当する。
