---
total_score: 34
p1_count: 0
p0_count: 0
target: TSUZUNE note-header operation hierarchy
timestamp: 2026-08-17T05-21-59Z
slug: src-renderer-app-tsx
---
# TSUZUNE ノート操作階層レビュー

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 4 | 保存状態と選択状態が文字、背景、`aria-pressed`で確認できる。 |
| 2 | Match System / Real World | 3 | 「編集」「プレビュー」は明快だが、「ローカルグラフ」と「グラフビュー」の範囲差は名称だけでは弱い。 |
| 3 | User Control and Freedom | 4 | 3表示は可逆で、ユーザーを閉じ込めない。 |
| 4 | Consistency and Standards | 4 | native button、既存token、既存focus vocabularyを再利用している。 |
| 5 | Error Prevention | 3 | UI実装は状態を区別するが、focused testが相互排他と状態遷移まで固定していない。 |
| 6 | Recognition Rather Than Recall | 4 | iconだけに頼らず、すべてに可視ラベルがある。 |
| 7 | Flexibility and Efficiency | 3 | keyboard操作可能だが、shortcut表示と最悪幅受入はない。 |
| 8 | Aesthetic and Minimalist Design | 4 | 主切替、補助文脈、Vault navigationの階層が静かで明確。 |
| 9 | Error Recovery | 3 | 保存状態は見えるが、このslice単体では失敗時の回復を評価し切れない。 |
| 10 | Help and Documentation | 2 | Graph用語の範囲説明がなく、初見利用者には意味の推測が必要。 |
| **Total** |  | **34/40** | **Good。構造は出荷可能、契約と語彙に改善余地あり。** |

## Anti-Patterns Verdict

### LLM assessment

AI生成らしい過装飾は見られない。既存のwarm paper、Thread Teal、compact toolbarを守り、Edit／Previewだけを一つの主切替にした判断は製品UIとして自然。Local Graphを弱め、Vault Graphを左navigationへ一本化したことで、同じ重みのbuttonが横並びになる以前の問題は解消している。

### Deterministic scan

`detect.mjs --json src/renderer/App.tsx` はexit code 0、finding 0件。今回のsliceにgradient text、過剰card、過丸め、装飾motion、奇妙な独自controlはない。検出器はARIAの状態遷移やresponsive headroomまでは保証しないため、0件は補助証拠として扱う。

### Visual evidence

隔離Electron captureでは1440pxと900pxの両方で横overflowなし。900pxではactions right 730px、header right 740pxで収まった。安全なbrowser overlayは、native Electron targetに承認済みのscript injection経路がなく、本番Vault/profileを開かない境界を優先して実施していない。

## Overall Impression

今回の設計判断は正しい。最大の機会は、見た目を追加することではなく、現在の意図をlabelとtestへ正確に固定すること。そうすれば今後のtoolbar整理でも階層が崩れにくい。

## What's Working

1. `編集／プレビュー`がborder付きの一群として読め、note作業の主判断が3秒以内に分かる。
2. Local Graphは一clickで維持しながら、Vault全体Graphの重複入口をheaderから除いた。機能削除ではなく情報設計の整理になっている。
3. native button、`role="group"`、accessible name、`aria-pressed`、global `:focus-visible`を再利用しており、新規component、state、依存関係はない。
4. 現在色の実測contrastはmuted text on paper 4.71:1、active text on accent-soft 7.51:1で基準を満たす。

## Priority Issues

### [P2] Focused testが操作階層と状態遷移を完全には固定していない

- Why it matters: 現在のtestは`ノート表示`groupを取得した後、その親`.note-actions`を対象にEdit／Previewを探している。そのため、将来Edit／Previewがgroup外へ移動しても通る。Local Graphのgroup外配置、`aria-pressed`の相互排他、click後の状態も未検証。
- Fix: `within(switcher)`でEdit／Previewを検証し、Local Graphがswitcher外であることをassertする。Preview、Edit、Local Graphを順にclickし、3buttonの`aria-pressed`と表示regionを検証する。
- Suggested command: `$impeccable audit`

### [P2] Graphの可視名称が範囲差を言い切れていない

- Why it matters: headerは「ローカルグラフ」、左navigationは「グラフビュー」。既存利用者には通じるが、初見利用者は現在noteのGraphとVault全体Graphの違いを推測する必要がある。
- Fix: 新しい説明UIは増やさず、「このノートのグラフ」と「Vault全体グラフ」のように対になるlabelへ揃える。workspace tab名も同じ語彙へ同期する。
- Suggested command: `$impeccable clarify`

### [P2] Narrow acceptanceが通常noteだけで、最悪組合せを覆っていない

- Why it matters: 900px captureは合格したが余白は10px。structured captureでは「内容を編集」と「Markdownソース」が同時に増え、長いnote名、保存中／失敗label、Windows 200% scalingが重なるとwrap量や到達性が変わる。
- Fix: productの720px minimumを前提として、720／900px、通常note／structured capture、長い日本語title、保存中／失敗の最小matrixを隔離captureで受け入れる。Windows 125／150／200%は実機確認項目として分離する。
- Suggested command: `$impeccable adapt`

### [P3] Local Graphの製品上の役割を将来変更時にも保てる名前が必要

- Why it matters: 実装上は`viewMode='graph'`だが、UI上はEdit／Preview group外の文脈actionとして扱う。現時点では成立しているが、後からworkspace化すると語彙とtestがずれやすい。
- Fix: 「Local Graphはnote pane内の補助文脈表示」という現行契約をtest名または短い設計記録で維持する。新しい抽象化は作らない。
- Suggested command: `$impeccable document`

## Persona Red Flags

### Alex, power user

- 主切替が即座に見つかり、余計な確認もない点は良い。
- Edit／Preview／Graphのshortcutが見えず、反復利用時の加速経路は弱い。
- structured capture時のlabel拡張でtoolbar位置が変わる可能性がある。

### Sam, keyboard／screen-reader／low-vision user

- native button、group label、pressed state、focus outlineは良い。
- focused testがpressed stateとtab orderを固定していない。
- current contrastは合格だが、NVDA、Windows High Contrast、200% scalingは未確認。

### Jordan, first-time user

- 「編集」「プレビュー」は即座に理解できる。
- 「ローカルグラフ」と「グラフビュー」の違いは、Graph機能を知らないと判断しにくい。

## Minor Observations

- 900pxでaction rowをtitle下へwrapする挙動は、controlを潰すより良い。
- save statusは十分静かで、主切替と競合していない。
- `.note-view-switcher`と`.note-context-action`は一用途に対する最小CSSで、component抽象化は不要。
- Ponytail review: `Lean already. Ship.` 削除可能な過剰実装はない。

## Questions to Consider

1. Graphの二つのscopeを、説明文なしのlabelだけで明確にできるか。
2. productが本当に保証するminimumは720 CSS pxなのか、それともWindows 200% scalingでも720px相当を維持するのか。
3. Local Graphが将来workspace tabになった場合も「補助文脈action」という位置づけを維持するのか。

## Recommended Actions

1. `$impeccable audit`: focused testをgroup containmentとpressed-state遷移まで強化する。
2. `$impeccable clarify`: Local／Vault Graphのlabelを対になる語彙へ統一する。
3. `$impeccable adapt`: structured captureを含む720／900px受入matrixを追加する。
4. `$impeccable polish`: 上記修正後にvisual、keyboard、contrastを最終確認する。
