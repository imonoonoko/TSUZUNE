# Orchestration

## Goal

TSUZUNEの現在の全コードを独立観点で監査し、重複を除いて優先度付きの一つの改善計画へ統合する。

## Packet 01 — Core / MCP / main safety review

- Objective: core、main、MCPの実行経路で correctness、安全性、データ保全、契約逸脱を探す。
- Ownership: read-only。`src/core`、`src/main`、`src/mcp`、関連tests。
- Do not: 編集、本番TSUZUNE書込み、外部操作、他packet領域の網羅監査。
- Expected output: 重大度順findings、file/line、発火条件、影響、最小修正案、既存test gap。
- Verification: 呼出元とpublic testを照合する。

## Packet 02 — Renderer / preload / UX boundary review

- Objective: renderer、preload、shared IPC境界のcorrectness、状態管理、accessibility、保守性を監査する。
- Ownership: read-only。`src/renderer`、`src/preload`、`src/shared`、関連tests。
- Do not: 編集、本番TSUZUNE書込み、視覚変更の実装。
- Expected output: 重大度順findings、file/line、再現条件、最小修正案、test gap。
- Verification: component呼出経路とtestsを照合する。

## Packet 03 — Tooling / tests / complexity audit

- Objective: scripts、CLI、test構造、dependencies、repo全体の過剰設計と削減余地を監査する。
- Ownership: read-only。`scripts`、`src/cli`、`tests`、package metadata、repo-wide metrics。
- Do not: 編集、依存削除、生成物削除、本番TSUZUNE書込み。
- Expected output: correctness/test findingsと、ponytail形式の削除・簡素化候補。推定削減量は根拠を示す。
- Verification: package scripts、imports、callers、test coverageを照合する。

## Parent integration

1. live repositoryの構成・entry point・dependency graph・dirty境界を確認する。
2. 各packetの証拠を現物と照合し、重複・誤検知・scope外を除く。
3. typecheck、full tests、MCP gateを現状確認として実行する。
4. findings-firstの最終reportと、段階的refactoring roadmapを作る。
5. TSUZUNE実施記録を作成し、read-backと検索で検証する。

## Safety

- agentはread-only。親だけがworkflow reportとTSUZUNE記録を作成する。
- 既存dirty worktreeを巻き戻さない。
- review中にコードを修正しない。
- production appを終了・更新しない。
