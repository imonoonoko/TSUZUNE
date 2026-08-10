# GP0-3b-o Attachment Folder Reveal Requirements

## 1. Status and authority

This document is the design contract for the next Graph parity slice. It is not authorization to edit product code or start an external file manager. The reference capture is the first gate; if it contradicts the static expectation below, implementation stops and this document is revised.

## 2. Fixed comparison input

- Obsidian 1.13.4 with installer SHA-256 `8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0` and asar SHA-256 `51218495AD940A8515B202D380BDE638BE6570A198E121F7CA6D484A8A158917`; mismatch blocks capture.
- `fixtures/obsidian-graph-parity-vault`, isolated Vault and user data, Windows 11, 1265x768, DPR 1, light theme.
- Global Graph with attachments visible and empty query.
- Target: existing file-backed `attachments/diagram.svg`, linked from `00_Home.md`.

## 3. Reference-first requirements

### R1 — exact menu contract

The capture must record the complete ordered menu, enabled/disabled state, bounds, and close behavior. The static asar currently indicates `フォルダで表示` follows `デフォルトアプリで開く` and precedes `ファイルエクスプローラでファイルを表示`; this is a hypothesis until runtime capture confirms it.

### R2 — exact native boundary

Before clicking, install and verify a fail-closed hook at the actual runtime boundary. The hook must record only sanitized API identity, request payload, and call count; it must prevent Explorer or another OS file manager from starting. If the boundary cannot be hooked and restored, do not click.

### R3 — one controlled action

Run one success-intercepted action for the fixed attachment. Require exactly one native request, a closed menu, and no fallback to an unhooked OS call. Always restore the original function in `finally`, including failure paths.

### R4 — state preservation

Compare before, immediate-after, and same-process Graph reopen state: query, camera transform, node IDs, directed edge signature, Graph tab/leaf state, active file, and Vault content digest. Force-layout coordinates and pixel equality are not required.

### R5 — lifecycle boundary

Same-process Graph reopen must not replay the native request. A second process may be tested only if the hook safely covers startup through action; otherwise restart is explicitly `not established` and cannot be used in a parity claim.

### R6 — product safety after reference approval

If the reference confirms an OS reveal, TSUZUNE may add an attachment-only menu item that accepts a Vault-relative path and reaches a trusted main-process native reveal call after existing path/symlink/Vault checks. Renderer code must not receive an absolute path or call Electron shell APIs directly. Missing, unsupported, directory, Vault-outside, and symlink paths must result in zero native calls and preserve Graph state.

### R7 — failure behavior

Native non-empty errors must use the existing error-result/message path. The menu, Graph tabs, query, camera, nodes, edges, and Vault must remain usable. No automatic retry or destructive fallback is allowed.

## 4. Acceptance gates

### Reference gate

- Pinned hashes and fixture match.
- Menu item is exact, enabled, and in the observed order.
- Hook install/identity/call count/restore all pass.
- Native request payload is sanitized and tied to the fixed relative file identity.
- Explorer is not launched; process cleanup is zero; Vault/source/protocol digests are unchanged.

### Product gate (future, not authorized here)

- Attachment-only exact menu item and one relative-path request.
- Trusted validation and native call only for a valid existing file.
- Failure and missing-path tests preserve Graph state and make zero native calls.
- Existing Graph behavior and unrelated menu items remain unchanged.

### Evidence gate

Raw observation, comparison JSON, and report must distinguish observed behavior from static inference. No user absolute paths, secrets, clipboard contents, Vault body, or OS accessibility claims may be stored.

## 5. Honest result vocabulary

Use `matched-core-behavior` only after the reference and product satisfy the same fixed-file identity, one-call, menu-close, and same-process reopen requirements. Keep API representation differences, real Explorer launch, restart gaps, physical input, accessibility, and pixel identity explicit.

## 6. Stop conditions

Stop after the one controlled action and lifecycle observation. Stop and revise this package if the label, order, payload, native seam, or reveal semantics differ from the static hypothesis. Do not continue to the neighboring Explorer menu action.
