# Canonical plan: code-review-graph read-only Gate 0

## Task contract

- **objective:** Evaluate `code-review-graph==2.3.8` against the current TSUZUNE TypeScript source in an isolated, read-only snapshot and decide whether a larger 10–20 task A/B is justified.
- **deliverables:** frozen ground truth for three impact paths; reproducible snapshot/build/query evidence; baseline-versus-CRG scorecard; independent verification; final decision and, only if canonical state changes, one TSUZUNE execution record plus the minimum affected roadmap update.
- **constraints:** preserve the dirty working tree and all untracked current source; do not run CRG `install`; do not change Codex/MCP settings, Hooks, daemon state, embeddings, product code, production TSUZUNE binary, or remote state; do not send code to an embedding provider; pin CRG to 2.3.8; keep generated graph data and Python environment outside the repository.
- **success:**
  1. An isolated Git snapshot containing the current `src`, `tests`, `scripts`, and project configuration builds a CRG 2.3.8 graph without modifying the source checkout.
  2. CRG output for all three frozen symbols is scored against independently verified direct callers and direct test references, with every omission and unsupported relation explicit.
  3. Build/update time, query evidence, false negatives, and baseline exploration are sufficient to decide `advance to 10–20 A/B` or `return to Held` without relying on CRG's own benchmark claims.
- **lane:** Orchestrated. Ground-truth audit, isolated execution, and independent scoring are separate packets; the parent owns snapshot safety, integration, decision, and all TSUZUNE writes.
- **evidence:** `results/ground-truth.md`, `results/environment.md`, `results/crg-raw-evidence.md`, `results/scorecard.md`, `results/independent-verification.md`, `final-report.md`, plus command exit codes and elapsed times recorded there.
- **stop:** Stop and return to Held if a critical direct caller or direct test is omitted, the graph cannot parse/build the bounded TS/TSX snapshot, freshness cannot be demonstrated safely, setup/schema overhead dominates the three-case benefit, or further progress requires product/config/runtime mutation.

## Frozen cases and scoring contract

The ground-truth packet may correct a path only when current source evidence proves the correction; it may not relax scoring after CRG results are seen.

1. `searchRendererRanked`
   - expected direct production references: `src/renderer/App.tsx`, `src/renderer/components/QuickSwitcherDialog.tsx`, `src/mcp/service.ts`
   - expected direct test references: `tests/search.test.ts`, `tests/renderer-search-query.test.ts`
2. `buildWikiGraphForView`
   - expected direct production references: `src/renderer/App.tsx`
   - expected direct test references: `tests/graph.test.ts`
   - transitive impact candidates, scored separately from direct recall: `src/core/graph-groups.ts`, `src/core/graph-geometry.ts`, `src/core/graph-timeline.ts`, `tests/graph-geometry.test.ts`, `tests/graph-layout.test.ts`
3. `buildContextBundle`
   - expected direct production references: `src/mcp/service.ts`, `src/mcp/link-ops.ts`, `src/cli/classification-migration-preview.ts`, `src/cli/classification-migration-prototype.ts`
   - expected direct test references: `tests/context.test.ts`
   - indirect behavior-test candidate, scored separately from direct recall: `tests/mcp-service.test.ts`

For each case record production-reference recall, test-reference recall, false positives, command/tool round trips, returned character count when measurable, and elapsed time. A **critical false negative** is any frozen expected production or test file absent from every CRG query result used for that case. Text-search baseline is exact-symbol `rg`; it is a reproducible direct-reference baseline, not a complete semantic review baseline. Token counts are not cost evidence.

## Execution

1. [x] Freeze current-source ground truth and repository safety boundary.
2. [x] Build a tracked isolated snapshot and CRG 2.3.8 graph; record cold build cost.
3. [x] Run exact-symbol baseline and CRG impact/context queries for the three cases.
4. [x] Make one harmless source-only snapshot edit and record incremental refresh/freshness behavior, then restore only the disposable snapshot.
5. [x] Score results and obtain an independent read-only verification.
6. [x] Verify workflow artifacts and synchronize one execution record plus the affected roadmap row to production TSUZUNE; confirm fresh runtime, read-back, unique search, and backlinks.
