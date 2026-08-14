# Scope

## In scope

- `Search files`のmalformed／in-progress query境界だけを扱う。
- TSUZUNEとObsidian 1.13.4へ同一fixture、同一query集合を入力する。
- node集合または一致件数、query入力値、再表示後状態を機械可読で比較する。
- 差が確認された場合だけ、既存`src/core/graph-query.ts`と対象testを最小修正する。

## Out of scope

- Excluded filesのManage UIと全surface効果。
- Groups、Force、Animate、context menu、GP0-3b-pの再開。
- 新しいparser、検索index、SQLite、BM25、Hooks、AI、依存関係。
- 本番Vault本文の変更、実OS外部processの起動、物理入力やアクセシビリティ受入の主張。
