# GP0-3b-p Discussion Log

## 2026-08-11 — design checkpoint

- GP0-3b-o (`フォルダで表示`) is complete in the working tree. It already covers the parent-folder request through the trusted `showItemInFolder` route; this slice must not repeat or silently widen that behavior.
- The next fixed menu item is `ファイルエクスプローラでファイルを表示`. The Japanese label alone does not prove whether it selects the file in Obsidian's internal File Explorer, opens an OS Explorer window, or uses another workspace action.
- Existing TSUZUNE has a `FileTree` and `treeSelection`, but it currently renders Markdown notes rather than attachments. No new attachment browser is authorized by this design.
- The first step is therefore a pinned Obsidian 1.13.4 reference observation and an explicit OS-boundary decision. Product code and capture are not changed by this design checkpoint.

## Decision

Use one real attachment (`attachments/diagram.svg`) from the existing Graph parity fixture. Observe the exact menu item and its immediate state effect once. If it is an internal File Explorer reveal, reuse the existing TSUZUNE tree-selection surface only after a public behavior test proves the smallest viable path. If it crosses an OS boundary, install a fail-closed hook before any click. If the seam or meaning cannot be established safely, stop without implementation.

## 2026-08-11 — first fixed observation

- The pinned Obsidian action called the internal `file-explorer.revealInFolder` seam once with the exact relative path `attachments/diagram.svg`.
- No `window.open` or `shell.showItemInFolder` request occurred. The menu closed, the internal File Explorer leaf became active, and the attachment row was visibly selected in the isolated screenshot.
- Graph query, camera, node IDs, directed edges, source/Vault bytes, and hook restoration remained stable. Reopening Graph restored the Graph leaf without replaying the internal request.
- The first packet was marked failed only because the harness incorrectly required the Graph leaf to remain active immediately after an internal navigation. Requirements R4/R6/R7 now treat that active-leaf change as the expected internal workspace transition. The packet is not accepted until the corrected assertions are run against a fresh isolated capture.

## 2026-08-11 — reference gate stopped without an accepted packet

- The corrected assertion model was checked statically, but the two final isolated attempts stopped before the target click because the Graph context menu did not appear within the pre-action wait window.
- No target action, external request, or OS launch occurred in either attempt. Hooks were restored and no isolated Obsidian/Electron process remained.
- The initial provisional observation still points to Obsidian's internal `file-explorer.revealInFolder` transition, but its repository packet was intentionally not accepted or regenerated after the pre-action failures. It is not a product-parity claim.
- GP0-3b-p therefore remains reference-blocked. Do not implement the TSUZUNE menu item or publish a comparison report until the harness preflight is made reliable and one fresh capture passes the full gate. If that cannot be done proportionately, close this slice as blocked without product changes.

## 2026-08-11 — fresh capture after preflight stabilization

- The pinned Obsidian 1.13.4 installer and `app.asar` hashes matched, the isolated fixture was unchanged, and the stabilized preflight reached the target context menu and one click.
- The exact action classified unambiguously as the internal File Explorer transition: `internalPlugins.file-explorer.revealInFolder` was called once with `attachments/diagram.svg`; no `window.open` or `shell.showItemInFolder` call occurred. The menu closed, the File Explorer pane became active, the attachment row was selected, hooks were restored, and the fixture/Vault digest stayed unchanged.
- The full reference assertion still failed only at `attachmentFileExplorerGraphReopenKept`. The harness centers the target before opening the menu (`panX=715.5051116943359`, `panY=489.482177734375`), while Obsidian's same-process Graph reopen returns its default centered camera (`panX=460.5`, `panY=345`). Query, node IDs, directed edges, Graph leaf, tab labels, and no-replay remained stable.
- This is a diagnostic capture, not an accepted parity packet. GP0-3b-p is closed as `blocked` pending an explicit decision about whether the reopened Graph camera must equal the action baseline or may follow Obsidian's normal reopen reset. No TSUZUNE product implementation or production update is authorized. See [diagnostic report](../../../../docs/reports/graph-gp0-attachment-file-explorer-2026-08-11.md) and the raw [manifest](../../../../docs/reports/assets/graph-gp0-attachment-file-explorer/manifest.json).
