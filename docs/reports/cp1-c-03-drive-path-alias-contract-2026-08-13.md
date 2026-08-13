# CP1-C-03 Drive Path Alias Contract

Date: 2026-08-13 JST
Result: `pass`
Task type: requirements / architecture
Product code changed: no

## Conclusion

The remaining `DRIVE_PATH_ALIAS_UNSUPPORTED` blocker cannot be closed by either sidecar sync or remote rename alone. The fixed contract is a staged hybrid:

1. O2-P4A synchronizes one validated Path Alias JSON object in the existing app-owned Drive Vault root.
2. O2-P4B relocates each explicitly planned Markdown object by existing Drive file ID using a metadata-only update, then re-keys the ledger.

Sidecar sync preserves old Wiki/MCP identities across restore. Remote relocation prevents the current path-based sync from retaining the old remote object and uploading a duplicate at the new path.

## Key Decisions

- Reuse the existing `drive.file` scope and per-Vault root.
- Do not use `appDataFolder` or request `drive.appdata`.
- Do not infer moves from equal content or hashes.
- Preserve Markdown Drive file IDs and contents; only logical path metadata and display name change.
- Treat alias conflicts as fail-closed; never auto-merge two divergent maps.
- Implement and prove O2-P4A before starting O2-P4B.

## Evidence Boundary

The decision is based on the current source path in `src/core/drive-sync.ts`, `src/main/drive-sync-service.ts`, `src/main/google-drive.ts`, `src/main/google-auth.ts`, the Path Alias contract, and completed O2-P3 evidence. Google Drive's official API contract confirms that `files.update` supports metadata-only PATCH by file ID and that `appProperties` are private app metadata.

No Drive request, production Vault write, installed-app change, OAuth change, migration apply, or product-code change occurred in this task.

Official API references:

- [Google Drive API `files.update`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update)
- [Google Drive API File resource and `appProperties`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- [Google Drive application data folder](https://developers.google.com/workspace/drive/api/guides/appdata)

## Frozen Contract

- [Purpose](../../.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/1_purpose.md)
- [Alternatives](../../.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/2_alternatives.md)
- [Scope](../../.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/3_scope.md)
- [Requirements](../../.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/4_requirements.md)
- [Implementation brief](../../.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/6_implementation_brief.md)

## Next Step

Implement O2-P4A only: test-owned fake-remote sidecar synchronization with exact bytes, unique ownership, preview/apply revalidation, ledger state, conflict behavior, and rollback-safe local replacement. Stop before remote rename, UI, MCP, live Drive, or production apply.
