# MCP Contract Reconciliation — 2026-08-13

## Conclusion

Current source now matches the X1-T1 transport contract again: `build_context` returns `content: []` plus `structuredContent`, while the other nine direct-server tools retain the legacy text block. The Codex Desktop registration remains deliberately narrower at seven tools; `suggest_links`, `move_note`, and `add_link` are implemented and smoke-tested on the direct server but are not enabled in the normal Codex configuration.

This is a source/runtime-contract correction, not a production installation receipt. After Codex Desktop restart, a normal registered `build_context` call returned `content: []` with `structuredContent`, closing the runtime acceptance. The installed v0.5.0 receipt was not reissued.

## Detected drift

At HEAD `560b54d`, Codex configuration launched the repository artifact `out/mcp/server.js`, not an MCP binary owned by the installed desktop package. The direct server exposed ten tools, while the managed Codex block enabled seven. That 7/10 split was not documented consistently.

The current source also routed `build_context` through the shared legacy result helper. The actual transport therefore duplicated the same value in a JSON text block and `structuredContent`, contradicting the X1-T1 structured-only contract and making `npm run check:mcp` fail with `build_context did not return the structured-only context.`

## Minimal correction

- Added one structured-only result path and used it only for `build_context`.
- Kept legacy text transport for the other nine direct-server tools and added an inverse smoke assertion on `search`.
- Applied the same `content: []` assertion to both normal and query-aware `build_context` calls.
- Aligned the autonomous no-op output schema with its existing `unchanged: true` result, where `history_path` is intentionally absent.
- Added the missing `Knowledge` parent to the isolated MCP smoke fixture; production Vault behavior is unchanged.
- Documented the official Codex registration as seven tools and the direct server as ten tools without enabling any new Codex write authority.

No dependency, new service, new public registration, production Vault write, process stop, commit, push, or installation was added.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npx vitest run --maxWorkers=1 tests/mcp-service.test.ts tests/mcp-link-ops.test.ts` | 2 files / 44 PASS |
| `npm run check:mcp` | PASS; direct server 5 read + 5 write tools |
| `node scripts/check-x1-t1-desktop-fixture.mjs` | 12/12 structured-only calls; fixture SHA-256 `8ca7b80b8569b2c002edce1ccd25452c56b6744d99d9fdb217fc6ff034156a6e` |
| Isolated `register-codex-mcp.ps1` check | PASS; seven enabled tools, direct-only three absent, create/update remain prompt-gated |
| `NODE_OPTIONS=--max-old-space-size=6144 npm test` | 60 files / 564 PASS |
| `git diff --check` | PASS |
| Live `build_context` before restart | `content.length === 1`; confirmed the already-started process still served the old artifact |
| Live `build_context` after Codex restart | PASS; `isError === false`, `content.length === 0`, `structuredContent` present, seed ID preserved |

## Remaining boundary

The source, rebuilt `out/mcp/server.js`, and restarted Codex Desktop runtime now agree on the structured-only contract. This runtime result must not be interpreted as proof of model-visible token or billing reduction.

The repository remains a broad dirty working tree and does not match the installed v0.5.0 receipt. Do not run an undifferentiated production update merely to reload MCP. Commit, push, installer promotion, and a new production receipt require a separately reviewed delivery boundary.
