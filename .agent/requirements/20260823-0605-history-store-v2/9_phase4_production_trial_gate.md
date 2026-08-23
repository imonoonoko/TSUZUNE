# Phase 4 Production Trial Gate

## Decision

Do not wire History Store v2 into the active production Vault yet. The current decision is:

1. a packaged, installed-runtime trial with an isolated profile and fixture Vault is conditionally allowed;
2. the active production writer is NO-GO until the blockers below are resolved and Gate A passes;
3. only then may a separately approved, bounded opt-in shadow trial be considered.

Legacy Markdown history remains authoritative throughout both gates.

## Current Writer Boundary

The only Phase 4 candidate seam is `applyUpdateWithHistory()` in `src/mcp/service.ts`.
It serves:

- `autonomousUpdateNote()`;
- `patchNote()`;
- approved AI update proposals.

Do not attach v2 to `VaultService.saveNote()`. That lower-level API is also used by human desktop saves and Drive sync. Do not include note-link audit records or entry-move journals; they have different history contracts.

## Proposed Shadow Order

For changed MCP AI revision updates in the isolated trial only:

1. read exact canonical bytes;
2. create and finalize the v2 intent;
3. create the existing legacy Markdown history;
4. save the canonical note with the existing revision/mtime guard;
5. read exact canonical bytes back;
6. create and finalize the v2 receipt;
7. return the existing public response unchanged.

If intent finalization fails, do not write legacy history or canonical content. After canonical save, a missing receipt is recovered only through the Phase 3 receipt-only path. This order is not production-ready: the current runner throws when read-back or receipt finalization fails after the canonical update, which can report failure even though legacy and canonical writes already succeeded.

## Production Blockers

All four blockers must be closed before an active-Vault trial:

1. **Post-canonical false failure:** preserve the existing writer's successful public result when only v2 read-back or receipt finalization fails, and classify v2 as `pending-recovery` without retrying the canonical update.
2. **Cross-process CAS gap:** the final `stat` then `rename` sequence has a TOCTOU window. The isolated trial must be single-writer; production use requires an explicit ownership/enforcement gate and a conflicting-writer test.
3. **Filesystem failure contract:** run hard-link preflight on the exact trial directory and inject `ENOSPC`/permission/link failures at intent and receipt stages. Do not add rename or copy fallback.
4. **Receipt semantics:** a receipt proves that a durable intent existed and matching after-bytes were observed. It does not prove which writer produced those bytes or exactly-once execution.

## Gate A: Installed Runtime, Isolated Data

### Scope

- packaged and installed TSUZUNE binary;
- isolated app profile;
- fixture Vault that is never the active production Vault;
- MCP `autonomousUpdateNote()`, `patchNote()`, and approved update proposal paths;
- legacy Markdown plus v2 shadow records.

### Required Cases

1. normal update;
2. CRLF, BOM, Japanese, emoji, empty previous body;
3. stale revision and same-size concurrent replacement;
4. canonical save failure after intent;
5. receipt finalize failure followed by receipt-only recovery;
6. existing valid receipt race;
7. partial/tampered intent and receipt;
8. disk-full or injected `ENOSPC` before intent finalize;
9. hard-link unsupported or injected failure;
10. normal completion leaves no `.tmp` record.
11. canonical success followed by read-back or receipt failure preserves the existing public success result and leaves v2 pending recovery;
12. crash after link but before temp unlink leaves a valid final and does not block an idempotent retry;
13. reader parity for search, fetch, context building, history inclusion, and legacy compaction.

### Pass Conditions

- every successful canonical update has one valid legacy history record, intent, and committed receipt;
- every failed pre-canonical update leaves canonical bytes unchanged;
- every post-canonical receipt failure is either recovered or reported as unresolved; it is never treated as committed without a valid receipt;
- old bytes restore exactly for every committed case;
- public MCP schemas and returned `history_path` remain unchanged;
- a v2-only post-canonical failure never changes an existing successful API result into failure;
- recovery invokes the canonical update callback zero times;
- the isolated profile and production Vault remain byte-identical;
- the normal production-update acceptance suite passes.

Any failure is NO-GO for Gate B.

## Gate B: Active-Vault Opt-In Shadow

Gate B requires a separate explicit user approval after Gate A evidence is reviewed and all production blockers are closed. Passing Gate A alone does not authorize production writer wiring.

### Scope

- MCP AI revision updates only;
- one active Vault on this Windows PC;
- legacy Markdown remains enabled;
- v2 records use a dedicated protected shadow directory;
- no migration, deletion, retention, pack, desktop writer, Drive writer, link-add, or entry-move integration.

