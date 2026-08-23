# TSUZUNE 全コードレビューとリファクタリング案

## Task Contract

- objective: 現在のworking source全体をレビューし、正しさ・安全性・保守性・過剰実装を証拠付きで評価して、実行順序の明確なリファクタリング案を提示する。
- deliverables: 優先度付きreview findings、全体構造評価、段階的refactoring roadmap、検証結果、TSUZUNE実施記録。
- constraints: コード変更なし、既存dirty worktreeを保全、Markdown正本とMCP安全契約を維持、履歴・生成物・fixtureを製品sourceと混同しない。
- success:
  1. 重大な指摘は実行経路と正確なfile/line evidenceを持つ。
  2. refactoring案は優先度、依存関係、期待効果、検証方法、見送り案を持つ。
  3. typecheck・test・MCP gateの現状を確認し、未確認境界を分離する。
- lane: Orchestrated。
- evidence: repository source、tests、package scripts、git status、実行した検証、production TSUZUNEの現行判断。
- stop: review packet統合、検証、durable reportとTSUZUNE記録が完了した時。実装修正は別Task Contractとする。

## 非目標

- 指摘事項の修正実装。
- production update、Git commit、PR、push。
- 新機能、新dependency、DB、cache、daemon、Hookの採用。
- 既存dirty差分の整理や巻き戻し。
