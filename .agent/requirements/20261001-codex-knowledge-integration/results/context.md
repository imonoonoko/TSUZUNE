# CONTEXT result

Implemented `buildContextSetFromSnapshot(snapshot, canonicalSeeds, options)` in `src/mcp/context-set.ts`.

- Validates 1–8 requested canonical documents and integer budget 1000–100000; deduplicates canonical paths; rejects any absent seed before building. Service resolves aliases/request IDs before invocation.
- One shared index from one supplied VaultSnapshot; existing candidate, temporal, MOC, Japanese section-projection logic reused through `buildContextBundleFromSnapshot` and an internal rendered-source callback.
- Fair seed-first allocation, then round-robin related selection with fair remaining allocation. One body per canonical note, optional supplied source revision in metadata and Markdown. Revision callback omitted means no inferred revision.
- Source modes, full note omissions, source/seed included and omitted headings, truncated/content-omitted flags, owners and per-seed lineage/warnings are explicit. Markdown heading parser handles ATX/Setext and excludes fences. Partial final heading line is conservatively excluded from receipt.
- Existing single-seed return contract unchanged. Existing dirty getOutgoingLinks source-path fixes in core/context were preserved.

Verification: `npx.cmd vitest run tests/mcp-context-set.test.ts tests/context.test.ts --maxWorkers=1` PASS (63 tests, 2 files); `npm.cmd run typecheck` PASS. First typecheck briefly saw concurrent newly-created local-graph.ts before its include was refreshed; rerun passed without config edits. New set suite has 8 meaningful cases: dedup/revisions/owners, missing/limits, fair Japanese/large budgets, query sections, isolated state lineages, Setext/fence attribution, temporal knowledge omission, tiny 8-seed budget honesty.

Ponytail and focused Ponytail review applied: existing allocators/parsers reused, no dependencies/runtime/storage added; no further abstraction needed. Source/fixture evidence only. Service/server/catalog, actual Codex acceptance, full gate, installed delivery and production Vault integration belong to parent. At budget 1000 with eight sources metadata envelopes may not fit; omitted seeds are explicitly reported rather than claiming body acquisition.

Requested model: gpt-6.1-sol / medium; actual model not observable in worker tools.

## Independent review correction (2026-10-01)

Fixed duplicate-title section attribution: core projection callback now supplies exact original heading source offsets in emitted heading order. Original spans survive parent-heading generation, body clipping, frontmatter and stripped indentation. Context-set receipts compare original offsets, label duplicate headings by occurrence and source line, and report missing occurrences separately. No prefix/text matching inference is used; old single-seed returned bundle shape remains unchanged.

Fixed missing Markdown omission marker for budget-clipped query projections: reserve marker space whether clipping happens in core projection or context-set rendering; emitted Markdown and truncated receipts now agree within the requested character cap.

Added three regressions: later duplicate omitted, later duplicate selected with identical body prefix, and nested/indented projected branch with frontmatter (both child query and parent branch query). Focused old+new suite PASS 66 tests / 2 files. Typecheck passed at 05:07; latest run at 05:08 temporarily blocked only by concurrently edited parent-owned `tests/mcp-knowledge-service.test.ts` field names (seed_id/id). Parent notified; final integrated typecheck belongs to parent if this mismatch remains at handoff.
