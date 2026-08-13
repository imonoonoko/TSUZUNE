# O2-P3 Anonymous Apply/Rollback Prototype Discussion Log

## Intake And Setup - 2026-08-13 01:33 JST

### User Input
> Follow the CP1 fresh-task handoff, choose exactly one natural bounded long task after preflight, and proceed with the recommended approach.

### Codex Proposal Or Question
The clean `5266131` worktree and the latest dirty-source production receipt were reconciled read-only. O2-P3 was selected as one bounded requirements task: define an anonymous temporary-Vault apply/rollback prototype without touching the production Vault, Drive, product code, or installed app.

### Decisions
- Accepted: use targeted TSUZUNE retrieval and repository evidence.
- Accepted: produce an implementation-ready, test-only O2-P3 contract.
- Rejected: production-capable migration CLI or app UI in this slice.
- Open: none for the requirements checkpoint.

### Rationale
O2-P2 already identifies exact blockers. A test-only prototype can close the reference-rewrite and rollback proof gaps without weakening the remaining Drive prohibition or exposing a production mutation surface.

---

## Alternatives And Scope - 2026-08-13 01:33 JST

### User Input
> Use the recommended approach.

### Codex Proposal Or Question
Prefer an integration-test-owned temporary Vault and an internal prototype function over a general CLI. Reuse the O2-P2 plan parser, analyzer, Path Alias compiler, link parser, Graph, and Context projection.

### Decisions
- Accepted: rewrite only active writable references; preserve `40_情報源` and `50_履歴` bytes.
- Accepted: preserve old immutable links through a Path Alias entry.
- Accepted: capture rollback preimages outside the fixture Vault before the first mutation.
- Accepted: require byte-for-byte round-trip restoration and injected-failure restoration.
- Rejected: Drive sidecar synchronization, remote rename, production apply, UI, database, and generic transaction framework.

### Rationale
This is the smallest slice that directly exercises the two unproved local-safety blockers while leaving `DRIVE_PATH_ALIAS_UNSUPPORTED` explicit.

---
