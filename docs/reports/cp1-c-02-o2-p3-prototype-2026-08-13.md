# CP1-C-02 O2-P3 Anonymous Apply/Rollback Prototype

Date: 2026-08-13 JST
Result: `pass`
Task type: implementation (test-only prototype)
Frozen contract: `.agent/requirements/20260813-0133-o2-p3-anonymous-apply-rollback/4_requirements.md` (CP1-C-01)

## Conclusion

The O2-P3 test-only prototype was implemented under the frozen contract and proven on an
anonymous temporary Vault. One validated schema-v1 classification plan now round-trips
exactly: apply rewrites only resolved path-qualified Wiki links in active writable notes,
preserves `40_情報源` and `50_履歴` bytes, moves the planned files, and merges the Path Alias
sidecar; explicit rollback and automatic rollback after every injected mutation-stage
failure restore the complete original tree (file list, bytes, paths, sidecar presence/bytes,
and directory set).

`REFERENCE_REWRITE_NOT_APPLIED` and `ROLLBACK_PREIMAGES_NOT_CAPTURED` are now prototype-proven
at fixture scope. The only remaining classification blocker is `DRIVE_PATH_ALIAS_UNSUPPORTED`.
No production apply entry point, app route, MCP tool, package command, Drive flow, installed
binary, or production Vault change was made.

## Implementation

- `src/cli/classification-migration-prototype.ts` (new, test-only): ownership-token guard,
  preimages-dir-outside-Vault guard, symlink-rejecting tree snapshot, dry-run preflight reuse,
  durable rollback packet captured outside the Vault before the first mutation, four ordered
  mutation stages (directories → references → moves → sidecar), applied-state verification
  (moved bytes, immutable bytes, alias resolution, Wiki resolution outcomes, Graph node/edge
  sets, Context included/warning sets, MCP-ID resolution), reverse-order rollback with exact
  sidecar-byte restore and newly-created-empty-directory cleanup, idempotent double rollback,
  and automatic rollback on any failure including injected failpoints.
- `src/core/links.ts` (+13 lines, additive only): exported `transformWikiLinks`, which reuses
  the existing fence/code-span-aware Markdown walker so rewriting never touches code blocks,
  inline code, or unrelated text. No existing behavior changed and no product caller uses it.
- `tests/classification-migration-prototype.test.ts` (new, 15 tests): happy-path apply +
  explicit rollback + double rollback; exact rewrite of fragments/display aliases/basename and
  unrelated links; existing-sidecar exact-byte round-trip; absent-sidecar create/remove;
  preflight drift and collision fail-closed with zero writes; unowned-root and missing-marker
  fail-closed; preimages-inside-Vault fail-closed; symlinked root rejected (skipped when the OS
  cannot create directory symlinks); one injected failure per mutation stage with exact
  automatic restoration.

## Verification

- `npm run typecheck`: PASS (tsconfig.node.json + tsconfig.web.json)
- Focused regression: classification-migration-preview, path-aliases, links, graph, context,
  vault.atomic, prototype — 7 files / 106 tests PASS
- Full suite (6 GiB heap, `--maxWorkers=1`, the established OOM-free gate): 58 files / 524
  tests PASS. The default 4 GiB worker run reproduced the known worker OOM
  ("Worker exited unexpectedly"), consistent with the documented CP1-A/CP1-B behavior.
- `git diff --check`: PASS
- Diff scope: `src/core/links.ts` (+13) modified; two new files added; no `package.json`,
  app IPC/preload/renderer, MCP, Drive sync, installer, or production script touched.

## Acceptance Trace

- Fixture boundary: unowned/mis-token roots and symlink roots fail before any write; the test
  owns the temp root and cleanup removes its artifacts.
- Preflight/preimages: drift, collision, malformed plan, and unsafe paths leave the tree
  byte-identical; the rollback packet is written outside the Vault before the first mutation
  and captures moved sources, rewritten reference files, prior sidecar bytes or absence, and
  the pre-existing directory set.
- Apply: only the path component of resolved path-qualified links changes; immutable notes
  stay byte-identical; sources absent, destinations present with identical bytes, nothing
  overwritten; existing sidecar entries preserved and validated through `compilePathAliases`;
  absent sidecar creates exactly one; applied Wiki/Graph/Context/MCP-ID projections verified.
- Rollback: full tree equality; second rollback is a no-op ("already-restored"); pre-existing
  sidecar restored with its exact original bytes; unrestored items are reported with relative
  paths and the packet is never deleted on failure.

## CP1 Observation Boundary

- This is one natural bounded continuation task (CP1-C sample after CP1-B 3/3), not a
  generalized fresh-task savings claim.
- Host model-visible token, cached-input, and billing values are `not_observable` from this
  host (Freebuff does not expose per-task rollout usage), so no input/output/cost reduction is
  claimed. The CP1-C-02 record in `work/context-profiler/records/` keeps this explicit.
- No BM25, FTS, embeddings, GraphRAG, Hooks ranking, persistent cache, or agent runtime was
  added.

## Remaining Boundary

- `DRIVE_PATH_ALIAS_UNSUPPORTED` stays open: the alias sidecar is not propagated by Drive, so
  production apply remains forbidden. Drive sidecar synchronization / remote rename semantics
  are a separate gate and were not decided here.
- The prototype remains test-only: no production command, UI, MCP tool, or migration workflow
  exists. Converting it into an authorized production workflow requires a separate decision.

## Next Step

Leave the prototype test-only. The next natural gate is the Drive Path Alias sidecar contract,
which decides whether Drive synchronizes the alias sidecar or replaces local aliases with
remote rename semantics — then, and only then, a separately authorized production apply
workflow may be designed.

## Independent Review Hardening

The first independent integration review found that the initial packet did not yet contain
the created-directory set and that direct rollback did not revalidate the owned-Vault and
packet boundaries. The implementation was hardened before integration:

- the complete planned directory set is now stored in the initial packet before the first
  Vault mutation; all packet rewrites between mutation stages were removed;
- rollback now requires the ownership token and validates the Vault binding, packet location
  outside the Vault, non-symlink file status, schema, and every mutation-driving relative path;
- rollback outcomes now include the failpoint and restored fingerprint, including in the
  machine-readable failpoint error;
- regression coverage now checks the complete initial packet, unowned rollback rejection,
  and unsafe packet-path rejection before any additional Vault write.

The hardened result remains fixture-only and does not change the Drive or production boundary.
