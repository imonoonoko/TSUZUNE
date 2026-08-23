# Independent forward tests

Evaluator: `development_os_forward_test`
Boundary: current global AGENTS and five core Skills only。prior conversation、requirements、TSUZUNE、想定解は非提示。read-only。

## A — changed file listing

- Request: `TSUZUNEリポジトリの現在のgit statusと、変更されたファイル名だけ確認して。`
- Result: Direct
- State owner: conversation + Task Contract
- Artifact: none
- Delegation: none
- Evidence: one read-only git status command
- Stop: filenames returned; no content inspection or TSUZUNE write
- Verdict: PASS

## B — Context Profiler planning only

- Request: `TSUZUNEのContext Profilerに、現在のテスト状況を踏まえた次の実装計画を作って。実装はまだしない。`
- Result: Planned
- State owner: existing repository plan, otherwise `update_plan`
- Delegation: requestだけでは不要。独立証拠抽出が成立する場合のみbounded scout
- Evidence: live code/tests、actual test results、bounded TSUZUNE context、依存とacceptanceを持つplan
- Stop: grounded plan completed; implementation unstarted
- Verdict: PASS

## C — development OS migration

- Request: `Codex、TSUZUNE、User Skills、subagent運用を新しい開発OSへ移行し、主要Skillとglobal AGENTSを更新し、Direct/Planned/Orchestratedの独立forward testとvalidatorで検証して。`
- Result: Orchestrated
- State owner: one durable workflow/requirements artifact
- Delegation: architecture、migration/acceptance、independent forward test
- Evidence: changed-file inventory、hash/diff、3 lane tests、Skill validator、TSUZUNE read-back
- Stop: acceptance、validator、persistence完了。または権限拡張・契約衝突で停止
- Verdict: PASS

## Observed ambiguity and resolution

- Evaluatorはdefaultとして `.workflow/<slug>/` を選んだが、このrepositoryには `.agent/requirements/` の既存規約がある。本runは後者を唯一のstate artifactとして使用する。
- `validator`の対象は、変更したCodex User Skills 6件の`quick_validate.py`、UI YAML parse、3 lane behavioral result、責務境界の静的検査に固定する。
- forward testではTSUZUNE accessを禁止したため、B/Cのwritebackは期待動作として述べるだけで実行させていない。本task本体では親agentがfinal boundaryで実行する。
