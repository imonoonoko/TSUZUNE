# Obsidian Graph Parity Alternatives

## Codebase Findings
- `src/renderer/components/WikiGraphView.tsx`は固定リング配置、SVG edge、HTML button nodeを使う。
- `src/core/graph.ts`は解決済みWikiリンクから都度グラフを構築する。
- 現行のkeyboard focus、hover、表示上限とMarkdown不変条件は維持すべき資産である。

## Options

### Option A: 固定SVGを拡張
Effort: Small
Value: Low

既存リングへsliderと色設定だけを加える。

Benefits:
- 変更が少ない。

Tradeoffs:
- Forcesが実際の配置へ作用せず、Obsidianの操作感へ到達しない。

### Option B: d3-forceと既存アクセシブルnodeを段階統合
Effort: Medium
Value: High

純粋な力学配置を先に導入し、既存HTML button nodeと操作を維持する。次sliceでCanvas描画へ移す。

Benefits:
- 4つのForce設定を早く検証できる。
- 既存アクセシビリティと回帰testを維持しやすい。

Tradeoffs:
- GP1時点では大規模描画性能がObsidian相当に届かない。

### Option C: WebGLグラフを一括導入
Effort: Large
Value: High

力学、描画、操作を同時に置き換える。

Benefits:
- 大規模Vaultの上限を高くできる。

Tradeoffs:
- 回帰原因を切り分けにくく、keyboard／screen reader対応を別途再構築する必要がある。

## Recommendation
Option BでForce契約を通し、GP2でCanvasへ移行する。WebGLは大規模fixtureでCanvas不足が測定された場合だけ採用する。
