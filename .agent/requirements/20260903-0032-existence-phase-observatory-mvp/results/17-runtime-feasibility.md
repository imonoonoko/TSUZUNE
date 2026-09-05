# RUNTIME-FEASIBILITY 結果

## Current path

- `src/renderer/App.tsx`: `visibleGraph`を`ObservatoryView`へ渡す。
- `src/core/observatory.ts`: 実在note pathを最大72粒子へ変換し、linkを無視した決定的O(n²) simulation。
- `src/renderer/components/ObservatoryView.tsx`: 単一Canvas 2D、RAF、ResizeObserver、visibility、reduced-motion、pause、pointer/keyboard、gradient/glow/trail。
- `package.json`: graph用`d3-force`以外にWebGL/WebGPU専用依存なし。Electron 43.2.0。

## Options

1. Canvas 2D延命: 最小差分だが、R5の点・trail・glowを豪華にするだけになりやすい。
2. isolated WebGL2 motion prototype: shader/buffer/fallback/testが必要だが、node表面を捨て、数万のtracerとpersistent fieldで連続体を作れる。

scoutはCanvas 2D継続を最小実装として推奨したが、親統合では作品要件を満たさないため不採用。WebGPUは既存経路も互換性証拠もなく初回prototypeでは採用しない。次候補は既存productへ接続しない単一WebGL2 prototypeとする。

未計測: 実FPS、fill-rate、1x/2x DPR。実装時は現行acceptanceをbaselineにし、DPR、reduced-motion、589 note snapshotで計測する。
