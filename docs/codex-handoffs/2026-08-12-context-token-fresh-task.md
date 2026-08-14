# Codex Session Handoff: CP1-B Fresh Boundary Monitoring

## Reactivation Prompt

```text
We are continuing from this handoff:
<repository>\docs\codex-handoffs\2026-08-12-context-token-fresh-task.md

Read that document first, then inspect the current repo state. Do not assume the old chat context is available. Continue from the Next Steps section, verifying what still applies before changing files or global config.
```

## Context

- Repo/path: `<repository>`
- Branch/HEAD at handoff: `agent/tsuzune-mcp-integration` / `5266131f6e2c38afc39b46fe9083c9e1fef39577`
- Current goal: monitor the conditionally adopted fresh-task boundary on the next three natural long tasks without lowering task success, provenance, safety, or source traceability.
- Active track: CP1-B Fresh Boundary Monitored Adoption. Sample 1/3 completed as FAIL with reusable partial evidence.
- Immediate state: the one allowed reference-completion attempt is blocked. Do not retry Excluded files GUI capture immediately; wait for the next natural long TSUZUNE task for monitoring sample 2/3.
- User constraints: local Windows personal software; TSUZUNE remains a Markdown knowledge source, not an AI runtime; preserve the dirty worktree; do not commit, push, release, reinstall, add dependencies, or change production settings unless separately requested.
- Session handling: no Codex task, rollout, log, memory, skill, plugin, or automation was archived, moved, or deleted.

## What Changed

- CP0-T01〜T10 completed as 8 pass / 2 blocked. CP0-T10 verified production Review mode with note-body invariance and complete cleanup.
- Corrected the earlier claim that task-level token usage was unavailable. Codex rollout JSONL stores cumulative `token_count` values for input, cached input, output, reasoning, and model context window.
- Re-scored all ten records from their frozen task boundaries. The new script reproduced all ten records exactly.
- Aggregate result: 456 token events; input 42,806,336; cached input 41,566,464 (97.10% of input); output 185,616; reasoning 54,727; model context window 258,400. Actual cost remains unobservable.
- Selected the first intervention to compare: a fresh Codex task with this short handoff and targeted TSUZUNE retrieval. Do not change TSUZUNE retrieval, BM25, Hooks, SQLite, cache, or context budgets before this comparison.
- Updated repository status documents, production TSUZUNE project note, and Codex Brain to this decision.
- CP1-A-04 and CP1-A-05 ran the same 6 GiB single-worker full suite. Both passed 58 files / 529 tests, Git status unchanged, tool calls 2→2, retry 0. Fresh input was 33,004 versus 289,020 (-88.58%); cached input was -89.03%.
- The 88.58% figure is limited to that matched pair. Fresh boundaries are conditionally adopted only for long tasks and must be monitored for three natural switches.
- The first 2-worker matched pair remains preserved: the fresh side failed with one worker OOM and is not replaced by the successful single-worker pair.
- CP1-B-01 fixed the dedicated Excluded files page, its empty label, the clickable plus control, and the live Graph exclusion effect. It did not establish restart persistence, so frozen condition B2 and the overall task are FAIL. Usage was input 2,156,261, cached input 2,062,848, output 27,301, reasoning 5,086, with retry 5.
- The correlated reference-completion task stopped blocked after four retries: archive package 1.13.4 versus isolated window 1.13.6, and no safe actionable Settings route. No guessed-coordinate click was used. Its final cumulative rollout usage was input 3,674,978 over 46 events; it is not sample 2/3.

## Files Touched Or Investigated

- `scripts/measure-codex-rollout-usage.mjs`
- `work/context-profiler/records/CP0-T01.json` through `CP0-T10.json`
- `docs/reports/context-profiler-native-baseline-2026-08-12.md`
- `docs/reports/assets/context-profiler-native-baseline-2026-08-12/summary-public.json`
- `docs/reports/cp0-t10-ai-write-review-runtime-acceptance-2026-08-12.md`
- `PLAN.md`, `PROJECT_STATUS.md`, `docs/INDEX.md`
- Production TSUZUNE note `10_プロジェクト/TSUZUNE.md`, current revision at handoff: `sha256:370a5431f9185fe7fc86b19421913a723864a9d5bc69e0d44310d8afdf6ffbb4`
- Existing Excluded files evidence: `docs/obsidian-graph-parity-reference.md`, `docs/reports/assets/graph-gp6/obsidian-1.13.4/01-global-baseline.observation.json`, `tests/app.safety.test.tsx`, `tests/ipc.graph-settings.test.ts`, `tests/excluded-files.test.ts`.
- Codex Brain note `<codex-brain>\wiki\tsuzune-project-status.md`

