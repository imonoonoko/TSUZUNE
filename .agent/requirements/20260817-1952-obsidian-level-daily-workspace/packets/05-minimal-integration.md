# Packet 05 — Minimal integration

## Objective

Remove the equal-weight permanent top action row, retain every existing action through the Activity Rail, and reorganize the existing settings into a category-based dark dialog.

## Ownership

- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- Focused regression tests and isolated UI acceptance only.

## Constraints

- Reuse existing update, Google, Vault, and settings handlers.
- Do not change persisted settings shape, Markdown semantics, OAuth storage, or IPC security.
- Add no dependency, database, account, plugin system, or speculative settings.

## Acceptance

- No `.app-header` action row remains.
- Activity Rail footer exposes update when supported, Google, active-Vault switch, settings, and the sidebar toggle.
- Settings exposes Files and links, Templates, and AI and review categories.
- 1440／900／720 CSS px, Tab／Shift+Tab／Escape, focus restore, and unchanged fixture Markdown pass.

