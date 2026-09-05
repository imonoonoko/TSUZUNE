# TSUZUNE LIFE Weather — Note Existence-Phase Signature Evidence

観測日: 2026-09-04

## 結論

隔離中のLIFE Weather prototypeへ、各ノートの局所的な存在相シグネチャを実装した。内容・時点・link・構造とは別に、境界の明示、資料／観測／提案としての傾き、改訂の残留、出典の痕跡、明示された時間、未確実性を8本の観測軸として保持する。これらを単一scoreへ集約せず、慣性、拡散、痕跡保持、結合、相転移感受性、光の揺らぎへ別々に接続した。

このシグネチャは存在相そのものではなく、現在取得できるMarkdownとfrontmatterから作る局所的な観測表現である。

## 実Vault接続

- `50_履歴`を除く通常表示対象599ノートを再観測した。
- 題名、本文、pathはprototype snapshotへ出力せず、opaque idと数値特徴だけを保持した。
- 599ノートから331種類の運動応答組合せを得た。同じ応答のノートもあり、個体識別や価値判定には使わない。
- 一件だけphase軸を変えた同一初期条件で、その粒子と候補近傍の軌道が変わることを確認した。

## 動力学の安全境界

- phaseは重要度、価値、順位、同一性のscoreではない。
- 全体イベントの渦向きを粒子ごとに分岐し、一つの属性や現象が宇宙全体を同方向へ固定しない。
- 捕獲／圧縮の中心に通過域を設け、粒子が一点へ崩壊し続けないようにした。
- 1800秒後も有限、平均速度0.004411、方向整合0.194、95区画を占有、最大区画比率0.110で分布と運動を維持した。

## 検証

- `node --test work/archive-weather-prototype/note-model.test.mjs`: 16 tests PASS。
- `npx vitest run tests/life-weather.test.ts tests/observatory.test.ts --maxWorkers=1`: 2 files / 14 tests PASS。
- `npm run typecheck`: PASS。
- `git diff --check`（対象file）: PASS。
- ユーザー画面を妨げないため、ブラウザ表示と目視の美的確認は未実施。

## 変更artifact

- `src/core/life-weather.ts`
- `scripts/generate-life-weather-prototype.ts`
- `tests/life-weather.test.ts`
- `work/archive-weather-prototype/note-snapshot.mjs`
- `work/archive-weather-prototype/note-model.mjs`
- `work/archive-weather-prototype/note-model.test.mjs`

## 証明しない境界

- 存在相理論の自然科学的妥当性、真の人生、真の意味、ノートの価値を証明しない。
- 331種類という数は人格やノートの固有性の数ではない。
- 美的完成、製品統合、本番反映、Git delivery、利用者確認は未実施。

## 次の停止線

この段階では隔離prototypeの因果接続までを完了とする。次は利用者が実見し、ノートごとの違いが「装飾差」ではなく、人生の痕跡が異なる運動として感じられるかを判定する。採用後にだけ、煙・残響・光の質感へシグネチャを接続する。
