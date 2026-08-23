# `build_context` transport pre-implementation design — 2026-08-22

Status: research complete / product implementation not started

## Decision

Do not restore global structured-only transport (`content: []`) as the next product change.

The current `text block + structuredContent` shape is not an accidental regression. It is the intentional compatibility contract adopted on 2026-08-16 after Freebuff treated a structured-only `build_context` result as empty. The 2026-08-22 context-efficiency review compared the current dirty worktree with Git `HEAD` and the older X1-T1 acceptance, but did not incorporate the superseding 2026-08-16 and 2026-08-19 decisions. Its P1 classification is therefore not implementation authority.

If independent task evidence later justifies revisiting transport duplication, the smallest isolated candidate is a complementary text projection: keep full `structuredContent`, while `content[0].text` contains the Context Markdown plus only the warnings and omission state required by content-only clients. This is a research candidate, not an approved product contract.

## Goal

Reduce avoidable transport duplication only when all supported hosts can still complete the same task with the same source trace, temporal safety, omission visibility, and write boundary.

The optimization unit is a successful task, not a smaller MCP call.

## Current evidence

### Current worktree

- `src/mcp/server.ts` has one `textResult` helper. It serializes the same object into one text block and `structuredContent`.
- `build_context` calls `VaultMcpService.buildContext(...)` and passes its result through `textResult`.
- `src/mcp/service.ts` owns Context selection and source descriptors. It does not own transport shape and should remain unchanged by a transport-only experiment.
- `scripts/check-mcp.mjs` requires a non-empty text block for `build_context`.
- `scripts/check-mcp-freebuff.mjs` checks the Freebuff tool catalog and runtime profile but does not call `build_context`. This is the current coverage gap.
- `docs/mcp-integration.md` explicitly records the `text block + structuredContent` contract and the Freebuff reason.

### Git and production boundaries

- Git `HEAD` (`5a9443d`) still contains the older X1-T1 `structuredOnlyResult` helper and `content.length === 0` smoke assertion.
- The dirty worktree contains the later compatibility correction plus many unrelated changes. `HEAD` is historical baseline, not sufficient evidence that structured-only is current intent.
- The running production MCP reports version `0.5.0`, profile `direct`, and `stale_runtime: false`.
- `delivery_info` currently reports `mismatch`. No future implementation may claim source/installed equivalence until a fresh baseline is frozen and the normal production gate succeeds.

### Historical evidence

- X1-T1 on 2026-08-12 showed that structured-only reduced its fixture JSON-RPC wire from 2,761 to 1,252 bytes, with answer quality 4/4, source trace 3/3, future leakage 0, and writes 0 in fresh Codex tasks.
- On 2026-08-16, Freebuff exposed the unseen boundary: it consumed `content` but not `structuredContent`, so `content: []` appeared as an empty result. TSUZUNE then intentionally standardized `build_context` on `textResult` and passed the production gate.
- On 2026-08-19, the current knowledge documents were corrected to treat X1-T1 as superseded rather than as a missing implementation.

### Protocol guidance

- MCP defines `content` as the required unstructured result and `structuredContent` as optional structured data.
- The current MCP tool specification says a tool returning structured content should also return serialized JSON in a text block for backward compatibility.
- Primary references:
  - https://modelcontextprotocol.io/specification/2025-11-25/server/tools
  - https://modelcontextprotocol.io/specification/2025-11-25/schema
  - https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/server/tools.mdx

## Live payload probe

One read-only live `build_context` call with `max_characters: 4000` produced:

| Field | Observed size |
|---|---:|
| pretty JSON text block | 4,901 characters |
| Context Markdown | 4,000 characters |
| compact `structuredContent` JSON | 4,756 characters |

The text block exactly matched pretty-printed `structuredContent`. These values are payload proxies, not model-visible token or billing measurements.

## Alternatives

