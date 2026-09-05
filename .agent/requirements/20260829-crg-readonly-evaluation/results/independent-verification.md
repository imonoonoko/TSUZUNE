# Packet 03 independent verification

Verifier: Zeno (`crg_primary_source_audit`). The verifier had read-only ownership of evidence recomputation and an unseen-boundary source check; it did not edit files, run CRG, access TSUZUNE, or mutate product/config/runtime state.

## Verdict

**PASS.** The evidence supports the scorecard and the predeclared decision to return the candidate to Research/Held without starting the 10–20 task A/B.

## Independent recomputation

- Standard production recall: `(3 + 1 + 4) / (3 + 1 + 4) = 8/8 = 100%`.
- Standard test-file recall: `(2 + 1 + 1) / (2 + 1 + 1) = 4/4 = 100%`.
- Minimal production recall: `(3 + 1 + 3) / 8 = 7/8 = 87.5%`.
- Minimal test-file recall: `(2 + 1 + 1) / 4 = 4/4 = 100%`.
- The minimal-route omission is `src/mcp/service.ts` for `buildContextBundle`; the two valid `scripts/m5-dogfood.*` callers are outside the frozen `src/tests` scoring scope and do not change the arithmetic.

## Unseen-boundary check

Current `src/core/context.ts` contains the sibling wrapper `buildContextBundleFromSnapshot`; both it and `buildContextBundle` dispatch to the private `buildContextBundleInternal`. Current `scripts/m5-dogfood.ts` directly imports and invokes both public APIs. This confirms a wrapper/indirect surface outside the frozen exact-reference set, but it neither rescues the compact caller omission nor changes frozen direct-reference scoring.

## Decision pressure test

- Standard output is materially larger than exact `rg` for this three-case direct-reference workload; no compact-context advantage was measured.
- The stale deleted symbol survived a clean source restore while CRG reported `status: ok` and `head_matches_build: true`; the subsequent incremental update parsed zero files. This is a freshness/safety failure and directly triggers the frozen stop rule.
- The minimal-route critical false negative independently triggers the other frozen stop rule.

## Required qualifications

- Standard recall is 100% only for these three frozen symbols in this bounded snapshot; it is not a general CRG accuracy claim.
- Exact-symbol `rg` does not prove aliases, renamed imports, dynamic dispatch, transport reachability, or runtime propagation.
- CRG flow analysis was skipped and its quality was not measured by this Gate 0.
- A larger A/B remains unrun by design because Gate 0 met two stop conditions.

