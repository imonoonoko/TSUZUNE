# Scope — GP0-3b-o Attachment Folder Reveal

## In scope

- Fixed Obsidian 1.13.4 reference capture for `attachments/diagram.svg` in `fixtures/obsidian-graph-parity-vault`.
- Global Graph, attachment context menu, exact label/order/enabled state, and one `success-intercepted` scenario.
- Safe interception of the relevant native boundary before the menu action, with guaranteed restoration.
- Action request, menu close, same-process Graph reopen, query/camera/node/edge/tab state, Vault digest, and process cleanup.
- A TSUZUNE design for the smallest trusted path if the reference gate confirms an OS boundary.

## Explicitly out of scope

- `ファイルエクスプローラでファイルを表示` and all later menu items.
- `デフォルトアプリで開く`, move, bookmark, path copy, linked view, or delete changes.
- Notes, tags, folders, unresolved nodes, or arbitrary absolute paths.
- Actual Explorer or OS file-manager launch, association success, chooser/cancel, or physical mouse/keyboard behavior.
- Screen reader, High Contrast, multi-DPI, pixel identity, telemetry, network, database, retry UI, or a new generic migration layer.
- Production implementation, production Vault writeback, commit, push, or installer update during the design checkpoint.

## Allowed future product touchpoints after reference approval

- `WikiGraphView` menu item for existing file-backed attachments only.
- Existing shared/preload/main trusted API seams, only if the reference requires a new native reveal request.
- Focused renderer/App/backend tests and the existing capture/report harness.
