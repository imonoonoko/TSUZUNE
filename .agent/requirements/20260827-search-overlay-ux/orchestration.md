# Orchestration

## Parallel audit packets

- Packet 01 owns read-only tracing of every current modal/backdrop close path, with special attention to Command Palette, Quick Switcher, Settings dirty state, and form dialogs.
- Packet 02 owns read-only audit of Search view hierarchy, empty/results states, responsive layout, semantics, and existing UI checks.

Reviewers report exact files, public behavior, smallest safe fix, tests to add, and stop conditions. They do not edit files, write production TSUZUNE, add dependencies, revert other work, or broaden scope into search-engine changes.

## Integration policy

- The parent owns product edits, red-green sequencing, conflict resolution, unseen-boundary tests, UI capture, production update, and TSUZUNE writes.
- A backdrop handler must close only when `event.target === event.currentTarget` and must call the dialog's existing close/cancel path.
- Unsaved confirmation and saving guards remain authoritative; click-outside cannot bypass them.
- Search polish reuses the current query/result model and Night Workshop tokens. No new index, ranking system, animation layer, or modal abstraction.

## Verification

Run focused tests first, then full tests/typecheck/build/MCP. Exercise true backdrop and dialog-internal clicks, Escape/focus return, empty/query/result search states, and 1440/900/720 CSS px without horizontal overflow or Markdown mutation. Finish with an independent read-only review and the repository production gate.
