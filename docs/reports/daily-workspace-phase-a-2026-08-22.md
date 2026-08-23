# Daily Workspace Phase A acceptance — 2026-08-22

## Decision

`R5-READY`

Phase A was executed against the installed TSUZUNE binary with an isolated fixture Vault and isolated `userData`. A1–A6 passed. The A5-only rerun established the empty state, a 117-character Japanese filename, changed-file and deleted-file conflicts, and a retryable save-error state at 1280×800. The fixture was restored byte-for-byte and no isolated TSUZUNE process remained.

Phase B and the R5 implementation candidate were not started.

## Product and isolation

- Installed executable: `C:\Users\Humin\AppData\Local\Programs\tsuzune\TSUZUNE.exe`
- SHA-256: `e2e9ce0807bfdeb14aa7268e5dc7f5016e91d989bb055895e38693944e36397f`
- Fixture Markdown digest before/after: `96b2dc1d2c7884a7127ee4cf7e4a484ada2ff4cae7cacf2732de6570f5618021`
- Fixture file count before/after: 8 / 8
- Remaining isolated TSUZUNE processes: 0
- Final source/installed delivery state: governed by [production-update-latest.json](production-update-latest.json); acceptance closes only when `delivery_info` returns `match` after this report and evidence are included in the verified source fingerprint.

The harness used a unique directory under `work/daily-workspace-phase-a-<pid>/` and kept the application window hidden and offscreen. The production Vault was not opened or modified.

## Matrix

| ID | Result | Evidence |
|---|---|---|
| A1 | PASS | `Ctrl+O`, `Ctrl+P`, and `Ctrl+Shift+F` opened one intended surface, focused its input, and restored focus on Escape at 1440×900. |
| A2 | PASS | Pointer-to-keyboard focus, ArrowUp/Down, F2→Escape, and Shift+F10→Escape behaved correctly at 900×768; no rename remained. |
| A3 | PASS | IME composition did not move selection; only committed Japanese text selected the 120-character Japanese note at 900×768. |
| A4 | PASS | At 720×768 the document stayed 720px wide; the center remained reachable with both sidebars open (384px) and closed (652px). Primary controls remained in the viewport. The FileTree footer labels are visually tight at the narrow width and should be watched as polish debt, but the captured boundary did not show an unreachable action. |
| A5 | PASS | The empty state and primary action were visible. The 117-character Japanese filename retained its full `aria-label` and tooltip. Changed-file and deleted-file conflict banners exposed both actions without overlap. An isolated `note:save` failure injection displayed a visible retry action. |
| A6 | PASS | Note, Global Graph, attachment, and linked-view tabs switched and closed with their content preserved. Missing R5 keyboard behavior and `aria-controls` linkage were recorded as `not implemented`, as required by the baseline contract. |

## Evidence

- Structured result: [phase-a-result.json](assets/daily-workspace-phase-a-2026-08-22/phase-a-result.json)
- Harness: [`scripts/check-daily-workspace-phase-a.mjs`](../../scripts/check-daily-workspace-phase-a.mjs)
- Entry points: [a1-entry-points.png](assets/daily-workspace-phase-a-2026-08-22/a1-entry-points.png)
- FileTree: [a2-file-tree.png](assets/daily-workspace-phase-a-2026-08-22/a2-file-tree.png)
- IME/typeahead: [a3-ime-typeahead.png](assets/daily-workspace-phase-a-2026-08-22/a3-ime-typeahead.png)
- Narrow workspace: [open](assets/daily-workspace-phase-a-2026-08-22/a4-narrow-open.png), [closed](assets/daily-workspace-phase-a-2026-08-22/a4-narrow-closed.png)
- Changed-file conflict: [a5-changed-conflict.png](assets/daily-workspace-phase-a-2026-08-22/a5-changed-conflict.png)
- A5-only structured result: [a5-result.json](assets/daily-workspace-phase-a5-rerun-2026-08-22/a5-result.json)
- A5-only visual evidence: [empty](assets/daily-workspace-phase-a5-rerun-2026-08-22/a5-01-empty-state.png), [changed conflict](assets/daily-workspace-phase-a5-rerun-2026-08-22/a5-02-changed-conflict.png), [missing conflict](assets/daily-workspace-phase-a5-rerun-2026-08-22/a5-03-missing-conflict.png), [save error](assets/daily-workspace-phase-a5-rerun-2026-08-22/a5-04-save-error.png)
- Current tabs baseline: [a6-tabs-baseline.png](assets/daily-workspace-phase-a-2026-08-22/a6-tabs-baseline.png)

## Verification and residual boundary

- `node --check scripts/check-daily-workspace-phase-a.mjs`: PASS
- `node scripts/check-daily-workspace-phase-a.mjs`: completed; A1–A4 and A6 PASS; A5 initially UNVERIFIED.
- `node scripts/check-daily-workspace-phase-a.mjs --a5-only`: PASS; `runError: null`; decision `R5-READY`.
- Fixture digest unchanged: PASS
- Isolated process cleanup: PASS (0 remaining)

The A5 save-error evidence uses a deterministic failure injected only into the isolated app process after the real changed-file and deleted-file flows were exercised. It does not modify product code or the production Vault. Phase B and R5 remain unstarted; `R5-READY` means the Phase A evidence gate permits the separately authorized next phase, not that it has begun.
