# O2-P4 Drive Path Alias Contract Implementation Brief

## Existing Patterns To Reuse

- `src/core/path-aliases.ts`: the sole alias parser, validator, and flattener.
- `src/main/drive-sync-service.ts`: preview/apply fingerprint, Drive version checks, ledger checkpoints, and per-Vault root binding.
- `src/main/google-drive.ts`: authenticated REST helpers, private app properties, metadata parsing, and response validation.
- `src/main/vault.ts`: atomic sidecar replacement and symlink/path safety patterns.
- `src/cli/classification-migration-prototype.ts`: local recovery packet, explicit mutation order, and reverse rollback behavior.

## O2-P4A Likely Touch Points

- Extend the Drive adapter with one JSON alias-object type and list/get/create/update methods.
- Extend the ledger with one optional alias state per Vault. Parse the prior version compatibly and write one explicit next version only when the feature is implemented.
- Extend preview/apply with one sidecar decision independent of Markdown decisions.
- Add focused Google Drive adapter and sync-service tests using the existing fake remote. Do not add UI or a package command.

## O2-P4B Likely Touch Points

- Add a metadata-only relocation method that accepts `fileId`, `vaultId`, `oldPath`, `newPath`, and `expectedVersion`.
- The method first fetches live metadata, validates ownership/path/version/root parent, then PATCHes `name` and `appProperties.tsuzunePath` at the standard metadata endpoint.
- Add one plan-driven migration coordinator only after O2-P4A passes. Do not teach ordinary `planDriveSync` to guess renames.
- Re-key existing ledger entries after verified remote success.

## Test Order

1. O2-P4A RED tests: unique ownership, exact bytes, upload, download, no-op, one-side change, both-side conflict, malformed bytes, version drift, and multiple remote candidates.
2. O2-P4A implementation and focused regression.
3. O2-P4B RED tests: same file ID, unchanged content/parent, explicit-plan-only, destination collision, version drift, ledger re-key, mutation failpoints, reverse rollback, and rollback-drift packet retention.
4. Only after both local fake-remote gates pass, authorize a disposable live-Drive acceptance task separately.

## Risks

- Reusing Markdown transfer types for JSON can accidentally admit the alias object into note search or conflict copies. Keep the role-specific parser separate and small.
- Changing the normal sync planner to infer moves can rename the wrong equal-content note. Keep relocation plan-driven.
- Removing the recovery packet too early loses the only safe path after a partial remote failure. Delete it only after full local/remote/ledger verification.
- Adding `drive.appdata` is unnecessary scope expansion for the current per-Vault model.

## Stop Condition

For the immediate next task, stop after O2-P4A test-only sidecar sync passes focused and full regression with no UI, MCP, package command, OAuth-scope, real Drive, or production-Vault change. O2-P4B and production apply remain blocked until separately started.
