# TSUZUNE five improvements — implementation

Owner: CEO-01. Authorized plan: user request 2026-09-30. Status: source verified; production held.

Success: (1) Markdown links/headings/GFM and bounded previews work; (2) configurable major hotkeys and revision-checked cell/bulk Property editing work; (3) focused tests, typecheck, full regression and MCP checks pass, preserving existing changes.

Scope: six declared Property types, Vault-local settings, selected previewed conversion/rename, partial-completion reporting. Markdown remains canonical. No MCP permission expansion, production data conversion or Git publication.

Production: reconstruct Sept 24 source before promotion. Missing source/receipt means hold production update; implementation and isolated verification continue.

Packets (actual requested model/reasoning):
- reading: gpt-6-sol / high. Markdown headings/link resolution, MarkdownPreview, focused tests. No App/settings/IPC edits.
- property-core: gpt-6-sol / high. Pure Property operations, main Property service, focused tests. No App/shared types/IPC edits.
- hotkeys: gpt-6-luna / low. Hotkey helpers/settings UI/tests only. No App/settings/shared types edits.
- integration: parent, existing model/reasoning. App, preload/IPC/types/settings, Bases/Inventory UI, source audit, final validation and Vault writeback.

No worker may revert another's edits. Integration owns production and canonical writeback.

Sequence: audit → reading → shortcuts → cells → global types/bulk → review → gates → final evidence. Follow accepted conversation plan; recommendations are no longer unselected.

Evidence and outstanding checks are kept in results.md; PLAN Current Decision remains repository priority owner.
