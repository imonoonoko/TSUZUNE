# TSUZUNE Daily Workspace — Current Execution Brief

Status: source-verified; production acceptance and final TSUZUNE writeback pending.

## Outcome

Replace the permanent in-app top action row with an Obsidian-like left-side application control area, and make the current settings usable as a categorized dark surface without inventing unimplemented options.

## Public behavior

- The native Windows title bar remains; the in-app brand/Vault/action header is removed.
- The Activity Rail has two regions:
  - scrollable daily navigation and creation actions;
  - a pinned footer for update when available, Google, active-Vault switch, settings, and sidebar collapse.
- Each compact action keeps an accessible name and tooltip. Update state is exposed through description and tooltip instead of changing the button's accessible name.
- Settings opens with three categories: Files and links, Templates, AI and review.
- Desktop uses a left category column. At 760px and below it becomes a horizontally scrollable category row.
- Settings content scrolls independently while Cancel and Save remain fixed.
- Tab and Shift+Tab wrap inside Settings; Escape closes only while not busy and returns focus to the opener.

## Reuse boundary

- Reuse `handleUpdateAction`, `openGoogleDialog`, `chooseVault`, `openSettingsDialog`, and the existing settings save functions.
- Keep `AppSettings`, IPC channels, OAuth credential storage, AI proposal semantics, and Markdown behavior unchanged.
- Do not add settings search, appearance fields, custom hotkeys, attachment policy, plugins, accounts, cloud behavior, or a new dependency in this slice.

## Product files

- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- `tests/app.safety.test.tsx`
- `scripts/check-shell-settings-ui.mjs`
- `scripts/capture-optimization-ui.mjs`

## Acceptance evidence

- Focused shell/settings tests pass.
- `npm run build` passes.
- `npm test`: 858 passed, 1 skipped.
- `npm run check:mcp` passes.
- Isolated Electron acceptance passes at 1440／900／720 CSS px with no horizontal viewport overflow and unchanged fixture Markdown digest.
- Settings screenshots show dark Files and links, Templates, and AI and review surfaces; the fixed footer remains visible at 720px.
- Independent read-only verification passes, including busy-state and preservation of the existing three-step settings save path.

## Remaining execution

1. Confirm production TSUZUNE is not running; never force-close it.
2. Run `npm run production:update` and require the complete packaged／installed/hash/profile/MCP delivery gate.
3. Verify the installed result and delivery artifact.
4. Fetch current canonical TSUZUNE notes, write the final verified boundary once, and read back links and status.

## Stop conditions

- Stop after installed acceptance and final knowledge-base writeback.
- If production TSUZUNE is running, ask the user to close it and wait.
- If persistence, OAuth, save/conflict behavior, or another settings schema must change, stop and contract that as a separate slice.
- Do not automatically implement the remaining Obsidian parity candidates.
