# Gate 0 scorecard

## Direct-reference correctness

| Case | Standard CRG production recall | Standard CRG test-file recall | Minimal CRG production recall | Minimal CRG test-file recall |
|---|---:|---:|---:|---:|
| `searchRendererRanked` | 3/3 | 2/2 | 3/3 | 2/2 |
| `buildWikiGraphForView` | 1/1 | 1/1 | 1/1 | 1/1 |
| `buildContextBundle` | 4/4 | 1/1 | **3/4** | 1/1 |

- Standard relationship queries reached 100% frozen file-level recall in all three cases and found two valid additional script callers.
- Compact queries had one critical false negative: `src/mcp/service.ts` for `buildContextBundle`.
- Standard output avoided that omission but was substantially larger than exact `rg`, especially for heavily tested functions.

## Operational score

| Criterion | Result | Gate effect |
|---|---|---|
| isolated build | PASS: 12.466 s, 283 parsed files | technically viable |
| direct standard recall | PASS: 100% across 3 cases | useful structural evidence |
| compact direct recall | FAIL: 1/8 production caller files omitted overall | critical false negative |
| compact context size | MIXED: 0.5–2.2k chars/call, but 2–3 relationship calls plus ~1.35 s startup | no demonstrated advantage over one `rg` for these cases |
| standard context size | FAIL for efficiency: 14k–104k chars for relationship pairs; impact capture >120k chars | overhead dominates bounded direct lookup |
| freshness after ordinary edit | PASS only with explicit update: 871 ms | manageable when every change is known |
| freshness after restore to indexed commit | **FAIL**: stale deleted symbol survived; `status: ok`, `head_matches_build: true`, later update parsed 0 files | predeclared stale-index kill criterion |
| source safety | PASS: external graph/venv, no product/config/runtime mutation; snapshot 303/303 hashes intact | isolation works |
| privacy boundary | PASS for this trial: no embeddings/cloud; outputs include absolute local paths | future integration would still need local-path handling |

## Decision

**Return to Research/Held; do not start the 10–20 task A/B.**

The graph parser itself is promising: full relationship queries were correct on the frozen direct-reference sets and exposed function/test structure plus two real script callers. But the evaluated value proposition was a compact, safe routing layer. That route omitted a critical MCP caller, while the complete route cost more context than exact search. More importantly, a clean-tree restore left a ghost symbol that CRG declared current and incremental update could not remove. This directly meets the predeclared stale-index stop condition.

Reactivation requires evidence that the stale restore/rebase case is fixed or a bounded wrapper proves content-hash parity and forces a rebuild when graph/source diverge. A future trial must also provide a compact paginated/file-level caller result that cannot silently omit expected files. Passing those prerequisites would reopen the 10–20 matched-task A/B; it would still not authorize CRG `install`, Hooks, daemon, embeddings, or production wiring.

