# D8 Production Delivery Boundary

## Decision

Installed production mutationには明示承認が必要。現時点では実行しない。

## Evidence

- live `delivery_info`: `mismatch`
- live runtime: version `0.6.0`, profile `direct`, `stale_runtime:false`
- latest receiptとcurrent sourceのfingerprintは不一致
- `production:update`はtask-owned filesだけを選択せず、current tracked/untracked source全体をfingerprint、build、package、install、hash検証、MCP再登録する

## Exact-baseline recheck

直近receiptはdirty sourceをinstall済みだが、aggregate fingerprintしか保存していない。個別path/hash manifest、exact source snapshotはなく、`app.asar`はcompiled bundleなので元のTypeScript、untracked files、working-tree状態を復元できない。

Git HEAD＋Inbox 4ハンクは検証用の再構成に留まり、既に本番へ入った未commit機能を欠落させる可能性があるためproduction baseには使えない。

## Options

1. current dirty source全体の本番昇格を利用者が明示承認する。
2. receipt相当のsource境界を広範に再構成・監査してから昇格する。
3. source実装済みのまま停止する。

## Stop

build、install、process停止、Vault変更、stash/reset/checkoutは実行していない。
