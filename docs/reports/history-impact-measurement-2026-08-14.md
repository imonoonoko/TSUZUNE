# TSUZUNE AI更新履歴 影響計測 — 2026-08-14

## 結論

`50_履歴`による通常操作の負荷は実在する。圧縮・ローテーションはまだ行わず、次の製品sliceを「通常のGraph・backlink・デスクトップ検索から`50_履歴`を既定除外する最小変更」とする。

Drive同期から履歴を除外する判断はしない。監査・復元・バックアップ契約が変わるため、別の計測と設計が必要である。

## 実測境界

- 対象: 本番Vault `<production-vault>`
- 計測時刻: 2026-08-14 21:01 JST
- 方法: 製品の`buildWikiGraph`、Graph simulation、`getBacklinks`、`searchNotes`を実Markdownへ適用
- 比較: 全593ノート 対 `50_履歴`を除いた180ノート
- warmup 3回、sample 10回、Node coreのみ
- 本番VaultのMarkdown digestは計測前後で一致。作成・更新・移動・削除は0
- DOM／Canvas描画、Electron起動、watcherイベントは未計測

再現コマンド:

```powershell
node scripts/run-measure-history-impact.mjs --vault "<production-vault>" --output "work\history-impact-2026-08-14\measurement.json"
```

## 結果

| 項目 | 全ノート | 履歴除外 | 比率／差 |
|---|---:|---:|---:|
| Markdown件数 | 593 | 180 | 履歴413件 |
| Markdown bytes | 7,351,555 | 943,272 | 履歴6,408,283 bytes（87.2%） |
| Wiki link occurrences | 8,668 | 1,042 | 履歴7,626件（88.0%） |
| Graph nodes | 593 | 180 | 3.29倍 |
| Graph edges | 6,757 | 967 | 6.99倍 |
| Graph build p50 | 157.7507ms | 22.4657ms | 7.02倍 |
| Graph simulation 180 tick p50 | 614.0018ms | 116.3181ms | 5.28倍 |
| TSUZUNE backlink件数 | 210 | 70 | 履歴由来140件 |
| Backlink scan p50 | 225.1573ms | 19.5930ms | 11.49倍 |
| 4-query search suite p50 | 89.7372ms | 13.5424ms | 6.63倍 |
| Markdown読込 | 48.8628ms | 6.5498ms | warm-cache参考値 |

検索4語は`TSUZUNE`、`MCP`、`Graph`、`更新`。全ノートを対象にすると、それぞれ565／457／438／529件が一致し、履歴除外時は157／108／100／122件だった。現在のMCP searchは既に`50_履歴`を既定除外する一方、Rendererの通常検索は`savedNotes`全体を使うため、デスクトップ検索には履歴ノイズが残る。

## 成長予測

- AI更新履歴の観測期間: 2026-08-02〜2026-08-14 UTC、13日
- 現在量: 413件、6,408,283 bytes
- 単純平均: 約492,945 bytes／日
- 同じ率なら10MiBまで約9日

8月13日の一括分類など一時的な大量更新を含むため、これは上限寄りの線形予測であり、定常成長率とは扱わない。

## Drive境界

- live `preview_drive_sync`: TSUZUNE本体が閉じているため未実施
- Drive apply: 未実施
- 最終同期状態: 2026-08-14 20:22 JST、履歴386件をlocal／remote stateに保持
- 静的差分: state未登録Markdown 31件・462,907 bytesのうち、AI更新履歴27件・437,022 bytes（94.4%）

静的差分はupload候補の概算であり、remote変更・move・conflictを判定する正式previewではない。履歴をDrive対象外にすると監査バックアップ境界が変わるため、この結果だけでは採用しない。

## 判定

1. 「問題なしなら何もしない」は不採用。Graph、backlink、デスクトップ検索で明確な差がある。
2. 圧縮・ローテーションは保留。6.4MBは緊急のストレージ障害ではなく、監査履歴を破壊する必要はない。
3. 次の最小sliceは、通常のGraph・backlink・Renderer検索から`50_履歴`を既定除外すること。
4. File tree、明示fetch、監査履歴、Temporal Memoryの明示的な時点参照は維持する。
5. Drive同期対象の変更は別契約。正式previewを取る場合もapplyとは分離する。

## 次sliceの不変条件

- Graph node／edgeへ`50_履歴`を入れない
- 通常backlink一覧へ`50_履歴`のsource noteを入れない
- Renderer通常検索へ`50_履歴`を入れない
- File treeと直接open／fetchは維持する
- MCP searchの既存`include_history: true`、Temporal Memory、`build_context(as_of:)`を壊さない
- 新規DB、cache、event log、Hooks、学習順位は追加しない

## 証拠

- `scripts/measure-history-impact.ts`
- `scripts/run-measure-history-impact.mjs`
- raw local result: `work/history-impact-2026-08-14/measurement.json`
- pre/post Markdown digest: `24bccebecf90511399ddf8c1de06dd6b97411bc515e494a1bd204c8cd6404c29`
