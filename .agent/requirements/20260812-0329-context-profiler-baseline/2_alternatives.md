# X1-CP0 Context Profiler Baseline Alternatives

## Existing Findings

- `PLAN.md`はX1-CP0をPrimary Trackとし、10 taskのNative baselineから最大の無駄を一つだけ選ぶ。
- `work/`は既にGit管理外のローカル証跡領域である。
- X1-T1/X1-C2には、wire bytes、Context文字数、host-visible token、費用、回答品質を混同しない先例がある。
- 固定fixtureでは、単一の既知sourceは`search -> fetch`、複数根拠・時点・provenanceは`build_context`が有利な場合を確認した。ただし、これは成功タスク当たりの一般的な改善を証明しない。
- task card template、共通record schema、tool/read/retryの数え方、恣意的に選ばない採取規則は未作成である。

## A. Context Sidecarを先に実装する

revision-aware state、cache、BM25、SQLite、Hooks、別Agentを先に作る。

- 利点: 目に見える機能へ早く進める。
- 欠点: 現在の主要因でない可能性があり、追加tool callや失敗面を増やす。
- 判定: 不採用。CP0-Cで同じ無駄が最低3 taskに再現するまで実装しない。

## B. X1-C2の4k/6k/8k/15k比較を先に行う

- 利点: Context bundle量の下位比較は既存runbookで再実行できる。
- 欠点: fixture MCPが必要であり、Context bundle量が主要因かは未確認である。
- 判定: held。ProfilerがContext bundle量を主要因と示した場合だけ再開する。

## C. host tokenだけをKPIにする

- 利点: 正確なper-task usageが公開されるhostでは直接的である。
- 欠点: 現行hostでは観測不能な場合があり、token削減が成功率、時間、実費削減と一致しない。
- 判定: 補助指標。正確なtask紐付きusageが公開された場合だけRaw recordへ保存する。

## D. 次に自然発生するtaskから小さいNative baselineを採る

- 利点: agent経路を変えず、通常作業の探索、再読、再試行を観測できる。結果やtask種別を見てsampleを選べない。
- 欠点: 最初の10件は少数の連続sampleであり、task種別が偏る可能性がある。一般化できず、手動採点のばらつきもある。
- 判定: 採用。eligible／ineligible条件、連続採取、数え方、証拠参照、`not_observable`境界を先に固定し、10件で主因がなければ同じ規則で最大30件まで続けて停止する。

## Recommendation

Dを採用する。CP0-Aは測定契約だけ、CP0-BはNative baselineだけ、CP0-Cは一因の選定だけに分ける。
