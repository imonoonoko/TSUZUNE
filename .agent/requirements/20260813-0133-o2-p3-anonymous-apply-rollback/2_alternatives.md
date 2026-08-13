# O2-P3 Anonymous Apply/Rollback Prototype Alternatives

## Codebase Findings

- `src/cli/classification-migration-preview.ts` already validates schema-v1 plans, source digests, reference counts, collisions, aliases, Wiki/Graph/Context equivalence, required directories, and immutable baselines.
- `src/core/path-aliases.ts` already validates and flattens safe Markdown-only aliases.
- `src/main/vault.ts` already has collision-safe note move/rename operations, but O2-P3 needs a multi-file transaction contract rather than a UI operation.
- `docs/path-aliases.md` explicitly forbids classification apply while Drive ignores `.tsuzune/path-aliases.json`.
- Existing O2-P2 tests already create anonymous temporary Vaults and assert zero-write dry-run behavior.

## Options

### Option A: Keep O2-P2 Read-only

Effort: Small
Value: Low

Summary: Keep all physical moves disabled and add no prototype.

Benefits:

- No new mutation code.
- No new safety surface.

Tradeoffs:

- Reference rewriting and rollback remain unproved.
- The classification gate cannot advance.

Flow: `plan -> preview -> blocked`

### Option B: Test-only Anonymous Prototype

Effort: Medium
Value: High

Summary: Add one internal apply/rollback path used only by integration tests that own a newly created temporary Vault.

Benefits:

- Exercises real filesystem mutations without production exposure.
- Reuses the O2-P2 analyzer and existing link/alias projections.
- Can inject failures at each mutation boundary and prove exact restoration.

Tradeoffs:

- Does not resolve Drive behavior or authorize production apply.
- The prototype API must remain inaccessible from app, MCP, and package scripts.

Flow: `temporary fixture -> preview gate -> preimages -> apply -> verify -> rollback -> exact fingerprint`

### Option C: Production-capable Migration Command

Effort: Large
Value: Premature

Summary: Add a CLI or app command capable of applying plans to arbitrary Vaults.

Benefits:

- Direct route to real migrations.

Tradeoffs:

- Exposes destructive capability before Drive and rollback contracts are proven.
- Requires authorization, UX, recovery, packaging, and production acceptance outside this slice.

Flow: `real Vault -> command -> mutations`, currently forbidden.

## Recommendation

Choose Option B. It closes the two local proof gaps with the smallest reachable surface. Keep Option C blocked until the prototype passes and the Drive Path Alias contract is decided separately.
