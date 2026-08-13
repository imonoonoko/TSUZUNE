# X1-CP0 Context Profiler Baseline Scope

## MVP

- CP0-A完了後に自然発生する次のeligibleなTSUZUNE開発10 taskを、順番を変えず通常のCodex経路で実行する。
- 各taskは実際の依頼後、substantiveな探索・読取・実装より前に対象、開始revision、1〜3件の成功条件、停止条件、write境界を固定する。
- task transcriptとtool resultを根拠に、一つのschemaでtask recordを作る。
- 成功率、wall-clock時間、tool call、検索、読取、unique source、同一`source + revision + range`の再読、再試行、変更file数を記録する。
- task別Raw recordは`work/context-profiler/records/`へ保存し、Gitへ入れない。
- Gitには測定契約、空のschema、予約IDとcard template、個人情報を含まない集計だけを置く。実taskのcard本文は`work/`へ置く。

## Out Of Scope

- TSUZUNE本体へのProfiler、AI、LLM、router、telemetryの組込み。
- background service、常時Hook、watcher、SQLite、FTS、BM25、embedding、vector/Graph DB。
- 独自compaction、独自要約、prompt短縮、cache、永続task state。
- wire bytes、文字数、tokenizer推定からhost tokenまたは費用を推定すること。
- 10件から一般的な削減率、因果効果、他repositoryへの有効性を主張すること。
- CP0-A中の製品コード、本番アプリ、package、installer、MCP登録、本番Vaultの測定対象本文／fixtureの変更。既存のproject／roadmap／current-work noteへの契約と状態の同期だけはsample外とする。

## Data Boundary

| Data | 保存先 | Git | TSUZUNE |
|---|---|---:|---:|
| task card、schema、数え方 | `.agent/requirements/...` | 可 | 判断の要点だけ可 |
| Raw transcript／tool result | host既存履歴。必要なローカル参照だけ`work/context-profiler/` | 不可 | 不可 |
| task別record、task ID、個別usage値 | `work/context-profiler/records/` | 不可 | 不可 |
| 匿名化したtask種別別集計 | `docs/reports/` | 可 | 可 |
| 個人本文、秘密、認証情報 | 複製しない | 不可 | 不可 |

## Constraints

- 1 taskは、連続採取でadmitされ、実行前に固定した一つのtask cardを一つのCodex taskで完了または停止する単位とする。
- child agentを使った場合は、観測できる全childを同じtask費用へ含める。child transcriptが見えない場合はrecordを`partial`にする。
- 最初の10件はTSUZUNE開発に限定する連続sampleであり、母集団推定には使わない。task種別を揃えるための追加、除外、順序変更をしない。
- preflight card作成、record作成、schema修正、集計、CP0判断、TSUZUNEのproject tracking同期、handoff等の測定運用はsampleへ含めない。
- 途中でschemaを変える必要が出た場合は、既存recordを黙って混在させない。全recordを新schemaで再採点するか、CP0-Bを停止する。
- taskの実行に別の権限、実Windows操作、本番writeが必要な場合は、task cardとは別にその時点の利用者承認を得る。
