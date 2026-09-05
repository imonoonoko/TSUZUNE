# TSUZUNE LIFE Weather — Gate 2 Motion Evidence

観測日: 2026-09-04

## 結論

R5の固定3周期イベントを廃止し、Gate 1 Profileの発芽・回帰・合流候補だけが大域的な捕獲・圧縮・破裂・残響を起こすよう、隔離WebGL2 prototypeへ接続した。Profileが空なら大域イベントは0件となる。作品内時刻は検出済み候補を辿る再生ヘッドであり、時計だけでは現象を作らない。

## 実Vault接続

- 通常表示対象598ノートを一対一の粒子へ再生成。
- 題名、本文、pathを出力せず、opaque id、損失的内容特徴、観測時点、現在link、構造特徴、Profile候補の粒子indexだけを保持。
- Profile候補数: 発芽6、回帰24、合流24。省略件数はProfileに保持。
- 発芽・回帰・合流は異なる継続時間を持ち、候補の実ノート粒子が現象中心を担う。

## 同一条件の因果比較

同一初期配置・同一camera・240秒でbaselineと一属性比較Profileを描画系へ入力した。

| 比較 | 粒子位置RMS差 | 現象列 |
|---|---:|---|
| 時点shuffle | 0.413898 | baselineと異なる |
| 内容shuffle | 0.396680 | baselineと異なる |
| link除去 | 0.432928 | baselineと異なり、合流候補0 |

RMS差は作品内の位置差であり、意味、価値、重要性のscoreではない。

## 検証

- `node --test work/archive-weather-prototype/note-model.test.mjs`: 14 tests PASS。
- `npx vitest run tests/life-weather.test.ts tests/observatory.test.ts --maxWorkers=1`: 2 files / 13 tests PASS。
- `npm run typecheck`: PASS。
- Codex内ブラウザの非表示実機確認: WebGL error 0、598粒子、発芽・回帰・合流の候補idとstageが同時に更新。
- 目視: 描画崩壊、空画面、固定線はなし。美的採否は利用者未確認。

## 変更artifact

- `scripts/generate-life-weather-prototype.ts`
- `work/archive-weather-prototype/note-snapshot.mjs`
- `work/archive-weather-prototype/note-model.mjs`
- `work/archive-weather-prototype/note-model.test.mjs`
- `work/archive-weather-prototype/prototype.mjs`
- `work/archive-weather-prototype/index.html`
- `work/archive-weather-prototype/README.md`

## 証明しない境界

- Profileは存在相そのもの、真の人生、真の意味関係、自然科学simulationではない。
- `createdAt`を真の執筆時点・経験時点とは呼ばない。
- 同じcameraで差が出ることは芸術として感動できることを証明しない。
- 製品統合、本番反映、Git delivery、利用者確認は未実施。

## 次の停止線

ここでGate 2を止める。次は利用者が隔離prototypeを実見し、「自分のノート群だから生じた天候」に見えるかを判定する。採用された場合だけ、同時期の空気と観測層の残留を視覚表現へ深めるか、製品統合の別gateを設計する。
