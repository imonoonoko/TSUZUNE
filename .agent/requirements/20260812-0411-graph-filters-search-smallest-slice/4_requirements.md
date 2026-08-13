# Requirements

## R1. Fixed query matrix

最低限、次を明示的な文字列として同じ順序で両製品へ入力する。

- 未閉じquote
- 末尾`OR`
- 未閉じ左括弧
- 未閉じregex
- 未閉じproperty
- compile不能なregex
- 式を持たない左括弧

queryを「malformed」と先に一括分類せず、各入力の観測結果を固定する。

## R2. Fixed reference

Obsidian Desktop 1.13.4を隔離profile／fixtureで観測し、query、表示node、再表示後query、エラー表示の有無をRaw observationへ保存する。captureがなければ製品仕様を推測しない。

## R3. TSUZUNE comparison

同じfixtureとquery matrixをTSUZUNEへ適用し、Raw observationからcomparisonを生成する。既存の通常query永続化証拠をmalformed queryの証明へ流用しない。

## R4. Change gate

- 全項目一致: 製品コードを変更せず`matched-core-behavior`として閉じる。
- 差あり: 差を一項目へ絞り、既存parserを最小変更し、その失敗を検出する回帰testを追加する。
- 参照取得不能: `blocked`として閉じる。

## R5. Verification

変更なしでも既存`tests/graph-query.test.ts`を実行する。製品変更時はtargeted test、typecheck、全test、`check:mcp`、`git diff --check`を変更範囲に応じて実行し、Ponytail reviewで過剰実装がないことを確認する。

## R6. Safety and delivery

isolated fixtureだけを使う。外部processを起動せず、本番Vaultへ書かない。製品変更がなく、かつ固定参照比較も未完の状態では`production:update`を実行しない。

## CP0-T01 acceptance

| 条件 | 結果 | 根拠 |
|---|---|---|
| A1: 未受入の公開挙動一件を特定し、scopeと受入条件を固定 | PASS | 本package |
| A2: 差を再現して最小修正、または正直なno-change／blocked判定 | PASS | 固定参照不足を確認し、製品変更なしのblocked判定と証拠を残した |
| A3: 比例した検証、無関係な変更なし、本番Vault変更なし | PASS | targeted test 12/12、製品変更0 |

成功条件は満たしたが、事前停止条件が発火したため、CP0-T01全体の結果は`blocked`とする。
