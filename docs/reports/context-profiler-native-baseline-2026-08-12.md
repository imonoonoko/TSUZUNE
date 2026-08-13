# X1-CP0 Context Profiler Native Baseline

日付: 2026-08-12
対象: CP0-T01〜CP0-T10
判定: 10件の連続採取とhost usage再採点を完了。single-worker matched A/Bの品質維持とinput 88.58%減を確認し、長大taskのfresh境界を条件付き採用する。

## 結論

自然発生したTSUZUNE作業10件は、成功8件、blocked 2件で固定した。成功taskだけへの差し替えは行っていない。

初回集計ではtask別tokenを`not_observable`としたが、これは誤りだった。Codex rollout JSONLの`token_count` eventには累積input、cached input、output、reasoning usageとmodel context windowが保存されている。各taskの開始直前と終了時の累積値を差し引き、10/10 recordをhost実測値へ修正した。

10 task／456 token eventの合計はinput 42,806,336、cached input 41,566,464、output 185,616、reasoning 54,727だった。inputの97.10%がcached inputである。これは、同じ長大task内で安定したprefixが各model turnへ繰り返し渡されている可能性を強く示す。一方、cache tokenの実料金、各prefixの必要性、fresh taskへ分けた場合の成功率は未観測なので、現時点で費用削減率や「97.10%が無駄」とは主張しない。

したがって最初に比較するのはTSUZUNE本体へのBM25、Hooks、DB、独自cacheではない。短いdurable handoffと必要時のTSUZUNE取得を使うfresh Codex taskが、同じ成功条件を保ったままinput token、tool call、elapsed timeを減らすかを一件のA/Bで確認する。

## 集計

| 指標 | 全10件 | 成功8件 |
|---|---:|---:|
| 成功 | 8 | 8 |
| blocked | 2 | 0 |
| 経過時間中央値 | 696,651.5 ms | 955,964.5 ms |
| tool call中央値 | 41 | 59.5 |
| search中央値 | 8.5 | 9 |
| read中央値 | 17 | 19 |
| retry中央値 | 2 | 3.5 |
| input token中央値 | 3,329,110 | 5,760,227.5 |
| cached input中央値 | 3,211,648 | 5,617,408 |
| output token中央値 | 18,576 | 23,145 |
| reasoning token中央値 | 4,497.5 | 4,497.5 |
| task別usage観測可能 | 10/10 | 8/8 |
| `unique_sources`観測可能 | 0/10 | 0/8 |
| `repeated_reads`観測可能 | 0/10 | 0/8 |

task種別はfeature change 7、knowledge 2、continuation 1だった。lookup、code understanding、bug diagnosis、bug fixは0件であり、人工taskで補わない。

機械可読集計: [summary-public.json](assets/context-profiler-native-baseline-2026-08-12/summary-public.json)

## 再現方法

`scripts/measure-codex-rollout-usage.mjs`は標準ライブラリだけでrollout JSONLを読み、recordのtask境界に一致する累積usage差分を出力する。prompt本文、tool result本文、rate-limit残高は出力しない。

```powershell
node scripts/measure-codex-rollout-usage.mjs --rollout <rollout.jsonl>
```

今回の実行は`task_count: 10`、`all_records_match: true`、`model_context_window: 258400`だった。累積値が途中で減少した場合、task境界が見つからない場合、recordと再計算値が異なる場合は非0終了する。

## 確認できたこと

- task別の正確なinput、cached input、output、reasoning usageはhost rolloutから再現できる。
- 全10 taskでcached input比率は92.82%〜98.57%で、単一の長大taskに共通して現れた。
- output合計185,616に対しinput合計42,806,336であり、最初に疑うべき量的要因は生成文量ではなくmodelへ渡す既存contextである。
- feature taskはknowledge taskよりtool call、read、経過時間が大きい傾向を持つが、偏った10件から一般化しない。
- production update timeout／test worker OOMは2 taskで観測され、3 task gateを満たさない。

## 未観測の境界

- `unique_sources`と`repeated_reads`は10/10で`null`のままであり、source単位の再読量はまだ比較できない。
- cached inputは「再利用可能な安定prefix」を示すが、その全量が不要だったことは示さない。
- 実料金、cache割引、latencyへの寄与は公開値がなく、tokenから推定しない。
- CP1-A fresh taskの初回sampleは成功したが、CP0の同一成功条件を持つtaskとの一対一比較ではないため、task分割の改善率と品質維持は未証明である。

## CP1-A 初回 Fresh Task Sample — 2026-08-12

