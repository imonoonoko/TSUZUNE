# X1-CP0 Context Profiler Baseline Implementation Brief

## Existing Patterns To Reuse

- `.gitignore`の`work/`除外。
- X1-T1の固定条件、revision/digest、`not_observable`境界。
- 既存requirements packageのpurpose、alternatives、scope、requirements、discussion log構成。
- TSUZUNEの`fetch`が返すnote revisionと、GitのHEAD／working-tree状態。

## Smallest Execution

1. CP0-A完了後に届いた次のeligibleなTSUZUNE依頼へ、未使用の最小IDを連続順で割り当てる。
2. substantiveな探索・読取・実装より前に、目的、task種別、成功条件、停止条件、write境界、Codex task ID、host/model表示、Git HEAD、dirty/clean、対象Vault revisionを`work/context-profiler/cards/`へ固定する。
3. preflightの状態取得は測定運用としてcount外にし、card固定直後から通常どおりtaskを実行する。途中でProfiler機能や最適化経路を加えない。
4. 終了後、task transcriptを参照して`task-record.schema.json`のrecordを`work/context-profiler/records/`へ一件作る。
5. 成功条件と停止条件を採点し、失敗・blockedも除外しない。
6. 10件完了後にだけ、task種別の偏りを含む匿名化した集計を作る。

## No Implementation In CP0-A

CP0-Aではcollector、parser、dashboard、database、hook、background serviceを作らない。最初のrecordを手動で再採点できないことが確認された場合だけ、既存依存または標準ライブラリで動く局所validatorを別taskとして検討する。

## Verification

- requirements package内のMarkdownとJSONが読める。
- `task-record.schema.json`がJSONとしてparseできる。
- 予約IDが10件あり、eligible／ineligible条件と連続採取規則がある。
- card templateに目的、1〜3件の成功条件、対象、開始revision規則、停止条件、write境界がある。
- `git diff --check`がPASSする。
- 製品source、本番アプリ、package、installer、MCP登録、本番Vaultの測定対象本文／fixtureの変更が0である。既存project tracking noteへの同期はsample外として区別する。

## Stop Conditions

- host transcriptからtool eventまたは時刻を再現できず、主要指標が複数taskで`not_observable`になる。
- Raw evidenceをGitまたはTSUZUNEへ複製しなければ採点できない。
- task cardを実行するために、現在の利用者許可を越える本番writeまたは外部操作が必要になる。
- 30 taskでも同じボトルネックが3件以上に再現しない。
