# D19 code-path evidence

## Existing path

- Browser capture renders provenance frontmatter and creates collision-safe Markdown under `01_受信箱` in `src/main/browser-clip.ts`.
- `src/core/frontmatter.ts` reads scalar frontmatter; inline lists can be interpreted by a bounded consumer without adding a YAML dependency.
- Renderer and MCP search share `searchRendererRanked` from `src/core/search.ts`.
- Wiki links and backlinks are resolved by `src/core/links.ts`; MCP exposes backlink readback.
- `VaultMcpService.createNote` rejects an existing destination and routes configured review paths through `AiWriteReviewStore`; approval checks collision and revision again.
- `40_情報源` and legacy `50_履歴` are protected from autonomous writes by the existing policy.

## Smallest selected seam

1. Add `category:` and `topic:` facets to the shared search path, retaining ordinary full-text results for unclassified notes.
2. Group renderer results as knowledge, source, Inbox, and other without changing result count or hiding unclassified notes. Relevance order is preserved inside each fixed group.
3. Add a narrow derived-note proposal path that validates a source revision and generates canonical Markdown with one category, at most three topics, and an explicit source Wiki link. It must register an AI Review proposal in the first slice and must not mutate the source.
4. Keep semantic classification in the external AI organizer contract; do not add an embedded LLM, database, or scheduler to the app.

## Rejected shortcuts

- Folder-only grouping cannot express topic or provenance.
- MOC-only classification creates a manually maintained second source of truth.
- Plain full-text alone cannot guarantee a source round trip.
- Destination collision handling does not provide semantic duplicate detection.
