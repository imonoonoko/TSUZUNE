# TSUZUNE Obsidian級Daily Workspace: Alternatives

Status: draft, user confirmation pending

## Codebase Findings

- `src/renderer/App.tsx` は3ペイン、search、workspace tabs、sidebar state、note view state、既存action handlersを一か所で結んでいる。
- `src/core/search.ts` はranked searchと`tag:`／`path:`／`file:`／quoted phrase／negationを既に持つ。Quick Switcherと検索UIは新しいsearch engineを作らず再利用できる。
- `src/renderer/components/FileTree.tsx` は`role="tree"`、F2 rename、drag／drop、context menuを持つが、各rowの標準treeitem semanticsと矢印／Home／End／typeaheadが不足する。
- workspace tabsは`tablist`／`tab`を持つが、roving tabindex、`aria-controls`／`tabpanel`、Ctrl+Tab／Ctrl+Wが不足する。
- `MarkdownPreview`、`MarkdownEditor`、`RelatedNotes`、`TemporalDetails`、`WikiGraphView`は既存surfaceとして再利用できる。
- current UI監査で、Properties、sidebar collapse、context tabs、Edit／Preview階層は完了済み。次の大きな摩擦はkeyboard entry、tree、tabs、long-form navigationである。

## Options

### Option A: Obsidianの外観と機能を広く複製する

Effort: Very large
Value: Medium

Summary:

Ribbon、panes、tabs、Properties編集、Live Preview、split、Canvas、Bases、plugin modelまで一括で追う。

Benefits:

- 一覧上の機能差は縮まりやすい。
- Obsidian利用者には見た目が似る。

Tradeoffs:

- 現在必要な日常摩擦と関係の薄い機能が大量に入る。
- TSUZUNE固有の時間・出典・安全性より模倣が主目的になる。
- UI state、persistence、test matrixが急増し、一人用ローカル製品の単純さを失う。
- pixel copyは製品原則と既存監査の判断に反する。

### Option B: 色、余白、文字サイズだけを磨く

Effort: Small
Value: Low

Summary:

既存画面のspacing、font、button densityを整え、interaction modelは変えない。

Benefits:

- 変更が小さく、短期間で見た目が整う。
- 現在の状態管理へ影響しにくい。

Tradeoffs:

- Quick Switcher、Command Palette、Tree／Tabs keyboard、Outlineの欠落が残る。
- 操作を探す時間とマウス依存は改善しない。
- 「見やすい」は改善しても「使いやすい」がObsidian級にならない。

### Option C: Daily Workspace interaction parity

Effort: Medium to large, phased
Value: High

Summary:

既存3ペインとブランドを維持し、3つの入口と5つの日常動線を統一する。各sliceは一つの公開挙動だけを変更し、既存検索、actions、tabs、context dataを再利用する。

Benefits:

- 反復頻度が高い操作から体感を上げられる。
- Obsidianの予測可能なinteractionを取り入れつつ、TSUZUNEのIdentityを保てる。
- 新しいplugin systemやapp-owned DBが不要。
- 各sliceをkeyboard、narrow width、long label、production gateで独立検証できる。

Tradeoffs:

- 全機能の一覧比較では未実装項目が残る。
- Keyboardとresponsiveを後付けにせず、各sliceのacceptanceへ含める必要がある。
- P0完了まで複数の小さなproduction updateが必要になる。

## Recommended Direction

Option Cを採用する。

中心となるmental modelは三つだけにする。

| Intent | Entry | Result |
|---|---|---|
| ノートを開く | `Ctrl+O` | title、path、alias、recentから選ぶ |
| 操作を実行する | `Ctrl+P` | command名を検索し、shortcutを確認して実行する |
| 内容を検索する | `Ctrl+Shift+F` | 本文、path、tag、propertyを絞り込む |

Workspaceの意味は現行を維持する。

```text
+--------------------------------------------------------------------------------+
| App header: Vault / current state                         Sync / Settings / Help |
+----------------------+-----------------------------------------+-----------------+
| LEFT: PLACE          | CENTER: WORK                            | RIGHT: CONTEXT  |
| Quick create         | Workspace tabs                          | Outline         |
| Search / Files       | Note title + save state                 | Links           |
| Bookmarks / Recent   | Edit / Preview                          | Backlinks       |
|                      | Readable Markdown surface               | Time            |
| Vault-wide views     |                                         |                 |
+----------------------+-----------------------------------------+-----------------+
| Status: current path, save/error feedback, keyboard hint                         |
+--------------------------------------------------------------------------------+

Temporary layer over the workspace:
  Ctrl+O  Note switcher     Ctrl+P  Command palette
```

## Why not a generated visual direction probe

これは新しいvisual identityの探索ではなく、既存workspaceのinformation architectureとinteractionを整える提案である。PRODUCT.md、DESIGN.md、現行captureが方向を固定しているため、画像生成による別案は実装判断を増やすだけと判断した。
