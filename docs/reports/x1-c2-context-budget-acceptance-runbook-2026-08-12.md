# X1-C2 Context Budget 受入 Runbook

作成日: 2026-08-12
状態: 実行待ち（fixture MCP が Codex Desktop task に公開されてから実施）

## 目的

`build_context` の既定 `max_characters` を、回答品質と時間安全性を落とさずに下げられるか判定する。

対象は **Context の文字数上限**である。host が当該 task の usage を公開しない限り、入力 token・料金・実時間の削減は判定しない。文字数や wire bytes を host token の代用にしない。

## この試験で決めること／決めないこと

決めること:

- `4,000`、`6,000`、`8,000`、`15,000` 文字のうち、全 gate を通る最小 budget
- 全 budget が失敗した場合は、既定 `15,000` を維持すること

決めないこと:

- BM25、SQLite、キャッシュ、Hooks、GraphRAG、AI内蔵の導入
- Codex Desktop が内部で消費した token、料金、時間の削減（usage が公開されない場合）
- 通常の本番 `tsuzune` MCP を使った代替試験

## 固定する入力

### 質問

以下の順序を変更しない。

1. 現在動いているプロジェクトは何か。
2. 2026-07-22時点では何が動いていたか。
3. 再確認が必要な情報は何か。
4. この状態を採用した根拠は何か。

### seed path

以下の順序を変更しない。

1. `10_プロジェクト/TSUZUNE.md`
2. `10_プロジェクト/ONOKO・CodexAtelier・Forest Room.md`
3. `10_プロジェクト/宵灯工房.md`

### 時点と tool 引数

| 質問 | `as_of` | その他 |
|---|---|---|
| 1, 3, 4 | `2026-08-09` | `include_history: true`、`query` は質問本文 |
| 2 | `2026-07-22` | `include_history: true`、`query` は質問本文 |

各 budget で、質問ごとに seed path 3件すべてへ `build_context` を呼ぶ。したがって一つの budget は **12 call**、全4 budget は **48 call** である。呼出し順は budget 昇順 → 質問順 → seed path 順とする。

## 実行前の停止条件

次のいずれかなら、その task では試験を実行しない。

1. fresh Codex Desktop task に fixture MCP の `build_context` が公開されていない。
2. 通常の `tsuzune` を使う必要がある、または fixture 以外の読み取り／書き込み tool が混在する。
3. fixture snapshot、server revision、MCP schema、質問、seed path のいずれかが前回と一致しない。
4. fixture の read-only fingerprint を実行前後で比較できない。

停止時は「fixture MCP 未公開」などの事実だけを記録し、通常 MCP へのフォールバックや prompt の調整で結果を作らない。

## 実施手順

### 1. 実行環境を固定する

- 本番 Vault ではなく、既存の X1-T1 fixture snapshot を使う。
- fixture MCP が公開された **新規** Codex Desktop task を作る。
- task に公開された tool 一覧を保存し、fixture `build_context` 以外を使わないことを確認する。
- 実行前に、repository HEAD、dirty 状態の source fingerprint、fixture digest、server revision、Node/Codex Desktop/model version（表示される範囲）を記録する。
- `npm run build:mcp` を成功させる。既存の `node scripts/check-x1-t1-desktop-fixture.mjs` も実行し、fixture server の structured-only 契約を確認する。

この script は server 自身の確認であり、Codex Desktop task の回答品質や task 中の host token を測るものではない。

### 2. budget sweep を一回だけ行う

task への依頼文は、次の内容を変えずに使う。

```text
この task は X1-C2 context budget acceptance です。
fixture MCP の build_context だけを使用してください。通常の tsuzune、write tool、他の MCP は使用しません。

max_characters を 4000, 6000, 8000, 15000 の順で試験します。
各 budget ごとに、固定4問の各質問について、固定seed path 3件すべてへ build_context を呼んでください。
引数は as_of、include_history: true、query（質問本文）をこの runbook の表どおりに固定します。

各 budget の12 call後に、その budget の Context だけを根拠に4問へ回答し、各回答で参照した source path を明記してください。
推測で補わず、時点外の情報は使わないでください。
```

途中で tool error、内容不足、誤答の疑いが出ても、その場で別 tool・別 source・別 prompt を足さない。記録して当該 budget を FAIL とする。

### 3. 各 budget を採点する

既存 M5 dogfood の固定正答基準を使う。最低限、次をすべて満たす。

| gate | 合格条件 |
|---|---|
| 回答品質 | 固定4問が 4/4。現在の TSUZUNE、2026-07-22 の BMR Shelf、再確認期限超過、状態根拠を時点混同なく区別できる。 |
| source trace | State Note から source までの追跡が 3/3。 |
| 未来情報 | 過去時点の回答・引用・根拠に未来 State/Event/通常本文の混入が 0。 |
| 推測抑制 | 根拠のない状態を稼働中・期限なしなどと断定しない。 |
| expected-source reachability | 質問に必要な source が `included` または追加取得可能な `omitted_ids` として失われていない。 |
| 書き込み | fixture fingerprint が実行前後で一致し、task transcript 上も read-only `build_context` 以外の tool call が 0。 |

固定4問の正答内容は [`docs/m5-dogfood.md`](../m5-dogfood.md) の「回答品質」を正本とする。採点者は回答生成者と別にし、根拠を見ずに後付けで正答基準を変えない。

### 4. 結果を決定する

- 4 budget のうち、上記 gate をすべて通った最小値を候補とする。
- どれか一つでも gate を落とした budget は候補にしない。
- 通過 budget がない場合、既定値は `15,000` のままにする。
- 既定値の変更、MCP 本番反映、release は、この試験の記録をレビューしてから別途判断する。この runbook の実行だけでは変更しない。

## 記録テンプレート

```text
run_id:
date/time (JST):
fresh Codex Desktop task ID:
Codex Desktop / model version (if visible):
repository HEAD:
source dirty fingerprint:
fixture digest before/after:
server revision / MCP schema check:
host token usage: observed | not_observable

budget | answers | source trace | future leak | inference | reachability | writes | verdict
4000   | ?/4     | ?/3          | ?           | ?         | ?            | ?      | PASS/FAIL
6000   | ?/4     | ?/3          | ?           | ?         | ?            | ?      | PASS/FAIL
8000   | ?/4     | ?/3          | ?           | ?         | ?            | ?      | PASS/FAIL
15000  | ?/4     | ?/3          | ?           | ?         | ?            | ?      | PASS/FAIL

selected default:
reason:
unobserved boundaries:
```

`host token usage` が `not_observable` なら、結論は「安全な最小 Context 文字数」に限定する。token・費用・時間が減ったとは書かない。

## 根拠と限界

- 固定4問と正答基準は [`docs/m5-dogfood.md`](../m5-dogfood.md) に基づく。
- X1-T1 の structured-only transport 受入条件は [既存 protocol](../../.agent/requirements/20260810-0440-query-aware-compact-context/7_x1-t1-model-visible-token-benchmark.md) に従う。
- 既存の 4k route 測定は「候補があり得る」ことを示すだけで、この4 budget・回答品質試験の代替ではない。
- fixture MCP が現在の task に公開されない限り、実測を行ったとは扱わない。