## Commands And Checks Already Run

- `node scripts/measure-codex-rollout-usage.mjs --rollout <current-rollout.jsonl>` — PASS; `task_count: 10`, `all_records_match: true`.
- CP0-T10 production Review runtime acceptance — PASS; proposal persisted outside the Vault, note revision/body unchanged, temporary setting and proposal store restored, start/end Git status fingerprints identical.
- Codex Brain `scripts\lint.ps1` — PASS, no errors or warnings; report `outputs/lint-2026-08-12-131511.md`.
- Codex Brain `scripts\health-check.ps1` — healthy, no missing links or secret hits; report `outputs/health-2026-08-12-131511.md`.
- No product build, reinstall, commit, push, or release was required for the usage-accounting and documentation-only correction.
- CP1-A-04 long side: `NODE_OPTIONS=--max-old-space-size=6144 npx vitest run --maxWorkers=1` — 58 files / 529 tests PASS; input 289,020.
- CP1-A-05 fresh side: same command — 58 files / 529 tests PASS; input 33,004. Both rollout records reproduce exactly and pass the shared schema.

## Known Issues

- `unique_sources` and `repeated_reads` remain `null` for all ten records; source-level reread waste is not yet measurable.
- A high cached-input ratio proves a large stable prefix is repeatedly presented, not that all cached tokens are unnecessary or charged at the uncached rate.
- Actual billing cost and cache discount are not exposed. Do not convert token counts into a cost-reduction claim.
- One matched pair supports the fresh boundary, but it is not a general reduction guarantee. Two further natural long-task switches remain after sample 1/3; the first sample carries a quality/re-exploration warning.
- Partial fixed capture now proves the Excluded files route, dedicated page, empty state, plus control, and Graph effect. Add/remove and restart persistence remain unproved.
- The reference-completion card used a placeholder midnight timestamp. Preserve it as an evidence gap; do not use it for token-boundary measurement or silently rewrite the frozen card.
- The TSUZUNE implementation currently uses a global textarea; this is not sufficient evidence of Obsidian parity. Do not change it from recollection.
- The repository was already heavily dirty. Preserve unrelated changes and do not treat the working tree as a clean release state.

## Open Decisions

- Excluded files Manage UI and FileTree parity remain held until a trustworthy fixed-version UI route becomes available. MCP filter propagation is already implemented and must not be duplicated.
- The next CP1-B admission must be a natural long task requested for real project work, not an artificial benchmark or another immediate reference retry.

## Next Steps

1. Run `git status --short`, read this handoff, and identify whether the user's next real request is a natural long TSUZUNE task.
2. If eligible, freeze CP1-B-02 before substantive work with the actual objective, 1–3 success conditions, stop conditions, and write boundary. Do not invent a task solely to fill the sample.
3. Use a short durable handoff plus targeted TSUZUNE retrieval; preserve raw errors, provenance, revision guards, and safety evidence.
4. Complete the real task, then record quality, safety, input, cached input, retries, and elapsed time without censoring failures.
5. Compare the result with the conditional-adoption guardrail. Do not attribute a task-specific failure to fresh boundaries without a defensible comparison.
6. Leave Excluded files Manage UI/FileTree work held unless a trustworthy fixed-version reference route becomes available independently.

## Do Not Touch / Be Careful

- Do not import the old chat transcript into the new task; this handoff is the bounded replacement.
- Do not add BM25, FTS, embeddings, GraphRAG, SQLite, Hooks, a background profiler, a cache, or an independent agent framework during CP1-A.
- Do not prune raw error output, diffs, security evidence, or revision guards to improve the token number.
- Do not infer real cost from input tokens or cached-input share.
- Do not implement Manage UI, FileTree filtering, MCP changes, or production updates in this reference-only sample.
