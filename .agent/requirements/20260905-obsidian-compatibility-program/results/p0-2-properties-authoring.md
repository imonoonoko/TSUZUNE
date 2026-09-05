# P0-2 Properties Text Authoring Evidence Packet

As of: 2026-09-05. Subject: current dirty source checkout, not installed production.
Work item: `tsuzune-obsidian-properties-authoring-20260905`.

## Contract and outcome

The owner selected lossless data compatibility first. This slice adds a Properties form to the Markdown editor for top-level text properties with ASCII letter/underscore names, followed by letters, digits, underscore or hyphen. Add, edit and delete use the existing `onChange` and revision-checked autosave; there is no new write IPC, database or dependency.

- Only the selected property is replaced/removed. Other metadata, ordering, comments, body, BOM and existing line endings remain byte-for-byte unchanged in the accepted fixtures.
- Same-value edits are no-ops. Deleting a property with an inline comment keeps the comment as a standalone line.
- Existing numbers, booleans, dates, nulls, collections and ambiguous values are not converted into text by the form.
- The conservative writer refuses whole documents containing unsupported complex syntax (flow mappings, anchors, aliases, tags, block scalars, or complex flow lists). Simple non-target lists and quoted links are retained. This is a deliberate source-edit-only boundary, not a full YAML parser or full Properties compatibility.
- External source changes discard pending form drafts. Note changes remount the editor. Saving/conflict states disable property mutations; the established source/conflict recovery path remains available.
- Value fields are textareas so escaped line breaks are visible and editable without single-line input sanitization. `__proto__` remains an own property and cannot bypass duplicate-name protection.

## Artifact ownership

- `src/core/frontmatter.ts`: conservative text inspection and lossless set/delete helpers; empty frontmatter and own-key parsing.
- `src/renderer/components/MarkdownEditor.tsx`: local property form state and source-backed operations.
- `src/renderer/App.tsx`: note identity and save/conflict readonly wiring only for this slice.
- `src/renderer/styles.css`: bounded property panel and wrapping form styles.
- `tests/frontmatter.test.ts`, `tests/markdown-editor.test.tsx`: scalar boundaries and public form behavior.
- `tests/app.properties.test.tsx`: real App/editor with mocked IPC, revision inputs, explicit external-event reload and conflict retention.
- `tests/properties-vault.integration.test.ts`: real temporary Vault bytes, fresh service reload and stale revision rejection.
- Program plan/state/ledger, root PLAN/PROJECT_STATUS: current source and next boundary.

Existing unrelated dirty changes were preserved. A Git diff against HEAD is not a task-only production source manifest.

## Verification

- Test-first: initial mutation/UI tests failed before implementation. Additional escaped-newline UI test reproduced `firstsecond` instead of `first\nsecond`, then passed after the textarea change.
- Core safety follow-ups: independent review reproduced typed numeric forms, reserved/malformed plain syntax, hidden `__proto__`, and unsupported non-target syntax bypasses; regression tests cover their refusal or own-key preservation.
- App test failures from assumptions about an always-open form and implicit reload were corrected to assert the actual public behavior: commit closes the form; an explicit Vault event performs reload.
- Real disk fixture proves exact add/edit/delete/read bytes and no stale save over an externally changed file. Automated tests never opened the active Vault.
- Full suite at default heap: FAIL, one worker OOM near 4 GiB; 993 passed / 1 skipped, incomplete.
- Full suite at explicit 8 GiB: FAIL, one worker OOM; 994 passed / 1 skipped, incomplete. Neither partial run is counted as PASS.
- Isolated existing App safety: 99 PASS; WikiGraph: 42 PASS, default heap.
- Final focused: 4 files / 63 tests PASS. Final typecheck: PASS.
- Final full suite: `npx vitest run --maxWorkers=1 --reporter=verbose`, default heap, 104 files PASS / 1 SKIP; 1045 tests PASS / 1 SKIP; exit 0, 84.31 seconds. This run includes the final core and UI fixes. Earlier OOM runs remain failures; the source/reporter/order differed, so the OOM cause is not established and no memory-leak fix is claimed.
- Independent final review: no remaining blocking finding within the bounded text-scalar contract. Parent rechecked exact reviewed source hashes below. `git diff --check`: PASS (line-ending advisories only).

## Delegation and review

Independent file ownership separated core safety, UI integration and App acceptance. Parent retained UI/real-file tests/integration, decisions and all production Vault writeback.

| Agent / role | Model / effort | Scope / evidence | Parent decision |
|---|---|---|---|
| frontmatter_path_scout / investigation | Luna / low | Read-only frontmatter/save path tracing | Reuse normal save; no new IPC |
| properties_ui_test_scout / investigation | Luna / low | Read-only editor/public test entry points | Use existing editor surface |
| scalar_safety / implementation | Terra / high | Only core/frontmatter and its tests; conservative refusal | Adopt safety fixes, restrict unsupported documents instead of adding a full parser |
| properties_save_tests / acceptance | Luna / medium | Only App Properties tests, mocked IPC | Adopt after correcting reload/form assumptions |
| properties_review / independent verification | Terra / high | Read-only typed/malformed/complex YAML and own-key probes; 63 focused tests and exact hashes | Adopt final bounded PASS after all blocking findings were fixed |

All child agents were prohibited from production Vault writes, Git delivery, app promotion and unrelated code changes. Models/efforts above are invocation settings; costs are not inferred. The resumed parent model identity is not asserted from older routing defaults.

Ponytail review, scoped to new scalar helpers:

- `src/core/frontmatter.ts`: shrink: duplicate inspection-failure type/factory has the same shape as edit failures; it can return the existing failure directly.
- `src/core/frontmatter.ts`: delete: the location result exposes `match` but no consumer uses it.
- net: approximately 14 lines possible. Optional cleanup was not mixed into the safety fix; no new abstraction/package was added.

Observed coordination cost: one App-test assumption correction and two bounded core review follow-ups. Maintain independent scalar safety review for subsequent typed/list support, with explicit accepted syntax before implementation; do not expand this into a general YAML parser through ad-hoc regex additions.

## Remaining boundary and next

Source implementation only: no production promotion, installed GUI acceptance, Git delivery or fresh Obsidian paired GUI comparison. Numeric/list editing and global property types remain unimplemented. Compatibility ledger stays `different`.

Next within the approved data-compatibility priority: establish the number/list type and round-trip fixtures, then extend one typed form at a time. Do not start Canvas, Bases or plugin runtime in this slice. Any production promotion remains a separate decision for the whole dirty source or a verified reconstructed production base.

TSUZUNE writeback completed: existing `30_知識/TSUZUNE-Obsidian互換性P0-1-Excluded-files-実施記録-2026-09-05.md` (P0-2 appended to the same campaign), project, roadmap and current-action entry were each updated once. Readback, unique record search and incoming navigation links verified. No new campaign note or raw usage ledger was created. `npm run check:current-decision`: PASS.

## Reviewed source hashes (SHA-256)

- frontmatter: `9191cc414b2eb22e67741db3cd096e1282417504191d35c776b4b31380e78113`
- MarkdownEditor: `c53dcc76147e03d65824d0d5b96d6fc96e4e6ddcb30e6cf7a803e9bebe957d68`
- App: `ffd7cf350fe2e3c9a1d70125a78730e18ac8fcb1a90dd7b6024455c6b23db9c5`
- styles: `8964bf7d188b3b5a72c5c090e80021540636fbfdf56db1c83a47e09efcf2a2a2`
