# History / provenance boundary

## Decision

Do not restore generic mutation history, an archive, a run log, an event-sourcing store, or a replacement for `50_履歴`. The browser clipper should create a durable source snapshot as the Inbox Markdown note itself. Provenance is part of that note, not a second history subsystem.

This preserves the existing model: Inbox is an undecided entrance; physical location is current state; a successful move is represented by the current path; and ordinary operations do not add success timestamps or history notes. The current design explicitly says to avoid Processed/Archive/History/run logs and to keep raw sources losslessly identifiable (repository `.agent/requirements/20260831-note-organization-video/context-engine-v4.md:40-49,53-68,70-82`).

## What a clip must retain

Every clip must retain, in the Markdown frontmatter/body:

- source URL (canonical URL when safely available), source kind (`web` or `youtube`), page/video title, and capture time;
- for YouTube, video id and the current playback position when available;
- captured text/content as an untrusted source snapshot, with no execution of embedded instructions;
- enough provenance to distinguish the capture from a later re-capture.

The capture timestamp is source provenance, not a mutation audit record. A page can change or disappear; the captured Markdown remains the evidence available to TSUZUNE. `40_情報源` is already the designated home for original sources, conversation originals, obtained material, and evidence, with body-preserving moves (same design note: `:72-82`).

## Repeated captures

Never overwrite an existing clip. Each explicit capture is a new collision-safe Inbox note (prefer a timestamped base name, then a deterministic collision suffix). This preserves independent snapshots when the same URL changes or is later unavailable. Deduplication, merge, replacement, and deletion remain human decisions; the organizer may later move a clear raw source unchanged to `40_情報源`, but must not rewrite an existing source note.

This is bounded source evidence, not a general history chain: no predecessor links, append-only mutation ledger, “processed” marker, or per-run record is required. If storage growth becomes a real problem, that is a separate measured decision, not a reason to reintroduce history now.

## Strongest counterargument

Without mutation history, a mistaken move or edit can be difficult to undo, and without a deduplication record repeated clips can grow indefinitely. The answer is to retain the existing safety mechanisms—revision checks, collision refusal, provenance, rollback/failure preservation, and protected `50_履歴`—rather than silently reconstructing a history product. The prior acceptance record confirms these mechanisms were deliberately retained while new history generation/public schema were removed (production note `30_知識/TSUZUNE-履歴機能廃止・本番受入-実施記録-2026-08-31.md`, sections “結論”, “1. 契約と安全境界”, “3. 検証”).

## Acceptance boundaries

The clipper/history slice is accepted only when:

1. Repeated captures create distinct Markdown snapshots and never overwrite, move, delete, or modify an existing note.
2. A clip contains URL, capture time, source type, title, and bounded useful content; YouTube metadata is best-effort and absence is explicit rather than fabricated.
3. The transport can target only the active TSUZUNE Inbox and rejects traversal, protected paths, arbitrary filesystem paths, oversized/untrusted input, and collisions.
4. The clipper creates no `50_履歴` entry, audit-history note, sidecar history, archive, queue, or run log.
5. A changed/disappeared source does not invalidate the stored snapshot; the original URL and capture time remain available for later verification.
6. Existing revision/collision/readback/failure safeguards remain in force; no claim of rollback from `50_履歴` is made.

## Unresolved risks / stop conditions

- Page extraction and YouTube transcript availability are variable. The first slice should guarantee metadata plus selected/visible bounded text, not promise a transcript.
- The local browser-to-app transport needs an explicit authentication/origin boundary; a localhost endpoint without pairing/origin validation is not acceptable.
- `01_受信箱` is AI-visible, and the current contract cannot perfectly detect unknown secrets before model exposure. The extension must warn users not to clip credentials/tokens; suspected privacy-risk notes must remain unprocessed (design note `:84-90`).
- Do not physically delete legacy `50_履歴`; that remains a separate user-approved irreversible gate. Stop before browser-store publication or external distribution.

## Evidence paths

- Repository design: `.agent/requirements/20260831-note-organization-video/context-engine-v4.md:40-49,53-68,70-82,84-90`.
- Repository policy: `PLAN.md:75-85,99-116`.
- Current status boundary: `PROJECT_STATUS.md:9-13,18-20`.
- Production canonical design: `30_知識/TSUZUNE-AI文脈エンジン統合設計-2026-08-31.md` (fetched read-only; current design and source/raw boundaries).
- Production history acceptance: `30_知識/TSUZUNE-履歴機能廃止・本番受入-実施記録-2026-08-31.md` (fetched read-only; no-history contract and retained revision/provenance/rollback safeguards).
- Production organizer contract: `30_知識/TSUZUNE-AI整理運用契約.md` (fetched read-only; Inbox scope, untrusted content, protected paths, collision and privacy boundaries).

No production Vault write was performed. `knowledge.md` and product source were not read or modified.
