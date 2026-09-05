# TSUZUNE Sync Core v2 Implementation Brief

## Existing Patterns

- `src/core/drive-sync.ts`: 決定的なpure planner。
- `src/main/drive-sync-service.ts`: preview/apply、ledger、remote delta、tombstone、conflict copy。
- `src/main/google-drive.ts`: Google Drive transportとversion guard。
- `src/main/vault.ts`: atomic local write、collision、path safety。
- `tests/drive-sync.test.ts`、`tests/drive-sync-service.test.ts`: plannerとfake remoteの主要回帰面。

## Foundation Slice

1. `src/core/sync-engine.ts`へprovider非依存の型と`planSync`を追加する。
2. `src/core/drive-sync.ts`を互換export／wrapperへ縮小し、既存callerを壊さない。
3. provider非依存public behaviorを新しいfocused testでREDから固定する。
4. typecheck、focused planner/service tests、既存回帰を実行する。

このsliceは動作変更を行わず、次のstate schema変更を一箇所で実装できる境界だけを作る。

## Subsequent Slices

1. Stable identity: logical file ID、path、revisionを分離し、move＋editをfixtureで閉じる。
2. Attachments: byte payloadとatomic stagingを同じplanへ加える。
3. History: remote immutable revisionsとrestore contractを追加する。
4. Auto runner: watcher／startup／reconnect trigger、single-flight、backoff、状態表示。
5. E2EE trial: isolated remoteだけで暗号化object、鍵喪失、rekey、metadata leakageを検証する。

## Risks

- 名前だけgenericにしてDrive固有責務をcoreへ持ち込むこと。
- stable identity前にauto syncを有効化し、move／deleteを誤判定すること。
- historyを通常Vault内のMarkdown履歴として増殖させること。
- E2EEとDrive上の可読性を両立できると誤認させること。

## Test Plan

- RED: `planSync`がnew local、remote-only、both-changed、explicit deletion、決定的順序を返す。
- GREEN: 既存planner実装を移し、Drive wrapperから同一結果を返す。
- Regression: `tests/drive-sync.test.ts`、`tests/drive-sync-service.test.ts`、typecheck。
- Unseen boundary: wrapperとgeneric APIへ同じ入力を与え、結果のdeep equalityを確認する。

## Migration And Rollback

- foundationはdata schemaとremote objectを変更しない。
- rollbackは新moduleを削除し、旧`drive-sync.ts`実装へ戻すだけである。
- ledger schema、production Vault、Google Drive object、本番binaryは変更しない。

