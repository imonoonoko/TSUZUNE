# Working Tree Boundary Review — 2026-08-14

## Conclusion

The installed product is verified, but the repository does not yet have a clean Git checkpoint for that exact delivery. Freeze the current integrated product snapshot before starting another feature.

Do not split Drive S1, S2, S3, MCP Bridge, and Tray into artificial file-level commits. They share `drive-sync-service.ts`, `ipc.ts`, `index.ts`, `App.tsx`, the Drive types, and the same production receipt. The simplest reproducible boundary is one integrated product commit, followed by evidence/navigation and the blocked classification packet.

No commit, push, Drive apply, classification apply, or production reinstall was performed in this review.

## Rechecked State

- branch: `agent/tsuzune-mcp-integration`
- HEAD: `6b8c55e`
- origin: ahead 0 / behind 0
- pre-report working tree: 43 status entries
  - tracked: 26
  - untracked: 17
- `git diff --check`: PASS; Git printed LF-to-CRLF warnings but no whitespace error
- installed receipt: v0.5.0, `installed-and-verified`, dirty source explicitly recorded
- receipt verification time: 2026-08-14 20:13 JST
- receipt boundary: 63 files / 626 tests, 10/10 production checks, built/installed hashes equal, production profile 57 files unchanged

This report adds one untracked file, so the working tree has one additional status entry after the snapshot above.

## Boundary A — Integrated Product Snapshot

Commit the exact already-verified product state together rather than manufacturing intermediate states that were never installed or accepted.

### Drive S1–S3 and long-path handling

- `src/core/drive-sync.ts`
- `src/main/drive-sync-service.ts`
- `src/main/google-drive.ts`
- `src/main/ipc.ts`
- `src/renderer/App.tsx` Drive move/count hunks
- `src/shared/types.ts`
- `tests/drive-sync-service.test.ts`
- `tests/google-drive.test.ts`
- `tests/ipc.graph-settings.test.ts`

The same service and ledger implement remote-version reuse, Changes API state, explicit note moves, long UTF-8 path storage, preview/apply revalidation, and conflict fail-closed behavior. Splitting S1/S2/S3 by file would be false separation.

### MCP Bridge and Tray lifecycle

- `src/main/mcp-drive-sync-bridge.ts`
- `src/mcp/drive-sync.ts`
- `src/mcp/server.ts`
- `src/main/index.ts`
- the shared Google queue and close-confirmation hunks in `src/main/ipc.ts`
- `scripts/check-mcp.mjs`
- `scripts/register-codex-mcp.ps1`
- `tests/mcp-drive-sync.test.ts`
- `tests/app.safety.test.tsx`

The bridge reuses the running app's Drive service and lifecycle. Tray close behavior keeps the bridge alive; these are one runtime boundary.

### Icon and production source snapshot support

- `src/renderer/assets/tsuzune-app-icon.svg`
- `src/renderer/assets/tsuzune-app-icon.png`
- `src/renderer/assets/tsuzune-tray-icon.svg`
- `src/renderer/assets/tsuzune-tray-icon.png`
- deletion of `src/renderer/assets/tsuzune-woven-loop.png`
- `src/renderer/App.tsx` icon import hunk
- `package.json`
- `tests/release-config.test.ts`
- `scripts/update-production.mjs`

The one-line `existsSync` filter is required so the source fingerprint accepts a legitimate tracked deletion. It is part of the verified delivery gate, not a speculative abstraction.

### Recommended treatment

Use one integrated product commit unless a staged intermediate tree is independently rebuilt and tested. The current production receipt proves the combined snapshot, not hand-crafted intermediate commits.

## Boundary B — Evidence, Navigation, and Handoff

- `DESIGN.md`
- `PLAN.md`
- `PROJECT_STATUS.md`
- `README.md`
- `docs/INDEX.md`
- `docs/mcp-integration.md`
- `docs/windows-production.md`
- `docs/codex-handoffs/2026-08-14-drive-sync-background-icon.md`
- Drive S1/S2/S3, MCP Bridge, and Icon Refresh reports
- Icon Refresh screenshot evidence
- `docs/reports/production-update-latest.json`
- this report

These files describe the integrated product snapshot. Keep them separate from product code if that improves review, but do not rewrite their claims to imply an independently verified intermediate build.

## Boundary C — Blocked CP1-C-07 Packet

- `docs/migrations/o2-production-classification-apply-plan.json`
- `docs/migrations/o2-production-classification-apply-packet.json`
- `docs/reports/cp1-c-07-production-classification-apply-packet-2026-08-14.md`

Keep this as a separate documentation-only commit. The packet says `applyAllowed: false` and `approvalState: not-requestable`. It must not be bundled with a Drive apply or treated as an executable migration authorization.

The active production Vault later established a clean normal sync baseline, but the remote five-object preview was not refreshed. The packet remains blocked.

## Verification Run During This Review

- `npm run typecheck`: PASS
- targeted Vitest: 5 files / 54 tests PASS
  - Drive sync service
  - Google Drive adapter
  - IPC move/rollback
  - MCP Drive bridge
  - release configuration
- `npm run check:mcp`: PASS, 6 read tools / 7 write tools
- `git diff --check`: PASS
- Ponytail review: Lean already. No new dependency, duplicate sync engine, generic event bus, speculative cache, or unnecessary abstraction was found.

The full 63-file / 626-test production gate was not repeated because the installed receipt already records it for the integrated source snapshot. Re-run the official gate only after creating the clean Git checkpoint.

## Safe Commit Sequence If Authorized

1. Commit Boundary A as the integrated verified product snapshot.
2. Commit Boundary B as evidence, navigation, and handoff.
3. Commit Boundary C as the explicitly blocked classification packet.
4. Confirm the tree is clean and origin state is understood.
5. Run the official `npm run production:update` from the clean commit.
6. Confirm 10/10 checks, exact built/installed hashes, unchanged production profile, and refreshed MCP registration.
7. Commit the refreshed receipt/closeout if the gate changes tracked evidence.

Do not perform these Git or production actions without explicit authorization.

## Residual Risks and Next Gate

- Installed production is verified, but the current Git history cannot reproduce it from a clean HEAD until the dirty snapshot is committed.
- S3 automated and installed delivery checks pass, but the one-note move preview/apply/zero-preview live acceptance remains open.
- Drive deletion propagation, attachment sync, move-plus-edit resolution, and mobile shell remain separate future slices.
- CP1-C-07 remains forbidden until its remote preview is refreshed and separately approved.
- LF-to-CRLF warnings are present. They are not current diff failures; do not normalize unrelated files merely to remove warnings.

Stop this boundary-review slice here. The next state-changing action is explicit authorization for the commit sequence or for the S3 Drive apply acceptance.