### Bounded Trial

- default disabled;
- explicit local opt-in;
- stop after 20 changed AI revision updates or the first anomaly, whichever comes first;
- hard cap: 8 MiB of v2 shadow records;
- no background daemon: enforce the count and byte cap synchronously before creating an intent;
- disabling the trial stops new v2 writes but does not delete existing records.

### Compare Each Update

- target and previous revision;
- legacy previous body versus restored v2 previous bytes;
- planned after hash versus canonical raw read-back;
- intent/receipt transaction, target, sizes, and hashes;
- orphan intent, missing receipt, invalid record, and `.tmp` counts;
- added legacy bytes, v2 bytes, and total dual-write overhead.

### GO Conditions

After 20 changed updates:

- 20/20 exact previous-byte matches;
- 20/20 committed receipt classifications;
- zero corrupt records;
- zero unexplained orphan intents;
- zero canonical changes without legacy history;
- zero public MCP response changes;
- hard-link finalization supported on the actual shadow-store volume;
- writer ownership is restricted to the tested single-writer boundary;
- full production acceptance remains PASS.

Passing Gate B permits a design decision about closed immutable packs. It does not permit stopping or deleting legacy history.

### Immediate Stop Conditions

- canonical/legacy/v2 byte mismatch;
- corrupt or partial final record;
- unresolved missing receipt after canonical update;
- canonical update succeeded but the public API reports failure due only to v2;
- a conflicting writer is detected or writer ownership is uncertain;
- hard-link unsupported on the actual volume;
- `ENOSPC`, permission, antivirus, sync, or sharing violation;
- active-Vault profile drift caused by automated acceptance;
- public reader, search, fetch, backlinks, or `history_path` regression;
- count or byte cap reached.

On stop: disable new v2 shadow writes, preserve all legacy and v2 evidence, make no automatic cleanup, migration, rollback, or retry of the canonical update.

## Writer Ownership

- MCP `applyUpdateWithHistory()` owns Phase 4 transactions.
- `VaultService.saveNote()` remains an actor-neutral primitive and must not create AI history.
- Desktop save, Drive sync, entry move, and note-link audit remain separate contracts.
- Existing revision and mtime/size guards remain required; v2 raw read-back SHA-256 is the final commit check.
- The isolated trial is single-writer only. Hard-link finalization does not serialize canonical writers, and existing guards do not close the final `stat`/`rename` TOCTOU window.
- Do not claim actor attribution or exactly-once execution from a receipt.

## Filesystem Boundary

- The v2 shadow store and its temp files must be on the same volume.
- Windows hard-link support must be demonstrated on the actual trial volume before canonical mutation.
- Microsoft documents `CreateHardLink` as NTFS-only and same-volume. ReFS and some SMB modes are unsupported.
- `FileHandle.sync()` requests storage flush, but Node documents the result as OS/device-specific. Phase 4 does not claim proof against sudden power loss.

## Required Implementation Packet Before Gate A

- exact allowed production files and functions;
- feature flag/default-off contract;
- protected shadow directory path;
- 20-record/8-MiB synchronous cap behavior;
- injected filesystem failure seams used only by tests;
- post-canonical `pending-recovery` behavior that preserves the existing public success result;
- an enforceable single-writer boundary and a separate conflicting-writer test;
- acceptance commands and isolated profile/Vault paths;
- production-update source fingerprint and installed hashes;
- rollback: disable flag only, no data deletion;
- explicit user approval boundary before Gate B.

## Out of Scope

- SQLite, Git, GitHub, database daemon, new dependency;
- v2-only history;
- legacy compaction, packing, migration, deletion, or retention;
- automatic temp cleanup;
- restore UI;
- desktop or Drive writer unification;
- claims of power-loss durability beyond tested evidence.

## Sources Checked 2026-08-23

- Node.js File system API: `FileHandle.sync()` requests flushing file data to the storage device, with OS/device-specific implementation; `fs.link()` creates a new hard link.
  - https://nodejs.org/api/fs.html
- Microsoft `CreateHardLink`: Windows hard links are NTFS-only, file-only, and must be on the same volume; ReFS and some SMB modes are unsupported.
  - https://learn.microsoft.com/windows/win32/api/winbase/nf-winbase-createhardlinka

## Stop Boundary

This phase produces the gate packet only. Do not modify `src/mcp/service.ts`, runtime configuration, the active Vault, or installed production until Gate A implementation is separately started and verified. Gate A success still does not authorize active production writer wiring.
