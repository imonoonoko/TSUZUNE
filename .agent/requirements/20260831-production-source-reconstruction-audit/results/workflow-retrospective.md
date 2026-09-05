# Subagent and workflow retrospective

## Demonstrated improvement

今回、`HEAD + Inbox 4 hunks`を機能として独立検証できる事実が、安全なproduction baseへ誤って拡張されかけた。latest receiptがdirty source由来でexact snapshotを持たないため、両者は別の判断である。

この再発を防ぐ最小変更として、root `AGENTS.md`のProduction TSUZUNE Dogfoodへ次を追加した。

- delivery mismatchかつdirty-source receiptにexact snapshot/path-hash manifestがない場合、task-owned hunk isolationはfunctional verificationにだけ使う。
- production update前にcurrent source whole treeの明示承認、またはverified production-equivalent boundaryを得るreconstruction auditを要求する。

新しいqueue、DB、daemon、管理runtime、常設agent roleは追加していない。

## Agent integration

| Agent | Role | Parent decision |
|---|---|---|
| Hypatia / D8 | source provenance and delivery boundary | aggregate fingerprint limitation、whole-tree stopを採用 |
| Pascal / D9 | test delta | 問題提起を採用。34-case集計は`it.each`未展開のため不採用し、親が45 casesへ訂正 |
| Bernoulli / D7 | original-philosophy guard | Inbox最小形、no-op、暗黙昇格拒否を採用 |
| Curie / D11 | workflow retrospective | P1のAGENTS rule一件だけ採用。新しい管理機構は不採用 |

## Deferred observations

- packet stateとresult artifactの同期を一般化する案は、一回の観測で新機構を増やさない。
- full testの実行ownerはpacketに明示済みであり、追加ルールは不要。
- subagent outputはleadであり、親が未提示境界を再検証する既存integration policyを維持する。
