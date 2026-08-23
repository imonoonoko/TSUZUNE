# Differential Recording System Design — 2026-08-23

## Status

- Design only. No product implementation is authorized by this document.
- Repository source is currently dirty and `delivery_info` reports `mismatch`; installed production and working source are separate states.
- The design reuses the existing Markdown, MCP revision, patch, provenance, and AI-history contracts.

## Goal

Keep durable knowledge current without producing a new note or append-only entry for every observation.

The system records a **logical difference in current understanding**, while the canonical Markdown note remains a complete current-state document. A reader must not need to replay a delta log to reconstruct the present.

## Verified system boundary

The repository contains 84 TypeScript/TSX code files, approximately 29,000 lines, across these responsibility areas:

| Area | Current responsibility | Relevant boundary |
|---|---|---|
| `src/core` | Pure in-memory search, Wiki links, Graph, Temporal, Context, templates, and sync decisions | Consumes note snapshots; does not own durable writes |
| `src/main` | Electron lifecycle, OS/Vault access, atomic whole-file saves, watcher, settings, Google/Drive, updater | Markdown filesystem is the source of truth |
| `src/preload` | Narrow `contextBridge` API | Renderer has no direct Node/filesystem access |
| `src/renderer` | Human editing, navigation, search, Graph, settings, and conflict UI | Human saves are full-content saves with mtime conflict checks |
| `src/mcp` | AI search/context and guarded mutations | Owns revision checks, patching, provenance, review proposals, and AI history |
| `src/cli` | Bounded import, migration, evaluation, and production operations | Not part of normal note-recording runtime |
| `scripts` / `tests` | Build, contract, packaging, installed-runtime, and production acceptance gates | Product changes require the fixed production-update gate |

Representative existing call paths:

1. Human save: Renderer → preload → trusted IPC → `VaultService.saveNote` → temporary file → recheck → atomic rename.
2. AI partial update: MCP `patch_note` → fresh Vault snapshot → revision check → exact-match patch → AI history → `VaultService.saveNote`.
3. AI current-state rewrite: MCP `autonomous_update_note` → revision check → exact-content no-op or AI history → `VaultService.saveNote`.
4. Retrieval: MCP search/fetch/build_context → fresh Vault scan → pure Core functions → source/revision-bearing result.
5. Production promotion: `production:update` → source/process/diff guards → typecheck/tests/MCP/build/package/smoke → install/hash/profile checks → receipt.

## Design decision

Use a **logical-delta / full-state-canonical** model:

- Detect whether the new evidence changes a conclusion, state, next action, restart condition, reusable constraint, or decision reason.
- If none changes, perform no write.
- If something changes, update the existing canonical note so it remains self-contained.
- Preserve why the change happened through MCP provenance and, when warranted, one execution record.
- Preserve the previous full body through the existing `50_履歴/AI更新` mechanism.

This is not an event-sourced design. Deltas are the write decision and audit evidence, not the format required to read current knowledge.

## Update protocol

### 1. Locate the canonical target

1. Use search to find the existing project note, MOC, policy, or atomic knowledge note.
2. Fetch the likely target and obtain its current revision.
3. Use `build_context` only when explicit links, backlinks, provenance, or temporal state are necessary to decide the change.
4. Create a new note only when no existing canonical target can own the concept without mixing unrelated responsibilities.

### 2. Classify the semantic difference

A write is eligible only when at least one field changes:

1. Current conclusion, specification, or priority.
2. Implementation, verification, or operational state.
3. Next action, restart condition, or reason for holding.
4. Reusable failure, constraint, evidence, or decision reason.

Rewording, a search result that changes no decision, duplicate evidence, and an identical current body are no-ops.

### 3. Choose the existing mutation path

| Situation | Existing path | Rule |
|---|---|---|
| One or several exact local replacements | `patch_note` | Prefer when 1–20 exact operations can update the note without reconstructing unrelated text |
| The current-state section must be coherently rewritten | `autonomous_update_note` | Send the complete desired body with `expected_revision`, reason, and source refs |
| User-reviewed sensitive path | Existing Review mode | Store a proposal outside the Vault; do not bypass approval |
| Exact body is unchanged | `autonomous_update_note` no-op or no call | Create neither target write nor AI history |
| New concept has no owner | `create_note` | Add one reachable atomic note, then update the affected entry point once |

`update_note` remains the plain revision-checked full update contract. It is not the default differential-recording route because it does not provide AI-history provenance.

### 4. Apply guards

