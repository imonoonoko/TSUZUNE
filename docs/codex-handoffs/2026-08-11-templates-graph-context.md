# Codex Session Handoff: Templates, Graph actions, and Context reduction

## Reactivation Prompt

```text
We are continuing from this handoff:
<repository>\docs\codex-handoffs\2026-08-11-templates-graph-context.md

Read that document first, then inspect the current repo state. Do not assume the old chat context is available. Continue from the Next Steps section, verifying what still applies before changing files or global config.
```

## Context

- Repo/path: `<repository>`
- Branch: `agent/tsuzune-mcp-integration`
- Current goal: keep the human-facing TSUZUNE workflow simple while preserving Markdown/MCP/Graph compatibility and reducing unnecessary context transport.
- User preferences or constraints: Windows-first, local/private scope; Markdown knowledge should not be required for ordinary input; preserve raw sources and history; use the smallest safe change; do not claim model-token savings without model-visible measurement.

## What Changed

- Product commit `2ee914c` was pushed. It adds four built-in templates, editable Vault templates under `90_テンプレート`, custom-template creation, template-based Daily/Idea creation, direct normal-note creation into the editor, rename dialog behavior, Graph zoom/fit, and attachment default-app/folder actions.
- Docs/receipt commit `5266131` was pushed. Production receipt and project status now record the rollout.
- Production update completed on 2026-08-11 05:00 JST: `installed-and-verified`, product commit `2ee914c`, 509 tests, 10/10 checks, packaged/installed smoke, executable and `app.asar` hash equality, 57-file production profile unchanged, and MCP registration passed.
- TSUZUNE `10_プロジェクト/TSUZUNE.md` was updated through revision-guarded `autonomous_update_note`; the previous body was preserved automatically under `50_履歴/AI更新`.
- Context reduction status: MOC Title Router keeps all MOC titles in authored order and reduced the production `00_入口/知識地図.md` context from 15,000 to 1,130 Markdown characters (92.47%). Recall-safe Query Bridge keeps the candidate union and only prioritizes ordinary note body expansion. Model-visible token reduction is not measured; structured-only MCP transport remains a separate future slice.

## Files Touched Or Investigated

- Product implementation: `src/core/templates.ts`, `src/renderer/App.tsx`, `src/renderer/components/RenameDialog.tsx`, `src/renderer/components/WikiGraphView.tsx`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/types.ts`.
- Product tests: `tests/templates.test.ts`, `tests/wiki-graph-view.test.tsx`, `tests/ipc.graph-settings.test.ts`, and focused `tests/app.safety.test.tsx` cases.
- Durable status/docs: `PROJECT_STATUS.md`, `PLAN.md`, `docs/reports/production-update-latest.json`, GP0-3b-o report assets, and this handoff.
- Next-slice requirements: `.agent/requirements/20260811-0257-attachment-file-explorer-reveal/`.

## Commands And Checks Already Run

- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- `npm run check:mcp` — PASS (4 read tools, 3 write tools).
- `npm run production:update` — PASS, including package, installer contract, packaged smoke, silent install, installed smoke/hash, and MCP registration.
- `npx vitest run tests/templates.test.ts tests/wiki-graph-view.test.tsx tests/ipc.graph-settings.test.ts --pool=forks --no-file-parallelism --maxWorkers=1` — 3 files / 59 tests PASS.
- Focused app feature cases — PASS when split by feature. The monolithic `tests/app.safety.test.tsx` run still hits the known d3-force/RTL 4 GB Vitest worker OOM without an assertion failure; the production gate nevertheless passed 57 files / 509 tests.
- `node scripts/probe-obsidian-graph-search-persistence.mjs --attachment-file-explorer` — fresh isolated capture reached the exact click and internal File Explorer classification; the command exits nonzero because only `attachmentFileExplorerGraphReopenKept` is false (Obsidian re-centers the Graph camera on reopen). Diagnostic manifest/observation are retained under `docs/reports/assets/graph-gp0-attachment-file-explorer/`.
- Before creating this handoff, `git status --short` was clean; `origin/agent/tsuzune-mcp-integration` is at `5266131`. After this resumption, the handoff, blocked p report, and diagnostic capture are intentionally uncommitted.

## Known Issues

- GP0-3b-p (`ファイルエクスプローラでファイルを表示`) received one fresh isolated retry after preflight stabilization. The target click succeeded and classified as Obsidian's internal `file-explorer.revealInFolder` transition, but the full gate failed only because same-process Graph reopen did not preserve the action-baseline camera exactly. No product implementation or production change was made for p; the diagnostic capture is not an accepted packet. See [GP0-3b-p report](../reports/graph-gp0-attachment-file-explorer-2026-08-11.md).
- The next reference attempt must not claim real Windows Explorer launch, physical input, screen-reader/High Contrast, multi-DPI, or pixel identity unless separately proven.
- MOC query hard-filtering is intentionally rejected because titles alone have high false-negative risk. Do not silently drop MOC titles or score-0 candidates.
- The 92.47% context reduction is a Markdown-character measurement, not a model-visible token measurement.

## Open Decisions

- Whether to explicitly revise the GP0-3b-p camera contract before any future retry. Do not rerun p or implement the internal File Explorer action automatically; it is currently closed as blocked.
- Whether a later X1-T1 structured-only transport change is justified after an external-client/model-visible token measurement; do not infer it from wire-byte savings alone.

## Next Steps

1. Treat GP0-3b-p as closed `blocked`; keep the diagnostic manifest/observation and the truthful [report](../reports/graph-gp0-attachment-file-explorer-2026-08-11.md).
2. Return to the queue and choose an independent Track. Reopen p only after explicitly deciding whether Graph-reopen camera reset is acceptable and updating its stop gate.
3. Keep context work on the measurement track: design a model-visible token benchmark before considering structured-only MCP transport.

## Do Not Touch / Be Careful

- Do not modify raw exports, original/source notes, `50_履歴`, or the production Vault as part of the p reference attempt.
- Do not rerun production update unless source changes are intentionally made and reverified.
- Do not add a new database, embedding/GraphRAG layer, generic migration framework, or speculative template/Graph abstraction.
- Preserve revision guards and dirty-form/data-loss protections when changing note creation or rename flows.
