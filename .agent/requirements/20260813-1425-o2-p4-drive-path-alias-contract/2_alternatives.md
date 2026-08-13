# O2-P4 Drive Path Alias Contract Alternatives

## Current Architecture

- Drive Markdown objects are app-owned objects under one TSUZUNE Vault root.
- `appProperties.tsuzunePath` is the logical Vault path; all Markdown objects keep the Vault root as their Drive parent.
- The sync ledger maps logical path to `fileId`, local hash, and remote hash.
- The existing `files.update` route updates content only after asserting that the remote path already equals the requested path.
- The local alias source is the exact JSON bytes at `.tsuzune/path-aliases.json`.

## Option A: Synchronize Only The Alias Sidecar

Effort: Small to medium
Value: Incomplete

Benefits:

- Old paths survive restore and another TSUZUNE installation.
- Existing alias validation can be reused.

Failure:

- A move is still planned as preserve-old plus upload-new.
- Remote Markdown identity is not retained and duplicate objects remain.

## Option B: Remote Rename Only

Effort: Medium
Value: Incomplete

Benefits:

- A metadata-only `files.update` can preserve the same Drive file ID.
- In the current flat Drive layout, only `name` and `tsuzunePath` need to change; parents remain unchanged.

Failure:

- The local alias map is missing after restore or on another device.
- Immutable source/history links and old external MCP IDs lose their compatibility layer.

## Option C: Staged Hybrid

Effort: Medium
Value: Complete for the stated blocker

Summary:

1. Synchronize one validated alias document in the existing per-Vault Drive root.
2. Relocate planned Markdown objects by existing file ID using metadata-only updates.
3. Re-key the existing ledger from old path to new path only after verified remote success.

Benefits:

- Prevents remote duplication.
- Preserves Drive file identity and old TSUZUNE identities.
- Uses the current `drive.file` scope and per-Vault ownership model.
- Keeps the two new behaviors independently testable.

Tradeoffs:

- Requires a short recovery protocol across local filesystem and Drive mutations.
- Must fail closed on concurrent local or remote changes.

## Option D: Store Aliases In `appDataFolder`

Effort: Medium to large
Value: Low for this product

Failure:

- Requires the new `drive.appdata` OAuth scope and re-consent.
- Separates alias recovery from the existing per-Vault Drive backup.
- Adds a different lifecycle and location without solving remote note relocation.

## Recommendation

Choose Option C, implemented as O2-P4A sidecar foundation followed by O2-P4B explicit remote relocation. Do not infer moves and do not expose a production apply entry point in either first prototype.
