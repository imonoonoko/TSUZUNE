# Working-tree commit manifest — 2026-08-14

## Purpose

Freeze every dirty leaf file into exactly one disposition before staging or committing. This file is administrative output and is not part of the frozen inventory.

## Frozen boundary

- repository: `C:\Users\Humin\Documents\Codex\TSUZUNE`
- branch: `agent/tsuzune-mcp-integration`
- HEAD: `ae7d97d`
- command: `git status --porcelain=v1 -uall`
- frozen leaf files after build-hygiene fix: **245** = tracked modified 36 + untracked 209; this manifest itself is excluded
- current count after the App flow repair and type-order restore, including this manifest: **20 leaf files** / **15 collapsed entries**
- final closeout after rejecting H1: **0 leaf files** / **0 collapsed entries**; working tree clean before push and production update
- prior count before the fix: **250 leaf files** / **104 collapsed entries**
- invariant: each current non-administrative dirty path appears once below; no path is staged, deleted, committed, or pushed by this manifest task

## Dispositions

| Bundle | Count | Disposition | Meaning |
|---|---:|---|---|
| C0 | 3 | committed | Build hygiene committed as `0ad187a` |
| C1 | 40 | committed | MCP transport, AI write policy, reviewed support code, tests, and evidence committed as `5750c2e` |
| C2 | 14 | committed | O2 migration and Drive Path Alias prototype packet committed as `88f0518` |
| C3 | 125 | committed | Graph parity product code, tests, requirements, scripts, and retained evidence committed as `8e5a3d3` |
| C4 | 38 | committed | Context/token research, creation-time no-op test, profiler, and reproducibility committed as `37601ce` |
| C5 | 2 | restored_exact_pin | Unneeded MCP SDK range widening removed; manifest and lock are back to exact 1.30.0 |
| C6 | 5 | commit_with_manifest | Project tracking and operational documentation included in this closeout commit |
| C9 | 8 | commit_with_manifest | Remaining durable reports and handoffs included in this closeout commit |
| R1M | 4 | resolved | Three mixed files were resolved by reviewed bundle hunks; the remaining App flow repair is `0eaaec7`, while the type-only reorder was restored |
| H1 | 6 | discarded | Unreferenced superseded Hooks shadow experiment; result and rationale remain in committed C4/report evidence |

Frozen total: **245** = **233 assigned to commits + 2 exact-pin restored + 4 mixed-path resolutions + 6 discarded**.

Resolved X1: eight adjacent `.js` / `.d.ts` files came from `tsc -b` while the composite projects allowed emit. `noEmit: true` now prevents recurrence, and `.gitignore` names only those eight legacy outputs. `tsc -b --force` left all eight hashes unchanged; all eight are ignored.

## Execution log

