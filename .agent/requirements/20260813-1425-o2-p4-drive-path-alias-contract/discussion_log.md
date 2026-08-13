# O2-P4 Drive Path Alias Contract Discussion Log

## 2026-08-13 14:25 JST — Start

The sole remaining classification-migration blocker is `DRIVE_PATH_ALIAS_UNSUPPORTED`. O2-P3 proved local apply and rollback only on an anonymous temporary Vault. This task decides the Drive contract without adding a production entry point or touching a real Drive Vault.

## 2026-08-13 14:31 JST — Current-path findings

- `DriveSyncService` compares Markdown files by logical path. A local move currently appears as `local_deleted` at the old path and `new_local` at the new path.
- The current deletion policy preserves the old remote file. Applying normal sync after a classification move would therefore retain the old remote object and upload a second object at the new path.
- All synchronized Markdown objects live under the per-Vault Drive root. Logical hierarchy is stored in the private `tsuzunePath` app property; the Drive parent does not mirror each Markdown directory.
- The sync ledger already retains Drive file IDs, but it is keyed by logical path and has no rename decision.
- `.tsuzune/path-aliases.json` is excluded because the current remote adapter lists and transfers Markdown only.
- The current OAuth scope is `drive.file`; `drive.appdata` is not requested.

## 2026-08-13 14:36 JST — Alternatives

- Rejected: sidecar sync alone. It preserves aliases across restore, but normal path-based sync would still duplicate moved notes remotely.
- Rejected: remote rename alone. It preserves the Markdown Drive file ID, but a restored or second TSUZUNE installation would lose immutable historical links and old MCP IDs because the alias map remains local-only.
- Accepted: a staged hybrid contract. Synchronize one app-owned alias document in the existing per-Vault Drive root, then relocate each planned Markdown object by file ID and metadata-only patch.
- Rejected: `appDataFolder`. It requires another OAuth scope, separates recovery metadata from the visible per-Vault backup, and its lifecycle differs from the existing Drive Vault.
- Rejected: guessing moves from equal hashes. Two independent notes can have identical bytes. Only an explicit, validated classification plan may authorize a remote path change.

## 2026-08-13 14:41 JST — Simplicity and safety decision

The implementation is split into two gates:

1. O2-P4A adds sidecar transfer and a clean remote baseline. It does not move notes.
2. O2-P4B adds plan-driven metadata relocation and ledger re-keying. It is not attempted until the local note, remote note, ledger, and alias document all match the preview.

This ordering avoids needing a generalized distributed transaction. Production migration remains forbidden until both gates have executable rollback evidence and a separately authorized production acceptance run.
