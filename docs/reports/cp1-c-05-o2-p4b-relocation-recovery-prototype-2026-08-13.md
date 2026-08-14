# CP1-C-05 O2-P4B Remote Relocation and Recovery Prototype

Date: 2026-08-13 JST
Result: `pass`
Task type: implementation (test-only fake remote)
Frozen contract: `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/4_requirements.md`

## Conclusion

O2-P4Bをtest-only prototypeとして実装した。明示済みclassification planだけを入力にし、既存Drive Markdown objectのfile ID、content hash、parentを保持したままpath/nameを移す。local P3 migration、remote note relocation、remote Path Alias更新、両ledger checkpointを一つのrecoverable sequenceとして固定した。

`DRIVE_PATH_ALIAS_UNSUPPORTED`は`prototype-proven`へ進んだが、本番解消とは扱わない。live Drive、OAuth、製品entry point、UI、IPC、MCP、本番Vault apply、installed binaryは変更していない。次のproduction gateはdisposable live Drive acceptanceと明示的な本番承認である。

## Implementation

- `src/cli/drive-path-alias-relocation-prototype.ts`（新規、test-only）
  - P4A clean baseline、local／remote／Drive ledgerの三者一致、destination collision、path／name／version／parent／file-ID／content driftをmutation前に検査
  - equal-contentからrenameを推測せず、明示planのsourceだけを既存file IDでmetadata relocation
  - combined mutation前にVault外recovery packetを保存し、local P3 rollback packetの決定的path、remote IDs／paths／versions、alias exact bytes、Drive／alias ledger preimageを記録
  - local P3 → remote notes → remote alias → alias ledger／Drive ledgerの順で適用し、最後にremote一覧、ID、path、name、parent、hash、ledger key、alias bytesを再取得・検証
  - remote／alias／ledger failpointではremote notesを逆順に戻し、alias、両ledger、local P3を復元
  - rollback drift時は未解決file IDをpacketへ残し、以後のpreview/applyをblockして成功を返さない
- `src/cli/classification-migration-prototype.ts`
  - 既存P3へ任意のVault外rollback packet pathだけを追加。既定のrandom pathと既存挙動は維持
- `tests/drive-path-alias-relocation-prototype.test.ts`（新規、12 tests）
  - happy path、先行packet参照、remote／alias／ledger failure、destination collision、name drift、version drift、explicit-plan-only、remote／local rollback drift retention、completion re-readを固定

## Verification

- Focused O2-P4B: 1 file / 12 tests PASS
- Related P3／P4A／P4B: 3 files / 43 tests PASS
- `npm run typecheck`: PASS
- Full suite: `node --max-old-space-size=6144 node_modules/vitest/vitest.mjs run --maxWorkers=1` — 62 files / 608 tests PASS（dirty共有worktreeの最終再実行値）
- `git diff --check`: PASS（既存working treeのCRLF warningのみ）
- `ponytail-review`: `Lean already. Ship.` 新規依存、汎用transaction abstraction、製品entry pointは追加していない

## Safety Boundary

- testが所有する一時Vault、Vault外ledger／packet、memory fake remoteだけを変更した。
- 実Drive API、OAuth credential、production Vault、installed app、Codex MCP登録、本番受領書を変更していない。
- recovery packetにnote本文やtokenを保存せず、relative path、hash、file ID、version、必要なsidecar／ledger preimageだけを保持する。
- commit、push、production updateは行っていない。

## Remaining Work

1. disposable live Driveで、同一file IDのmetadata-only relocation、private path metadata、current version、reverse rollbackを受入する。
2. live acceptance後も、本番Vault applyは別の明示承認とproduction gateを必要とする。
3. MCP-R1 sample 3の結果ではsearch履歴重複が2件目の自然観測になった。新しいBM25層を作る前に、既にdirty sourceへ存在する`50_履歴/**`既定除外のruntime反映と受入を最小候補とする。
