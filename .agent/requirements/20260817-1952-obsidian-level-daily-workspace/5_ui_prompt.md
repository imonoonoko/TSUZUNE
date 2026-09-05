# TSUZUNE Obsidian級Daily Workspace: UI Design Brief

Status: direction approved; the 2026-08-27 top-shell/settings continuation is source-verified and awaiting production acceptance

## 1. Feature Summary

TSUZUNEの既存3ペインを、日常的に迷わず使えるWindows knowledge workspaceへ整える。中心は新しい装飾ではなく、ノート、操作、本文検索の入口を分け、Tree、Tabs、Outline、Editor、Contextを共通のkeyboard／focus contractでつなぐことである。

本人一人が日本語の長文を毎日読み書きし、必要なnoteと関係へすぐ戻れることを目標とする。

## 2. Primary User Action

思考を止めず、現在のnoteから目的のnote、操作、heading、related contextへ移動し、元の作業位置へ戻る。

## 3. Design Direction

- Color strategy: Restrained。Paper／Canvas／Inkを面、Thread Tealをaction／focus／selection／connectionに限定する。
- Scene sentence: 一人の利用者が通常の室内光のWindowsデスクで、長い日本語noteを集中して読み書きし、必要な記録だけを素早く呼び出している。
- Anchor references: ObsidianのQuick Switcher／Command Palette／linked views、VS Codeのcommand／tree keyboard pattern、Windows File Explorerの予測可能なfile operations。
- Existing identity: 「静かな知識工房」。UIは道具として退き、Markdown本文を最も静かで強いsurfaceにする。
- Anti-direction: Obsidianのpixel copy、generic dashboard、nested cards、glass、neon、decorative motion、icon-only mystery controls。

## 4. Scope

- Fidelity: implementation-ready design brief。
- Breadth: whole daily workspace, delivered in independent slices。
- Interactivity: production behavior, keyboard and pointer parity。
- Time intent: P0を優先して出荷し、P1／P2はdogfood evidenceで順番を調整する。
- This artifact: the durable design contract for the selected shell/settings implementation and its later independent slices.

## 5. Layout Strategy

```text
+------------------------+------------------------------------+------------------+
| LEFT: PLACE            | CENTER: WORK                       | RIGHT: CONTEXT   |
|                        |                                    |                  |
| [Activity Rail]        | [Tab] [Tab] [Tab]                  | [Outline]        |
| [Files/Search/Create]  | Note title           Saved         | [Links]          |
| Files | Bookmarks      | [Edit | Preview] [This note graph] | [Backlinks]      |
|                        |                                    | [Time]           |
| ▼ 00_入口              |       readable 65–75ch             |                  |
|   今やること           |       Markdown surface             | current tab body |
| ▶ 10_プロジェクト      |                                    |                  |
|                        |                                    |                  |
| [Sync/Vault/Settings]  | path / word count / feedback       |                  |
+------------------------+------------------------------------+------------------+

Ctrl+O layer: ノートを開く
+--------------------------------------------------------------+
| ノートを開く                                      Ctrl+O     |
| [ title、path、aliasを検索...                         ]       |
| 最近のノート                                                 |
| > Note title                                      path       |
|   Another note                                    path       |
| Enter 開く       Ctrl+Enter 新しいタブ       Esc 閉じる      |
+--------------------------------------------------------------+

Ctrl+P layer: 操作を実行
+--------------------------------------------------------------+
| 操作を実行                                        Ctrl+P     |
| [ command名を検索...                                  ]       |
| > 左サイドバーを閉じる                            shortcut   |
|   プレビューへ切り替える                          shortcut   |
| Enter 実行                                      Esc 閉じる  |
+--------------------------------------------------------------+
```

### Hierarchy

1. Markdown work surface。
2. Current note title、save state、Edit／Preview。
3. Current-note context。
4. Vault navigation。
5. Sync、Settings、Graph settings、rare actions。

Low-frequency application controls live in the pinned Activity Rail footer. Each remains reachable by accessible name and tooltip; no existing operation receives a second implementation.

## 6. Primary Components and States

### Quick Switcher

States: recent, query results, duplicate titles, no match, explicit create, loading if needed, error.

- One input and one listbox-like result surface.
- The first release keeps at most 20 deduplicated Markdown-note recents for the current app session; restart persistence is deferred.
- Selection is visible through background, leading indicator, and accessibility state.
- Title is primary; path and modified／recent context are secondary.
- Footer shows only the shortcuts that work in the current state.

### Command Palette

States: recent commands, filtered, active-state command, disabled with reason, no result.

- Reuse the same temporary-layer vocabulary as Quick Switcher after the first pattern is proven.
- Command labels start with a concrete object／action in Japanese.
- Show shortcuts right-aligned. Do not add a plugin management surface.

### Left Pane

States: Files, Search results, Bookmarks, empty Vault, selected entry, drag target, collapsed rail.

- Search stays at the top.
- New note and Today are the strongest frequent actions. New folder stays discoverable but secondary.
- File／Bookmark view choice is explicit.
- Vault-wide Graph and rare actions sit below the main navigation or inside More.
- Tree focus and selected note must be distinguishable.

### Center Pane

States: welcome／empty, note Edit, note Preview, this-note Graph, attachment, linked view, save error, external conflict.

- Workspace tabs form the first row of work history.
- Note title and path truncate safely; full values remain available.
- Save state stays near the title and does not animate continuously.
- Edit／Preview remains a grouped primary control. This-note Graph remains secondary.
- Preview and Editor use an inner readable column rather than stretching prose across the full pane.

