# Windows Accessibility Baseline Alternatives

## Codebase Findings

- `src/renderer/components/WikiGraphView.tsx`はGraph canvasを`region`、操作群を`toolbar`、nodeをbuttonとして公開し、`+`／`-`／`0`／矢印のkeyboard pan/zoomを持つ。
- `src/renderer/styles.css`はbutton/input/select/link/CodeMirrorに2px focus-visible outlineを定義する。
- `tests/wiki-graph-view.test.tsx`はnodeをpointerとEnterで開けることを確認する。
- `PRODUCT.md`はWCAG 2.2 AA、pointerとkeyboard、100〜200%の表示倍率を製品要件とする。
- `PLAN.md`は実Windows keyboard、screen reader、High Contrast、100〜200% DPIを未完の受入条件としている。

## Options

### Option A: DOM回帰だけを増やす

Value: Low

既存のrole、name、keyboard handlerをunit testで補強する。

Tradeoff: 実Windows、screen reader、High Contrast、物理DPIの受入にはならない。

### Option B: 実Windows baselineを先に固定する

Value: High

最小primary flowを実Windowsで観測し、DOM testと分けてPASS／SKIP／FAILを残す。

Tradeoff: 実機環境と手動確認が必要で、未確認の項目をPASSとできない。

### Option C: Graph全体のaccessibilityを一括改修する

Value: Uncertain

tree semantics、canvas代替、High Contrast対応をまとめて作る。

Tradeoff: 問題の実測前に広範囲の設計と実装を進めることになり、現在の停止条件に反する。

## Recommendation

Option B。まず実Windows baselineを固定し、確認された障害だけを別の小さい修正sliceにする。
