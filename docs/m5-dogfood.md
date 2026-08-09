# M5 Starter Vault Dogfood

実施日: 2026-07-31
対象: Temporal Memory Lite M5
判定: PASS

## 目的

同じモデルへ渡すContextだけを変え、TSUZUNEの時間対応Contextが次を改善するか確認した。

- 現在と過去時点の区別
- 再確認期限超過の検出
- 状態ノートから出典への追跡
- 根拠がない状態を推測しないこと

これはモデル一般の知能向上を証明する試験ではない。TSUZUNEが、より正確で時点整合的な根拠を渡せるかを比較した。

## Starter Vaultへ追加した記録

3対象について、State Note 5件、Event Note 3件、Gitチェックポイントの出典ノート1件を追加した。

- TSUZUNE: v0.1完了、MCP接続、Temporal M4完了
- BMR Shelf: 2026-07-22に別名で開発中と報告
- 宵灯工房: 2026-07-22に凍結中と訂正

これにより、少なくとも2プロジェクト、2回の状態変化、1件の訂正を実データで扱った。TSUZUNEの時刻は、次のGitコミット時刻を出典ノートへ固定した。

- `cf24860888179965d92a93b6efd98e78783c924b`
- `0c66af80511ef3b393017e4336319f903b6cee5e`
- `4b3576564af896f0bbf3291f21c08ababed57687`

## 比較条件

同じ固定質問を、それぞれ独立した新規回答者へ渡した。

| Arm | 渡した資料 |
|---|---|
| A | 3件の起点ノート本文だけ |
| B | 従来の起点 + outgoing最大5件 + backlink最大3件 |
| C | 現在と2026-07-22を分離した時間対応Context |

固定質問:

1. 現在動いているプロジェクトは何か。
2. 2026-07-22時点では何が動いていたか。
3. 再確認が必要な情報は何か。
4. この状態を採用した根拠は何か。

対照質問として「2026-07-22時点のTSUZUNEの状態は何か」も尋ねた。正解は、当時有効なState Noteがないため「不明」である。

## 回答品質

| 指標 | A: 起点だけ | B: 従来1段 | C: 時間対応 |
|---|---:|---:|---:|
| 固定4問の厳密正答 | 1/4 | 1/4 | 4/4 |
| exact State Note → Source | 0/3 | 0/3 | 3/3 |
| 対照質問で未来を遡及しない | PASS | PASS | PASS |
| 推測抑制 | PASS | FAIL | PASS |

主な差:

- Aは2026-07-22のBMR Shelfを答えられたが、正式な`review_after`超過と状態ノートから出典への組を得られなかった。
- Bは「現在の入口」という通常ノートからBloodLedgerも稼働中と推測し、再確認期限を取得できなかった。
- Cは現在のTSUZUNE、2026-07-22のBMR Shelf、期限超過したBMR Shelfと宵灯工房、3組の状態根拠を区別した。

## 機械判定

`npm run dogfood:m5`が生成する`work/m5-dogfood/metrics.json`の結果:

| 指標 | A | B | C |
|---|---:|---:|---:|
| 過去へ混入した未来State/Event | 0 | 0 | 0 |
| 過去へ露出した時間未指定本文 | 3 | 16 | 0 |
| 現在の再確認警告 | 0 | 0 | 2 |
| 解決済み出典 | 0 | 0 | 6 |

Bの未来State/Eventが0件なのは安全性を示さない。1段リンクの件数上限により時間ノート自体が選ばれず、代わりに時間範囲のない通常本文16件を過去資料へ露出していた。

競合状態、観測時刻不明についての合成安全性プローブは4件すべてPASSした。

## Dogfoodで見つけて直した問題

初回のCはState/Eventの未来選択を防いだ一方、2026-07-22用Contextへ2026-07-30更新の通常ノート本文を含めていた。回答者はその本文を遡及利用しなかったが、Context層では未来情報を見せていたためGate FAILとした。

最小修正として、明示された`asOf`が生成時刻より過去の場合は次の動作へ変更した。

- 時間範囲のない通常ノート本文を採用しない
- 起点はPathと名前を残したstubにする
- `contentOmitted` / `content_omitted`を構造化出力する
- `UNSCOPED_NORMAL_CONTENT_OMITTED`警告へ対象Pathを載せる
- State/Eventは従来どおりvalid-timeとknowledge-timeで選ぶ
- mtimeを事実の有効時刻として使用しない
- 現在Contextと`asOf`省略時の通常本文は従来どおり残す

