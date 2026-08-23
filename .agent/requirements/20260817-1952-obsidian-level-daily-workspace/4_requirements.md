# TSUZUNE Obsidian級Daily Workspace: User-facing Requirements

Status: direction approved by the user on 2026-08-17; R1 Quick Switcher, R2 Command Palette, R3 Full-text Search, and R4 FileTree keyboard／ARIA are implemented and installed. The next gate is the bounded Windows acceptance in `6_implementation_brief.md`; R5 is the next implementation candidate only after that gate passes.

## Current execution decision — 2026-08-22

- Do not start a cosmetic refresh, new infrastructure, or multiple R5-R12 items together.
- Run the bounded acceptance packet first. Background-safe isolated checks and user-visible Windows assistive-technology checks are separate phases.
- If the packet finds a reproducible blocker or daily-navigation regression, fix one root cause and rerun only the affected scenario plus its regression check.
- If the packet passes, select R5 Workspace Tabs keyboard／ARIA as one independent implementation slice.
- R6-R12 remain staged. Their presence in this document is not approval to implement them.

## 1. Overview

TSUZUNEのDaily Workspaceは、ノートを探す、読む、書く、整理する、文脈を辿る、という反復動作を一つの予測可能な操作体系で提供する。Obsidianの現行Helpをinteraction referenceとして使うが、外観や全機能を複製しない。既存の3ペイン、Markdown正本、Paper／Thread Teal、時間・出典・履歴・安全性を維持する。

## 2. Core Mental Model

### Three entry points

- `Ctrl+O`: ノートを開く。対象はnote identityとrecent history。
- `Ctrl+P`: 操作を実行する。対象はavailable commands。
- `Ctrl+Shift+F`: 内容を検索する。対象は本文、path、tag、propertyなど。

三つのsurfaceは用途、placeholder、結果形式を混ぜない。どれを開いてもEscapeで閉じ、起点controlへfocusを戻す。

### Three panes

- Left: 場所とVault-wide navigation。
- Center: 現在の作業とwork history。
- Right: 現在noteの文脈。

現在noteに追従するviewとVault全体viewは、label、description、stateで明示する。

## 3. User Stories

- As the daily user, I want to open a known note from anywhere using the keyboard, so that navigation does not interrupt thought.
- As the daily user, I want to search for an action by name, so that I do not need to remember every button location or shortcut.
- As the daily user, I want the file tree and tabs to behave like familiar desktop controls, so that I can navigate without trial and error.
- As a long-form reader, I want a readable measure and an outline, so that I can understand and move through a note quickly.
- As a writer, I want formatting shortcuts and stable cursor／scroll context, so that switching modes does not lose my place.
- As an organizer, I want rename, move, bookmark, and trash operations to remain discoverable and safe from both pointer and keyboard.
- As a researcher, I want links, backlinks, time, outline, and local graph to clearly follow the current note, so that I can judge context without scanning unrelated panels.
- As a Windows user, I want the workspace to remain operable at 100〜200% scaling and with assistive technology, so that compactness never removes access.

## 4. Acceptance Criteria

### R1. Quick Switcher

- Given any non-modal workspace state, when the user presses `Ctrl+O`, then a single temporary layer opens, its search field is focused, and the background workspace remains unchanged.
- With an empty query, the list shows up to 20 Markdown notes opened in the current app session, in most-recent order with duplicates removed. Persistence across app restarts and non-Markdown workspace tabs are outside the first release.
- With input, results match note title, Vault-relative path, and available aliases. The implementation may use the existing ranked search, but result ordering must be deterministic.
- Duplicate titles show enough path context to choose correctly.
- ArrowUp／Down moves selection, Home／End reaches the first／last result, Enter opens in the active tab, and Ctrl+Enter opens in a new tab.
- No-match state does not create data silently. It shows one explicit "新規ノートを作成" action with the destination before creation.
- Escape closes the layer and returns focus to the control or editor position that opened it.
- Search results remain responsive for the production Vault and a deterministic 10,000-note synthetic fixture. After initial indexing and one warm-up query, measure input-to-painted-result for at least 30 committed query changes spanning five Japanese／path／duplicate-title queries; p95 must be at or below 150ms on the development PC. Record PC、Electron／Node version、fixture generator revision、note count、query set。Cold start and indexing time are reported separately and do not share this threshold.

### R2. Command Palette

