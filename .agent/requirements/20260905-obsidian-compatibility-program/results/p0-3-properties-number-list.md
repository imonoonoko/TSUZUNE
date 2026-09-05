# P0-3 Number and List Properties — source / isolated fixture evidence

Work item: `tsuzune-properties-number-list-20260905`. Date: 2026-09-05 JST.

## Contract and delivered behavior

Extend the existing Properties form to add, edit and delete decimal numbers and simple lists, using the unchanged App autosave and VaultService revision-checked atomic save path. No new dependency, IPC, database or runtime was introduced.

- Decimal grammar: `^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$`. Values stay lexical strings; large decimal digits, signs and trailing fractional zeros do not pass through JavaScript Number.
- Lists accept simple indented/indentless block syntax and single-line flow syntax, with explicit text or decimal-number items. Empty lists, empty text, escaped multiline text and quoted Wiki links are supported. `"42"` remains text and `42` remains a number.
- Existing property kinds cannot change implicitly. A list item's text/number choice is explicit; invalid numeric input remains in the draft without a write.
- Ambiguous/complex syntax, nested collections, anchors, tags and unsupported target types are refused. Known ordinary boolean/date/null/unsupported-number neighbors remain untouched. Property names remain ASCII letters/underscore followed by letters/digits/underscore/hyphen; Unicode keys and global property-type management are outside this contract.
- Unchanged commits are byte-identical no-ops. Edited lists use a two-space block representation (or `[]` when empty). Header comments remain inline; old item/interior comments become standalone comments so deleting/reordering an item cannot attach its old comment to a different item. This preserves comment text, not original item-comment placement. Non-target ranges, trailing neighbor comments, BOM, EOL and body retain exact bytes.
- Source changes discard stale drafts. Busy/conflict states disable property mutations. Stale file saves return FILE_CHANGED and preserve external bytes.

## Ownership and review

Parent owns MarkdownEditor UI/styles, App and real-file acceptance tests, integration, repository records and all TSUZUNE writes. `App.tsx` and VaultService were read for the existing path and were not changed by P0-3. Pre-existing dirty changes are preserved; HEAD diff is not a task-only production manifest.

| Agent / responsibility | Actual invocation | Owned / prohibited surfaces | Parent disposition |
|---|---|---|---|
| typed_core / core implementation | gpt-5.6-terra, high | Only `src/core/frontmatter.ts`, `tests/frontmatter-properties.test.ts`; no UI, Vault, Git or production changes | Bounded core work adopted after parent data-preservation and reload corrections |
| typed_review / independent verification | gpt-5.6-terra, high | Read-only final core/UI and temporary external probes; no repository or Vault writes | Adopt final hash-bound PASS after the parser reload fix; earlier hash PASS superseded |

Independent parsing safety review and disjoint core/UI ownership justified temporary delegation. No permanent agent/runtime was added. Model effort is task allocation, not measured cost or ability ranking. Parent runtime model is not inferred from older routing defaults.

## Verification trail

- RED witnessed before number UI wiring and before list item controls; each became GREEN.
- Parent real-file test caught a following comment being consumed by target replacement. Core fixes limit scalar/flow ranges to one line and block ranges to the last actual item.
- Parent review caught item-comment reassignment, overly permissive block indentation/dash parsing, negative-number rejection, null/empty-list confusion, plain apostrophe comment splitting and unsupported-neighbor regression. Dedicated tests now cover the bounded correction.
- Parent App save/reload test and an additional indentless-list UI test caught an inconsistency between the display parser and typed parser for comment-bearing list headers. Final acceptance includes both public paths, not only core helper tests.
- Actual temporary Vault tests cover exact number/list add, edit, clear, delete and fresh-service reopen, and stale saves for text/number/list. App tests cover expectedContent/expectedModifiedAt inputs, explicit external-event reload, no-op commit and FILE_CHANGED hold. Automated tests never opened the active Vault.
- Earlier P0-2 full-run OOM failures remain historical unresolved failures; this slice does not claim a memory-leak fix.

Final verification:

