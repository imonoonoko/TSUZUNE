# O2-P3 Anonymous Apply/Rollback Prototype Requirements

## 1. Overview

O2-P3 shall prove, using only anonymous temporary test data, that one validated classification plan can be applied and completely rolled back without data loss. Passing O2-P3 closes only the local reference-rewrite and rollback proof gaps. It does not authorize production apply or resolve Drive behavior.

## 2. Use Cases

- As the TSUZUNE owner, I want a real filesystem round trip on anonymous data so that rollback safety is supported by executable evidence.
- As the TSUZUNE owner, I want immutable evidence and history notes left byte-identical so that classification cannot rewrite provenance.
- As the TSUZUNE owner, I want every injected partial failure restored automatically so that a successful happy path is not mistaken for failure safety.

## 3. Interaction Flow

```text
create anonymous temporary Vault
  -> run existing O2-P2 validation and projection
  -> capture full preimages outside the Vault
  -> apply active-reference rewrites, moves, and alias sidecar
  -> verify applied state
  -> rollback
  -> compare the complete Vault tree with the original snapshot
```

At any injected failure after mutation begins:

```text
failure -> automatic rollback -> exact original tree or explicit test failure
```

## 4. Acceptance Criteria

### Fixture Boundary

- Given a root not created and marked by the current test run, when apply is requested, then it fails before any write.
- Given a symlinked Vault root, planned source, destination parent, or alias sidecar, when apply is requested, then it fails before any write.
- Given an anonymous test-owned root, when the test completes or fails, then its temporary artifacts are removed by test cleanup.

### Preflight And Preimages

- Given plan drift, source digest drift, reference-count drift, unsafe paths, alias errors, or destination collisions, when preflight runs, then the complete Vault tree remains byte-identical.
- Given a valid plan, when apply begins, then the rollback packet is complete and durably written outside the fixture Vault before the first Vault mutation.
- The rollback packet captures every changed Markdown file, every moved source file, prior alias-sidecar bytes or confirmed absence, and the pre-existing directory set.

### Apply

- Given a resolved path-qualified Wiki link in an active writable note, when its target is moved, then only its path component changes; heading, block reference, display alias, surrounding Markdown, encoding, and unrelated text remain unchanged.
- Given links in `40_情報源` or `50_履歴`, when apply runs, then those files remain byte-identical and the old target resolves through the alias sidecar.
- Given each planned move, when apply completes, then the source is absent, the destination exists with identical bytes, and no destination is overwritten.
- Given an existing valid alias sidecar, when apply completes, then existing mappings are preserved and new mappings are validated through the current Path Alias compiler.
- Given no prior alias sidecar, when apply completes, then exactly one valid sidecar is created.
- Applied-state verification must confirm equivalent Wiki resolution, Graph projection, Context included/warning sets, and old/new MCP-ID resolution for the fixture.

### Rollback

- Given a completed apply, when rollback runs, then the full Vault file list, file bytes, paths, alias-sidecar presence/bytes, and directory set equal the pre-apply snapshot.
- Given rollback is requested twice, when the second request runs, then it performs no additional mutation and reports an already-restored state.
- Given a pre-existing alias sidecar, when rollback completes, then its exact original bytes are restored rather than reserialized.

### Failure Injection

- The integration test injects one failure after each mutation class: directory creation, active-reference replacement, physical move, and alias-sidecar replacement.
- After every injected failure, automatic rollback restores the exact pre-apply tree and no temporary in-Vault file remains.
- If rollback itself cannot restore an item, the test fails with the unrestored relative paths; it must not report success or delete the rollback packet needed for diagnosis.

### Safety Decision

- Passing O2-P3 changes `REFERENCE_REWRITE_NOT_APPLIED` and `ROLLBACK_PREIMAGES_NOT_CAPTURED` only from untested to prototype-proven.
- `DRIVE_PATH_ALIAS_UNSUPPORTED` remains open, and all production apply entry points remain absent.
- No generalized migration-safety or cost/token-saving claim is made from this single fixture task.

## 5. User-Facing Nonfunctional Requirements

### Data Integrity

- Verification uses complete file bytes and relative paths, not note counts or semantic summaries alone.
- Collision and drift checks are fail-closed.

### Traceability

- Test output identifies the plan ID, failpoint, before fingerprint, applied fingerprint, restored fingerprint, and remaining blocker list without including note bodies or absolute production paths.

### Simplicity

- Use existing parsers, projection functions, and Node filesystem primitives.
- Add no app route, MCP tool, package command, dependency, database, or reusable transaction abstraction in O2-P3.

## 6. Open Questions

- None for the prototype. Drive behavior is a separate gate and must not be decided implicitly here.