- Given any non-modal workspace state, when the user presses `Ctrl+P`, then commands can be searched by Japanese label and stable keywords.
- Each result shows its label and assigned shortcut. A selected or active-state command exposes that state in text, not color alone.
- The first release includes safe, high-frequency commands: new note, today's note, open Quick Switcher, open Vault search, toggle sidebars, switch Edit／Preview, open this note's graph, open Vault-wide graph, show Bookmarks, open Settings.
- Commands call existing action handlers. The palette must not introduce a second implementation of create, open, Graph, or sidebar behavior.
- Disabled commands remain visible only when the reason helps the user; the reason is readable by assistive technology.
- Destructive operations are absent from the first release or pass through the same existing confirmation and trash contract as their visible controls.
- Arrow navigation, Enter, Escape, and focus return match Quick Switcher.

### R3. Full-text Search

- `Ctrl+Shift+F` focuses or reveals the persistent Vault search surface.
- Existing `tag:`、`path:`、`file:`、quoted phrase、negation behavior remains available and receives concise inline help.
- Empty search may show recent search terms, but it does not replace the FileTree without an explicit search action.
- Results identify title, path, modified time, and an excerpt around the match. Matching text is visually emphasized without relying on color alone.
- Search, Quick Switcher, and Command Palette use distinct labels: "内容を検索", "ノートを開く", "操作を実行".

### R4. FileTree

- The container uses `tree`; every visible note／folder uses `treeitem` with a correct level and selection state. Folders expose expanded state.
- Exactly one visible treeitem participates in the Tab order. ArrowUp／Down moves through visible items.
- ArrowRight expands a closed folder or moves to its first child. ArrowLeft collapses an open folder or moves to its parent.
- Home／End move to the first／last visible item. Typing printable characters cycles through visible items with matching names.
- Typeahead ignores keyboard events while IME composition is active, applies only committed text, compares Latin text case-insensitively, and resets the accumulated prefix after 700ms of inactivity. Japanese IME confirmation is included in real-Windows acceptance.
- Enter opens a note or toggles a folder. F2 starts existing inline rename. Shift+F10 or the Context Menu key opens the same menu as right-click.
- When a note is opened outside the tree, optional auto-reveal scrolls to and marks that note without stealing editor focus.
- Drag／drop, move, rename, bookmark, copy path, and trash retain the existing collision and data-preservation behavior.
- A 50-character title and 120-character path may be visually truncated, but full text is available through tooltip and accessible name.

### R5. Workspace Tabs

- The tablist uses a roving tabindex. Every tab has a unique id and `aria-controls`; the active work surface is a `tabpanel` labelled by the active tab.
- ArrowLeft／Right changes focus within the tablist. Enter or Space activates the focused tab if focus and selection are separated.
- Ctrl+Tab／Ctrl+Shift+Tab cycles active tabs, Ctrl+1..8 activates indexed tabs, Ctrl+9 activates the last tab, and Ctrl+W closes the active tab.
- Closing a tab focuses the next logical tab. Closing the last note returns to a useful empty state rather than a blank unlabeled panel.
- A tab does not close while its unsaved content would be lost. Saving, conflict, and external-change contracts remain authoritative.
- Long titles retain full tooltip／accessible text, and the active state uses shape, text or indicator in addition to color.

### R6. Reading Surface

- Normal prose in Preview and Editor uses a centered readable measure of approximately 65〜75 Japanese／Latin character units. The exact CSS measure may differ between Japanese and Latin text, but 1440px screens must not produce full-width paragraphs.
- Tables, preformatted blocks, and wide media may use their own inner overflow without causing viewport-wide horizontal scrolling.
- Heading levels have visible scale and spacing differences, and screen-reader heading order matches the Markdown source.
- The right context includes an Outline tab listing headings in document order. Selecting a heading moves the current note to it and visibly identifies the current section.
- Properties can collapse. The collapsed state shows "プロパティ n件" and does not hide parse warnings or malformed source.
- Empty Preview, no-heading Outline, and unavailable attachment states explain what the user can do next.

### R7. Writing Surface

- The formatting toolbar separates high-frequency formatting from Insert／More actions.
- Every icon-only or compact control has an accessible name, visible tooltip, and shortcut when one exists.
- Editor-specific shortcuts take precedence only while CodeMirror is focused. Global shortcuts must not unexpectedly replace text-entry behavior.
- Shortcut ownership follows one order: the topmost modal／temporary layer, then the focused editor／text control for standard text editing, then explicit workspace shortcuts. `Ctrl+O`、`Ctrl+P`、`Ctrl+Shift+F`、`Ctrl+Tab`、`Ctrl+Shift+Tab`、`Ctrl+1..9`、`Ctrl+W` are workspace shortcuts only when no modal owns the interaction; Electron／browser defaults are prevented only when TSUZUNE handles the command.
- `Ctrl+S` forces the existing save path and reports saved／saving／error state without a modal success dialog.
- Edit／Preview switching preserves the same note, save state, and a reasonable cursor／scroll context. Failure to map an exact position must not move to an unrelated location silently.
- Wiki link suggestions reuse existing note data and never require a remote service.