Before mutation:

- Require a non-stale runtime for MCP writes.
- Fetch immediately before writing and use the returned revision.
- Never force through a revision conflict; refetch and re-evaluate the semantic difference.
- Preserve `40_情報源` and `50_履歴` as immutable AI-write paths.
- Treat a Review-mode proposal as pending, not applied.
- Keep source/receipt delivery state separate from MCP runtime freshness.

### 5. Write once at the verified boundary

1. Update the atomic/current-state note first.
2. Update each affected project note or MOC at most once, only if its current status, priority, operation, or navigation changed.
3. Create at most one execution record when the work has reusable or audit value.
4. Do not add an execution record merely to report a no-op.

### 6. Read back

Verify that:

- The canonical note can be understood without replaying history.
- The changed conclusion and next boundary are explicit.
- Required Wiki links resolve and the note is reachable from an existing entry point.
- No duplicate current conclusion remains as an appended older state.
- The returned revision/provenance matches the performed operation.

## Current-state document shape

The format is guidance, not a mandatory schema:

```markdown
## State

Current verified status.

## Current decision

What is now accepted, held, or rejected.

## Evidence and constraints

Only evidence needed to support the current decision, with source links.

## Next action or restart condition

One bounded next step, or the observation required before work resumes.
```

Temporal or historical detail belongs in a dated evidence note or execution record when it is necessary for audit. It is not repeatedly copied into the current-state note.

## Failure behavior

| Failure | Required behavior |
|---|---|
| Stale or unavailable runtime freshness | Reject before side effects |
| Revision conflict | Refetch, compare again, and stop if intent is no longer valid |
| Patch finds zero or multiple unexpected matches | Abort without falling back to a broad rewrite |
| Protected source/history path | Reject |
| Review path | Return a pending proposal and leave the Vault body unchanged |
| Read-back differs from intended current state | Leave the operation open and record the mismatch; do not claim completion |
| Product source differs from production receipt | Describe design against source and production separately; do not claim shipment |

One existing residual boundary remains: AI history is created before the target save. If the subsequent save fails, an orphan audit entry can remain. This design does not add a transaction layer pre-emptively. Reopen that implementation question only if an orphan is observed or a deterministic failure-injection test demonstrates recurring operational harm.

## Explicit non-goals

- Delta database, event store, append-only current-state reconstruction, or CRDT.
- Semantic-diff service, embedding comparison, mandatory schema, or automatic classification.
- Watcher-triggered recording, daemon, heartbeat, or Codex/TSUZUNE Hook.
- Replacing Markdown full-file saves inside `VaultService`.
- Changing human editor save behavior.
- Compacting or deleting existing AI history.
- Starting a new product Primary Track from this design alone.

## Acceptance criteria

The design is operationally satisfied when all of the following hold in normal work:

1. Semantically unchanged information produces zero canonical writes and zero new AI-history notes.
2. A changed current decision produces one revision-checked canonical update and preserves the prior body once.
3. The updated note is self-contained and exposes its next action or restart condition.
4. Protected paths, stale runtime, and stale revisions fail before the target is changed.
5. Project/MOC updates occur only when their navigation or current-state projection changes.
6. No new database, background service, Hook, or dependency is required.

## Reopen conditions

Do not add product code now. Re-evaluate the smallest implementation only after one of these is observed at least twice, or reproduced deterministically:

- Meaning-equivalent updates repeatedly create history despite the exact-content no-op.
- Operators cannot consistently choose between patch and full-state rewrite.
- Orphan history from failed target saves causes real recovery ambiguity.
- Current-state notes repeatedly retain contradictory old conclusions after the protocol is followed.

At that point, begin with a read-only incident set and a fixed acceptance fixture. Do not begin with infrastructure.

## Evidence pointers

- `src/main/index.ts`, `src/main/ipc.ts`, `src/main/vault.ts`
- `src/preload/index.ts`, `src/renderer/App.tsx`
- `src/core/context.ts`, `src/core/search.ts`, `src/core/links.ts`, `src/core/temporal.ts`
- `src/mcp/server.ts`, `src/mcp/service.ts`, `src/mcp/tool-catalog.json`
- `src/shared/ai-write-policy.ts`
- `scripts/update-production.mjs`, `scripts/source-fingerprint.mjs`
- `tests/mcp-service.test.ts`, `tests/vault.atomic.test.ts`, `tests/app.safety.test.tsx`, `tests/release-config.test.ts`
- `docs/reports/production-update-latest.json`
