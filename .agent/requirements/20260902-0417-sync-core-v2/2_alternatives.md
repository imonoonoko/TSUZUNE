# TSUZUNE Sync Core v2 Alternatives

## Codebase Findings

- `src/core/drive-sync.ts`はlocal／remote／previous hashから決定的な同期planを生成する純粋関数である。
- `src/main/drive-sync-service.ts`はpreview／apply、remote version、Changes API cache、tombstone、crash recovery、競合copyを所有する。
- `src/main/google-drive.ts`はOAuthとGoogle Drive transportを分離している。
- `docs/reports/drive-vault-roundtrip-acceptance-2026-08-16.md`は隔離2 profileで空Vault受信、両側更新、競合、再起動、削除検出を実Drive受入済みとする。

## Options

### Option A: Existing Drive Service Extension

Effort: Medium
Value: Medium

既存serviceへ自動実行、添付、履歴を直接追加する。

Benefits:
- 初期変更が少ない。
- 現在のtest fixtureをそのまま使える。

Tradeoffs:
- 同期の意味とGoogle API処理が同じ大きなserviceへ集中する。
- 専用remoteやE2EEを追加する時に再分離が必要になる。

### Option B: Provider-Neutral Sync Core With Drive Adapter

Effort: Medium to large
Value: High

```text
Markdown / attachments
        -> Sync Core v2
             -> Google Drive adapter
             -> future remote adapter
```

Benefits:
- 既存Drive transportと受入証拠を再利用できる。
- 競合・削除・履歴の意味をremote実装から分離できる。
- foundationをcompatibility wrapperとして導入でき、可逆である。

Tradeoffs:
- coreとtransportの責務境界を固定する必要がある。
- stable identityとversion historyは後続sliceで台帳schemaを変更する。

### Option C: Dedicated Sync Server First

Effort: Large
Value: High only after multi-device demand

専用protocol、server、account、storage、E2EEを同時に所有する。

Tradeoffs:
- 現在の個人Windows-first境界を大きく越える。
- 運用、認証、課金、障害対応、mobile background制約が同時に発生する。

### Option D: Do Nothing

Effort: None
Value: Existing safe manual sync only

手動Drive同期を維持する。現状の安全性は保てるが、Obsidian級の常時複数端末体験には進まない。

## Recommendation

Option Bを採用する。最初は現在の純粋plannerをprovider非依存moduleへ移し、Drive名のpublic interfaceをcompatibility wrapperとして残す。既存挙動が完全にgreenのまま次のstable identity sliceへ進む。

