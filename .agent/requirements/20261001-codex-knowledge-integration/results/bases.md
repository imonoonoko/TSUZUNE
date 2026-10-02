# Bases readonly MCP core

Implemented files: src/mcp/bases.ts, base-worker.ts, base-worker-client.ts, vault-source.ts; scripts/build-mcp.mjs; tests/mcp-bases.test.ts and mcp-base-worker.test.ts.

API: listBases(vault,snapshot,filters,input?), queryBase(vault,snapshot,filters,propertyTypes,{id,view_index?,context_note_id?,limit?,after?,max_characters?,now?},evaluate?,workerOptions?). Pass undefined evaluate and {signal} workerOptions for default cancellation. baseNoteRevision is exported and matches service note revision construction. Removed the unused MCP readBase helper and ReadBaseInput inheritance; the registered MCP contract is unchanged.

List defaults 50/max100 with query name/path substring. Query defaults50/max200. Output budget default15000/max100000/min1000 counts pretty JSON. Query output rows have id/revision and evaluator typed cells; columns identify computed/file/saved_property. Groups and global summaries remain data only. Omitted rows/cells/groups/summaries/diagnostics/columns are counted explicitly. Large cells are omitted safely. Zero-progress pages fail with budget guidance.

Queries require visible listBases allowlist, reuse parser and UI evaluator, honor all selected-view filters/sorts/formulas/limit/group/summaries and declared propertytypes. Explicit this context is required for selected-view/global references, never inferred from active UI. Cursors bind root/Base/snapshot note revisions and creation timestamps/types/view/context/limit and frozen evaluation time. No persistent cache or registry/settings writes. Explicit --vault does not read normal settings; only an explicitly supplied settingsPath enables fixture propertytypes using canonical realpath/lowercase key.

Each query owns a Node Worker with3000ms default timeout. Success/error/cancel/timeout await termination. Real catastrophic-regexp timeout, cancellation, missing-worker error and subsequent success are tested. Build emits base-worker.js adjacent to arbitrary --outfile; ESM createRequire banner supports bundled yaml Node require.

Verification after review repair: focused10/10 tests passed; npm run typecheck passed. New regression proves creation-time-only changes reject the old cursor for file.ctime sort even when Markdown content/mtime remain unchanged, then a restarted query follows the new order. Earlier arbitrary output build passed in ignored work/codex-integration/bases-worker-build. Ponytail-review removed unused readBase helper. No dependencies added. Source/fixture only; parent owns service/catalog integration, full gates, production and actual Codex acceptance.

Model: assigned gpt-6.1-sol/medium; actual runtime model not observable through available tools.
