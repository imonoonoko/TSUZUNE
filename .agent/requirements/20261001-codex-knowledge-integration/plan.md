# Codex knowledge integration

## Goal

Implement the user-approved Codex knowledge integration plan end to end: natural-language discovery, attributable comparison/exploration, safe Markdown updates and resumption. ChatGPT and Git publication are excluded.

## Success Criteria

1. Six actual isolated Codex scenarios find and read sufficient source without tool names or answer text in prompts.
2. Four common read tools provide bounded, revision-attributed output with explicit omissions; read-only requests never mutate Vault/settings.
3. Requested fixture updates preserve unrelated content, read back successfully, and a separate run resumes; installed production and runtime match verified source.

## Current Context

Installed baseline is the 2026-09-30 production receipt and exact source archive `work/production-source-hC5Emb`. Existing dirty changes belong to previous delivered work and are protected. Baseline source comparison and actual CLI logs live under ignored `work/codex-integration/`. The frozen baseline MCP bundle is isolated from registered MCP artifacts.

## Constraints

Saved Markdown is authoritative. No new write permissions, DB, daemon, Hook, authentication changes, automatic conversation capture or production Vault testing. Preserve old build_context contract, exclusions, symlink guards and revision checks. Final production Vault writeback belongs to parent only.

## Risks

Context budgets can silently hide seeds; Bases evaluation must terminate real runaway Workers and bind pagination to source/type/time; graph limits must preserve nearest nodes. Source tests do not prove actual Codex behavior or installed delivery.

## Approval Required

Implementation, six-scenario baseline/final CLI evaluation and production:update are explicitly approved by the user's pasted plan. Stop dependent production action if app is running or unrelated source changes cannot be isolated. Do not force-close the app.

## Work Packets

- Parent: frozen baseline/CLI harness, graph read, service/server/catalog integration, integration integrity tests, docs, production and final Vault sync.
- CONTEXT: new context-set module and focused tests; limited core context export/refactor if needed; no service/server edits.
- BASES: new MCP Bases module, Node Worker/client, settings property-type read, build worker and focused tests; no service/server/catalog edits.
- Independent acceptance/review after integration, bounded to new behavior.

## Integration Policy

Each file has one owner. Workers must preserve concurrent edits and return tested module contracts. Parent validates boundary evidence and integrates. Full source promotion must contain only baseline + this task's authorized delta.

## Verification

Focused tests + typecheck per stage; final npm test, check:mcp, current-decision/docs and workflow checks. Baseline then final actual Codex scenarios, record failure/retry evidence. Isolated packaged/installed smoke includes new tools and Worker, exact exe/asar hash, unchanged normal profile, MCP registration and restarted runtime/delivery. Record source/autotest/Codex/production/user acceptance separately.

## Reusable Artifacts

Common tool catalog/documentation, executable natural-language fixture evaluation and final result report. Bulky logs remain ignored.
