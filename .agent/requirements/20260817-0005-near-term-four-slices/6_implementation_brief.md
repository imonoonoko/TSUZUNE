# Implementation brief

## Order

1. 独立testを先に追加する。
2. sidebar、deletion、historyを非重複file ownershipで並行実装する。
3. 同時にclassificationのproduction preflightをread-onlyで更新する。
4. 各sliceのtargeted verificationを終えた後、全体gateを一回実行する。
5. 製品snapshotが確定したらproduction updateとTSUZUNE最終同期を行う。

## Simplicity constraints

- sidebarはApp local stateとCSS classだけを基本とする。
- deletionは既存Drive sync plan、`VaultService.trashEntry`、Google Drive adapter、atomic JSON writeを再利用する。一件のtombstoneで足りる間は汎用transaction engineを作らない。
- history verifierはrevision計算を共有関数化するが、監査DBや別indexを作らない。
- classification用の新しい万能batch executorを作らない。既存single-entry coordinatorで安全条件を満たせなければ停止する。

## Evidence artifacts

- requirements package: `.agent/requirements/20260817-0005-near-term-four-slices/`
- targeted test output and final gate output.
- classification fresh packet/report under `docs/reports` or `docs/migrations`, secrets excluded.
- final execution record in production TSUZUNE and updated project note/MOC only where status changed.
