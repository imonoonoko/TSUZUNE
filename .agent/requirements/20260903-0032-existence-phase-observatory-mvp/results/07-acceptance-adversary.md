# Result 07 — Acceptance Adversary

## 初回受入の誤り

7件fixtureで遷移、transform一致、ノートopenだけを検査し、全量DOM／Canvasを許容していた。機械的PASSは鑑賞品質を証明していなかった。

## REDにする条件

1. 開始時から局所sceneで、意味を持つ星は1〜9件。overview／全景操作を禁止する。
2. 描画edgeの両端は必ずscene内で、場面外edgeをrendererへ渡さない。
3. 常時captionから全件数、内部rule名、存在相注意文を除く。
4. 1280×800相当で全星核を中央安全領域へ収め、caption／controlsと分離する。
5. 背景装飾をnoteや関係に見せず、ARIA treeにも入れない。

## 自動化しない判定

「見続けたい」「宇宙として心地よい」「ノートを開きたくなる」は利用者受入に残す。自動試験は全量配線、端飛び、矩形Canvas、技術captionの再発だけを検出する。

