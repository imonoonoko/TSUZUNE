# Night Workshop design QA

## Source visual

- Target: `docs/reports/assets/tsuzune-night-workshop-dark-target-2026-08-26.png`
- Target dimensions: 1586 x 992
- Target SHA-256: `88F1A0CA9D303DBE790DEF7C84DE53E3A53632E3924807FDEF23FDA0E213770B`
- Contract: `docs/reports/night-workshop-dark-ui-target-2026-08-26.md`

## Rendered implementation

- Editor shell: `docs/reports/assets/night-workshop-dark-2026-08-26/01-editor-shell.png` (1424 x 861)
- Move dialog: `docs/reports/assets/night-workshop-dark-2026-08-26/02-move-dialog.png` (1424 x 861)
- Preview at regular width: `docs/reports/assets/night-workshop-dark-2026-08-26/03-preview.png` (1424 x 861)
- Preview at 900px: `docs/reports/assets/night-workshop-dark-2026-08-26/04-preview-900.png` (900 x 768)
- Preview at the app minimum width: `docs/reports/assets/night-workshop-dark-2026-08-26/05-preview-720.png` (a 720px window request is clamped by the existing `minWidth: 760`; captured content is 760 x 768)
- Vault Graph: `docs/reports/assets/night-workshop-dark-2026-08-26/06-vault-graph.png` (1440 x 900)
- Quick Switcher: `docs/reports/assets/night-workshop-dark-2026-08-26/07-quick-switcher.png` (1440 x 900)
- Command Palette: `docs/reports/assets/night-workshop-dark-2026-08-26/08-command-palette.png` (1440 x 900)
- Full comparison: `docs/reports/assets/night-workshop-dark-2026-08-26/09-reference-comparison.png`
- Focused comparison: `docs/reports/assets/night-workshop-dark-2026-08-26/10-focused-surface-comparison.png`

The source target and rendered implementation were normalized into the same comparison boards before judging visible differences. The fixture state is `fixtures/obsidian-graph-parity-vault`, selected note `00_Home`, with preview image loaded. The modal state also proves `aria-modal`, focus on the destination select, and an inert workspace background.

## Visual comparison

### Matched in this slice

- The white workspace was replaced with the five-level warm charcoal hierarchy: Canvas, Sidebar, Surface, Editor, and Raised.
- Night Thread is restrained to active, connected, focused, and actionable states instead of tinting every control.
- Header, FileTree, editor/preview, right context, dialogs, menus, Quick Switcher, Command Palette, and Graph now read as one material system.
- Editor text remains bright enough to read without using pure white or a glowing canvas.
- Hover, selected, keyboard focus, warning, and danger keep separate shape, border, label, or icon cues.
- The 900px and effective minimum-width captures retain all three panes without a light leak or cropped persistent action label.

### Intentional structural differences

This is the selected A slice: Night Workshop on the current shell. The target's activity rail, compact Windows header, richer workspace tabs, and Outline are not hidden defects in this result; they are later shell/structure work. Existing DOM, Markdown/save behavior, ARIA, and keyboard contracts were intentionally preserved.

### Comparison history

1. Initial dark capture left the toolbar/footer and some temporary surfaces too light. They were moved onto the Night semantic surfaces and the editor-shell comparison was regenerated.
2. Initial narrow capture clipped the left persistent actions and compressed right-context tab labels. At `max-width: 900px`, actions now stack, the context column keeps usable width, and decorative count spans hide while accessible tab names retain their counts.
3. Adversarial Graph review found tag and attachment nodes bypassing the theme. They now use `--graph-node-tag` and `--graph-node-attachment`, with renderer tests and non-text contrast checks.

## Verification

- `npm run typecheck`: passed
- `npm test`: 80 files passed, 1 skipped; 840 tests passed, 1 skipped
- Focused Graph tests: 49 passed
- `npm run check:mcp`: passed
- `npm run build`: passed
- Isolated Electron capture: passed; all eight state images and `capture-result.json` were written, with no `capture-error.txt`
- `git diff --check`: passed (line-ending conversion warnings only)
- Read-only adversarial review: no remaining actionable finding

## Unverified boundaries

- Real Windows 125%, 150%, and 200% display scaling
- Windows High Contrast and Narrator/NVDA accessibility-tree confirmation
- Long-duration glare and eye-fatigue assessment on the user's monitor
- Installed production build and user acceptance

These require the real installed application or the user's environment and are not represented as passed by the isolated fixture.

final result: passed

## Calendar overview QA — 2026-09-10

### Reference and rendered evidence

- Reference: user-provided calendar screenshots in the task conversation; no separate repository asset was supplied.
- Annual overview capture: `docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-heatmap.png`
- Monthly activity-marker capture: `docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-markers.png`
- Activity-list capture: `docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-activity-list.png`
- Final daily-note interaction capture: `docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-electron.png`
- Machine-readable result: `docs/reports/assets/calendar-plugin-compatibility-2026-08-29/daily-calendar-electron.json`

### Result

- The native DailyCalendar now opens on an annual activity heatmap with year selection, month labels, weekday cues, activity levels, recent activity rows, and a preserved monthly view.
- Heatmap cells retain date selection and open the existing activity list; the monthly view retains daily-note selection and created/updated activity markers.
- The isolated Electron acceptance passed for the standard component, all activity interactions, and the generated screenshots. Month-label duplication found during review was corrected before this result.
- Visual review found the heatmap legible in the narrow right context panel; its horizontal scroll remains available for the full year.

### Verification

- `npx vitest run tests/daily-calendar.test.tsx --maxWorkers=1`: 2 tests passed
- `npm test`: 116 test files passed, 1 skipped; 1,254 tests passed, 1 skipped
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run check:calendar:native`: passed
- `git diff --check` on the calendar implementation and acceptance files: passed

final result: passed