再生成後は、Cの過去資料に含まれる時間未指定本文が0件になった。
修正後のCへ同じ固定質問を再実行し、厳密正答4/4、State Note→Source 3/3、対照質問「不明」、推測なしを再確認した。

公開前の独立監査では、起点自身が未来のState/Event Noteである場合だけ、過去`as_of`でも起点本文が残る境界ケースを追加発見した。起点にも同じ時間判定を適用して本文をstub化し、MCPへ`temporal_perspective`を公開して、実際の有効時点（valid-time）と当時の知識時点（knowledge-time）を明示的に選べるよう修正した。

## 手作業負担と誤判定

観測した手作業:

- 3対象へ8件の時間ノートと1件の追加出典ノートを作成
- State/Eventごとに日時、subject、状態またはevent、sourceを記入
- subjectごとにContextを作るため、3つの起点を個別に指定
- A/B/Cの独立回答3件と独立監査を実施

観測した誤判定:

- A: 再確認期限超過を特定できず、通常ノートを状態根拠として扱った
- B: BloodLedgerを稼働中と推測し、「期限なし」と判断した
- 初回C: 回答は正しかったが、過去Contextへ後日の通常本文が露出した

入力所要時間は計測していない。8件のfrontmatter手入力は日常運用では負担になり得るが、M5中に入力UIは追加しなかった。

## 2026-08-09 Context構築ベンチマーク

現在の本番Vaultを読み取り専用で使い、起点3件だけのArmと時間対応Context Armを各trial 20回warm-up、200回測定、3 trialで比較した。

- TSUZUNEなし: median 0.021 ms、p95 0.031 ms
- TSUZUNEあり: median 149.685 ms、p95 173.339 ms
- 絶対追加時間: median 149.664 ms
- 過去Context: 7,391文字から3,585文字へ減少し、時間未指定本文3件から0件へ減少
- 現在Context: 7,391文字／3ノートから33,412文字／24ノートへ増加し、出典6組と再確認警告3件を追加

相対倍率は約7,128倍だが、比較元が文字列連結だけで約0.02msのため、意思決定には約150msという絶対値を使う。詳細は[TSUZUNEあり／なし ベンチマーク](reports/tsuzune-with-without-benchmark-2026-08-09.md)を参照する。

## 残る制限

- Context Compilerは1つのsubjectを起点にする。今回の全プロジェクト比較は3 bundleを集約した。
- 過去時点では時間範囲のない通常本文を保守的に省略するため、背景情報が不足する場合がある。その場合は通常ノートを無理に推測せず、必要な事実だけState/Event化する。
- `review_after`超過は誤りや無効を意味せず、再確認要求だけを表す。
- 時間メタデータ入力の自動化、グラフ、同期、プラグイン、独自DBはこのM5へ追加していない。

## 2026-08-09 M5-C snapshot index

CPU profileで、同じVault snapshotに対するMarkdown走査、backlink計算、Wikiリンク解決、Temporal解析の繰り返しが主要コストであることを確認した。そこで永続cacheやDBを追加せず、1回の要求内だけでpath、outgoing／backlink、解析済みTemporal metadataを共有した。

同じ本番Vault、20回warm-up、200回測定で再計測した結果:

- 改善前: median 151.123ms、p95 180.404ms
- 改善後: median 35.934ms、p95 47.798ms
- median 76.2%短縮、4.21倍
- p95 73.5%短縮
- A／B／CのMarkdown SHA-256は改善前後で完全一致
- 未来情報混入0、安全判定、出典件数など意味指標も一致

retained heapの改善前後比較は、GCとmixed working treeの他処理を分離した再現可能なharnessがないため未測定とした。推定値でPASSにはせず、要求境界を越える長寿命cacheを検討する場合の必須Gateとして残す。

## 再現

```powershell
npm run dogfood:m5 -- "<Starter Vault path>" 2026-07-31 2026-07-22
npm run typecheck
npm test
npm run check:mcp
npm run build
git diff --check
```

生成物:

- `work/m5-dogfood/A-seed-only.md`
- `work/m5-dogfood/B-legacy-one-hop.md`
- `work/m5-dogfood/C-temporal.md`
- `work/m5-dogfood/metrics.json`
- `work/m5-dogfood/README.md`

`work/`は再生成可能なローカル証跡であり、Git管理しない。
