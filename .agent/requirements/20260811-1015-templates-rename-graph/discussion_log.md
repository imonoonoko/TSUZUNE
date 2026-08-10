# Discussion log

## 2026-08-11

- User reported three visible gaps in the current TSUZUNE window: the template picker has no usable templates, the bottom-left note rename button appears inert, and the graph view should feel closer to Obsidian.
- Existing code already supports Vault-backed Markdown templates, renameEntry, zoom/pan/fit, filters, groups, and graph settings. The first slice must repair the broken/absent public affordances without replacing those paths.
- Context/token work is intentionally kept separate: MOC title routing remains recall-safe (all titles, then fetch the selected note) and the next transport optimization is not part of this UI slice.

## Verification outcome

- Built-in `アイデアメモ`／`プロジェクトメモ`／`学びメモ` are in-memory only; real `90_テンプレート` files still override by exact path.
- Rename now uses an in-app dialog and keeps input on blank, unchanged, or API failure. Graph adds zoom-out, fit, and zoom-in controls through the existing view-state path.
- Targeted tests: templates and Graph 50/50; rename 2/2. Typecheck, build, MCP smoke, and diff-check passed.
- `production:update` was attempted twice and stopped at the existing Vitest worker OOM after 56/57 files and 494/514 tests. No installer or installed production profile was changed; production acceptance remains pending.

## 2026-08-11 template flow correction

- The user clarified that templates must be freely addable, the dedicated `今日のノート` and `アイデアを追加` buttons must be removed, and those entries must live in the template selector.
- The user also rejected the note-name/body creation modal for new notes. Creation must allocate a safe provisional name, create immediately, and open the ordinary editor screen.
- This correction supersedes the earlier requirement that built-in templates open the human note form. Structured forms remain only as a safe re-edit option for compatible existing Daily/Idea notes.

## Template flow verification

- Added four in-memory defaults: `今日のノート`, `アイデアメモ`, `プロジェクトメモ`, and `学びメモ`. Exact-path Vault files still override them without any startup write.
- `ノート`, selected templates, and `テンプレートを追加` now create collision-free Markdown files and open the ordinary editor directly. Dedicated Daily/Idea buttons are absent; existing same-day Daily notes are opened instead of duplicated.
- Public behavior tests for blank creation, custom template creation/discovery, generic template rendering, Daily, Idea, existing-Daily reuse, failure retention, and structured-note re-edit passed. Template core tests 8/8, typecheck, build, MCP smoke, and diff-check passed.
- The whole `app.safety` file again reached the repository's existing 4 GB Vitest worker heap ceiling after 35/55 tests; it reported no assertion failure before the worker OOM. Installed production was not changed.