### R8. Context and Graph

- The right context uses four clear tabs: Outline, Links, Backlinks, Time. Each tab reports a count where meaningful and preserves the existing Arrow／Home／End tab behavior.
- Backlink rows show source title and enough heading／excerpt context to judge whether opening is useful.
- The current-note graph is labelled "このノートのグラフ". The global graph is labelled "Vault全体のグラフ". Tooltips state the same scope.
- Local graph, backlinks, and outline follow the active note. A pinned／linked view, if later added, visibly states which note it is pinned to.
- Graph settings remain a secondary surface. Graph does not compete visually with Edit／Preview in the note header.

### R9. Visual Hierarchy

- Center work content remains the highest-contrast and largest continuous surface.
- Thread Teal is reserved for primary action, focus, selection, and relationship emphasis. It is not used as decoration.
- Permanent panels remain flat. Cards and shadows are not added to routine lists or panels.
- Primary controls, secondary controls, state indicators, and low-frequency overflow actions have distinct visual weight.
- Minimum routine control height remains at least 30px, with visible focus that is not clipped.
- UI copy uses concrete labels. "OK" is not used where a verb and object can state the result.

### R10. Responsive and Scaling

- The app is accepted at 720／900／1280／1440 CSS px with left and right sidebars each open／closed.
- At constrained widths, the center remains reachable and auxiliary panes do not force application-wide horizontal scrolling.
- At 100／125／150／175／200% Windows scale, controls do not overlap, dialog close actions remain reachable, and selected／focus states remain visible.
- No action becomes icon-only without tooltip and accessible name.
- Long Japanese labels, long paths, empty states, save errors, conflicts, and sync notices are included in the narrow acceptance fixture.

### R11. Accessibility

- Primary workflows work with pointer and keyboard.
- Text and component states meet WCAG 2.2 AA contrast. Meaning never depends on color alone.
- Temporary layers trap focus only while open, close with Escape, and restore focus.
- Hidden or collapsed panes contain no reachable focus targets.
- Reduced motion is honored. Product motion is limited to 150〜250ms state feedback and never gates content visibility.
- DOM tests, isolated Electron tests, and real Windows Narrator／NVDA／High Contrast results are reported separately. One cannot substitute for another.

### R12. Safety and Local-first Behavior

- Markdown remains readable without TSUZUNE.
- Navigation and presentation changes do not rewrite note content.
- Rename, move, trash, external-change, revision, and history behavior are not simplified to achieve UI speed.
- No account, telemetry, plugin marketplace, cloud service, or new database is required.
- Automated visual acceptance uses isolated Vault and userData, not the active production Vault.

## 5. Quality Gates

### Automated DOM／unit

- Quick Switcher and Command Palette keyboard states, focus return, duplicate titles, empty／no-match states.
- FileTree treeitem hierarchy and full navigation matrix.
- Tabs aria relationships and shortcut matrix.
- Outline extraction／jump, long labels, Properties collapse, Graph labels.
- Shortcut collision behavior while CodeMirror or an input is focused.

### Isolated Electron

- 720／900／1280／1440 screenshots with long Japanese fixture.
- Left／right sidebar permutations, overlay layers, tooltips, errors, no horizontal viewport overflow.
- Keyboard-only smoke for open note, command, tree, tabs, Outline, Edit／Preview.
- Fixture Markdown digest unchanged unless the scenario explicitly creates or edits a note.

### Real Windows

- 100／125／150／175／200% scale.
- Narrator or NVDA reading order and control names.
- High Contrast and keyboard focus visibility.
- Physical Tab／Shift+Tab／Arrow／Enter／Escape／Context Menu keys.

### Delivery

- `npm run typecheck`, relevant focused tests, full `npm test`, build, and applicable MCP checks.
- Every shipped product-code milestone passes `npm run production:update` 10/10, built／installed hash checks, isolated packaged／installed smoke, production profile unchanged, and MCP registration refresh.

## 6. Open Questions

No unresolved product choice is required for the background-safe acceptance phase. Narrator／NVDA, High Contrast, and Windows display-scale changes are visible or system-affecting checks and require a separately scheduled user-visible acceptance window. Advanced split view, editable Properties, and configurable hotkeys remain P2 and receive separate requirements before implementation.
