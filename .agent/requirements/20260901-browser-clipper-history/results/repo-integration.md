# Repository integration evidence

- The active Vault is the singleton `VaultService` in `src/main/index.ts`; no Vault produces `NO_VAULT`.
- `VaultService.createNote` validates names, rejects symlink traversal, and uses `flag: 'wx'`, so capture collision handling can remain create-only.
- The existing Drive bridge has broader capabilities and a different token-discovery contract. It is not reused for browser capture.
- The browser path therefore uses a dedicated loopback bridge and delegates only to `BrowserClipService.capture`, whose directory is fixed to `01_受信箱`.
- Shutdown must close the browser bridge alongside the watcher and Drive bridge; tray-hidden operation intentionally leaves it running.

Unseen boundary retained for root verification: fixed extension ID/CORS behavior and installed Chrome or Edge manual loading.
