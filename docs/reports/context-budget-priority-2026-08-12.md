# Context Budget Priority — 2026-08-12

## 結論

利用者の明示的な再優先により、次の主作業は **X1-C2 Context Budget Evaluation** とする。

目的は、TSUZUNEが実際に制御できるContext量を、回答品質・出典追跡・時間整合性を落とさずに小さくすることだ。既定の`max_characters`を即時に下げること、BM25／SQLite／embedding／永続agent stateを追加することは、このTrackの目的ではない。

## 既知の事実

- `build_context`の既定`max_characters`は15,000文字である。
- X1-D1は、queryで候補集合を削らず、本文の展開順だけを変え、未収録候補を`omitted_ids`で次取得可能にした。
- X1-T1は`build_context`の重複text envelopeを除去し、local stdio wireを2,761→1,252 bytes（54.7%）にした。これはhost model-visible tokenや請求額の測定ではない。
- hostがper-call／per-turnの正確なtoken使用量を公開していないため、TSUZUNEだけからmodel-visible tokenを測定・推定することはできない。

## 測定対象と非対象

| 区分 | 今回測る | 測らない／主張しない |
|---|---|---|
| TSUZUNE Context | Markdown文字数、structured payload／wire bytes、included・omitted、build latency | 文字数から推定したtokenや費用 |
| 品質 | 固定4問の回答、expected-source到達性、source trace、future leakage、書込み0 | 採点なしの短い回答を品質維持とみなすこと |
| host token | hostが正確なusageを表示した場合だけ記録 | tokenizer推定、wire bytes、料金の逆算 |

## X1-C2の順序

1. **既存機能での運用ルールを比較する。** 単一ノートは`search`→`fetch`を基本とし、複数ノート・時点・provenanceが必要なときだけ`build_context`を使う。
2. **read-only固定比較を行う。** 同じ質問・起点・Vault fingerprintで、`max_characters` 4k／6k／8k／15kを比較する。最小値は、4問4/4、source trace 3/3、future leakage 0、書込み0、expected-source到達性を満たす値だけとする。
3. **結果で一度だけ決める。** 6kなどの小さい予算が全gateを満たせば、次の小さな実装sliceで既定値変更を検討する。満たさなければ既定値は15kのままにし、`omitted_ids`からの段階取得または呼出し方を改善する。

## 保留するもの

- BM25、FTS、SQLite、vector／GraphRAG、長期task state、Hooksのproduction導入。
- hidden conversation contextの削除、ChatGPT／Codexの内部compaction、host請求額の操作。
- X1-T1のwire削減をtoken削減・費用削減と呼ぶこと。

## 他Trackとの関係

Windows accessibility P1は捨てずにquality gateとして保持する。ただし、X1-C2の固定比較と結論が出るまで、主製品sliceとしては開始しない。O1 7-day dogfoodは日常利用の観測として継続するが、Context既定値を変える根拠には固定比較を使う。

## 完了条件

- 比較fixture、質問、Vault fingerprint、実行時刻、各指標を再現可能な形で残す。
- 小さい予算を採用する場合は、上記品質gateを全て満たす証拠を残す。
- host tokenが非公開なら、その限界を明記し、Context proxyだけを成果として報告する。

## 初回の機械比較（未受入）

`node scripts/measure-context-budget.mjs`を、再構成25-note fixture（digest `8ca7b80b8569b2c002edce1ccd25452c56b6744d99d9fdb217fc6ff034156a6e`）に対して実行した。3つの現在seedとTSUZUNEの2026-07-22時点の合計4 scenarioで、4k／6k／8k／15kは各scenarioごとに同じcanonical Contextを返した。各値は二回呼出しで決定的であり、temporary fixture copyのdigestも不変だった。

この結果は、**この再構成fixtureに限れば4kがContextの文字数・候補・warningを15kから減らしていない**ことを示す。しかし固定4問のモデル回答、source trace 3/3、future leakage 0のhost再実測はまだ行っていないため、4kを既定値へ採用する根拠ではない。host model-visible tokenも未観測のままである。

再実行例:

```powershell
npm run build:mcp
node scripts/measure-context-budget.mjs
```
