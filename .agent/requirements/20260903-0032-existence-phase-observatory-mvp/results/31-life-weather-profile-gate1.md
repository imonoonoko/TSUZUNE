# TSUZUNE LIFE Weather Profile — Gate 1 Evidence

観測日: 2026-09-04

## 結論

現在の通常表示対象598ノートから、描画と分離した再現可能な `TSUZUNE LIFE Weather Profile v1` を生成できるようにした。profileはノート本文を保持せず、source note id、観測時点、128次元の損失的内容特徴、現在の明示link、構造特徴を入力とする。

現象は総合重要度scoreへ統合せず、次の四種類を別の根拠で保持する。

- 発芽: 同じ観測層の活動密度と、それ以前に対する内容差。
- 回帰: 7日以上離れた過去から、各ノートに最も近い内容特徴を一件だけ選ぶ。
- 同時期の空気: 同じ7日層に共存する内容差と構造差。
- 合流: 後発ノートの現在linkが、二つ以上の以前の観測層を横断する場合。

各候補にはsource note id、使用属性、現象固有の数値根拠、選定理由、不確実性を保持する。各現象は最大24件に限定するが、省略件数を別に残し、非表示を不存在とみなさない。

## 実Vault観測

- 通常表示対象: 598件
- 時点あり: 598件、時点不明: 0件
- 観測範囲: 2026-07-30T04:43:22.066Z〜2026-09-03T12:32:06.313Z
- 7日層: 6
- 発芽: 6、候補省略0
- 回帰: 表示候補24、候補省略227
- 同時期の空気: 6、候補省略0
- 合流: 表示候補24、候補省略359
- profileと三つの比較生成: 約1.0〜4.5秒（同一PC上の複数回の単回観測。性能保証ではない）

初版の24次元単純hashでは回帰が約11万件となり、粗い観測器の衝突を意味の反復と誤認した。128次元のcollection内IDF付き損失特徴と「各後発ノートにつき最も近い過去一件」へ修正し、全組合せのscore化を廃止した。

## 因果比較

- 時点trackだけを循環shuffle: profile signatureが基準から変化。
- 内容trackだけを循環shuffle: profile signatureが基準から変化。
- 現在linkを除去: profile signatureが基準から変化し、合流候補は0件。
- link除去後も発芽は残り、明示linkを全現象の唯一の根拠にはしていない。

signatureは候補idと層の件数・密度・新規性から作り、ノート本文・題名・pathを出力しない。

## 変更artifact

- `src/core/life-weather.ts`
- `tests/life-weather.test.ts`
- `scripts/evaluate-life-weather-profile.ts`

## 検証

- `npx vitest run tests/life-weather.test.ts tests/observatory.test.ts --maxWorkers=1`: 2 files / 13 tests PASS。
- `npm run typecheck`: PASS。
- 実Vault evaluator: 598件、6層、三因果比較true、link除去時confluence 0、raw note text/path非出力。

## 証明しない境界

- logical `createdAt`を真の執筆・経験・取込時点とは呼ばない。
- 内容特徴の近さを意味の同一性と断定しない。
- 現在linkから過去の関係状態を復元しない。
- profileは存在相そのものではなく、現在の観測条件による局所表現である。
- 描画接続、作品としての変化、美的採否、製品統合、本番反映、Git deliveryは未実施。

## 次の停止線

Gate 2では、R5の固定周期eventをこのprofileの発芽・回帰・合流へ最小限置換する。profile候補の閾値・上限はMVPの暫定観測条件であり、意味の価値基準として固定しない。描画後は時間・内容・linkの各比較を同じcamera条件で観察し、利用者が「自分のノート群だから起きる変化」と感じられるかを別に判定する。
