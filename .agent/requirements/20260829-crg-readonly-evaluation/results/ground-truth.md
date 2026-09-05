# Frozen direct-reference ground truth

Frozen before CRG query results were inspected. Faraday (`tsuzune_repo_fit`) performed the read-only source audit; the parent adopted the file sets below and corrected the provisional plan before scoring.

## `searchRendererRanked`

- declaration: `src/core/search.ts:241`
- direct production files: `src/renderer/App.tsx` (import 32, call 1168), `src/renderer/components/QuickSwitcherDialog.tsx` (2, 63), `src/mcp/service.ts` (18, 641)
- direct test files: `tests/search.test.ts` (2, 99, 106, 114), `tests/renderer-search-query.test.ts` (7, 104, 109)
- excluded: `tests/search-evaluation-script.test.ts:60` contains a property-shaped string, not an import/call of the symbol.

## `buildWikiGraphForView`

- declaration: `src/core/graph.ts:269`
- direct production files: `src/renderer/App.tsx` (import 15, call 1201)
- direct test files: `tests/graph.test.ts` (5, 90, 94, 98, 109)
- transitive impact candidates, not direct-reference ground truth: `src/core/graph-groups.ts`, `src/core/graph-geometry.ts`, `src/core/graph-timeline.ts`, `tests/graph-geometry.test.ts`, `tests/graph-layout.test.ts`.

## `buildContextBundle`

- declaration: `src/core/context.ts:429`
- direct production files: `src/mcp/service.ts` (2, 1271), `src/mcp/link-ops.ts` (1, 163), `src/cli/classification-migration-preview.ts` (13, 450), `src/cli/classification-migration-prototype.ts` (26, 667)
- direct test files: `tests/context.test.ts` (import 3 and many direct calls beginning at 30)
- indirect behavior-test candidate, not direct-reference ground truth: `tests/mcp-service.test.ts`.

## Unknown boundary

Exact-symbol search does not prove renamed imports, wrappers, dynamic dispatch, MCP transport reachability, or runtime state propagation. CRG may receive separate credit for evidence-backed transitive impact candidates, but those candidates do not alter direct-reference recall or rescue a direct false negative.

