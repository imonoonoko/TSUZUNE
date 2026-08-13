# CP1-C-01 O2-P3 Anonymous Apply/Rollback Requirements

Date: 2026-08-13 JST
Result: `pass`
Task type: requirements / knowledge
Product code changed: no

## Conclusion

The next classification gate is fixed as a test-only O2-P3 prototype over an anonymous temporary Vault. It must apply one existing schema-v1 O2-P2 plan, rewrite only active writable references, preserve `40_情報源` and `50_履歴` bytes, add validated Path Aliases for immutable old links, and restore the complete original tree after explicit rollback and every injected mutation-stage failure.

This checkpoint does not authorize production apply. `DRIVE_PATH_ALIAS_UNSUPPORTED` remains open, so no app, MCP, CLI package command, Drive flow, installed binary, or production Vault was changed.

The implementation-ready contract is [O2-P3 requirements](../../.agent/requirements/20260813-0133-o2-p3-anonymous-apply-rollback/4_requirements.md), with the minimal technical route in the adjacent `6_implementation_brief.md`.

## Verified Preflight

- Worktree: `C:/Users/Humin/.codex/worktrees/2196/TSUZUNE`
- HEAD: `5266131f6e2c38afc39b46fe9083c9e1fef39577`
- Branch: detached
- Initial status: clean
- Root manifest: `tsuzune` `0.5.0`, private, with `production:update`
- The clean checkout contains the older tracked production receipt. Read-only comparison confirmed that the dirty source repository and the handoff worktree both contain the handoff's latest receipt: `installed-and-verified`, verified at `2026-08-12T16:06:46.671Z`, based on HEAD `5266131` with a dirty source fingerprint.
- The dirty source worktree was read only and remains outside this task's write boundary.

## Targeted Knowledge Retrieval

1. Searched and fetched `10_プロジェクト/TSUZUNE.md` for the current project state.
2. Searched `O2-P2` and built a bounded context from `40_情報源/TSUZUNE分類移行Dry-run-O2-P2-2026-08-10.md` because the task required multiple evidence sources and provenance.
3. The bundle retained the three blockers and the explicit next-gate choice without introducing retrieval architecture.

## Alternatives

| Option | Decision | Reason |
|---|---|---|
| Keep O2-P2 read-only | Not selected | Safe but leaves both local proof gaps open. |
| Test-only anonymous prototype | Selected | Exercises real mutations and rollback without a production entry point. |
| Production-capable migration command | Rejected for this gate | Drive and failure recovery are not yet proven for production use. |

## Fixed Boundary

- The integration test owns and creates the temporary root.
- Existing O2-P2 parsing, validation, projections, link resolution, and Path Alias compilation are reused.
- Rollback preimages are captured outside the fixture Vault before the first mutation.
- Whole-tree relative paths, bytes, sidecar bytes or absence, and directory membership must round-trip exactly.
- One failpoint follows each mutation class: directory creation, active-reference replacement, move, and alias-sidecar replacement.
- Passing O2-P3 may close only `REFERENCE_REWRITE_NOT_APPLIED` and `ROLLBACK_PREIMAGES_NOT_CAPTURED` at prototype scope.
- Drive design and production apply remain separate tasks.

## Verification

The first targeted test command stopped before test discovery because the fresh clean worktree did not yet contain `node_modules`. `npm ci` restored the lockfile-pinned dependencies in this worktree only. The unchanged command then passed:

```text
npm test -- tests/classification-migration-preview.test.ts tests/path-aliases.test.ts tests/links.test.ts tests/graph.test.ts tests/context.test.ts tests/vault.atomic.test.ts

Test Files  6 passed (6)
Tests       91 passed (91)
```

`git diff --check` passed. Ponytail review found no speculative runtime surface in the requirements diff: no new dependency, abstraction, app route, MCP tool, Drive path, or production command was proposed.

## CP1 Observation Boundary

- This is one natural bounded task, not a generalized fresh-task saving estimate.
- Input, cached input, output, reasoning, token events, tool calls, retries, and result are recorded in `work/context-profiler/records/CP1-C-01.json`.
- Actual billing cost, per-source rereads, and cache discount remain unobserved.
- No BM25, FTS, embeddings, GraphRAG, Hooks ranking, persistent cache, or agent runtime was added.

## Next Step

Implement the O2-P3 test-only prototype from the frozen requirements in a separate clean task. Stop when anonymous round-trip and failpoint checks pass and the only remaining classification blocker is `DRIVE_PATH_ALIAS_UNSUPPORTED`.