- C0 committed: `0ad187af2d5b42a98da841153416b2433e6b2629` (`chore(build): prevent TypeScript project emits`). Exact staged set: `.gitignore`, `tsconfig.node.json`, `tsconfig.web.json`; cached diff check and `npm run typecheck` passed. No push or production update. Index returned to 0 files; branch is ahead of origin by 1.
- C1 committed: `5750c2e2ff6a41a0c8dd1588aa248059213597fc` (`feat(mcp): finalize guarded knowledge workflows`). Exact staged set: 40 pure C1 paths plus only the C1-owned hunks from `src/renderer/App.tsx`, `src/shared/types.ts`, and `tests/app.safety.test.tsx`; C2/C3 hunks remained unstaged. `git diff --cached --check`, `npm run typecheck`, 4 related files / 128 tests, MCP smoke (5 read / 6 write), and the full 62 files / 608 tests passed. No push or production update. Index returned to 0 files; branch is ahead of origin by 2.
- C2 committed: `88f05181165a3d98f1548327d86045b317112a0e` (`feat(migration): add Drive path alias prototypes`). Exact staged set: 14 pure C2 paths, only the C2-owned `destinationPath` hunks from `src/main/vault.ts` and `src/shared/types.ts`, plus one focused public regression in `tests/vault.integration.test.ts`; C3/C4 hunks remained unstaged. `git diff --cached --check`, `npm run typecheck`, 4 related files / 70 tests, and the full 62 files / 609 tests passed. Ponytail review: Lean already. No push or production update. Index returned to 0 files; branch is ahead of origin by 3.
- C3 committed: `8e5a3d3cde57956b8685616387ee21b94942542c` (`feat(graph): consolidate parity behaviors and evidence`). Exact staged set: 125 pure C3 paths plus only the note-folder-reveal hunks from `src/renderer/App.tsx` and `tests/app.safety.test.tsx`; C4 and other residual hunks remained unstaged. `git diff --cached --check`, `npm run typecheck`, focused 4 files / 128 tests, and the full 62 files / 609 tests passed with Node 6 GiB and one worker. The first focused run at Node's default 4 GiB ended after 107 tests with the known heap-limit OOM and is retained as environment evidence. Ponytail review: Lean already. No push or production update. Index returned to 0 files; branch is ahead of origin by 4.
- C5 resolved: the only two changes widened `@modelcontextprotocol/sdk` from exact `1.30.0` to `^1.30.0`; both `package.json` and `package-lock.json` were restored to exact `1.30.0`. Package diff is empty; no commit was needed.
- C4 committed: `37601ce620cefd5f122bc2b9c91b464d3003d02f` (`fix(vault): preserve stable creation times and context evidence`). Exact staged set: 38 pure C4 paths plus only the `persistCreationTimes` unchanged-sidecar hunk from `src/main/vault.ts`. `git diff --cached --check`, `npm run typecheck`, focused 2 files / 14 tests, six measurement-script syntax checks, and the full 62 files / 609 tests passed with Node 6 GiB and one worker. Retrieval Shadow remains read-only/test-only and records improved 1 / regressed 1 / unchanged 1; BM25, host-token, and cost reductions remain unclaimed. Ponytail review: Lean already. No push or production update. Index returned to 0 files; branch is ahead of origin by 5.
- R1M completed: `src/shared/types.ts` was proved to contain declaration-order-only changes and restored. `src/renderer/App.tsx` was not a no-op: restoring it would have placed AI path saves outside the intended `try/finally` flow and omitted draft refresh on dialog open. The reviewed repair was committed as `0eaaec7` (`fix: preserve AI settings save flow`). The first focused run reached 45/58 before the known default 4 GiB heap OOM; the prescribed 6 GiB single-worker rerun passed 1 file / 58 tests, and `npm run typecheck` passed. No push or production update.

## Recommended execution order

1. Commit C6, C9, and this manifest as the final local documentation packet.
2. H1 was explicitly rejected and its six untracked files were deleted; do not archive or replace them with another speculative package.
3. Push the clean local commits, then run the production update gate.

Blocked Graph captures remain C3 because current reports and indexes reference them. They are truthful negative evidence, not disposable build output.

## R1 / C5 review result

- Review boundary: product/test diff in the former R1 16 files plus C5 2 package files at HEAD `ae7d97d`.
- Verification: `npx vitest run --maxWorkers=1 tests/graph-query.test.ts tests/graph.test.ts tests/wiki-graph-view.test.tsx tests/settings.test.ts tests/app.safety.test.tsx tests/vault.creation-times.test.ts tests/mcp-service.test.ts` -> **7 files / 193 tests PASS**; `git diff --check` -> PASS.
- Graph query, unresolved-node identity/retention, and note folder reveal are supported by the fixed CP0-T02, CP0-T04, and CP1-B-02 evidence. Their six pure code/test files moved to C3.
- AI policy settings/IPC/preload/style support is one logical C1 feature. Five pure files moved to C1. The public review card now displays the required `operation`, `createdAt`, and `sourceRefs`, and the UI regression test verifies all three. TDD evidence: the focused test first failed on missing `操作: 更新`, then passed after the three direct render lines were added.
- `src/main/vault.ts`, `src/renderer/App.tsx`, `src/shared/types.ts`, and `tests/app.safety.test.tsx` contained hunks owned by more than one bundle. They were resolved by reviewed hunk staging; the final App control-flow repair was isolated after semantic comparison.
- `tests/vault.creation-times.test.ts` is the focused regression for the creation-time sidecar no-op and moved to C4.
- C5 changed only the declared SDK range from exact `1.30.0` to `^1.30.0`; the lock still resolved `1.30.0`. It added future install drift without enabling current behavior, so both files were restored to the exact pin with no commit.

