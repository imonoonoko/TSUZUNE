# Phase 4A Isolated Runner Contract

## Objective

Close the shadow-runner blockers needed before Gate A without wiring production.

## Allowed Changes

- `src/mcp/history-store-v2-shadow.ts`
- `tests/history-store-v2-shadow.test.ts`
- this contract

Do not change `src/mcp/service.ts`, `src/main/vault.ts`, runtime configuration,
the active Vault, or installed production.

## Required Behaviors

1. Run a real hard-link preflight in the exact shadow directory before intent
   creation or canonical mutation.
2. A preflight or intent-stage failure invokes the canonical callback zero times.
3. After the canonical callback succeeds, read-back or receipt failure preserves
   its result and returns `v2Status: pending-recovery`.
4. Receipt-only recovery never invokes the canonical callback.
5. A valid concurrent receipt race converges to one immutable receipt.
6. A canonical mismatch is detected as pending recovery, not represented as a
   committed receipt.
7. Normal completion leaves no preflight or `.tmp` files.

## Minimal Test Seam

The isolated runner may accept one optional stage failpoint for tests. It may
throw before `preflight`, `intent`, or `receipt` persistence. Do not add a
filesystem abstraction, fallback writer, daemon, lock service, or dependency.

## Single-Writer Boundary

Phase 4A exercises one fixture writer. A detected conflicting after-state is a
NO-GO result. This phase does not claim to close the production `stat`/`rename`
TOCTOU window or authorize Gate B.

## Residual NO-GO

`applyCanonicalUpdate()` can reject after its own canonical mutation. The current
production save path can still fail on post-rename metadata read-back, and the
shadow runner cannot reconstruct the missing public result. Keep this as an
explicit characterization test. Closing it requires a separate production
writer contract; do not expand Phase 4A into `VaultService.saveNote()`.

## Acceptance

1. Narrow test is RED for the intended missing behavior, then GREEN.
2. `npm run typecheck` passes.
3. Related History v2 and MCP/history tests pass with one worker.
4. Full `npm test` passes.
5. `src/mcp/service.ts` has zero references to `history-store-v2-shadow`.

Phase 4A may complete with this residual recorded, but Gate A and Gate B remain
NO-GO until it is closed.
