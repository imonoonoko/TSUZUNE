# Drive Vault Roundtrip Acceptance — 2026-08-16

## 結論

インストール済みTSUZUNEを、2つの隔離Vaultと2つの隔離profileへ接続し、空Vault受信、local／Drive更新、競合、再起動台帳、両側削除の検出を実Driveで往復した。全項目をPASSし、受入用Drive objectとローカル一時profileは回収した。本番Vaultは開かず、変更していない。

削除について確認できた現行境界は、local削除とDrive削除をどちらも検出するが、自動伝播せず残存側を`preserve`すること。削除伝播は日付待ちではなく、tombstone、復元先、確認付きapply、再起動後の意図識別を先に決める独立したデータ保護gateである。

## 実行範囲

- runtime: `docs/reports/production-update-latest.json`で固定されたinstalled TSUZUNE
- local data: `%LOCALAPPDATA%\Temp\tsuzune-drive-roundtrip-*`配下だけ
- Drive data: 受入時に新規作成した専用Vault rootとその子objectだけ
- credential: 既存の暗号化済みrefresh tokenとWindows暗号化に必要な`Local State`を隔離profileへ一時copy。平文token、client secret、Drive object IDは出力・保存していない
- excluded: production Vault、既存Drive Vault、複数端末同時apply、削除伝播の実装

## 固定シナリオ

1. profile Aの新規VaultからMarkdown 2件をuploadする。
2. 空のprofile B Vaultを同じ受入用Drive rootへpairし、2件をdownloadする。
3. profile Bを終了・再起動し、差分0件へ収束することを確認する。
4. profile Aのlocal更新をDriveへuploadし、profile Bで`remote_changed`としてdownloadする。
5. profile AとBで同一ノートを別内容へ変更し、`both_changed` conflictを退避して収束する。
6. profile Bでlocalファイルを削除し、`local_deleted`を`preserve`することを確認する。
7. 受入用Driveファイルをtrashし、profile Bで`remote_deleted`を`preserve`することを確認する。
8. 受入用Drive rootをtrashし、隔離profile／Vaultを削除する。

## 実行結果

```json
{
  "result": "pass",
  "emptyVaultReceive": true,
  "localUpload": true,
  "remoteDownload": true,
  "conflictPreserved": true,
  "localDeletionObservedWithoutPropagation": true,
  "remoteDeletionObservedWithoutPropagation": true,
  "restartLedgerConverged": true,
  "stalePlanRejected": false,
  "productionVaultUntouched": true
}
```

後処理確認:

- `tsuzune-drive-roundtrip-*`一時directory: 0件
- 受入script／cleanup helper process: 0件
- production TSUZUNE process: 0件（利用者が閉じた状態を維持）
- 途中失敗で残った最初の受入用Drive root: trash済み

## 再実行

Codex同梱Playwrightを新規依存なしで使うため、そのNode modules pathを環境変数で渡す。

```powershell
$env:TSUZUNE_ACCEPT_NODE_MODULES = 'C:\Users\Humin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node scripts/check-live-drive-vault-roundtrip.mjs
```

証拠script:

- `scripts/check-live-drive-vault-roundtrip.mjs`
- `scripts/check-live-drive-trash.cjs`

## 残る境界

- 削除伝播を採用する場合は、現行`preserve`契約を直接反転しない。明示policy、tombstone、local `.trash`、Drive `trashed=true`、stale-plan拒否、再起動、rollbackを一つの復旧可能なsliceとして固定する。
- production分類applyは、この受入の成功だけでは許可しない。最新manifest、Drive preview、preimage、Path Alias、rollback packet、停止条件をその時点のproduction Vaultへ再固定する。
