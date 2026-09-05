# Obsidian Compatibility Ledger

As of: 2026-09-06
TSUZUNE baseline: P0-7 source and exact-byte UI conformance verified. Installed identity and acceptance belong to the latest production receipt and final Vault campaign; P0-6 is historical installed paired evidence.  
Obsidian baseline: current official Help checked 2026-09-05; paired desktop evidence is limited to the fixed Obsidian 1.13.4 fixtures named below.

## Status Contract

- `matched`: the same bounded public behavior has current paired evidence or an exact current conformance fixture.
- `different`: both products have the surface, but observable behavior or supported breadth differs.
- `missing`: TSUZUNE has no corresponding user-facing surface.
- `not_proven`: an implementation exists, but current evidence cannot establish the same bounded behavior.
- `out_of_scope`: comparison is retained, but implementation is not authorized by the local product boundary.

No row implies pixel parity, mobile parity, every Obsidian setting, or arbitrary community-plugin compatibility.

## File, Authoring, and Metadata

| Obsidian surface | TSUZUNE status | Current evidence | Compatibility gap / next proof | Priority |
|---|---|---|---|---|
| Local Markdown source of truth | matched | `src/main/vault.ts`, `tests/vault.integration.test.ts`, official [file formats](https://obsidian.md/help/file-formats) | Bound is `.md` round-trip and collision-safe local handling, not every accepted format. | — |
| Accepted non-Markdown files | different | `src/shared/attachments.ts`, attachment integration tests | TSUZUNE supports a bounded attachment set; `.canvas` and `.base` are not treated as product documents. | P1 |
| Markdown editing / save | different | `src/renderer/components/MarkdownEditor.tsx`, revision-checked `note:save`, editor/app tests | Core source editing and safe save exist; Obsidian Live Preview, source-mode breadth, and full syntax interaction are not paired. | P1 |
| Attach, preview, move, open | different | `src/main/vault.ts`, `MarkdownPreview.tsx`, graph attachment reports/tests | Core local attachment flow exists; supported types and context actions are narrower. | P1 |
| Properties in document | different | Text/number/list [P0-4 evidence](results/p0-4-properties-paired-comparison.md) and checkbox [P0-5 evidence](results/p0-5-checkbox-properties.md), fixed Obsidian 1.13.4 and current-source TSUZUNE, save and fresh-process reopen | Mixed lists, comments, number spelling, BOM/EOL and initial unchecked values differ. Preserve TSUZUNE lossless behavior. Complex YAML/global types remain outside. These changes were included in the 2026-09-05 whole-tree production promotion; subsequent P0-7 installed acceptance is recorded in the final Vault campaign. This does not expand the paired Properties cases or claim whole-Properties parity. | P0-5 source/comparison verified |
| Properties: explicit boolean checkbox toggle / save / reopen | matched | P0-5 existing false, true and FALSE mouse toggles; explicit new false state and deletion retained after fresh process; 26 bounded checks | Public boolean semantics only. Initial checkbox creation differs below; no global-type, full keyboard or whole-Properties parity claim. | — |
| Properties: newly created unchecked value | different | P0-5 TSUZUNE creation writes false; Obsidian type selection leaves an empty value until toggled | Preserve explicit boolean creation. Null/empty conversion and global registry need a separately selected contract. | Observed difference |
| Properties: text / ordinary decimal / text-list final values | matched | P0-4 cases 01, 02, 05; public edits, list add/item edit/item delete/property delete and fresh-process reopen | Bounded semantic results only; quote/EOL/comment bytes and huge-number initial display differ. | — |
| Properties: mixed text/number lists | different | P0-4 cases 03/04: TSUZUNE retains mixed types; Obsidian requires a list-type selection and converts numeric items to text when editing | Type selection alone left Markdown unchanged; first item edit triggered conversion. No lossy compatibility change authorized. | Observed difference |
| Properties view / global type management | missing | no current user-facing implementation | Needs active-note and all-properties contracts before implementation. | P1 |
| File explorer | different | `src/renderer/components/FileTree.tsx`, keyboard/ARIA acceptance | Core local tree works; exact Obsidian context actions and Excluded files interaction are not fully paired. | P0 |
| Rename / move / collision handling | different | [P0-6 installed paired evidence](results/p0-6-file-operations.md), fixed Obsidian 1.13.4, fresh-process reopen | Path operations and collision non-overwrite match; incoming-link updates and byte preservation differ. Profile-invariance check failed (cache/session changes); do not claim fully isolated PASS. | P0-6 compared |
| Rename rejection / move collision numbering | matched | P0-6 both reject an existing rename target and move to `Source 1.md`; source and destination bytes survive restart | Bounded to the four anonymous collision files; crash, case-only and folder moves are untested. | — |
| Rename / move incoming-link maintenance | different | [P0-7 repair](results/p0-7-lossless-link-maintenance.md): incoming Wiki / Markdown / frontmatter links follow with non-target bytes intact; 32 safety tests and exact-byte UI restart proof | Bounded P0-6 target semantics now follow. Protected notes, ambiguous links and unsupported destinations remain bounded; bytes differ intentionally from Obsidian. Delivery requires current receipt plus installed UI evidence. | P0-7 source verified |
| File recovery snapshots and restore UI | missing | conflict banner and atomic-save tests are prevention, not recovery history | Do not equate safe save with Obsidian File recovery. | P1 |

## Find, Link, and Navigate

| Obsidian surface | TSUZUNE status | Current evidence | Compatibility gap / next proof | Priority |
|---|---|---|---|---|
| Search | different | `src/core/search.ts`, `tests/search.test.ts`, search acceptance report | Strong local search and several operators exist; Obsidian grammar/history/collapse behavior is broader. | P1 |
| Quick switcher | different | `QuickSwitcherDialog.tsx`, quick-switcher tests/report | Open/create/MRU work; Excluded files should be deprioritized rather than removed. | P0 |
| Internal links / link suggestions | different | `src/core/links.ts`, editor note selector, link tests | Wikilinks and aliases work; Markdown-link breadth and excluded-candidate ordering are not fully aligned. | P0 |
| Linked backlinks | different | `getBacklinks`, `RelatedNotes.tsx`, app tests | Linked mentions work; linked-view shell/persistence and exact exclusion semantics differ. | P1 |
| Unlinked mentions | missing | no unlinked-text mention index/view | Official exclusion behavior explicitly applies here. | P1 |
| Outgoing links | different | `getOutgoingLinks`, Related notes | Basic explicit outgoing targets exist; Obsidian view controls are narrower or unpaired. | P1 |
| Outline | different | `markdown-headings.ts`, outline app tests | Heading jump exists; full Obsidian controls are not paired. | P2 |
| Bookmarks | different | Vault bookmark persistence, Bookmark dialog/panel/tests | File bookmark core exists; heading/search/bookmark kinds and exact group/order UI differ. | P2 |
| Tags and tags view | different | `src/core/tags.ts`, search/Graph tag tests | Extraction and navigation exist; full Tags view hierarchy/actions are not paired. | P2 |
| Page preview on hover | missing | no bounded hover-preview surface found | Browser/attachment preview is not Obsidian Page preview. | P2 |
| Random note | missing | no current command found | Small core-plugin parity candidate after P0/P1 foundations. | P2 |

## Workspace and Daily Use

| Obsidian surface | TSUZUNE status | Current evidence | Compatibility gap / next proof | Priority |
|---|---|---|---|---|
| Tabs within the current session | not_proven | `WorkspaceTabBar.tsx`, app tests, installed accessibility report | Keyboard/focus behavior is strong, but no fresh paired Obsidian fixture for the current checkout. | P1 |
| Named Workspaces / restart restore | missing | no named save/load/delete layout contract | Obsidian stores open files/tabs and sidebar visibility/width in named layouts. | P0 |
| Daily notes | different | daily-note core, calendar, app tests | Create/open/templates work; settings and all Obsidian date/template behaviors are not paired. | P1 |
| Templates | different | `src/core/templates.ts`, editor/app tests | Insert works; property merge and cursor behavior need explicit contracts. | P1 |
| Command palette | different | command-palette component/tests | Core commands work; command breadth and plugin command registration differ. | P1 |
| Custom hotkeys | missing | fixed shortcuts exist in `App.tsx` | Fixed shortcuts are not a user-editable hotkey map. | P1 |
| Slash commands | missing | no current editor command surface found | Could reuse the command registry after command contracts stabilize. | P2 |
| Unique note creator | missing | Daily notes are date-based but no generic time-coded creator exists | Separate small core-plugin parity item. | P2 |
| Word count | missing | no note word/character-count surface found | Small core-plugin parity item. | P2 |
| Audio recorder | missing | no recorder surface found | Requires explicit media/device scope. | Held |
| Footnotes view | missing | no dedicated footnotes view found | Markdown rendering alone is not the view. | P2 |
| Format converter | missing | no conversion surface found | Needs exact conversion fixtures to avoid data loss. | Research |
| Note composer | missing | no merge/split surface found | Data-changing behavior requires exact preservation tests. | Research |
| Slides | missing | no presentation surface found | Not needed for the first compatibility tranche. | Held |
| Web viewer | missing | Browser Clipper captures sources but does not embed a general web viewer | Keep capture and browsing responsibilities distinct. | Held |

## Structural Views

| Obsidian surface | TSUZUNE status | Current evidence | Compatibility gap / next proof | Priority |
|---|---|---|---|---|
| Global Graph | different | `WikiGraphView.tsx`, graph settings/tests, selected GP0 paired reports | Many bounded interactions were matched against 1.13.4, but full context menu, panes, visual behavior, and current dirty checkout are not fully proven. | P1 |
| Local Graph | different | direct-neighbor implementation and tests | No depth expansion and incomplete filter/interaction parity. | P1 |
| Unresolved Graph nodes | matched | exact Obsidian 1.13.4 query fixture encoded in `tests/graph.test.ts` | Bound is node identity/retention for the recorded malformed queries, not all Graph behavior. | — |
| Graph search/camera restart subsets | not_proven | paired GP0 reports and capture scripts | Historical 1.13.4 evidence exists; current dirty source has not been recaptured. | P1 |
| Canvas document/view | missing | HTML Canvas used by Graph is unrelated to Obsidian `.canvas` | First define file round-trip and card/edge minimum; do not start with visual cloning. | P1 |
| Bases | missing | no `.base` parser or view found | Official syntax is broad; start only after Properties foundation. | P1 |

## Settings, Extension, and Transport

| Obsidian surface | TSUZUNE status | Current evidence | Compatibility gap / next proof | Priority |
|---|---|---|---|---|
| Excluded files: raw Vault enumeration | matched | Renderer IPC now uses the unfiltered `vault.scan()`; fixture test retains directory, note, and attachment. Obsidian 1.13.4 kept `app.vault.getMarkdownFiles()` unchanged. | Bounded to the recorded fixture and current source; installed runtime is not updated. | P0-1 complete |
| Excluded files: Search | matched | `App.tsx` applies the persisted matcher at Search presentation; app acceptance hides the excluded note. | Bounded to path-pattern exclusion and the recorded query, not every Search operator. | P0-1 complete |
| Excluded files: Graph | matched | Graph is built with all files for correct resolution, then removes excluded existing nodes and incident edges; the paired fixture retains unrelated unresolved `Missing Note`. | Bounded to node/edge identity, not pixel or complete Graph parity. | P0-1 complete |
| Excluded files: Quick switcher / link suggestions | matched | Component tests retain the excluded candidate and stably place it after ordinary candidates for MRU, ranked search, and editor selection. | Bounded to candidate presence/order; exact Obsidian scoring weights remain unpaired. | P0-1 complete |
| Excluded files: File explorer | matched | Raw renderer snapshot plus app acceptance keeps the directory and note visible and openable. | Bounded to visibility/open; all context actions are not paired. | P0-1 complete |
| Excluded files: linked backlinks | not_proven | TSUZUNE linked mentions remain unchanged. Official Help explicitly guarantees exclusion for unlinked mentions. | Needs a paired linked-mention fixture before changing this surface. | P1 |
| Core-plugin enable/disable model | missing | selected features are product-owned, not a general core-plugin registry | Do not build a registry solely for cosmetic equivalence. | P2 |
| Calendar 1.5.10 compatibility | matched | fixed artifact/hash host and acceptance tests/reports | Claim is exact target/version only. | — |
| Arbitrary community plugins | out_of_scope | scanner and fixed Calendar host; generic program remains Held | Unrestricted Node/filesystem/network execution violates the current safety contract. | Held |
| Web Clipper | different | TSUZUNE capture flow and source-note contracts | Provenance-first create-only capture differs from Obsidian template/interpreter breadth. | P1 |
| Obsidian Sync | out_of_scope | TSUZUNE has bounded Google Drive sync instead | Do not imitate a proprietary cloud service; compare conflict/data-safety outcomes only when selected. | Held |
| Publish | out_of_scope | no hosting product scope | Personal local product boundary. | Held |

## Completed First Slice: P0-1 Excluded Files Presentation Contract

The first implementation keeps the raw UI Vault snapshot complete, hides excluded notes/attachments only from Search and Graph, and keeps them available but after ordinary candidates in Quick Switcher and editor link suggestions. MCP retrieval continues to use the existing filtered scan because its explicit knowledge-disclosure boundary is stricter than the desktop presentation contract.

Acceptance boundary:

1. Persisting an exclusion no longer deletes the matching directory/note/attachment from the renderer snapshot.
2. File explorer can still open the matching file.
3. Search and Graph do not return/render the matching file; an unrelated unresolved Graph node remains.
4. Quick Switcher and link suggestions retain the matching candidate after non-excluded candidates.
5. MCP filtered scan behavior and creation-time preservation do not regress.

Backlinks remain a separate row: TSUZUNE currently implements linked mentions, while Obsidian's official exclusion guarantee names unlinked mentions. It will not be silently changed without a paired fixture.

Current-source verification:

- Test-first RED: all five new public-behavior tests failed for the intended pre-change reasons.
- Focused GREEN: 5 files / 141 tests, then renderer/MCP safety set 3 files / 102 tests.
- Full suite: 102 files passed / 1 skipped; 986 tests passed / 1 skipped.
- Typecheck: PASS.
- Independent verification: 8 files / 243 tests PASS with an 8 GiB Node heap; the combined default-heap run stopped at OOM before a product assertion failed.
- `git diff --check`: PASS; existing line-ending warnings only.

This is source implementation and source-level verification only. It is not installed production, Git delivery, or a fresh Obsidian GUI recapture.

## Current P0-7 Boundary

P0-7の参照元リンク追従を実装・source検証済み。単一Markdownノートの名前変更・移動にWiki／Markdown／frontmatter参照が追従し、別名・見出し・コメント・BOM・改行を保持する。32件の安全性test、実画面の4操作と再起動後の全file一致、隔離先userData／sessionDataの実測、本番profile 273 files不変を確認した。独立reviewのblocking findingは解消済み。本番反映の完了は、このsource fingerprintに対応する最新production receiptとinstalled実画面検証を記録した既存Vault campaignを正本とする。repo内記録はgate前に確定し、gate後に結果を重複追記しない。P0-6のprofile差分は原因未特定の過去証拠として保持する。 [Evidence](results/p0-7-lossless-link-maintenance.md). Current authorized continuation is delivery and final campaign synchronization only. Earlier checkpoints below are historical.

## Owner-Approved Priority Order After P0-1

Compatibility means opening the same local Vault in TSUZUNE without losing content or metadata, then being able to create, edit, search, and resume daily work. Feature count and pixel parity are not the target. Row-level P0/P1/P2 labels remain local gap severity and do not override this execution order.

1. **Lossless data compatibility:** Markdown/YAML/Properties; attachments/files/links; rename/move/collision; external edits/conflict/recovery boundaries. Text/decimal-number/simple-list add/edit/delete/save/reload is source-verified (P0-2/3). Next: paired isolated Obsidian/TSUZUNE fixtures for the implemented subset, then select concrete remaining differences.
2. **Daily operation compatibility:** Editor, Search, Quick Switcher, Backlinks, named Workspaces/restart restore, Daily Notes, Templates, and Hotkeys.
3. **Structural representation compatibility:** Canvas; Bases only after Properties is stable; remaining Graph/Local Graph differences.
4. **Selected extension compatibility:** only an actual plugin and use selected by the owner; never a generic or unrestricted community-plugin runtime.

Held: Obsidian Sync or Publish imitation, cloud/account scope, unrestricted plugin execution, and a new DB/daemon/Hook added only for parity.

## P0-2 Text Properties Source Checkpoint

The editor can add, edit and delete a supported top-level text property through normal revision-checked saves. Exact fixture bytes retain surrounding metadata/comments/body/BOM/EOL; same-value edits are no-ops. Numbers, booleans, nulls, dates and collections are not coerced to text. Complex unsupported YAML can make the whole Properties form source-edit-only. This bounded refusal is not full YAML parity.

Final focused 4 files / 63 tests PASS; typecheck PASS; independent adversarial review PASS; full verbose run 104 files / 1045 tests PASS with one skipped fixture. Two earlier non-verbose full runs ended in OOM (default and 8 GiB); retained as failed observations, not erased by the final pass. No OOM root cause is claimed.

At the P0-2 checkpoint, installed production, fresh Obsidian GUI comparison and typed/list authoring remained unverified or unimplemented. Typed/list authoring was subsequently implemented in P0-3 below. See [P0-2 evidence](results/p0-2-properties-authoring.md) for exact ownership, safety limits and hashes.

## P0-3 Number / Simple List Source Checkpoint

Decimal values retain exact lexical digits. Quoted numbers remain text. Lists support explicit text/number items, empty values and no-op preservation; changed lists use canonical block syntax and detach old item comments as standalone comments. Non-target bytes and stale-save protection are covered through real temporary files and App reload/conflict tests. Focused 117 and full 1099 tests PASS (1 SKIP), typecheck and final independent review PASS. No full YAML, installed or fresh Obsidian GUI parity is claimed. [P0-3 evidence](results/p0-3-properties-number-list.md).
