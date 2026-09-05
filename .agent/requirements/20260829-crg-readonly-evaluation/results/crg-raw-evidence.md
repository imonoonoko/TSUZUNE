# CRG Gate 0 command evidence

This is a reduced, durable record of command outputs. Absolute temp paths are normalized to snapshot-relative paths; large JSON bodies are not copied into the repository.

## Exact-symbol baseline

Command: `rg -n --no-heading --color never -w -F <symbol> src tests`.

| Symbol | Exit | Warm-run elapsed | Output | Lines |
|---|---:|---:|---:|---:|
| `searchRendererRanked` | 0 | 137 ms | 1,500 chars | 15 |
| `buildWikiGraphForView` | 0 | 30 ms | 576 chars | 8 |
| `buildContextBundle` | 0 | 28 ms | 6,299 chars | 71 |

The first timing includes the first `rg` process/cache start in this sequence. These are direct-reference measurements, not whole-review token or quality measurements.

## Standard CRG relationship queries

Commands: `query callers_of <target>` and `query tests_for <target>`. `buildContextBundle` first returned `status: ambiguous` because a test helper signature mentioned the name; its returned disambiguation qualified name was then used.

| Symbol | Caller nodes | Test nodes | Practical query output | Unique returned files |
|---|---:|---:|---:|---|
| `searchRendererRanked` | 8 | 9 | 16,838 chars | `src/mcp/service.ts`; `src/renderer/App.tsx`; `src/renderer/components/QuickSwitcherDialog.tsx`; `tests/renderer-search-query.test.ts`; `tests/search.test.ts` |
| `buildWikiGraphForView` | 2 | 16 | 14,007 chars | `src/renderer/App.tsx`; `tests/graph.test.ts` |
| `buildContextBundle` | 54 | 48 | 104,123 chars including one disambiguation response | `scripts/m5-dogfood.js`; `scripts/m5-dogfood.ts`; `src/cli/classification-migration-preview.ts`; `src/cli/classification-migration-prototype.ts`; `src/mcp/link-ops.ts`; `src/mcp/service.ts`; `tests/context.test.ts` |

The two `m5-dogfood` results were checked against current source and are valid extra direct callers outside the frozen `src/tests` scoring scope. Standard output includes node boundaries, kinds, call lines, edge confidence, and direct/indirect test classification; this is richer than `rg`, but 11–24 times larger for the first two cases and about 16.5 times larger for `buildContextBundle`.

File-level `impact --depth 2 --max-results 50` was not compact: all three captures exceeded the app's 120,000-character capture boundary. CRG reported 165, 246, and 106 total impacted nodes respectively while returning only 50. The capture layer estimated roughly 34.7k, 45.3k, and 52.0k output tokens; these are not billing data and are used only to show that standard impact output was not a token-saving route here.

## Filtered MCP route

The server exposed only `get_minimal_context_tool`, `query_graph_tool`, and `get_impact_radius_tool`. No settings were registered and no daemon/watch process ran.

- stdio server initialize: 1,351–1,396 ms per fresh process
- `get_minimal_context_tool`: 108–114 ms, 537–547 chars per case
- `query_graph_tool` minimal: 43–53 ms per call, 1,085–2,195 chars
- `get_impact_radius_tool` minimal: 135–170 ms, 647–655 chars

Minimal relationship output hard-capped the result list at five even when `max_results: 100` was requested:

| Symbol | Minimal caller/test union | Direct production recall | Direct test-file recall | Omission |
|---|---|---:|---:|---|
| `searchRendererRanked` | all five frozen files across two calls | 3/3 | 2/2 | lower-ranked test nodes omitted, but both frozen test files remained represented |
| `buildWikiGraphForView` | both frozen files | 1/1 | 1/1 | 11 indirect test nodes omitted |
| `buildContextBundle` | five caller entries plus `tests/context.test.ts` | 3/4 | 1/1 | **`src/mcp/service.ts` was omitted**; 49 caller nodes and 43 test nodes were summarized away |

Name-only `buildContextBundle` also required a 2,195-character disambiguation response before the qualified query. `get_minimal_context_tool` returned graph statistics, risk, five key entities, and freshness metadata, but not a caller/test list. Minimal impact returned only counts and five key entities, not affected file names. Neither compact tool can recover the omitted direct MCP caller.

## Incremental freshness probe

1. Added one disposable `crgFreshnessProbe` function to snapshot `src/core/search.ts`.
2. Before update, graph search returned zero matches.
3. `update --skip-flows` exited 0 in 871 ms, reported one file/13 nodes/137 edges updated, and graph search then found the new function.
4. Restored the disposable file exactly to snapshot `HEAD`; snapshot Git status became clean while the graph still contained the probe.
5. `get_minimal_context_tool` returned `status: ok` and `_graph.head_matches_build: true`, although graph search still returned the deleted probe.
6. A second `update --skip-flows` exited 0 in 612 ms but reported zero files updated; the deleted probe remained in the graph.

This demonstrates a stale-index false positive after a working-tree edit is indexed and then restored to the same commit. Commit equality did not detect content divergence, and ordinary incremental update did not remove the stale node once Git diff was clean. A full rebuild or additional content-hash wrapper would be required to recover safely; neither is part of the tested compact route.

The one-commit fixture also emitted `git diff ... HEAD~1` warnings inside minimal-context calls. Explicit changed files still produced results, so this fixture-specific warning is not the decision trigger.

