# X1-CP0 Prospective Task Registry

## Why The Exact Future Work Is Not Prewritten

baselineのためにlookup、bug、feature、handoffを人工的に作ると、TSUZUNEの通常開発ではなくProfiler運用自身の無駄を測ってしまう。したがって、先に固定するのは **次の10件を恣意的に選ばない採取規則** とcard templateである。各taskの目的と成功条件は、実際の利用者依頼が来た後、探索や実装を始める前に固定する。

## Consecutive Sampling Rule

CP0-A完了後に利用者が依頼した、次のeligibleなTSUZUNE開発taskへCP0-T01から順にIDを割り当てる。都合の良いtaskだけを採用せず、fail、blocked、no-changeも含める。

Eligible:

- TSUZUNE repository、TSUZUNE本番知識、installed TSUZUNEのいずれかを対象にする実際の開発、診断、調査、文書、knowledge/continuation task。
- 1〜3件の成功条件と停止条件を、最初のsubstantiveなassistant actionまたはtool eventより前に固定できる。
- task transcriptとtool resultを後から参照できる。

Not eligible:

- CP0 recordの作成、schema変更、集計、Profiler判断、Profiler handoff等の測定運用そのもの。
- status確認だけでsubstantive tool callを必要としない会話。
- TSUZUNEと無関係なtask。
- 既に開始済みで、開始revisionまたは開始時刻を再現できないtask。
- 利用者の権限を越えるwriteや外部操作が必要だが、許可を得ていないtask。

## Reserved IDs

| ID | Admission status | Frozen card |
|---|---|---|
| CP0-T01 | blocked | card: `work/context-profiler/cards/CP0-T01.json` / record: `work/context-profiler/records/CP0-T01.json` |
| CP0-T02 | pass | card: `work/context-profiler/cards/CP0-T02.json` / record: `work/context-profiler/records/CP0-T02.json` |
| CP0-T03 | pass | card: `work/context-profiler/cards/CP0-T03.json` / record: `work/context-profiler/records/CP0-T03.json` |
| CP0-T04 | pass | card: `work/context-profiler/cards/CP0-T04.json` / record: `work/context-profiler/records/CP0-T04.json` |
| CP0-T05 | pass | card: `work/context-profiler/cards/CP0-T05.json` / record: `work/context-profiler/records/CP0-T05.json` |
| CP0-T06 | pass | card: `work/context-profiler/cards/CP0-T06.json` / record: `work/context-profiler/records/CP0-T06.json` |
| CP0-T07 | blocked | card: `work/context-profiler/cards/CP0-T07.json` / record: `work/context-profiler/records/CP0-T07.json` |
| CP0-T08 | pass | card: `work/context-profiler/cards/CP0-T08.json` / record: `work/context-profiler/records/CP0-T08.json` |
| CP0-T09 | pass | card: `work/context-profiler/cards/CP0-T09.json` / record: `work/context-profiler/records/CP0-T09.json` |
| CP0-T10 | pass | card: `work/context-profiler/cards/CP0-T10.json` / record: `work/context-profiler/records/CP0-T10.json` |

この表は予約枠であり、架空の作業を指示するqueueではない。実際のcard本文はprivacy境界のためignored `work/`に置く。

## Preflight Card Template

探索、repo/Vault read、subagent起動、実装を始める前に、次を一度だけ固定する。preflight中に問題理解のためのsource探索が必要なら、その依頼はまだadmitせず、clarification後に固定する。

```json
{
  "task_id": "CP0-T01",
  "card_frozen_at": "ISO-8601",
  "objective": "依頼本文を複製しない一文の目的",
  "task_type": "lookup | code_understanding | bug_diagnosis | bug_fix | feature_change | knowledge | continuation",
  "target": {
    "repository": "TSUZUNE",
    "vault_mode": "none | production_read_only | production_write | fixture_read_only"
  },
  "start_revision": {
    "git_head": "...",
    "working_tree_state": "clean | dirty",
    "git_status_evidence_ref": "..."
  },
  "success_conditions": [
    { "id": "A1", "description": "1〜3件" }
  ],
  "stop_conditions": ["..."],
  "write_boundary": ["read-only または許可されたpath/action"]
}
```

## Classification And Adequacy

- task typeは目的を読んだ時点で一つ選び、結果を見て有利なtypeへ変更しない。
- 最初の10件のtype構成をそのまま報告する。カテゴリを揃えるために人工taskを追加、除外、順序変更しない。
- lookup、code understanding、bug fix、feature change、knowledge/continuationのいずれかが0件なら、その欠落をsample limitationとする。
- CP0-Cの介入候補は、同じ無駄が最低3 taskで再現した場合だけ選ぶ。さらに複数task typeへ跨るかを補助根拠として報告するが、黙って必須gateへ格上げしない。
- 10件で共通主因を選べなければ、同じ連続採取を最大30件まで続ける。欠落categoryを埋めるための架空taskは作らない。

## Administrative Work Outside The Sample

次はtask IDを割り当てず、測定値へ含めない。

- preflight cardと終了後recordの保存。
- recordのmanual review、schema修正、匿名化集計。
- CP0-Cのボトルネック判断、TSUZUNE同期、handoff。
- validator/collector/dashboardの検討。最初のmanual recordを再採点できないことが確認された場合だけ別Trackとして判断する。
