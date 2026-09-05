# Calendar Plugin Compatibility Orchestration

## Goal
Prove and ship exact compatibility for Liam Cain Calendar 1.5.10 without creating a generic Obsidian plugin runtime.

## Tracks
1. Upstream contract — complete: official release identity, public behavior, settings, commands, compiled API usage.
2. Host architecture — complete: current TSUZUNE seams, trust boundary, smallest target-specific shim.
3. Conformance — complete: fixture, RED/GREEN tests, UI/accessibility and unseen boundary checks.
4. Integration — complete for the original Calendar 1.5.10 compatibility boundary.
5. Live user activity visibility — complete: the screenshot used the native `DailyCalendar` fallback, while the original activity UI existed only inside the official Calendar iframe. The native path now exposes non-color-only creation/update marks and the same note-list interaction; source and installed-`app.asar` real-Electron acceptance passed, and the user confirmed the activity counts and note list in the active Vault.

## Integration Order
Upstream identity -> API matrix -> RED conformance -> host implementation -> focused GREEN -> full regression -> packaged/installed acceptance -> TSUZUNE final boundary.

## Stop Conditions
- Official artifact identity cannot be pinned.
- Required behavior demands generic unrestricted Node/renderer execution.
- A change would overwrite existing notes or bypass TSUZUNE save/conflict safety.
- Production app is running when production update is required.

## Integrated Result

- Official artifact is fixed to Calendar 1.5.10 and executed without modifying `main.js` or `manifest.json`.
- The compatibility host is Calendar-specific; arbitrary Obsidian plugins remain manifest-only.
- Full suite, JSDOM artifact check, working-tree Electron acceptance, first production update, and installed `app.asar` Electron acceptance passed.
- Final evidence is consolidated in `8_evidence_packet.md`.

## 2026-08-29 Live Falsification Packet

- Objective: make creation/update activity visible and operable in the user's actual installed Calendar path, not only in the isolated fixture.
- Success: the real 2026-08-17 cell shows a non-color-only activity affordance; a coordinate click opens the note list; installed and live paths use the same data/message sequence.
- Constraints: preserve the dirty worktree and Markdown source of truth; do not open the active Vault in automated smoke; do not stop the running TSUZUNE process; add no database, dependency, or generic plugin runtime.
- Packets: live process truth, real Calendar call path, live-mode RED seam, snapshot shape audit; parent owns integration and production rollout.
- Verification: first reproduce the missing legend/marks with the real startup order, then focused RED/GREEN, full regression, installed acceptance, and user confirmation.
- Stop: production installation waits while TSUZUNE is running; the work is not complete while fixture-only evidence disagrees with the user's screen.

## 2026-08-29 Native Fallback Correction

- Root cause: production had no ready Calendar plugin artifact, so `App` rendered `DailyCalendar`; the previous acceptance covered the iframe path only.
- Implemented: native activity indexing from `createdAt` and `modifiedAt`, exact `50_履歴` exclusion, creation/update marks, note list, note opening, outside-click close, Escape close, and preserved daily-note date clicks.
- Verified: focused RED/GREEN tests, full Vitest regression, typecheck, build, MCP check, official Calendar artifact Electron acceptance, and native fallback real-coordinate Electron acceptance.
- Installed boundary: the final production receipt records matching built/installed hashes and an unchanged production profile; the extracted installed `app.asar` passed the native real-coordinate acceptance.
- Final live boundary: on 2026-08-29 the user opened the installed TSUZUNE with the active Vault, displayed the 2026-08-29 activity list with creation/update counts and note rows, and confirmed `見えた`. Outside-click and Escape remain automated acceptance evidence rather than a claimed user-operated check.