短いhandoffと対象TSUZUNE project noteだけを読んだfresh Codex taskで、dirty working treeの安全な回帰gateを確認した。`npm run typecheck`と、既知の4 GiB worker OOM後に`NODE_OPTIONS=--max-old-space-size=6144 npm run test:production`を一度だけ実行し、58 files／529 testsはPASSした。task由来のrepo差分、本番設定、installed app、production Vault、commit、push、releaseは0件である。

rollout累積値のtask境界差分はinput 1,104,529、cached input 1,084,416、output 2,806、reasoning 1,244、16 token event、5 tool call、199,000 ms、retry 1だった。これはCP0全10件のinput中央値3,329,110より小さいが、成功条件とtask規模が同一ではないため、削減率、採用、費用削減を主張しない。次の自然な比較可能taskを連続採取し、品質・安全性を優先して判断する。

## CP1-A Matched A/B — 2026-08-12

同じHEAD、同じdirty working tree、同じread-only command列で、長大な現taskと短いhandoffだけを受けたfresh taskを比較した。両条件とも`npm run typecheck`、6 GiB固定の`npm run test:production`、開始／終了Git status hash比較を一度ずつ実行し、再試行しなかった。

| 指標 | 長大な現task CP1-A-02 | fresh task CP1-A-03 |
|---|---:|---:|
| 品質gate | PASS、58 files／529 tests | **FAIL、57 files／510 tests、1 worker OOM** |
| input token | 1,692,645 | 313,686 |
| cached input | 1,682,432 | 303,616 |
| output token | 1,889 | 761 |
| reasoning token | 415 | 123 |
| token event | 12 | 10 |
| input／event | 141,053.75 | 31,368.60 |
| elapsed | 136,131 ms | 111,966 ms |
| retry | 0 | 0 |
| Git status不変 | PASS | PASS |

fresh側のinputは1,378,959、割合では81.47%少なく、input／eventも77.76%少なかった。しかしfresh側は同じ6 GiB gateでworker OOMになり、成功タスク当たりのコストを比較できない。完走していないelapsed timeも速度改善として扱わない。長大task側が同じgateをPASSしているため、この一対だけから原因を会話境界へ帰属することも、fresh化が品質を損ねたと一般化することもできない。

**判定:** CP1-Aの初回matched介入は品質gate不成立により不採用／inconclusive。81.47%を削減効果として採用せず、fresh task運用も既定化しない。

## 次の一手 — 測定gateの安定化

製品コードやTSUZUNE検索を最適化する前に、比較用gate自体のworker OOM変動を一つの小さなread-only実験で切り分ける。既存の公式`test:production`を変更せず、同一HEADで固定したsingle-worker commandまたは、同じ公開挙動を覆う小さな決定論的test集合を両条件へ適用する。成功条件を両方が満たしたpairだけをtoken比較へ採用し、失敗sample CP1-A-03は削除・差し替えない。新しいCodex taskの作成は利用者の明示依頼後に行う。

## CP1-A Single-worker Matched A/B — 2026-08-12

公式`test:production`とpackage設定は変更せず、診断用に6 GiB・`--maxWorkers=1`を固定した全suiteを長大task CP1-A-04とfresh task CP1-A-05で一度ずつ実行した。両方とも58 files／529 tests、retry 0、Git status不変でPASSした。

| 指標 | 長大task CP1-A-04 | fresh task CP1-A-05 | 差分 |
|---|---:|---:|---:|
| input token | 289,020 | 33,004 | **-256,016（-88.58%）** |
| cached input | 286,976 | 31,488 | **-89.03%** |
| output token | 274 | 274 | 0 |
| reasoning token | 46 | 38 | -8 |
| token event | 3 | 1 | -2 |
| elapsed | 57,748 ms | 43,872 ms | -24.03% |
| tool call | 2 | 2 | 0 |
| test結果 | 529/529 PASS | 529/529 PASS | 同一 |

このpairでは成功率、安全性、tool callを維持し、input／cached inputとelapsedが悪化しなかった。したがって、**長大taskを続ける代わりに、短いdurable handoffと必要時だけのTSUZUNE取得を使うfresh task境界を条件付き採用する。** ただし88.58%はこの固定pairだけの実測であり、一般的な削減率や費用削減率には外挿しない。初回2-worker failure CP1-A-03もOOM変動の証拠として保持し、single-workerを公式production gateへ変更しない。

## 次の一手 — CP1-B Monitored Adoption

次の自然な長大task切替3件で同じ運用を使い、task成功、Git／Vault安全性、input token、retryを継続観測する。小さなtaskを機械的に分割せず、handoff作成と再取得の負担を含めても有利な長大taskだけを対象にする。3件で品質回帰または再探索増加が出た場合は既定化を撤回する。TSUZUNE本体へのBM25、Hooks、DB、独自cacheは開始しない。