| Alternative | Compatibility | Efficiency evidence | Decision |
|---|---|---|---|
| A. Keep current `textResult` | Proven in Codex and Freebuff history; aligned with MCP backward-compatibility guidance | Duplicates the structured object | **Current contract / do nothing** |
| B. Restore global structured-only | Passed bounded Codex fixture | Failed Freebuff with an empty visible result | **Reject** |
| C. Return different shapes by `direct` / `freebuff` profile | Could preserve Freebuff text | Makes launch profile imply client rendering capability; direct is not a formal capability negotiation | **Reject for now** |
| D. Context Markdown + critical status in text, full object in `structuredContent` | Could keep content-only clients useful while reducing identical JSON duplication | Not yet tested in either real host; departs from the specification's serialized-JSON SHOULD | **Isolated trial candidate only** |
| E. Client-side de-duplication | Preserves the server's compatibility response | Outside this repository and host behavior is not controlled here | **Research only** |

## Resume condition

Keep alternative A and do not start even an isolated trial until both conditions hold:

1. At least two independent, natural tasks show that duplicate transport causes a user-visible failure, retry, latency regression, or measurable host-visible context cost. Smaller wire payload alone is insufficient.
2. `delivery_info` is restored to `match`, so the source and installed runtime form a known baseline.

## Trial candidate D

The candidate result shape is:

```ts
{
  content: [{
    type: 'text',
    text: renderContextForTextClient(result)
  }],
  structuredContent: result
}
```

`renderContextForTextClient` may contain only:

1. `result.markdown`;
2. `truncated` state when true;
3. `omitted_ids` when non-empty;
4. warnings with code, message, and affected path(s).

It must not duplicate revisions and modification times into a second JSON envelope. A write-capable agent must fetch immediately before writing and use that revision guard; the text projection is not a write token.

No new dependency, cache, database, feature flag framework, or service-layer abstraction is justified. If a trial needs more than one small server helper and existing smoke fixtures, stop and redesign.

## Required trial before product implementation

The trial must compare the current shape and candidate D against the same frozen fixture and normalized generated timestamp.

### Host gates

- Fresh Codex task: fixed four answers 4/4, source trace 3/3, future leakage 0, fixture writes 0.
- Actual Freebuff task: the same quality gates and a non-empty visible result. A `--profile freebuff` stdio client alone is necessary but not sufficient evidence of actual host rendering.
- Content-only parser fixture: Markdown, truncation, omitted IDs, and warnings remain observable.
- Structured parser fixture: output schema, `included` descriptors, revision, and `modified_at` remain unchanged.

### Repository gates for a later authorized implementation

- Change only `src/mcp/server.ts`, the existing direct/Freebuff MCP checks, the transport report, and `docs/mcp-integration.md` unless evidence forces a scope review.
- Add a `build_context` call to `scripts/check-mcp-freebuff.mjs`; catalog-only verification is insufficient.
- Keep every other tool on `textResult`.
- Keep `src/mcp/service.ts`, Context selection, schema, default 15,000-character budget, Vault data, and tool catalog unchanged.
- Run `npm run typecheck`, `npm test`, and `npm run check:mcp`.
- Run the fixed candidate measurement without inferring tokens or billing from bytes.
- Only after every gate passes, run the normal `npm run production:update`, then verify `runtime_info.stale_runtime === false`, `delivery_info.status === 'match'`, and live host behavior.

## Stop conditions

Reject the candidate and retain current `textResult` if any of the following occurs:

- Codex or Freebuff sees an empty or incomplete result.
- A content-only path loses a warning, truncation state, omitted source, source trace, or temporal safety required by the quality fixture.
- The candidate reduces bytes but adds calls, retries, failures, or manual recovery.
- The change requires service/schema changes, a new client capability protocol, or per-host branches beyond the existing profile boundary.
- Source and installed production cannot be frozen to a known matching baseline.
- Exact task-quality evidence is unavailable.

## Implementation boundary

No product implementation is authorized by this design. The next reversible action, if explicitly selected, is one isolated candidate-D fixture trial. Global structured-only restoration is not an eligible implementation slice.
