# Task Contract

- objective: 全コードレビューで採用した安全問題のうち、現行認可内の2件を最小差分で修正し、履歴整合は既存Gate A/Bの再開条件を確定する。
- deliverables: check:mcp隔離bundle、本文一致による保存競合検知、各回帰テスト、History Store v2のGate判定、検証証拠。
- constraints: 既存dirty treeを保全する。新規依存・DB・daemon・Hookを追加しない。50_履歴を削除・移動しない。無関係なApp.tsx整理を同じ差分へ混ぜない。
- success:
  1. 認可内の2 failure modeが変更前RED、変更後GREENになる。
  2. typecheck、全test、check:mcp、diff checkが合格する。
  3. 製品変更はproduction:updateでinstalled productionまで検証し、TSUZUNE実施記録をread-backする。
- lane: Orchestrated
- evidence: focused Vitest/fixture、全repository gate、production receipt、TSUZUNE read-back。
- stop: 安全修正2件と本番受入・記録、履歴整合のGate境界確認が完了した時点。History Store v2本番配線とApp.tsx分割は別Sliceとして再契約する。

## Scope revision

- 2026-08-24: 現行TSUZUNE正本を確認し、History Store v2はGate AがNO-GO、active VaultのGate Bは別途明示承認が必要と判明した。このため今回の「はい」は安全修正開始の承認として扱い、本番履歴writerの配線承認には拡張しない。
