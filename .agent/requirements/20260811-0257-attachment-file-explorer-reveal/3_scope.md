# GP0-3b-p Attachment File Explorer Reveal Scope

## In scope

- Fixed Obsidian 1.13.4, existing isolated Graph parity fixture, Global Graph, empty query, attachment display, and `attachments/diagram.svg` only.
- Complete target context-menu labels, order, enabled state, target-action visibility, and menu close.
- One action request or one internal workspace transition, captured after the actual seam is established.
- Immediate state and same-process Graph reopen checks: query, camera, node IDs, directed edge signature, Graph tab/leaf, visible File Explorer surface, selected/revealed path, and Vault content digest.
- TSUZUNE's existing `FileTree`/`treeSelection` and trusted file/path validation as candidate reuse points.
- A narrow renderer/App regression only if the observed behavior has a clear existing route; existing IPC is reused unless the reference proves a new OS boundary is unavoidable.
- Sanitized machine-readable observation and comparison evidence, with explicit unproven boundaries.

## Out of scope

- `フォルダで表示` (GP0-3b-o), `ファイルを削除`, file integration, bookmark/path-copy/linked-view/default-app behavior, and any second menu action.
- Note, tag, folder, unresolved, missing, or unsupported nodes.
- Building a general File Explorer, attachment tree, search index, sidebar redesign, or workspace persistence framework.
- OS Explorer launch, chooser/cancel, real associated-app behavior, or process automation unless the reference action is proven to cross that boundary; even then the external launch must remain intercepted.
- Physical mouse/keyboard, screen reader, High Contrast, touch/pen, multi-DPI, and pixel-identity acceptance.
- Drive changes, MCP schema changes, database/dependency additions, telemetry, network, or production update.

## Change boundary

Design-only checkpoint: no product source, capture, production, commit, or push is authorized by this document. A later implementation slice may touch only the smallest existing renderer/App route and its public regression test after the reference gate passes.

## Safety boundary

- Never infer the action from its label or reuse `showItemInFolder` without reference proof.
- If an OS API is involved, install and identity-check a fail-closed hook before clicking; if it cannot be installed, do not click.
- Pass only Vault-relative paths through renderer callbacks. Keep absolute paths inside validated main-process/capture boundaries and sanitize all evidence.
- No `Start-Process`, shell command, child process, or external-app fallback from product code or capture.
- Preserve source/Vault/profile digests and restore every hook in `finally`.
