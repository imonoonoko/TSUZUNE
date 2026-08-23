# Phase 3 Recovery Fixture

## Objective

Recover a missing commit receipt without reapplying an already-completed canonical update.

## In Scope

- Validate the existing intent against the caller's expected intent bytes.
- Read the canonical bytes and require the intended after hash.
- Finalize immutable records through a flushed same-directory temporary file and atomic no-replace hard link.
- Treat an identical existing receipt as an idempotent success.
- Reject partial or tampered final records without overwriting them.

## Out of Scope

- Production writer wiring.
- Automatic canonical rollback or restore.
- Legacy history migration, deletion, retention, or packing.
- New dependencies, SQLite, Git, GitHub, daemon, or background cleanup.

## Acceptance

1. An existing valid intent plus canonical after bytes can create only the missing receipt.
2. The recovery path never calls the canonical update callback.
3. Partial or tampered intent and receipt files are preserved and rejected.
4. Successful finalization leaves no temporary file during normal execution.

## Stop Boundary

Stop before production wiring. A production gate requires a separate decision after recovery fixtures and full regression pass.
