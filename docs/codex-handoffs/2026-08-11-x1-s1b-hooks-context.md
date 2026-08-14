# Codex Session Handoff: X1-S1 maintenance and Hooks context

## Reactivation Prompt

```text
We are continuing from this handoff:
<repository>\docs\codex-handoffs\2026-08-11-x1-s1b-hooks-context.md

Read that document first, then inspect the current repo state. Do not assume the old chat context is available. Continue from the Next Steps section, verifying what still applies before changing files or global config.
```

## Context

- Repo/path: `<repository>`
- Branch: `agent/tsuzune-mcp-integration`
- Related handoff: `docs/codex-handoffs/2026-08-11-templates-graph-context.md` preserves the preceding templates / Graph parity context. This handoff adds the later maintenance slices and Hooks design input; it does not replace the Graph evidence boundary.
- Current goal: keep the local Markdown / MCP knowledge base simple, provenance-preserving, and compatible with the installed production app. Choose only independently justified next slices.
- User constraints: Windows-first and private/local; preserve raw sources and history; no speculative database, cache, embedding, GraphRAG, or token/cost claim; use the smallest safe change and leave unrelated dirty worktree changes intact.
- Session handling: no Codex sessions, logs, memories, skills, plugins, or automations were archived, moved, or deleted.

## What Changed

- X1-S1a is installed: a stable repeated `scan()` does not rewrite `.tsuzune/graph-file-times.json` when its regular-file raw bytes already equal the canonical creation-time registry. Missing, malformed, stale, or noncanonical sidecars continue to be repaired. `createdAt` and Graph Timeline semantics remain unchanged.
- X1-S1b is installed: `autonomous_update_note` is a no-op only when a supplied `expected_revision` matches and the supplied body is exactly identical. It returns `unchanged: true`, omits `history_path`, and does not write the target Markdown, AI history, or an already-stable canonical sidecar. Stale revisions still reject before equality, while calls without `expected_revision` retain the legacy history-writing behavior.
- The latest receipt records the dirty working tree based at `5266131f6e2c38afc39b46fe9083c9e1fef39577` as `installed-and-verified` at 2026-08-11 20:41 JST: 57-file production profile unchanged and 10/10 gate checks passed. Treat `docs/reports/production-update-latest.json` as the machine-readable authority; documentation finalized afterwards is not inside that receipt fingerprint.
- Production TSUZUNE was updated through revision-guarded writes: the dated X1-S1b source note plus project, search/Graph, evidence-map, and entry notes reference the maintenance result.
- Read the local `TSUZUNE Hooks 設計案.md`. It is a design input, not an implementation authorization. Its durable direction is: TSUZUNE Hooks are a lightweight event-observation layer, separate static WikiLink topology from a future Retrieval Graph, separate freshness / recency / usage / association signals, record before using, compare shadow rankings before applying any weak ranking correction, and never use weights to silently remove recall candidates.

## Files Touched Or Investigated

- X1-S1a implementation and regression: `src/main/vault.ts`, `tests/vault.creation-times.test.ts`, `docs/reports/x1-s1a-creation-time-sidecar-noop-2026-08-11.md`.
- X1-S1b implementation, wire contract, regression, and smoke: `src/mcp/service.ts`, `src/mcp/server.ts`, `tests/mcp-service.test.ts`, `scripts/check-mcp.mjs`, `README.md`, `docs/mcp-integration.md`, `docs/reports/x1-s1b-revision-aware-autonomous-noop-2026-08-11.md`.
- Durable status and evidence indexes: `PLAN.md`, `PROJECT_STATUS.md`, `docs/INDEX.md`, `docs/reports/production-update-latest.json`.
- Existing Graph / template context and blocked p evidence: `docs/codex-handoffs/2026-08-11-templates-graph-context.md`, `docs/reports/graph-gp0-attachment-file-explorer-2026-08-11.md`, and `.agent/requirements/20260811-0257-attachment-file-explorer-reveal/`.

## Commands And Checks Already Run

