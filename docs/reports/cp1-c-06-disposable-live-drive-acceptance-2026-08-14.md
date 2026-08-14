# CP1-C-06 Disposable Live Drive Acceptance — 2026-08-14

## Outcome

O2-P4A／P4Bでfake remoteに固定したDrive契約の最小live受入を、実Google資格情報とこの受入専用のdisposable fixtureで実行し、PASSした。

本番Vault、本番同期済みMarkdown、既存Drive Vaultは対象にしていない。受入が新規作成したfolder、Markdown、Path Alias objectの3件だけを操作し、終了時に3件すべてをDriveのゴミ箱へ移した。

## Accepted behavior

- Markdown metadata relocationの前後でDrive file IDとparent IDを保持した。
- private `appProperties.tsuzunePath`を旧path→新path→旧pathへ往復した。
- 各mutationでDrive versionが前進した。
- MarkdownのMD5とdownload bytesを往復後も保持した。
- Path Alias objectも同じfile IDのままexact bytesを更新し、元bytesへ戻した。
- 以前の同acceptance残存objectは0件。今回作成した3件のcleanupは3/3完了した。

## Safety boundary

- 実行にはtransient access tokenと`TSUZUNE_LIVE_DRIVE_ACCEPT=disposable-only`の明示tokenが必要。
- access／refresh token、OAuth client、account detail、Drive object IDは出力・Git・Vaultへ保存していない。
- 製品UI、IPC、MCP、通常同期、production Vault classification applyへの入口は追加していない。
- Google Drive API v3のprivate `appProperties`とfiles updateを直接使う受入scriptであり、P4B coordinator全体やfailure injectionをlive Driveへ接続していない。

## Verification

- `node --check scripts/check-live-drive-path-alias.mjs`: PASS
- live result: `sameMarkdownFileId`、`parentPreserved`、`privatePathMetadataRoundtrip`、`versionAdvanced`、`markdownBytesPreserved`、`sameAliasFileId`、`aliasBytesRoundtrip`、`cleanupComplete`がすべて`true`
- Ponytail review: Lean already. 製品入口、依存、汎用frameworkは追加していない。

## Decision

`DRIVE_PATH_ALIAS_UNSUPPORTED`のlive Drive契約blockerはclosedとする。本番Vaultへの分類applyは別承認のまま禁止を維持する。次は新機能を増やさず、production classification apply packet（正確な対象、preimage、rollback、Drive preview、停止条件）を作ってユーザー承認を得る。

## References

- `scripts/check-live-drive-path-alias.mjs`
- `docs/reports/cp1-c-03-drive-path-alias-contract-2026-08-13.md`
- `docs/reports/cp1-c-04-o2-p4a-sidecar-sync-prototype-2026-08-13.md`
- `docs/reports/cp1-c-05-o2-p4b-relocation-recovery-prototype-2026-08-13.md`
- Google Drive files resource: https://developers.google.com/workspace/drive/api/reference/rest/v3/files
- Google Drive custom properties: https://developers.google.com/workspace/drive/api/guides/properties
