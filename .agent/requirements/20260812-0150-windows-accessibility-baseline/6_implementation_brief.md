# Windows Accessibility Baseline Implementation Brief

## Existing Patterns

- `WikiGraphView.tsx`の`panWithKeyboard`、node button、region/toolbar ARIA。
- `styles.css`のglobal focus-visible outline。
- `wiki-graph-view.test.tsx`のpointer/keyboard node-open回帰。

## Likely Touch Points

- 初回は製品コードなし。手動観測packetと既存testの実行だけ。
- 障害が再現した場合だけ、`WikiGraphView.tsx`、`styles.css`、対応するtestを最小範囲で変更する。

## Risks

- jsdomのfocus/ARIA確認は実Windows Narrator、High Contrast、physical DPIの代理ではない。
- canvas描画の視認性とDOM nodeのsemanticは別々に評価する必要がある。

## Test Plan

- 既存Graph keyboard regressionを実行する。
- Windows環境では、keyboard、倍率、screen reader、High Contrastをそれぞれ手動観測する。
- 未実測の項目はSKIPにし、推測でPASSにしない。

## Stop Conditions

- 実Windows観測が必要なのに、その環境または利用許可が得られない。
- 要求された受入がDOM test以上の実OS証拠を必要とするが、証拠を取得できない。
