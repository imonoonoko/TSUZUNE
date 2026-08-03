# Obsidian Graph Parity Implementation Brief

## Existing Patterns
- `src/core/graph.ts`: Markdownからの純粋なグラフ構築・絞り込み・上限制御。
- `src/renderer/components/WikiGraphView.tsx`: SVG edge、HTML button node、pan／zoom／hover／focus。
- `src/main/settings.ts`: `settings.json`の既定値補完とpatch保存。
- `tests/graph.test.ts`、`tests/wiki-graph-view.test.tsx`、`tests/app.safety.test.tsx`: core、component、App統合test。

## Likely Touch Points
- `PLAN.md`
- `src/shared/types.ts`
- `src/core/graph-layout.ts`
- `src/main/settings.ts`、`src/main/ipc.ts`
- `src/preload/index.ts`
- `src/renderer/App.tsx`
- `src/renderer/components/WikiGraphView.tsx`
- graph／settings関連test

## Technical Assumptions
- GP1は`d3-force`で再現可能なsettled layoutを構築する。
- 既存HTML button nodeを維持し、Canvas描画はGP2で独立して導入する。
- Force設定は0〜100の正規化値として保存し、描画内部値へ変換する。

## Risks
- slider変更ごとの再配置が重い可能性。
- d3-forceの座標をpercentへ変換する際、端へ密集する可能性。
- App設定型の追加で古い設定fixtureが影響を受ける可能性。

## Test Plan
- Pure layout: 再現性、全node座標、Link distance方向。
- Settings: 既定値、古いJSON補完、patch保存。
- Component: 4 sliders、復元、配置変更、既存操作回帰。
- App: 読込設定をpropsへ渡し、変更をIPCへ保存。
- Final: graph関連test、typecheck、全test、build。

## Open Questions
- 実Electronでのslider連続操作性能をGP1 smokeで測る。
- GP2のCanvas libraryはGP1結果と2,000 node fixtureから決める。