- `npx vitest run tests/frontmatter.test.ts tests/frontmatter-properties.test.ts tests/markdown-editor.test.tsx tests/app.properties.test.tsx tests/properties-vault.integration.test.ts --maxWorkers=1 --reporter=dot`: 5 files / 117 tests PASS, 11.96 seconds, exit 0.
- `npm run typecheck`: PASS.
- `npx vitest run --maxWorkers=1 --reporter=verbose`: 105 files PASS / 1 SKIP; 1099 tests PASS / 1 SKIP; 74.39 seconds, default heap, exit 0. Local raw log: `work/p0-3-properties-full-test.log` (excluded from Vault writeback).
- `git diff --check`: PASS; pre-existing line-ending advisories only.
- The existing MarkdownEditor attachment test emitted non-fatal CodeMirror/jsdom `getClientRects` stderr while passing. This is not installed-browser rendering evidence.
- Independent final changed-parser review: PASS on the exact hashes below, received 2026-09-05 about 05:10 JST. Separate 117-test focused run, typecheck and 170 tests across search/context/temporal/MCP parser callers PASS. External probes covered comment-bearing/indentless headers, malformed/stray/nested forms, CRLF/BOM body separation and `tag:#design` search. Parent confirmed matching hashes and adopted this bounded result.
- `npm run check:current-decision`: PASS after roadmap updates.

Final source hashes (SHA-256), unchanged after the full regression:

- `src/core/frontmatter.ts`: `4AB5F998D40FD24764F13DCF3B67D6CF05C8EA75665519E34750C2E057BF7B60`
- `src/renderer/components/MarkdownEditor.tsx`: `3CF1D3499F9ABC7FF69CCD1668FE85352D2FE295612E6FCC28304C77999C4C01`
- `src/renderer/styles.css`: `358419CC322E8BCF251663CC4B403DAF3A75EF9BA02D3D7CB572D9D8DB411E7E`
- `tests/frontmatter-properties.test.ts`: `6EA3983E8ACB8753BD18BEBB0645E870A444FE6CE083B7753E6D265675069832`
- `tests/markdown-editor.test.tsx`: `7522734C01BA62D7D7C0DAB87FD3FD6E8303454103643E19498BD9A41E60FF7E`
- `tests/app.properties.test.tsx`: `DE1DA1CA75652EE198B79509B3F06DA575CB989B38712790F9367B3F313AA702`
- `tests/properties-vault.integration.test.ts`: `3893030ADEF5A623ECFA5B8AA446835B22E6E106178F62D5622487582F870746`

## Complexity review

`src/core/frontmatter.ts: typedInspectionFailure`: shrink: duplicate failure factory; return the existing edit failure directly. Optional cleanup only, not mixed into the final data-safety correction.

net: -7 lines possible.

Maintain bounded syntax and independent safety review. Improvement guard: cover both public display/parser and mutation/parser paths with save/reload fixtures before broad regression. Coordination required corrective core rounds and one late App-boundary discovery; a core-only PASS was insufficient and was not accepted as whole-feature completion. No time/token/billing savings are claimed.

## Remaining boundary and next

Source and isolated fixtures only. No production update, installed GUI test, Git delivery or fresh paired Obsidian GUI comparison. Properties remains `different`, not fully matched. Current supported decimal subset intentionally excludes exponent, hex, nonfinite values and implicit coercion.

Next within the approved data-compatibility priority: compare these implemented text/number/list round trips in an isolated Obsidian/TSUZUNE fixture and record concrete remaining differences before selecting another authoring syntax. Do not automatically start Canvas, Bases, plugins or production promotion. Production promotion needs a separately verified whole-source boundary.

Official scope references (read 2026-09-05): [Obsidian Properties](https://help.obsidian.md/properties), [YAML 1.2.2](https://yaml.org/spec/1.2.2/). They establish type/syntax context, not fresh runtime parity.

## Persistence

Updated the existing TSUZUNE campaign record `30_知識/TSUZUNE-Obsidian互換性P0-1-Excluded-files-実施記録-2026-09-05.md` once, with the P0-3 verified boundary. Updated the affected project, roadmap and current-action entry once each. Readback confirmed the new result/next boundary in all four notes; unique search returned the single campaign record; resolved backlinks include the project, roadmap and current-action entry. No duplicate record or raw test/usage log was added to the Vault. Repository plan/state/ledger and root PLAN/PROJECT_STATUS now reflect the same source-only checkpoint.

Task efficiency measurement: the same work item was started once in baseline mode and finished once with `outcome: pass` at 2026-09-05 05:12 JST. The local recorder observed the parent and two child sessions. Raw account/token data stays in its local ledger; no billing or efficiency improvement is inferred.