## R1M hunk ownership

The table below records the semantic anchors used to resolve the mixed files. It is historical execution evidence; all four paths are resolved.

| File | Bundle | Hunk anchor / owned behavior |
|---|---|---|
| `src/main/vault.ts` | C4 | `persistCreationTimes`: serialize once and skip replacing an unchanged regular, non-symlink sidecar |
| `src/main/vault.ts` | C2 | `moveNote`: optional exact `destinationPath`, exact-path collision check, legacy auto-suffix path retained when absent |
| `src/renderer/App.tsx` | C1 | `AiWriteReviewProposal` import; AI immutable/review state; settings load/save; proposal list/approve/cancel; review card including operation/time/source |
| `src/renderer/App.tsx` | C3 | `revealGraphNodeInFolder`: permit existing note nodes as well as attachments |
| `src/shared/types.ts` | C2 | `MoveNoteInput.destinationPath` |
| `src/shared/types.ts` | C1 | AI settings fields, `AiWriteReviewProposal`, and five renderer API methods |
| `tests/app.safety.test.tsx` | C1 | graph-force import used by AI fixture, five API mocks, immutable-path test, review-path/proposal test |
| `tests/app.safety.test.tsx` | C3 | note-node `フォルダで表示` assertion using `A.md` |

Resolution after C4:

1. `src/shared/types.ts` was restored because its residual was declaration order only.
2. `src/renderer/App.tsx` was retained and committed separately because ordering changed executable async control flow.
3. C6/C9 and this manifest form the final documentation packet. Each commit boundary was checked with `git diff --cached --check` and an exact staged-path list.

## Leaf inventory

