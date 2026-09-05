# D20 implementation result

## Outcome

The selected slice is implemented in source without changing any production-Vault source note.

- `propose_derived_note` accepts one fetched source under `01_受信箱` or an explicitly selected `40_情報源` note, one live canonical category, one to three topics, and a destination under `30_知識`.
- Submission creates only an AI Review proposal. Human approval creates the derived Markdown note; the source remains unchanged.
- The derived note records `type: knowledge`, `category`, `topics`, `derived_from`, `source_revision`, `source_refs`, and a source Wiki link.
- Search supports exact `category:` and `topic:` facets. Facet-only results retain category/topic metadata.
- Renderer results use four exclusive fixed groups: knowledge, source, Inbox, and other. Every result appears once and relevance order is preserved inside each group.

## Safety boundary

- The live `30_知識/TSUZUNE分類と保存基準.md` line is authoritative; malformed or ambiguous catalogs fail closed.
- `knowledge.md`, sources over 64 KiB, stale revisions, unsafe Wiki-link paths, unsupported categories, duplicate topics, and a second proposal for the same source revision are rejected.
- Approval revalidates source eligibility and revision, live category membership, exact source-link resolution, semantic duplicate absence, and destination collision. Stale proposals are removed without writing.
- No embedded LLM, database, Hook, schedule, daemon, bulk classification, move, rename, source update, or delete was added.

## Test-first evidence

- Adversarial additions first reproduced two defects: concurrent proposals both succeeded, and a `#` source path was accepted.
- After the lock-scoped semantic dedupe and Wiki-link guard, `npx vitest run tests/mcp-service.test.ts --maxWorkers=1` passed 60 tests.
- Integrated focused verification passed 107 tests across MCP service, search, renderer query, and file-tree grouping.
- `npm run typecheck` passed. `npm run check:mcp` passed against the real MCP protocol fixture.
- Full-suite and installed-production evidence belong to D21/D22 and are not claimed here.

## Delegation and parent integration

- Bounded code-path, design-critique, and grouping scouts supplied evidence only; the parent retained the public contract and final integration decision.
- `search_contract_hardening` owned search/test hardening. The parent removed its overfit multi-clause behavior, retained clause-level AND with Japanese segment candidates, and reran the focused tests.
- `derived_proposal_hardening` owned the first proposal/approval guard pass. The parent found and closed the remaining lock race, Wiki-link edge, missing adversarial tests, and MCP fixture gap.
