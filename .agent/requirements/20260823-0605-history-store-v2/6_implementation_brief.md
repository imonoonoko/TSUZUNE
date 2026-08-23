# TSUZUNE History Store v2 Implementation Brief

## Existing Patterns

- `src/mcp/service.ts`: `applyUpdateWithHistory()`、`renderAutonomousRevision()`、revision/provenance contract。
- `scripts/preview-history-compaction.ts`: legacy parser、manifest、hash、chain verification。
- `tests/mcp-service.test.ts`: update/history/no-op/stale/review behavior。
- `tests/history-compaction-preview.test.ts`: tamper、legacy、CLI read-only boundaries。

## Phase 1 Touch Points

- New: `src/mcp/history-store-v2.ts` — immutable intent/receipt/restore/verify codec。
- New: `tests/history-store-v2.test.ts` — public behavior tests。
- No production wiring in `src/mcp/service.ts` during Phase 1。

## Technical Assumptions

- Codec accepts bytes so BOM/newline fidelity is not lost。
- Intent stores Brotli-compressed complete before bytes and before/after SHA-256。
- Receipt references the exact serialized intent hash and observed after hash。
- Every record contains a transaction ID and enough provenance to audit the transition。
- SQLite index is optional and rebuildable; it is not part of Phase 1。

## Risks

- UTF-16 string offsets would split surrogate pairs; byte offsets are mandatory。
- Mutable pack/manifest cannot be committed atomically with the canonical note。
- A valid compressed payload can still be semantically wrong; hashes and sequence validation are mandatory。
- Production note-save atomicity is unresolved and must block writer integration。
- Existing `note_link_add` and entry-move history must remain on the legacy path until separately designed。

## Test Plan

- RED: exact restore of compressed full preimage bytes。
- RED: Japanese、emoji、CRLF、LF、BOM、empty transition。
- RED: intent-only is not committed; matching receipt＋observed bytes is committed。
- RED: tampered payload、metadata、receipt、unsupported version rejection。
- GREEN: narrow test, then `npm run typecheck` and related Vitest files。
- Unseen boundary: valid Brotli payload substituted from another intent must fail SHA-256 verification。

## Stop Conditions

- Existing files overlap with unrelated dirty edits in a way that cannot be preserved。
- The codec cannot reconstruct every fixture byte-exactly。
- A hash or chain failure returns partial content。
- Production integration would be needed to make Phase 1 tests pass。
