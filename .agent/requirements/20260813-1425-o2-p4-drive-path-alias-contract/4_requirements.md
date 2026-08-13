# O2-P4 Drive Path Alias Contract Requirements

## 1. Overview

O2-P4 shall close the Drive Path Alias design gap with a staged hybrid: synchronize the alias map for portability and relocate planned Markdown objects by Drive file ID for identity preservation. Contract completion alone does not authorize production apply.

## 2. Fixed Vocabulary

- **local alias sidecar**: `.tsuzune/path-aliases.json` in the Vault.
- **remote alias object**: one app-owned JSON object with `tsuzuneVaultId` and `tsuzuneRole: pathAliases` under the existing Drive Vault root.
- **remote relocation**: metadata-only update of an existing Markdown object by file ID from one validated logical path to another.
- **clean baseline**: local bytes/hash, remote bytes/hash/version, and ledger state all agree with the preview.
- **recovery packet**: durable preimages and completed-step state stored outside the Vault before a migration mutation.

## 3. Interaction Flow

```text
O2-P4A:
inspect local alias + remote alias + ledger
  -> validate exact bytes and uniqueness
  -> preview
  -> re-inspect
  -> upload or download one alias object
  -> checkpoint and verify

O2-P4B:
validated classification plan + clean O2-P4A baseline
  -> capture recovery packet
  -> run proven local migration stage
  -> relocate each remote Markdown object by file ID
  -> update remote alias object
  -> re-key ledger
  -> verify local/remote projection
  -> remove recovery packet only after full success
```

## 4. Acceptance Criteria

### O2-P4A Ownership And Format

- Given a remote alias candidate, when it lacks the expected Vault ID, role, parent root, file ID, or version, then it is not accepted as the Vault alias object.
- Given more than one owned alias object for one Vault, when preview runs, then sync is blocked without choosing one heuristically.
- Given malformed JSON, unsafe paths, non-Markdown mappings, case-fold collisions, self-reference, or cycles on either side, when preview runs, then no local, remote, or ledger write occurs.
- Given valid bytes, when transferred, then the exact UTF-8 bytes are preserved; the sync layer does not normalize or reserialize them.
- The remote object uses the existing Drive Vault root and current `drive.file` scope. No `drive.appdata` scope is introduced.

### O2-P4A Sync Decisions

- Given only a valid local sidecar and no remote alias object, when apply runs after unchanged preview, then exactly one owned remote alias object is created and checkpointed.
- Given only one valid remote alias object and no local sidecar, when apply runs after unchanged preview, then the exact remote bytes are installed locally using the existing atomic-replace safety pattern.
- Given equal local and remote hashes, when preview runs, then no transfer is planned.
- Given one side changed since the last clean ledger state, when preview/apply runs, then the unchanged side is updated after version and fingerprint revalidation.
- Given both sides changed or the ledger lacks enough history to distinguish divergent non-equal copies, when preview runs, then the sidecar is reported as a conflict and neither copy is overwritten.

### O2-P4B Preconditions

- Given a paired Vault, when any planned source is missing from local, remote, or ledger state, then relocation is blocked and normal Drive reconciliation must complete first.
- Given content-hash drift, Drive-version drift, path drift, destination collision, wrong parent root, or file-ID mismatch after preview, when apply is requested, then no migration mutation begins.
- Given two files with equal content, when no explicit plan maps one old path to one new path, then no rename is inferred.
- Given an unpaired Vault with no prior Drive identity, when local migration succeeds, then a later first sync may upload canonical paths and the alias document without a remote relocation phase.

### O2-P4B Remote Relocation

- Given a clean planned source, when relocation runs, then the same Drive file ID remains and only `name` plus private `tsuzunePath` metadata change.
- The Markdown content and Drive parent remain unchanged; this layout does not use `addParents` or `removeParents`.
- Given all planned relocations succeed, when the ledger is updated, then each old key is removed, each new key points to the same file ID, and existing content hashes remain unchanged.
- The remote alias object is updated after note relocation, not before it.
- Completion verification confirms every planned new path, original file ID, original content hash, exact alias bytes, unique ownership, and ledger key.

### Failure And Recovery

- Before the first combined local/remote mutation, the recovery packet records the local rollback packet reference, remote Markdown file IDs/paths/versions, exact remote alias bytes/version, and ledger preimage.
- Given failure after any remote relocation, when automatic recovery runs, then completed relocations are reversed in reverse order with current returned versions, the remote alias preimage is restored if changed, the ledger preimage is restored, and the proven local rollback runs.
- Given external Drive drift prevents safe rollback, when recovery stops, then it retains the recovery packet, identifies unresolved file IDs/paths, blocks further migration and normal sync for that Vault, and never reports success.
- A production gate requires executable tests for success, each mutation-stage failure, exact rollback, and retained recovery after simulated rollback drift.

### Safety Decision

- Passing O2-P4A alone does not close `DRIVE_PATH_ALIAS_UNSUPPORTED`; O2-P4B remains required for already-synchronized moves.
- Passing both test-only gates changes the blocker only to prototype-proven. Live isolated Drive acceptance and explicit production authorization remain separate.
- No app, MCP, package command, or installed-binary production migration entry point is added by the contract task.

## 5. Nonfunctional Requirements

### Simplicity

- Reuse `compilePathAliases`, current Drive ownership properties, file IDs, versions, preview/apply fingerprinting, atomic local replace, and ledger storage.
- Add no OAuth scope, database, dependency, background worker, or generic transaction abstraction.

### Traceability

- Preview and recovery evidence may contain relative paths, hashes, file IDs, versions, and step states, but never OAuth tokens or note bodies.

### Data Integrity

- Every mutation is conditional on the exact previewed identity and version.
- Conflicts are surfaced; alias maps are never automatically merged.

## 6. Open Questions

None for the test-only contract. The visible display name of the remote alias object is an implementation detail; ownership must rely on private app properties, not the name.
