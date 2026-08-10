# Alternatives — GP0-3b-o

## A. OS reveal through a trusted shell boundary (candidate)

The pinned asar statically routes `app.showInFolder(path)` through `adapter.getFullPath` and the desktop `shell.showItemInFolder`. A dynamic capture should verify this exact seam and payload. If confirmed, TSUZUNE should expose only a trusted, relative-path request that reuses Vault validation before calling the native shell boundary.

This is the leading option because it matches the apparent meaning of `フォルダで表示` and does not require duplicating a file tree in the renderer.

## B. In-app FileTree reveal

Use only if the dynamic reference proves that the action selects or reveals an in-app tree rather than the OS file manager. The current FileTree is a note/directory navigation surface and does not establish attachment reveal parity by itself.

## C. Reuse `openVaultFile` or open the parent as a normal file

Reject. Opening the attachment or a folder through the default-app path would not prove the requested reveal-and-select behavior and would conflate two menu actions.

## D. Implement both behaviors behind a generic abstraction

Reject for Ponytail reasons. It adds speculative API and state before the reference contract is known.
