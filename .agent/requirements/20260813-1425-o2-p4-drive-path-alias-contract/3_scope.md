# O2-P4 Drive Path Alias Contract Scope

## MVP Contract

### O2-P4A — Alias Sidecar Foundation

- Represent the local `.tsuzune/path-aliases.json` as one app-owned JSON object in the existing per-Vault Drive root.
- Identify it by `tsuzuneVaultId` plus `tsuzuneRole: pathAliases`, not by display name alone.
- Transfer exact UTF-8 bytes and validate them with the existing Path Alias compiler before accepting local or remote state.
- Track its file ID, Drive version, local hash, and remote hash in the sync ledger.
- Use the current preview/apply drift check and fail closed on concurrent changes.
- Treat multiple remote alias objects, malformed bytes, unsafe mappings, or unknown version as blocking errors.

### O2-P4B — Explicit Remote Relocation

- Accept only old-path/new-path pairs from a validated schema-v1 classification plan.
- Require each paired-Vault source to be clean and identical across local file, remote object, and ledger before relocation.
- Patch the existing remote object by file ID, changing only `name` and `appProperties.tsuzunePath` while retaining its Drive parent and content.
- Re-key the ledger entry from old path to new path without changing the file ID or content hashes.
- Update the remote alias document only after every planned remote note relocation succeeds.
- Verify remote paths, file IDs, content hashes, sidecar bytes, and ledger projection before completion.

## Unpaired Vault Behavior

If the local Vault has never been paired to Drive, classification remains a local operation. A later first sync uploads only canonical Markdown paths plus the validated alias document. No remote rename is required because no prior remote identity exists.

## Future

- An isolated live-Drive acceptance run using disposable app-owned data.
- A separately authorized product orchestration that combines the proven local and remote steps.
- Production classification apply only after recovery evidence and explicit user authorization.

## Out Of Scope

- A real production Vault or real production Drive mutation.
- `appDataFolder`, new OAuth scopes, re-consent, Shared Drive support, or Drive folder hierarchy mirroring.
- Move inference from hashes, names, timestamps, or content similarity.
- General remote filesystem transactions, queues, background migration, UI, MCP move tools, or new dependencies.
- Deleting old remote Markdown objects as a substitute for identity-preserving relocation.
- Claiming token, cost, retrieval-quality, or general sync improvement.

## Constraints

- One-device, personal-software defaults remain primary.
- Existing Drive preview/apply and private app-property ownership are reused.
- No production apply while either O2-P4A or O2-P4B lacks executable rollback evidence.
