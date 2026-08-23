# Codex Development OS 改革

## 目的

Codex、TSUZUNE、User Skills、subagent、repository gateを、個別の慣習ではなく一つの開発ワークフローとして接続する。小規模な改善ではなく、日常開発の開始、判断、実行、検証、記録、再開を同じ契約で扱える状態へ移行する。

## 背景

- 現行要素は存在するが、`orchestrate-skills`、`ai-coding-operator`、`codex-dynamic-workflows`、TSUZUNE、モデル分担、実施記録の間で受け渡す共通形式がない。
- そのため、各Skillを正しく読めても、taskごとに目的、成功条件、状態、証拠、次の一手を再構成する必要がある。
- 2026-08-23に利用者が大規模アップデートによる改革を明示選択した。これは従来Heldの再開条件を満たす。

## 成果

1. すべての非自明な開発taskが共有する Task Contract を定義する。
2. task規模に応じて Direct / Planned / Orchestrated の3 laneへ一度だけ分類する。
3. Skill選定、実行、subagent packet、検証、TSUZUNE書戻しを同じcontractで接続する。
4. 主要User Skillsとglobal AGENTSを新契約へ移行し、validatorと独立監査で確認する。

## 非目標

- 新runtime、DB、daemon、Hook、外部packageの導入。
- TSUZUNE製品codeの変更。
- plugin/system Skillのforkまたは改変。
- userの既存dirty worktreeの整理や巻き戻し。
