# P0-5 Checkbox Properties — Source and Paired Fixture Evidence

As of: 2026-09-05 JST. Source implementation and isolated runtime checks are verified. Installed production, Git delivery and user acceptance are not included.

## Result and boundaries

The Owner selected the next Obsidian compatibility item instead of Zen UI work. The existing next item was note-local checkbox Properties. The editor now creates an unchecked (`false`) or checked (`true`) field, toggles an existing boolean directly with a native checkbox, deletes it, and shows disabled read-only checkboxes in preview.

Accepted top-level syntax: true/false, True/False/TRUE/FALSE. New or changed values write lowercase booleans; no-op confirmation preserves original bytes. Quoted "true" remains text. Empty/null, yes/no/on/off, boolean list items, complex YAML and global name-to-type management remain outside the form contract. No dependency, IPC or settings registry was added. Zen layout changes and other candidates were not implemented.

## Verification

- Test-first: existing boolean toggle initially failed because no checkbox existed; the implementation made it pass. Preview initially had a test import error, corrected before the expected missing-checkbox RED was observed; then GREEN.
- Focused: 6 files / 130 tests PASS, including editor, preview, typed/scalar helpers, real Vault save/reload and App properties regression.
- Independent core acceptance: 17 tests PASS.
- Full regression: `npx vitest run --maxWorkers=1`: 106 files / 1124 tests PASS; 1 fixture file/test SKIP; exit 0, 85.84 seconds (final run: full-final-focus.log). Earlier campaign OOM is not claimed resolved.
- Typecheck PASS. Final `npm run build` PASS after the keyboard-focus corrections. Typecheck was also repeated and passed. No product code changed after the final full suite.
- `npm run check:mcp` PASS. The generic Skill workflow verifier FAILS against the campaign's pre-existing custom schema (missing generic title/slug/status/approval/packets/verification and final-report.md). Product checks and this schema mismatch are reported separately; no competing state schema was added.
- Independent final review: 3 files / 51 tests PASS; no introduced blocking defects. The final Editor/CSS update received an additional hash-bound review and 28 editor tests PASS. Final four source hashes match the reviewed revisions. Ponytail review: no actionable introduced complexity.
- Paired runtime: 26/26 checks PASS; separate anonymous Vaults and userData, original identical bytes, saved files and fresh-process reopen. Both CDP listeners and isolated apps closed afterward.
- `git diff --check` PASS; existing LF/CRLF advisories remain.

Logs are under `work/checkbox-20260905/`. Paired fixtures, DOM/ARIA snapshots, screenshots, original/stage/final files, hashes and isolation identities are under `output/playwright/p0-5-checkbox-20260905/`. `verification.json` is the 26-check result. Pre-task owned-file copies are in `work/checkbox-20260905/before/`; broad dirty Git changes are not the task delta.

## Keyboard focus boundary

Initial explicit Add-button focus was removed for checkbox toggles. Actual Electron testing then exposed native disabled during autosave blurring to BODY. The existing checkbox now uses aria-disabled during saving/conflict and retains the mutation guard; readOnly remains native disabled. Editor/App 33 tests PASS, reviewer 28 PASS, and the final real-app Space/save focus remains on done. Two toggles restore exact fixture bytes; focus-verification.json PASS.

## Paired matrix

Reference: extracted official Obsidian 1.13.4, fixed obsidian.asar SHA256 `51218495ad940a8515b202d380bde638be6570a198e121f7ca6d484a8a158917`. TSUZUNE: 0.6.0 current-source Electron build, not installed production. Exact PID, runtime versions and paths are in each *-session.json / *-isolation.json.

| Behavior | Observation | Classification |
|---|---|---|
| Existing false / true / FALSE display and mouse toggle | Same boolean states, retained after fresh process | matched, bounded |
| Quoted "true" | Remains text in both final files | matched, bounded |
| New unchecked field immediately after creation/type selection | TSUZUNE writes false; Obsidian initially leaves empty | different |
| Set new field true then false; delete second checkbox | Same final false state, deleted field absent after reopen | matched final semantics; operation steps differ |
| Comments, BOM, CRLF, null spelling | TSUZUNE retains comments/BOM/CRLF/null. Obsidian rewrites these when checkbox is edited | different; preserve TSUZUNE lossless behavior |
| TSUZUNE keyboard Space toggle | Same expected bytes as mouse trial | verified TSUZUNE only |
| Global property type registry / arbitrary YAML | Not implemented or compared | outside this slice |

The first scripted keyboard trial on Obsidian produced unexpected body text (`na# Checkbox`). Cause is unresolved; do not attribute it to an intrinsic product defect or claim paired keyboard parity. Its original result is retained in toggle-results.json. The later mouse trial reset both test files to exact initial bytes, records files after each toggle, and preserves the body in both apps. Mouse-trial results alone establish paired mutation parity.

