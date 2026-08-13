# CP1-C-04 O2-P4A Path Alias Sidecar Sync Prototype

Date: 2026-08-13 JST
Result: `pass`
Task type: implementation (test-only fake remote)
Frozen contract: `.agent/requirements/20260813-1425-o2-p4-drive-path-alias-contract/4_requirements.md`

## Conclusion

O2-P4Aのtest-only prototypeを実装し、Path Alias sidecar一個の同期判断を匿名一時Vaultとmemory fake remoteだけで固定した。exact UTF-8 bytes、remote ownershipの一意性、preview/apply再検証、clean ledgerに基づく片側変更、競合、remote応答検証、atomic local replace後のledger失敗時復元を公開testで確認した。

`DRIVE_PATH_ALIAS_UNSUPPORTED`はまだ閉じない。O2-P4Bの既存Drive Markdown file ID relocation、live isolated Drive acceptance、本番applyは未実施である。UI、IPC、MCP、OAuth scope、package command、installed binaryには入口を追加していない。

## Implementation

- `src/cli/drive-path-alias-sync-prototype.ts`（新規、test-only）
  - `.tsuzune/path-aliases.json`の固定pathとVault外ledgerを検証
  - `compilePathAliases`を再利用してJSON、Markdown path、case collision、self-reference、cycleをfail-closed
  - `vaultId`、`role=pathAliases`、root parent、file ID、versionによるunique ownership
  - local-only create、remote-only download、equal no-op、clean ledgerからのlocal-only update／remote-only download、履歴不足・両側変更・version driftのconflict
  - exact preview fingerprint再検証、remote mutation responseのidentity／bytes検証
  - local atomic replaceと、ledger保存失敗時のexact preimage復元または新規file除去
- `tests/drive-path-alias-sync-prototype.test.ts`（新規、16 tests）
  - CRLFを含むexact-byte upload/download、ledger checkpoint、no-op、片側変更、両側変更、履歴不足、version drift、複数owned object、malformed content、preview drift、path boundary、rollbackを固定

## Verification

- Focused prototype: 1 file / 16 tests PASS
- `npm run typecheck`: PASS
- Related regression: 5 files / 69 tests PASS
- Full suite: `NODE_OPTIONS=--max-old-space-size=6144 npx vitest run --maxWorkers=1` — 61 files / 585 tests PASS（dirty共有worktreeの最終再実行値）
- Target-file whitespace check: PASS
- `ponytail-review`: `Lean already. Ship.` 新規依存、汎用transaction層、製品entry pointは追加していない

## Safety Boundary

- testが所有する一時directoryとmemory fake remote以外を変更しない。
- remote alias objectの実Drive API、`drive.file`実資格情報、既存Markdown object relocationは呼び出さない。
- production Vault、installed app、Codex MCP登録、本番受領書は変更しない。
- O2-P4A通過だけでは既存Drive同期済みnoteの分類移行を安全にしない。P4Bと別のlive acceptanceが必要である。

## Remaining Work

1. 次のPrimary gateはO2-P4B test-only prototype。明示plan、既存Drive file ID、metadata-only relocation、reverse rollback、rollback drift packet retentionをfake remoteで固定する。
2. O2-P4B通過後も、disposable live Drive acceptanceと明示的なproduction authorizationを別に行う。
3. MCP-R1は本taskをsample 2として記録し、sample 3完了まではBM25、cache、Context budget、Hooksの実装を開始しない。
