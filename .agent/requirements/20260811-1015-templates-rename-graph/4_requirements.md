# Requirements and acceptance

## Templates

- The left toolbar no longer exposes separate `今日のノート` or `アイデアを追加` buttons. Both are available from the template selector.
- A Vault with zero `90_テンプレート` notes shows stable built-in choices including `今日のノート` and `アイデアメモ`.
- Built-ins are in-memory only; opening or refreshing a Vault performs no template-file write.
- `ノート` creates a collision-free `無題のノート` immediately and opens it in the normal Markdown editor; it does not open the note-name/body dialog.
- Selecting a template creates the note immediately, renders title/date placeholders, and opens the normal Markdown editor. `今日のノート` keeps its dated path and opens an existing note rather than duplicating it.
- `テンプレートを追加` creates a collision-free editable Markdown file below `90_テンプレート` and opens that file in the normal editor. It becomes a selectable template through the existing Vault-backed discovery path.
- A real Vault template with the same path replaces the built-in definition; unrelated custom templates remain listed in stable path order.
- Existing safe Daily/Idea form re-editing remains available for already structured notes, but creation no longer requires those forms.

## Rename

- Clicking `名前変更` for a selected note or directory opens an in-app dialog with the current name, an editable input, cancel, submit, Escape handling, focus restoration, and an inline error region.
- Submitting the same/blank name does not call the API.
- A valid submit calls the existing `renameEntry` with the selected relative path and new name exactly once, refreshes selection to the returned path, and closes only after success.
- Link-impact confirmation, flush-save, collision errors, alias bookkeeping, and failure input retention remain active.
- The flow does not call `window.prompt`.

## Graph

- The graph exposes compact buttons labelled `グラフを縮小`, `グラフ全体を表示`, and `グラフを拡大`.
- Buttons update the existing zoom/pan/view-state path; fit keeps all visible nodes inside the viewport and does not rebuild the graph.
- Existing wheel, keyboard, settings, filters, groups, context menu, and graph persistence behavior remain unchanged.

## Verification and stop

- Targeted tests for templates, App safety, and WikiGraphView pass; typecheck and diff-check pass.
- No new dependency, database, or Vault startup write is introduced.
- Stop after these three public affordances are verified; full Obsidian parity remains a later explicitly scoped slice.