- X1-S1a: `npx vitest run tests/vault.creation-times.test.ts tests/graph-timeline.test.ts` — 2 files / 11 tests PASS; `npm run typecheck` PASS; `npm test` — 57 files / 510 tests PASS; `npm run check:mcp` PASS.
- X1-S1b: first targeted regression was red before implementation; after implementation `npx vitest run tests/mcp-service.test.ts` — 1 file / 18 tests PASS; `npm run typecheck` PASS; `npm run check:mcp` PASS; `git diff --check` PASS.
- Full X1-S1b suite: default 4 GiB V8 heap worker OOM occurred after 492 / 513 tests, without an assertion failure. With unchanged sources, `NODE_OPTIONS=--max-old-space-size=6144 npm test` — 57 files / 513 tests PASS.
- Production: `NODE_OPTIONS=--max-old-space-size=6144 npm run production:update` produced the current receipt with all 10 checks passed, packaged / installed smoke, built-versus-installed executable and `app.asar` hash equality, unchanged 57-file profile, and MCP registration.
- Independent post-diff review found no correctness, compatibility, or scope issue; the X1-S1b change stayed limited to the revision-aware branch and optional MCP response fields.

## Known Issues

- X1-S1b does not avoid the initial `snapshot()` / full-Vault scan. A missing, malformed, or noncanonical creation-time sidecar can still be repaired during that scan. Do not call this universal zero-write behavior or a performance/token improvement.
- The active Codex MCP tool declaration can lag a newly registered server schema within the same desktop session. Installed stdio smoke and the production receipt prove the new schema; do not test the new no-op response through a stale in-session declaration solely to refresh it.
- GP0-3b-p (`ファイルエクスプローラでファイルを表示`) remains closed `blocked`: a fresh isolated capture reached Obsidian's internal File Explorer selection, but Graph reopen did not retain the action-baseline camera exactly. No TSUZUNE product change was made for p.
- Model-visible input-token reduction, fixed four-question answer quality, and X1-T1 structured-only transport are unmeasured. Wire bytes or Markdown characters must not be presented as host-visible token savings.

## Open Decisions

- Choose the next independent Track: X1-T1 measurement, a profiled X1-S1 read-path question, or another primary-queue item. Do not infer a priority from this handoff.
- Reopen GP0-3b-p only after explicitly accepting or changing the Graph-reopen camera gate.
- Whether Hooks should become a requirements slice. If selected, decide its minimal event source, retention/privacy boundary, write-rate budget, failure behavior, and proof fixtures first. The proposal does not authorize SQLite, a persistent event log, `last_viewed_at` frontmatter writes, counters, co-occurrence ranking, or a Retrieval Graph.
- If Hook collection is ever selected, prefer append-only / separate operational data with a bounded retention contract over write-on-read mutations of ordinary note bodies or frontmatter. Keep human view/open events distinct from MCP retrieval/context-selection events, and prove that history/revision/provenance semantics remain intact.

## Next Steps

1. Read this handoff and the preceding `2026-08-11-templates-graph-context.md`, then run `git status --short` and inspect current sources before treating any dirty change as belonging to the next slice.
2. Select one independent next slice explicitly. For X1-T1, execute the fixed model-visible measurement protocol without changing transport beforehand.
3. For any read-path optimization, profile first and preserve note bytes, revision, `createdAt`, MOC/Temporal/provenance, `build_context` candidate union, and ordinary Graph/search scope.
4. If Hooks are chosen, write a small requirements packet and fixture-only shadow plan first; do not add `NoteOpened` write-on-read metadata or co-occurrence scoring as the first implementation.
5. Keep GP0-3b-p blocked unless the user explicitly changes its camera acceptance contract.

## Do Not Touch / Be Careful

- Do not modify raw exports, original/source notes, `50_履歴`, or the production Vault while investigating p or Hooks.
- Do not rerun the production gate unless intentional source changes have passed proportionate tests. Do not hand-edit receipt hashes.
- Do not introduce a database, background cache, BM25, embeddings, GraphRAG, generic event framework, or popularity ranking merely because Hooks may need data later.
- Preserve `expected_revision` stale rejection before no-op equality; never fabricate a history path.
- Preserve the existing Graph parity scope: do not silently remove `50_履歴/AI更新/` from ordinary Graph or search candidates in a maintenance slice.
