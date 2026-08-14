# TSUZUNE Current-State Consolidation

Date: 2026-08-13 JST
Result: documentation checkpoint
Product code changed by this checkpoint: no

## Current Truth

- TSUZUNE is a one-person, Windows-first knowledge workspace whose source of truth is ordinary Markdown. It should remain useful as a daily note app without AI; external AI accesses bounded, source-backed Context through MCP.
- The installed product is TSUZUNE v0.5.0 with the last `installed-and-verified` receipt. That receipt proves the exact source fingerprint recorded there, not the current working tree.
- The development branch is `agent/tsuzune-mcp-integration` at `560b54d`. This commit contains the test-only O2-P3 classification migration prototype and is one commit ahead of the tracked origin at this checkpoint.
- At the start of this consolidation, the working tree had 96 Git status entries: 35 tracked modifications and 61 untracked entries. This checkpoint updates already-dirty entry documents and adds this report, so the post-checkpoint count is 97. It is not an installed-production claim and is not ready for a bulk commit without ownership review.
- CP1-C-03 fixed the remaining Drive Path Alias contract as a staged hybrid. O2-P4A is the only authorized next implementation slice; O2-P4B remains dependent on P4A.

## What Is Actually Complete

| Layer | Status |
|---|---|
| Product foundation | Markdown editing, search, Wiki links/backlinks, Graph, MCP read/write with revision/history boundaries, optional Google/Drive foundation, installer/update gate |
| Context work | MOC title routing, recall-safe query ordering, stable no-op writes, structured-only `build_context`; these do not prove a universal token or billing reduction |
| Classification safety | O2-P1 alias resolution, O2-P2 read-only migration inspection, O2-P3 anonymous test-only apply/rollback prototype |
| Drive alias decision | CP1-C-03 requirements complete; no product code or live Drive operation yet |
| Daily-use validation | Not complete. The planned seven-day ordinary-use dogfood has not been closed |

## Evidence Boundaries

These states must not be merged:

1. **Evidence exists** — a report, fixture, capture, or test result is present.
2. **Feature works in source** — current source and focused regression tests support the behavior.
3. **Installed production** — `production-update-latest.json` identifies the exact installed source fingerprint and passed gates.
4. **Ready for real data** — destructive or remote behavior has passed its explicit safety and rollback gates.

O2-P3 currently reaches state 2 only. CP1-C-03 is state 1. Neither authorizes a production-Vault migration or live Drive relocation.

## Working-Tree Inventory

The 96 pre-checkpoint status entries are retained without deletion or staging; this report is the additional post-checkpoint entry:

- product source, configuration, scripts, and tests accumulated across Graph, MCP, Context, write-review, and classification work;
- requirements and durable reports, including CP0/CP1 measurements and fixed contracts;
- capture assets and task handoffs that may be valid evidence rather than disposable output;
- eight likely TypeScript-emitted byproduct paths beside existing `.ts` sources (`electron.vite.config.*`, `vitest.config.*`, `scripts/m5-dogfood.*`, and `scripts/measure-large-vault-core.*`). These are candidates for a separate ownership review, not automatic deletion.

The repository already contains 560 files under `docs/reports` (about 34.53 MiB), of which 500 files (about 31.22 MiB) are assets. This is still manageable, but future evidence should be indexed by decision value rather than added to the current-development list indiscriminately.

## Priority Order

1. **P0 — Preserve a truthful checkpoint.** Keep installed production, HEAD, dirty source, and evidence status separate. Review the 96 status entries by ownership before any commit, cleanup, push, or production update.
2. **P1 — O2-P4A only.** Implement exact-byte Path Alias sidecar synchronization against a test-owned fake remote, with unique ownership, preview/apply revalidation, conflict handling, ledger state, and rollback-safe local replacement. Stop before remote relocation, live Drive, UI, MCP, or production apply.
3. **P1 — Seven-day daily-use dogfood.** Use normal notes without adding features; record friction in capture, retrieval, navigation, and AI handoff. This determines whether classification remains the right product priority.
4. **P2 — O2-P4B only if P4A passes.** Add explicit plan-driven metadata-only relocation by existing Drive file ID. Do not infer moves from hashes or equal content.
5. **Held until measured:** X1-C2 Context Budget, BM25/cache/task-state, Hooks/co-occurrence ranking, Excluded-files parity remainder, Graph parity backlog, Google intake, ChatGPT candidate apply, and new databases.

## Stop Conditions

- Do not apply classification migration to the production Vault.
- Do not call live Drive or expand OAuth scope during O2-P4A.
- Do not claim token, cost, or quality improvement from wire bytes or one matched pair.
- Do not clean, commit, push, or reinstall the current 96-entry working tree as one undifferentiated change.

## Next Verification

For this documentation-only checkpoint, validate Markdown links and `git diff --check`. Before the next product-code checkpoint, re-establish a bounded diff and rerun the focused tests, typecheck, full single-worker suite, MCP smoke, and only then the production update gate if installation is explicitly intended.
