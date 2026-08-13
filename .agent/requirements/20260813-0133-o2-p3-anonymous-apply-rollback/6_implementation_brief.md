# O2-P3 Anonymous Apply/Rollback Prototype Implementation Brief

## Existing Patterns

- `src/cli/classification-migration-preview.ts`: reuse plan parsing, drift/collision checks, reference classification, alias projection, and Wiki/Graph/Context/MCP equivalence checks.
- `tests/classification-migration-preview.test.ts`: reuse the anonymous temporary-Vault fixture and whole-tree snapshots.
- `src/core/path-aliases.ts`: reuse alias validation and flattening; do not implement a second alias model.
- `src/core/links.ts`: reuse Wiki-link extraction/resolution so rewrites target resolved links rather than text matches.
- `src/main/vault.ts`: use its collision and path-safety behavior as the product reference, but do not expose the prototype through `VaultManager`.

## Likely Touch Points

- Add one internal O2-P3 module beside the preview module, or keep the small prototype in the classification migration test support if no production module needs it.
- Add one focused integration test file for apply, rollback, and failpoints.
- Do not change `package.json`, app IPC/preload/renderer, MCP, Drive sync, installer, or production scripts.

## Technical Assumptions

- The test creates the temporary root and passes an unforgeable in-process ownership token or closure-bound root; a user-supplied arbitrary root is not accepted.
- Rollback preimages live in a sibling temporary directory outside the fixture Vault.
- File replacement uses same-directory temporary files and rename where an existing file is replaced.
- Mutation order is explicit and short. Rollback runs in reverse order and restores original bytes rather than reconstructing Markdown.
- Active-reference rewriting changes only links that the preflight index resolves to a planned source.

## Risks

- Naive string replacement can corrupt aliases, fragments, code blocks, or unrelated text; use the existing parsed link spans or extend the existing parser minimally.
- Directory cleanup can remove pre-existing directories; snapshot the original directory set and remove only newly created empty directories.
- Reserializing the prior sidecar can change bytes; preserve the exact preimage.
- A generic transaction helper would broaden scope; keep the prototype local until a second real use exists.

## Test Plan

- Successful apply verifies moved bytes, active rewrites, immutable bytes, alias resolution, and all projections.
- Explicit rollback verifies exact whole-tree and directory restoration.
- Existing-sidecar and absent-sidecar fixtures both round-trip exactly.
- One failpoint per mutation class proves automatic restoration.
- Drift, collision, malformed plan, unsafe root, and symlink cases prove zero writes.
- Run the focused classification, Path Alias, link, Graph, Context, and atomic-Vault tests needed by the actual implementation diff.

## Stop Condition

Stop when the anonymous fixture passes all round-trip and failpoint checks and the remaining blocker list contains only `DRIVE_PATH_ALIAS_UNSUPPORTED`. Do not add a production entry point or start Drive design in the same task.
