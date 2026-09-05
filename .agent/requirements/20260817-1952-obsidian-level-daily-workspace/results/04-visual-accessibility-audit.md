# Result 04 — Visual and accessibility audit

P1:

- 4つのheader actionは900px以下でも横一列で、720px／200%相当でoverflow riskがある。
- settingsは一枚の縦長surfaceで、category間移動と保存／閉じる到達性が弱い。
- settings dialogはfocus復帰を持つがTab cycleを閉じ込めていない。

受入境界:

- header action列を削除し、Rail main/footerを分けて狭い高さではmainだけをscroll可能にする。
- settingsをNight Workshop tokenだけで描画し、header／category／content／footerを分離する。
- 1440／900／720 CSS pxで横overflowを出さず、Escape、Tab、Shift+Tab、opener focus復帰を成立させる。

