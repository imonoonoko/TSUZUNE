# Progressive Context Route Baseline — 2026-08-12

## 結論

単一ノートを質問の起点として確認する固定fixtureの3ケースでは、`search`→`fetch`は`build_context`より応答量が小さかった。従って、単一ノートで足りる作業を最初からbundle化しない、という段階取得の運用原則を維持する。

これはMCPの応答量・呼出し数・local latencyだけの比較である。回答品質、host model-visible token、請求額、複数根拠が必要な作業の成功率は測定していない。

## 固定条件

- fixture: `work/x1-t1-desktop-fixture-2026-08-09-v2`
- fixture SHA-256: `8ca7b80b8569b2c002edce1ccd25452c56b6744d99d9fdb217fc6ff034156a6e`
- `build_context` budget: 4,000 characters
- 比較経路:
  - 直接取得: `search(query, limit=10)`→`fetch(expected source)`
  - bundle: `build_context(seed, query, max_characters=4000)`
- 全ケースでsearchがexpected sourceへ到達し、temporary fixture copyは不変だった。

## 結果

| 起点 | search→fetch 応答量 | build_context 応答量 | bundle収録ノート数 |
| --- | ---: | ---: | ---: |
| TSUZUNE | 6,371 bytes | 8,843 bytes | 9 |
| ONOKO・CodexAtelier・Forest Room | 6,274 bytes | 9,392 bytes | 4 |
| 宵灯工房 | 3,989 bytes | 9,420 bytes | 6 |

local latencyは実行環境の揺れを含むため採用指標にしない。いずれも`build_context`は1 call、直接取得は2 callsである。従って、この結果は「常に直接取得が良い」ではなく、単一ノートで足りると分かっている場合の応答量比較である。

## 時点指定の安全境界

同じfixtureで`TSUZUNE.md`を`as_of: 2026-07-22`として確認した。

| 経路 | 応答量 | 結果 |
| --- | ---: | --- |
| `fetch` | 2,631 bytes | 後日の現在本文を含む。時点指定を解釈しないため、この質問には使えない。 |
| `build_context(include_history: true)` | 2,046 bytes | seed本文を省略し、`UNSCOPED_NORMAL_CONTENT_OMITTED`を返す。未来の通常本文を混ぜない。 |

このケースでは、直接取得が小さいかどうかを選択根拠にしてはならない。現在の`fetch`には時点指定の契約がないためである。時間・履歴・provenanceが要求される作業は、`build_context`を安全な入口とする。

## 複数根拠の固定ケース

TSUZUNEの現在状態を確認するため、seedと運用資料・証拠地図・開発ロードマップの4ノートを必要根拠として固定した。

| 経路 | 応答量 | call数 | expected source |
| --- | ---: | ---: | --- |
| 4ノートを個別`fetch` | 11,977 bytes | 4 | 4/4到達 |
| `build_context` | 8,843 bytes | 1 | 4/4を含む |

bundleにはこの4ノートに加えて、関連MOC・情報源・履歴も含まれる。それでもこのfixture・4,000文字budgetでは、既知4ノートを個別取得するより小さかった。この結果は「bundleが全ての複数根拠作業で最小」という一般化には使わないが、既存の運用分岐を支持する。

- 単一・現在・明示source: `search`→`fetch`
- 複数根拠、時点、provenance: `build_context`

## 実行

```powershell
node scripts/measure-progressive-context.mjs
```

## 次の最小評価

複数根拠が必要な固定課題を一つだけ選び、次を同じ根拠条件で比較する。

1. `build_context`一回で必要な複数根拠に到達できるか。
2. 直接取得を積み上げた場合と比べ、応答量・tool call数・再読のどれが減るか。
3. expected source、source trace、future leakage、書込み0を満たすか。

そこで再現可能な改善がなければ、BM25、永続task state、SQLite／FTS、GraphRAGは導入しない。