| Status | Bundle | Disposition | Path |
|---|---|---|---|
| M | C0 | committed | `.gitignore` |
| M | C0 | committed | `tsconfig.node.json` |
| M | C0 | committed | `tsconfig.web.json` |
| ?? | C1 | committed | `.agent/requirements/20260812-1231-ai-write-review-contract/1_purpose.md` |
| ?? | C1 | committed | `.agent/requirements/20260812-1231-ai-write-review-contract/2_alternatives.md` |
| ?? | C1 | committed | `.agent/requirements/20260812-1231-ai-write-review-contract/3_scope.md` |
| ?? | C1 | committed | `.agent/requirements/20260812-1231-ai-write-review-contract/4_requirements.md` |
| ?? | C1 | committed | `.agent/requirements/20260812-1231-ai-write-review-contract/5_ui_prompt.md` |
| ?? | C1 | committed | `.agent/requirements/20260812-1231-ai-write-review-contract/6_implementation_brief.md` |
| ?? | C1 | committed | `.agent/requirements/20260812-1231-ai-write-review-contract/discussion_log.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2035-search-history-exclusion/1_purpose.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2035-search-history-exclusion/2_alternatives.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2035-search-history-exclusion/3_scope.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2035-search-history-exclusion/4_requirements.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2035-search-history-exclusion/5_ui_prompt.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2035-search-history-exclusion/6_implementation_brief.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2035-search-history-exclusion/discussion_log.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2039-patch-note-partial-update/1_purpose.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2039-patch-note-partial-update/2_alternatives.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2039-patch-note-partial-update/3_scope.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2039-patch-note-partial-update/4_requirements.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2039-patch-note-partial-update/5_ui_prompt.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2039-patch-note-partial-update/6_implementation_brief.md` |
| ?? | C1 | committed | `.agent/requirements/20260813-2039-patch-note-partial-update/discussion_log.md` |
| M | C1 | committed | `docs/mcp-integration.md` |
| ?? | C1 | committed | `docs/reports/cp0-t05-excluded-files-mcp-retrieval-2026-08-12.md` |
| ?? | C1 | committed | `docs/reports/cp0-t06-ai-write-immutable-policy-2026-08-12.md` |
| ?? | C1 | committed | `docs/reports/cp0-t07-ai-write-review-policy-gate-2026-08-12.md` |
| ?? | C1 | committed | `docs/reports/cp0-t08-ai-write-review-contract-2026-08-12.md` |
| ?? | C1 | committed | `docs/reports/cp0-t09-ai-write-review-mode-2026-08-12.md` |
| ?? | C1 | committed | `docs/reports/cp0-t10-ai-write-review-runtime-acceptance-2026-08-12.md` |
| ?? | C1 | committed | `docs/reports/mcp-contract-reconciliation-2026-08-13.md` |
| ?? | C1 | committed | `docs/reports/mcp-retrieval-route-observation-2026-08-13.md` |
| M | C1 | committed | `scripts/check-mcp.mjs` |
| M | C1 | committed | `scripts/register-codex-mcp.ps1` |
| M | C1 | committed | `src/mcp/server.ts` |
| ?? | C1 | committed | `src/shared/ai-write-policy.ts` |
| ?? | C1 | committed | `tests/mcp-link-ops.test.ts` |
| ?? | C2 | committed | `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/1_purpose.md` |
| ?? | C2 | committed | `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/2_alternatives.md` |
| ?? | C2 | committed | `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/3_scope.md` |
| ?? | C2 | committed | `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/4_requirements.md` |
| ?? | C2 | committed | `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/6_implementation_brief.md` |
| ?? | C2 | committed | `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/discussion_log.md` |
| ?? | C2 | committed | `docs/reports/cp1-c-03-drive-path-alias-contract-2026-08-13.md` |
| ?? | C2 | committed | `docs/reports/cp1-c-04-o2-p4a-sidecar-sync-prototype-2026-08-13.md` |
| ?? | C2 | committed | `docs/reports/cp1-c-05-o2-p4b-relocation-recovery-prototype-2026-08-13.md` |
| M | C2 | committed | `src/cli/classification-migration-prototype.ts` |
| ?? | C2 | committed | `src/cli/drive-path-alias-relocation-prototype.ts` |
| ?? | C2 | committed | `src/cli/drive-path-alias-sync-prototype.ts` |
| ?? | C2 | committed | `tests/drive-path-alias-relocation-prototype.test.ts` |
| ?? | C2 | committed | `tests/drive-path-alias-sync-prototype.test.ts` |
| M | C3 | committed | `.agent/requirements/20260811-0257-attachment-file-explorer-reveal/discussion_log.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0411-graph-filters-search-smallest-slice/1_purpose.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0411-graph-filters-search-smallest-slice/2_alternatives.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0411-graph-filters-search-smallest-slice/3_scope.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0411-graph-filters-search-smallest-slice/4_requirements.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0411-graph-filters-search-smallest-slice/6_implementation_brief.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0411-graph-filters-search-smallest-slice/discussion_log.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0426-graph-malformed-query-parity/1_purpose.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0426-graph-malformed-query-parity/2_alternatives.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0426-graph-malformed-query-parity/3_scope.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0426-graph-malformed-query-parity/4_requirements.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0426-graph-malformed-query-parity/6_implementation_brief.md` |
| ?? | C3 | committed | `.agent/requirements/20260812-0426-graph-malformed-query-parity/discussion_log.md` |
| M | C3 | committed | `docs/obsidian-graph-parity-reference.md` |
| ?? | C3 | committed | `docs/reports/assets/cp1-b-01-obsidian-1.13.4/excluded-files-effect.json` |
| ?? | C3 | committed | `docs/reports/assets/cp1-b-01-obsidian-1.13.4/excluded-files-graph-effect.json` |
| ?? | C3 | committed | `docs/reports/assets/cp1-b-01-obsidian-1.13.4/excluded-files-manage-ui.json` |
| ?? | C3 | committed | `docs/reports/assets/cp1-b-01-obsidian-1.13.4/reference-completion/blocked-run.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-attachment-file-explorer/comparison.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-attachment-file-explorer/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-attachment-file-explorer/obsidian-1.13.4/01-node-context-menu.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-attachment-file-explorer/obsidian-1.13.4/02-after-file-explorer-request.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-attachment-file-explorer/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/comparison.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/obsidian-1.13.4/01-after-entry.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/obsidian-1.13.4/02-after-graph-reopen.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/obsidian-1.13.4/03-after-app-restart.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/tsuzune-working-tree/01-query-entered.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/tsuzune-working-tree/02-graph-reopened.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/tsuzune-working-tree/03-app-restarted.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/tsuzune-working-tree/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/tsuzune-working-tree/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/tsuzune-working-tree/phase-initial.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/expressionless-paren/tsuzune-working-tree/phase-restarted.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/obsidian-1.13.4/01-after-entry.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/obsidian-1.13.4/02-after-graph-reopen.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/obsidian-1.13.4/03-after-app-restart.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/tsuzune-working-tree/01-query-entered.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/tsuzune-working-tree/02-graph-reopened.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/tsuzune-working-tree/03-app-restarted.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/tsuzune-working-tree/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/tsuzune-working-tree/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/tsuzune-working-tree/phase-initial.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/invalid-regex/tsuzune-working-tree/phase-restarted.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/query-matrix.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/obsidian-1.13.4/01-after-entry.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/obsidian-1.13.4/02-after-graph-reopen.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/obsidian-1.13.4/03-after-app-restart.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/tsuzune-working-tree/01-query-entered.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/tsuzune-working-tree/02-graph-reopened.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/tsuzune-working-tree/03-app-restarted.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/tsuzune-working-tree/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/tsuzune-working-tree/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/tsuzune-working-tree/phase-initial.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/trailing-or/tsuzune-working-tree/phase-restarted.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/obsidian-1.13.4/01-after-entry.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/obsidian-1.13.4/02-after-graph-reopen.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/obsidian-1.13.4/03-after-app-restart.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/tsuzune-working-tree/01-query-entered.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/tsuzune-working-tree/02-graph-reopened.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/tsuzune-working-tree/03-app-restarted.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/tsuzune-working-tree/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/tsuzune-working-tree/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/tsuzune-working-tree/phase-initial.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-paren/tsuzune-working-tree/phase-restarted.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/obsidian-1.13.4/01-after-entry.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/obsidian-1.13.4/02-after-graph-reopen.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/obsidian-1.13.4/03-after-app-restart.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/tsuzune-working-tree/01-query-entered.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/tsuzune-working-tree/02-graph-reopened.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/tsuzune-working-tree/03-app-restarted.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/tsuzune-working-tree/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/tsuzune-working-tree/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/tsuzune-working-tree/phase-initial.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-property/tsuzune-working-tree/phase-restarted.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/obsidian-1.13.4/01-after-entry.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/obsidian-1.13.4/02-after-graph-reopen.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/obsidian-1.13.4/03-after-app-restart.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/tsuzune-working-tree/01-query-entered.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/tsuzune-working-tree/02-graph-reopened.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/tsuzune-working-tree/03-app-restarted.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/tsuzune-working-tree/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/tsuzune-working-tree/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/tsuzune-working-tree/phase-initial.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-quote/tsuzune-working-tree/phase-restarted.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/obsidian-1.13.4/01-after-entry.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/obsidian-1.13.4/02-after-graph-reopen.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/obsidian-1.13.4/03-after-app-restart.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/obsidian-1.13.4/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/tsuzune-working-tree/01-query-entered.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/tsuzune-working-tree/02-graph-reopened.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/tsuzune-working-tree/03-app-restarted.png` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/tsuzune-working-tree/manifest.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/tsuzune-working-tree/observation.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/tsuzune-working-tree/phase-initial.json` |
| ?? | C3 | committed | `docs/reports/assets/graph-gp0-malformed-query/unclosed-regex/tsuzune-working-tree/phase-restarted.json` |
| ?? | C3 | committed | `docs/reports/cp0-t01-graph-filters-search-2026-08-12.md` |
| ?? | C3 | committed | `docs/reports/cp0-t02-graph-malformed-query-parity-2026-08-12.md` |
| ?? | C3 | committed | `docs/reports/cp0-t04-graph-unresolved-node-parity-2026-08-12.md` |
| ?? | C3 | committed | `docs/reports/cp1-b-01-excluded-files-reference-completion-2026-08-12.md` |
| ?? | C3 | committed | `docs/reports/cp1-b-01-obsidian-excluded-files-reference-2026-08-12.md` |
| ?? | C3 | committed | `docs/reports/cp1-b-02-note-folder-reveal-2026-08-13.md` |
| ?? | C3 | committed | `docs/reports/cp1-b-03-production-readiness-audit-2026-08-13.md` |
| ?? | C3 | committed | `docs/reports/graph-gp0-attachment-file-explorer-2026-08-11.md` |
| M | C3 | committed | `scripts/capture-graph-gp0-3b-search-restart.mjs` |
| M | C3 | committed | `scripts/probe-obsidian-graph-search-persistence.mjs` |
| ?? | C4 | committed | `.agent/requirements/20260810-0440-query-aware-compact-context/7_x1-t1-model-visible-token-benchmark.md` |
| M | C4 | committed | `.agent/requirements/20260810-0440-query-aware-compact-context/discussion_log.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0150-windows-accessibility-baseline/1_purpose.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0150-windows-accessibility-baseline/2_alternatives.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0150-windows-accessibility-baseline/3_scope.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0150-windows-accessibility-baseline/4_requirements.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0150-windows-accessibility-baseline/5_ui_prompt.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0150-windows-accessibility-baseline/6_implementation_brief.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0150-windows-accessibility-baseline/discussion_log.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/1_purpose.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/2_alternatives.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/3_scope.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/4_requirements.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/6_implementation_brief.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/discussion_log.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/task_cards.md` |
| ?? | C4 | committed | `.agent/requirements/20260812-0329-context-profiler-baseline/task-record.schema.json` |
| ?? | C4 | committed | `docs/codex-handoffs/2026-08-11-x1-s1b-hooks-context.md` |
| ?? | C4 | committed | `docs/reports/assets/context-profiler-native-baseline-2026-08-12/summary-public.json` |
| ?? | C4 | committed | `docs/reports/codex-bm25-context-gateway-assessment-2026-08-11.md` |
| ?? | C4 | committed | `docs/reports/context-budget-priority-2026-08-12.md` |
| ?? | C4 | committed | `docs/reports/context-profiler-native-baseline-2026-08-12.md` |
| ?? | C4 | committed | `docs/reports/progressive-context-route-baseline-2026-08-12.md` |
| ?? | C4 | committed | `docs/reports/windows-accessibility-baseline-2026-08-12.md` |
| ?? | C4 | committed | `docs/reports/x1-c2-context-budget-acceptance-runbook-2026-08-12.md` |
| ?? | C4 | committed | `docs/reports/x1-s1a-creation-time-sidecar-noop-2026-08-11.md` |
| ?? | C4 | committed | `docs/reports/x1-s1b-revision-aware-autonomous-noop-2026-08-11.md` |
| ?? | C4 | committed | `docs/reports/x1-t1-structured-only-transport-2026-08-12.md` |
| ?? | C4 | committed | `scripts/check-x1-t1-desktop-fixture.mjs` |
| ?? | C4 | committed | `scripts/measure-codex-rollout-usage.mjs` |
| ?? | C4 | committed | `scripts/measure-context-budget.mjs` |
| ?? | C4 | committed | `scripts/measure-progressive-context.mjs` |
| ?? | C4 | committed | `scripts/measure-x1-t1.mjs` |
| ?? | C4 | committed | `scripts/reconstruct-x1-t1-desktop-fixture.mjs` |
| ?? | C4 | committed | `src/core/retrieval-shadow.ts` |
| ?? | C4 | committed | `tests/fixtures/retrieval-shadow-corpus.ts` |
| ?? | C4 | committed | `tests/retrieval-shadow.test.ts` |
| M | C5 | restored_exact_pin | `package-lock.json` |
| M | C5 | restored_exact_pin | `package.json` |
| M | C6 | commit_with_manifest | `docs/INDEX.md` |
| M | C6 | commit_with_manifest | `docs/reports/production-update-latest.json` |
| M | C6 | commit_with_manifest | `PLAN.md` |
| M | C6 | commit_with_manifest | `PROJECT_STATUS.md` |
| M | C6 | commit_with_manifest | `README.md` |
| ?? | C9 | commit_with_manifest | `docs/codex-handoffs/2026-08-11-templates-graph-context.md` |
| ?? | C9 | commit_with_manifest | `docs/codex-handoffs/2026-08-12-context-token-fresh-task.md` |
| ?? | C9 | commit_with_manifest | `docs/codex-handoffs/2026-08-13-context-token-next-track.md` |
| ?? | C9 | commit_with_manifest | `docs/reports/delivery-boundary-checkpoint-2026-08-12.md` |
| ?? | C9 | commit_with_manifest | `docs/reports/obsidian-bases-assessment-2026-08-13.md` |
| ?? | C9 | commit_with_manifest | `docs/reports/package-manifest-repair-2026-08-13.md` |
| ?? | C9 | commit_with_manifest | `docs/reports/tsuzune-consolidation-2026-08-13.md` |
| ?? | C9 | commit_with_manifest | `docs/reports/tsuzune-priority-reset-2026-08-12.md` |
| M | C3 | committed | `src/core/graph-query.ts` |
| M | C3 | committed | `src/core/graph.ts` |
| M | C1 | committed | `src/main/ipc.ts` |
| M | C1 | committed | `src/main/settings.ts` |
| M | R1M | resolved | `src/main/vault.ts` |
| M | C1 | committed | `src/preload/index.ts` |
| M | R1M | resolved | `src/renderer/App.tsx` |
| M | C3 | committed | `src/renderer/components/WikiGraphView.tsx` |
| M | C1 | committed | `src/renderer/styles.css` |
| M | R1M | resolved | `src/shared/types.ts` |
| M | R1M | resolved | `tests/app.safety.test.tsx` |
| M | C3 | committed | `tests/graph-query.test.ts` |
| M | C3 | committed | `tests/graph.test.ts` |
| M | C1 | committed | `tests/settings.test.ts` |
| M | C4 | committed | `tests/vault.creation-times.test.ts` |
| M | C3 | committed | `tests/wiki-graph-view.test.tsx` |
| ?? | H1 | discarded | `.agent/requirements/20260812-0124-hooks-shadow-evaluation/1_purpose.md` |
| ?? | H1 | discarded | `.agent/requirements/20260812-0124-hooks-shadow-evaluation/2_alternatives.md` |
| ?? | H1 | discarded | `.agent/requirements/20260812-0124-hooks-shadow-evaluation/3_scope.md` |
| ?? | H1 | discarded | `.agent/requirements/20260812-0124-hooks-shadow-evaluation/4_requirements.md` |
| ?? | H1 | discarded | `.agent/requirements/20260812-0124-hooks-shadow-evaluation/6_implementation_brief.md` |
| ?? | H1 | discarded | `.agent/requirements/20260812-0124-hooks-shadow-evaluation/discussion_log.md` |

## Validation

Rebuild the frozen inventory with:

```powershell
git status --porcelain=v1 -uall | Where-Object { $_.Substring(3) -ne 'docs/reports/working-tree-commit-manifest-2026-08-14.md' }
```

Before staging, compare the current leaf set with this table. A new or missing path requires regenerating the manifest rather than silently assigning it to an existing bundle.