## Source hashes

- src/core/frontmatter.ts: 2ddee72744b079219033f7618f2674fc2025bb9a7697deb949c9da58638581f1
- src/renderer/components/MarkdownEditor.tsx: 0295fed16d7c368fb75e7a440fae49c217f978889ff74bf106ae201e684f8ae6
- src/renderer/components/MarkdownPreview.tsx: 4b194535a3927c8a6559b0a9902b579bc06b7889a6bc5b9625ce850d57d9c6a7
- src/renderer/styles.css: f08128c7cb98062eddacf58c31ba64a970b2851c5dc95472b7e884c3ead7b9c5

## Data and delivery boundary

No production Vault was opened by automated tests. The selected production TSUZUNE settings and Obsidian configuration file hashes, plus Obsidian protocol registration, match before/after. This is not a whole-profile audit. Anonymous fixture files were mutated only inside the new paired output root; previous P0-4 evidence was left untouched.

Latest installed receipt before this slice: docs/reports/production-update-latest.json, verified 2026-09-04T10:53:06Z from a dirty source tree. It retains a whole-tree fingerprint and installed binary/asar hashes, but no exact source snapshot or per-path source manifest. Task-owned source isolation does not establish a production-equivalent base. Production promotion remains gated on explicit whole-tree approval or reconstruction audit. No production update, MCP registration change, Git operation or next feature was performed.

## Delegation and integration

- Parent CEO-01: selected contract, implemented four product files, UI/disk fixtures, real-app operation, final comparison, reporting and sole Vault writer. Host model is observed as gpt-6-astra; no claim that the session changed to the user-preferred Sol.
- obsidian_baseline / Kierkegaard: Luna low, read-only official Checkbox semantics. Accepted true/false and global-type scope; no inferred quoted/null coercion.
- note_attention_scout / Sagan: Luna low, read-only editor discovery before the Owner chose compatibility, then existing harness/receipt boundaries. The proposed property-collapse direction was not implemented. Accepted harness reuse and source/installed separation.
- checkbox_core_check: Luna low, wrote only tests/frontmatter-checkbox.test.ts, 17 tests PASS against current core hash. Accepted fixtures; its claimed unseen BOM/CRLF case overlaps parent coverage, so independent completeness relies on the separate review boundary below.
- checkbox_review: Terra high, read-only introduced-delta and Ponytail review. Initial 51 tests PASS, then an additional final Editor/CSS focus review and 28 editor tests PASS; no blockers. Parent matched the final hashes and verified real-app focus independently.
- Parent boundary beyond helper tests: actual app save/restart, quoted text, empty/null neighbor, source bytes, creation difference, protected settings/protocol, fresh PIDs and listener cleanup. Reviewer additionally checked uppercase boolean followed by independent comments and another field.
- Observed rework: one test import correction, one existing-token correction, one contaminated Obsidian keyboard trial excluded and replaced by a recorded mouse trial, and a two-stage focus fix verified in actual Electron after component coverage proved insufficient. No cost improvement or permanent agent rating inferred.
- Improve: keep source hash-bound reviews and per-operation saved files. Use mouse for Obsidian parity unless its keyboard focus route has separate evidence. No new automation/runtime introduced.

## Current and next

- Complete: source feature and isolated tests/comparison.
- Persistence complete: after the Owner restarted the client, runtime_info reports stale_runtime:false. The campaign and three hubs were fetched at current revisions, patched once each, and read back with exact content matches. Unique campaign lookup and all three mutual hub links were verified. The project source checkpoint was advanced from P0-3 to P0-5 in the same project patch. No duplicate note was created. p0-5-pending-tsuzune-writeback.json retains the initial block and completed synchronization evidence.
- Next: establish the authorized production promotion boundary. delivery_info remains mismatch. No build, product modification, full test repeat, production update or Git action was performed during synchronization.
- Held: production promotion without that boundary; next feature implementation.
- Research: empty/global type semantics, broader YAML and true paired keyboard interaction.

## Synchronization acceptance after client restart

Parent used the existing tsuzune and tsuzune-execution-record workflow to resume this campaign. checkbox_review (Terra high, read-only) independently rechecked four current product hashes against source-hashes.json and both verification packets; they match. The saved 26/26, focus PASS and 1124 PASS / 1 SKIP evidence remains applicable to that source boundary. Parent accepted this evidence and independently verified four fresh Vault revisions, exact readback, unique lookup and mutual links. This did not re-test installed production. Keep revision-bound synchronization; do not replay stale revisions or bypass the stale-runtime guard.
