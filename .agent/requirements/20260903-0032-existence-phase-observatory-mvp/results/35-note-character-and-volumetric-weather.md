# LIFE Weather — ノート固有力学と色付き体積履歴

## 判断

LIFE Weatherの個性を、色や大きさだけでなく運動そのものへ移す。全ノート共通の漂流へランダム差を足すのではなく、各ノートが異なる接近、回避、回転、流れへの応答、未知への反応、現象への反応、履歴の残し方を持つ。これらは価値、重要度、存在相そのものを表す尺度ではなく、現在資料から作る一つの観測表現である。

## 参照した技術的方向

- William R. Chase, Flow Fields: 通常のnoise fieldが停滞点やsinkを作る問題に対し、curl／divergence-free fieldを用いて流れを循環させる。
  - https://www.williamrchase.com/writing/2019-09-30-flow-fields-12-months-of-art-september
- Emil Dziewanowski, Curl Noise: 大きな主流と小さな乱流を重ね、蔓やtendrilのような連続運動を作る。
  - https://emildziewanowski.com/curl-noise/
- Tyler Hobbs, Flow Fields: 複数尺度の滑らかな場の歪みで、単純な規則から多様な軌跡を作る。
  - https://www.tylerxhobbs.com/words/flow-fields
- Lenia: 連続値の局所相互作用から、多種の移動・変形・持続形態を生む。
  - https://chakazul.github.io/lenia.html
- Minimal Particle Life: 非対称な引力と斥力によって自己組織化する群れを作る。
  - https://github.com/hunar4321/particle-life
- WebGPU 3D Life Sim: 局所ルールから群れ、filament、shell、発光構造が現れる視覚例。
  - https://www.webgpu.com/showcase/3d-life-sim-webgpu-artificial-life-visualizer/

## 実装

- `work/archive-weather-prototype/note-model.mjs`
  - privacy-safeな既存traitsとnote ID由来seedから、9系統の独立したdynamic signatureを作る。
  - 接触を等作用反作用へ固定せず、source／target別の接近、回避、旋回を適用する。
  - 大域curl状流、呼吸する速度、note別のpace／volatility／chiralityを合成する。
  - event反応、stranger反応、memoryへの追随とdepositをnote別に変える。
- `work/archive-weather-prototype/prototype.mjs`
  - 再生時間倍率と追従可能な固定step数を引き上げる。
  - 8近傍の低周波拡散と長い減衰へ変更し、白い線ではなく色付きの体積履歴を強める。
  - event時のimprintを広げ、背景noiseを低周波化してmosaic感を避ける。
- `work/archive-weather-prototype/note-model.test.mjs`
  - 599ノートの力学署名が十分に分散し、単一score／rank／speciesへ畳まれていないことを検証する。
- `work/archive-weather-prototype/renderer-contract.test.mjs`
  - 斜め方向を含む拡散、note色による着色、event gating、速度線の不在を検証する。

## 検証

- `node --test work/archive-weather-prototype/note-model.test.mjs work/archive-weather-prototype/renderer-contract.test.mjs`
  - 21 tests passed。
  - 1800秒相当でも全粒子が有限範囲にあり、空間分布と時間変化を維持した。
- Codex内ブラウザ `http://127.0.0.1:4174/`
  - 初回観測で、中心の高密度発光、周辺の異速散開、複数色の低周波雲を確認した。
  - 12秒の時間差観測で、中央の群れが左上、右上、下端へ移送・分離し、中央の暗部が戻る変化を確認した。
  - 履歴は粒子から伸びる一本の速度線ではなく、群れの通過域に幅を持つ色付きの雲として残った。

## 境界

- 隔離prototypeのみ。既存観測宙域、本番製品、production install、Git deliveryへは接続しない。
- 自動生成された群れを真の分類、関係、価値、人生の全体、存在相そのものとは扱わない。
- 芸術的な最終採否は工房主の実画面確認に残す。