### Right Pane

States: Outline, Links, Backlinks, Time, empty, collapsed rail.

- Use the existing context tab pattern and add Outline without creating cards inside cards.
- Each tab shows only one context at a time.
- Backlink rows include a short excerpt; Time remains compact and factual.
- Context follows the active note unless a future pinned linked view explicitly says otherwise.

### Toolbars

States: default, hover, focus, active, disabled.

- Frequent formatting remains visible.
- Insert Wiki link, template, and rare formatting may live in Insert／More.
- Every compact action has tooltip, accessible name, and shortcut if available.

## 7. Interaction Model

### Global shortcuts

- `Ctrl+O`: open note switcher, even from Editor.
- `Ctrl+P`: open command palette, even from Editor.
- `Ctrl+Shift+F`: reveal full-text search.
- `Ctrl+Tab`／`Ctrl+Shift+Tab`: cycle workspace tabs.
- `Ctrl+W`: close current tab through save-safe behavior.
- `Escape`: close the topmost temporary layer before changing workspace state.
- Shortcut priority is topmost modal／temporary layer, focused editor／text control for standard editing, then explicit workspace commands. Prevent Electron／browser defaults only after an app command takes ownership.

### Context-sensitive shortcuts

- Editor formatting shortcuts run only while CodeMirror owns focus.
- Plain text inputs keep standard editing shortcuts.
- Global commands must not fire while a modal dialog owns the interaction unless explicitly supported.

### Focus

- Opening a layer focuses its input.
- Closing it returns to the exact opener when possible.
- Collapsing a sidebar keeps focus on its toggle.
- Opening a note does not steal focus from a pointer user, while keyboard-open offers a predictable note／editor focus destination.
- Closing a tab focuses the adjacent tab and announces the new active title.

### Feedback

- Use inline `status` for save progress and non-blocking completion.
- Use `alert` for failures requiring immediate attention.
- Empty states state the missing thing and one next action.
- Confirmation labels use verb plus object, such as "ノートをごみ箱へ移動".

## 8. Responsive Behavior

### Wide, 1280px and above

- Three panes may remain visible.
- The center prose column stays readable rather than growing indefinitely.

### Medium, 900–1279px

- One auxiliary pane may be collapsed by default or by remembered user state.
- Note title, save state, Edit／Preview, and sidebar reopen controls stay visible.

### Compact, 720–899px effective CSS width

- Center work surface remains the default.
- Opening one auxiliary pane must not make the other pane or essential close control unreachable.
- Permanent application-wide horizontal scroll is prohibited.
- Labels may truncate, but never disappear without tooltip／accessible name.

Scaling is tested at each Windows 100〜200% setting. CSS viewport screenshots alone do not close the real-DPI gate.

## 9. Content Requirements

- Surface names: "ノートを開く", "操作を実行", "内容を検索".
- Graph names: "このノートのグラフ", "Vault全体のグラフ".
- Context tabs: "アウトライン", "リンク", "バックリンク", "時間".
- Empty Outline: "このノートに見出しはありません。"
- Empty Backlinks: "このノートへのリンクはまだありません。"
- No Quick Switcher result: queryを表示し、明示的なcreate actionを一つだけ示す。
- Disabled command: reasonを一行で示す。例 "ノートを開いている時に使えます".
- Avoid generic "OK" and unexplained abbreviations.

## 10. Accessibility Expectations

- Follow standard APG patterns for tree, tabs, dialog／combobox or listbox as appropriate.
- Body text contrast at least 4.5:1; large text and non-text component boundaries at least 3:1 where applicable.
- Focus ring remains visible in Paper, Soft Paper, Canvas, and Workshop Night surfaces.
- Forced Colors preserves selection, focus, disabled, and error distinctions.
- Motion conveys only state and respects reduced motion.
- Real Windows acceptance includes keyboard, Narrator or NVDA, High Contrast, and 100〜200% scaling.

## 11. Implementation Prompt

Implement the approved TSUZUNE Daily Workspace slices against the existing React／Electron codebase. Preserve the 3-pane structure, Markdown source of truth, existing Paper／Thread Teal design tokens, current save／revision／conflict behavior, and dirty-worktree changes. Reuse `searchRendererRanked`, existing App action handlers, FileTree operations, workspace tab state, MarkdownEditor／Preview, RelatedNotes／TemporalDetails, and WikiGraphView. Do not add a plugin system, account, cloud dependency, app-owned note database, new design framework, or speculative command architecture.

Deliver one public behavior per slice. Begin with Quick Switcher, then Command Palette, FileTree keyboard semantics, workspace tab semantics, action hierarchy／wording, and finally reading／context improvements. Each slice must include keyboard behavior, focus restoration, empty／error states, long Japanese labels, 720／900 width evidence, and at least one executable regression test. A shipped product-code milestone must pass the repository's production update gate.

## 12. Recommended Impeccable References for Implementation

- `product.md`: familiar product controls and state vocabulary.
- `layout.md`: three-pane hierarchy and compact-width behavior.
- `typeset.md`: readable line length and heading rhythm.
- `clarify.md`: surface names, empty states, disabled reasons.
- `adapt.md`: width, long labels, Windows scaling.
- `harden.md`: errors, focus, accessibility, edge cases.

## 13. Open Questions

No open product question remains inside P0. Confirm or override the recommended direction before implementation. P2 choices such as split view, editable Properties, and customizable hotkeys are intentionally deferred to separate briefs.
