# Production source reconstruction audit

## Task Contract

- objective: 現在のdirty working treeを本番候補として安全に判断できるよう、直近production receiptとの間にあるsource・test・証拠の境界を再構成し、今回のsubagent運用から再利用可能な改善だけを反映する。
- deliverables: 変更群のprovenance/risk inventory、test suite差分の説明、production判断、subagent/workflow改善、統合evidence packet。
- constraints: production update、install、process停止、Vault書込み、branch/worktree/stash/reset/checkout、stage/commitを行わない。source codeと`knowledge.md`を変更しない。legacy `50_履歴`を読取・変更しない。既存の利用者変更を保全する。
- success:
  1. 現在の変更を意味のあるwork item群へ分類し、receipt時点に含まれた可能性・現在の検証状態・未確定境界を示す。
  2. 直近記録の912 tests / 94 filesと現在報告の868 tests / 91 filesの差を、test fileとGit差分から説明する。
  3. productionへ進める／止めるの判断を一件へ統合し、運用上の同型失敗を防ぐ最小のworkflow更新を検証する。
- lane: Orchestrated。source provenance、test delta、原思想、workflow改善を独立packetとして監査する。
- evidence: `git status`/`git diff`/`git ls-files`、`docs/reports/production-update-latest.json`、production gate scripts、current test/typecheck/MCP checks、packet result。
- stop: exact reconstruction不能でも推測で埋めずbounded riskを報告する。production mutation、destructive Git、契約外source変更、新しい権限が必要になった時点で停止する。

## Current state

- state: complete
- prior source slice: Inbox captureはsource実装・test済み、本番未反映。
- production decision: broad reconstruction audit完了。exact production-equivalent sourceは未復元のためdefault stop。current source whole treeの昇格は利用者の明示承認が必要。
- workflow hardening: functional hunk isolationとproduction baseを分けるroot rule一件を追加。
- final evidence: `final-report.md`。

## Work packets

- A — source provenance and receipt boundary
- B — test suite delta and current verification
- C — original-philosophy adversarial guard
- D — subagent/workflow retrospective and minimal self-update proposal
- I — parent integration, unseen checks, durable corrections

## Verification

- workflow artifact completeness and JSON parse
- relevant source inventory consistency
- current `npm test` once, plus narrow checks only when needed to explain a delta
- `npm run typecheck`, `npm run check:mcp`, `npm run check:current-decision` when the audit reaches a release recommendation
- `git diff --check` for task-owned documentation/workflow changes

## Integration policy

- Accept only findings tied to current files, commands, or canonical TSUZUNE notes.
- Separate receipt-time historical evidence, current verified evidence, inference, and unknowns.
- Agent outputs are leads, not completion evidence; parent reproduces one unseen boundary check per adopted conclusion.
- Workflow improvements must remove a demonstrated ambiguity or handoff failure. No new daemon, database, queue, telemetry, or framework.
