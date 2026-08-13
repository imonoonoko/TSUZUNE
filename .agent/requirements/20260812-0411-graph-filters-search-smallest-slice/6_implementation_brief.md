# Implementation brief

## 今回

実装しない。固定参照がない状態で`src/core/graph-query.ts`を変更しない。

確認済みのTSUZUNE挙動:

- 未閉じquote、末尾`OR`、未閉じ左括弧、未閉じregex、未閉じpropertyは入力途中として検索可能。
- compile不能なregexと式を持たない左括弧は一致0件。
- `tests/graph-query.test.ts`: 12/12 PASS。

## 再開手順

1. R1のquery matrixをJSON fixtureとして固定する。
2. Obsidian 1.13.4の隔離captureを取得する。
3. 同じmatrixでTSUZUNE observationを取得する。
4. comparisonで差がある一項目だけを要件化する。
5. 差がなければコード変更なしで閉じる。

再開時もExcluded filesやGroupsを混ぜない。
