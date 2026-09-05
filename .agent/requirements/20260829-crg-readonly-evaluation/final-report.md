# Final report: TSUZUNE code-review-graph read-only Gate 0

## Outcome

**Decision: Return to Research/Held; do not start the 10–20 task A/B.**

CRG 2.3.8 built and its standard relationship queries were correct for all three frozen cases, but the compact route omitted one critical production caller and the graph retained a deleted ghost symbol after a source restore while declaring itself current. Both conditions meet the task's predeclared stop rules.

## What the trial established

- Isolated build: 283 supported files parsed in 12.466 seconds from a 303-file current-source snapshot.
- Standard direct-reference result: production 8/8 and test files 4/4 across the three frozen symbols.
- Useful extra evidence: two real `scripts/m5-dogfood.*` direct callers outside the frozen `src/tests` scoring scope.
- Compact direct-reference result: production 7/8 and test files 4/4; `src/mcp/service.ts` was omitted for `buildContextBundle`.
- Standard query size: 14,007–104,123 characters per caller/test pair in the tested cases; standard impact captures exceeded 120,000 characters.
- Freshness: an explicit edit updated in 871 ms, but restoring that edit left a ghost node; CRG reported `status: ok`, `head_matches_build: true`, and a later update parsed zero files.

These measurements do not generalize to CRG overall. They cover three frozen TypeScript symbols, exact direct-reference scoring, and one restore-shaped freshness probe. Flow/community analysis, aliases, dynamic dispatch, runtime propagation, and the 10–20 matched-task A/B remain unmeasured.

## Independent verification

Zeno independently recomputed standard production recall as 8/8, compact production recall as 7/8, and all test-file recall as 4/4. It also checked the sibling `buildContextBundleFromSnapshot` wrapper and the shared `buildContextBundleInternal` path in current source. Verdict: PASS for the evidence and Held decision, with no broader accuracy claim.

## Safety and changes

- No CRG `install`, Codex/MCP registration, Hook, daemon, embedding provider, product code, production binary, or remote state was changed.
- The original dirty worktree was preserved; concurrent unrelated changes were not included in the snapshot result.
- Repository writes are limited to this workflow directory.
- The disposable snapshot, CRG graph, and Python environment are removed after evidence verification.
- Shipped product code did not change, so `npm run production:update` is not applicable.

## Persistence status

The repository decision/evidence packet and production TSUZUNE synchronization are complete. After the user restart, `runtime_info` reported server/package `0.6.0`, profile `direct`, and `stale_runtime: false`.

- created `30_知識/TSUZUNE-code-review-graph隔離Gate0評価-実施記録-2026-08-29.md`
- patched `30_知識/TSUZUNE-MCP改善案-2026-08-13.md` once, changing the external Code Graph candidate to `Gate 0評価完了・Research/Held` with the measured reactivation conditions
- fetched both notes, found the execution record by its unique subject, and verified its backlink from the roadmap
- preserved the roadmap's previous version in TSUZUNE-managed AI update history

No unsynchronized item remains. Detailed read-back evidence is in `results/tsuzune-writeback.md`.

After synchronization and read-back had finished, a later build update made the same MCP process stale again. The committed note revisions and backlinks remain verified, so this does not reopen the Gate 0 work; it only means a future, separate Vault mutation must refresh the runtime first.

## Reactivation condition

Reopen this candidate only after both are demonstrated in isolation:

1. a content-hash divergence guard or upstream behavior forces a verified rebuild after restore/rebase-shaped source changes; and
2. compact file-level caller/test results cannot silently omit expected callers, for example through complete pagination.

Even then, `install`, Hooks, daemon, embeddings, and production wiring remain separately gated.

## Agent evidence

- Archimedes: read-only decision-pressure test and measurement-format audit; criteria adopted, prior telemetry not reused.
- Faraday: read-only current-source ground truth and repository-fit audit; corrected frozen sets adopted.
- Zeno: read-only primary-source audit and independent final verification; qualifications and Held verdict adopted.
- Parent Codex: isolation, measurements, freshness probe, integrity check, integration, and persistence packet.
