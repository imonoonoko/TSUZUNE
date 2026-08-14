# Discussion Log — GP0-3b-o Attachment Folder Reveal

## 2026-08-11 — design checkpoint

- User requested the next Graph parity slice after `デフォルトアプリで開く`.
- The operation under review is `フォルダで表示` for an existing attachment node.
- Static inspection of the pinned Obsidian 1.13.4 asar shows `app.showInFolder(path)` resolving the adapter path and reaching the desktop `shell.showItemInFolder` boundary.
- Static evidence is not sufficient to fix the product contract. A fixed, isolated dynamic capture must first record the exact menu, payload, lifecycle, and safe interception seam.
- This checkpoint is design-only. No TSUZUNE source, production Vault, Explorer, or external application is changed or started.

## Open questions

1. Does the runtime request the file path, its parent folder, or another normalized representation?
2. Is the visible behavior reveal-and-select in the OS file manager, or an in-app tree selection?
3. Can the OS boundary be intercepted before the action without allowing Explorer to start?
4. Does a safe hook cover a second process, or must restart remain explicitly unestablished?

## Stop rule

If the fixed reference differs from the static expectation, stop before product implementation and update this package. Do not proceed to `ファイルエクスプローラでファイルを表示` in this slice.
