# Repository closeout read-only inventory — 2026-08-23

## Scope and stop boundary

This packet classifies the current TSUZUNE worktree for a future closeout decision. It does not delete, move, stage, commit, push, reinstall, or alter existing product files.

## Current evidence

- Branch: `main`
- HEAD: `5a9443d93840bb970ae34ea76a618bef1f1fce6c`
- Status: 64 modified entries, 137 untracked files, 0 staged files, 0 conflicts
- Content diff: 63 tracked files, 7,470 insertions, 2,311 deletions
- The extra modified status entry is `fixtures/obsidian-graph-parity-vault/.tsuzune/graph-file-times.json`; it has no content diff.
- Latest production receipt: `docs/reports/production-update-latest.json`
  - verified: 2026-08-21
  - result: installed and verified, 10/10 checks passed
  - receipt source fingerprint: 1,065 files, `5f5a2d56...`
- Current source fingerprint: 1,077 files, `0307b48441b8336a40520fcbf3602295fb578b9f08ba63f6c0e59836ea360de1`
- Live delivery status: mismatch

The receipt accepted a dirty working snapshot. Therefore, the current dirty state is not proof that all 201 status entries are uninstalled or unverified. The current fingerprint differs by 12 files from the accepted snapshot, but the receipt has no per-file manifest; exact file-by-file reconstruction of that snapshot is not possible from the receipt alone.

File modification times suggest that product runtime files under `src/` predate the receipt, while several planning, research, and evidence files postdate it. This is useful triage evidence, not cryptographic proof.

## Classification

| Class | Contents | Decision now | Reason |
|---|---|---|---|
| Preserve as integrated product work | Drive deletion and move, Path Alias, classification migration, search, templates, Vault behavior, UI, MCP delivery and stale-runtime guard, their tests and scripts | Keep; do not delete or quarantine | Source, callers, tests, scripts, and reports form coherent feature contracts; the installed receipt accepted an integrated dirty snapshot |
| Post-receipt research and documentation | Compact envelope fixtures and reports, Current-State Compiler R0/R1 reports, differential-recording and build-context transport designs, Daily Workspace Phase B evidence, improvement ledger, recent plan/status/index updates | Keep; review as a separate research/documentation lane | These appear newer than the receipt and should not be silently represented as part of its accepted product snapshot |
| Durable requirements and evidence | `.agent/requirements`, `docs/reports`, `docs/migrations`, report assets | Keep; include only with the feature or research contract they evidence | They are compact, referenced, and useful for auditability; they are not disposable build output |
| Local review artifact | `.impeccable/critique` | Hold for owner decision | No references were found; it may be useful locally but is not clearly project truth |
| Sensitive generated artifact | `undefined/Local State` | Git-excluded; retained locally | Chromium-style local state contains encrypted-key metadata and must never enter a commit; its value was not exposed |
| Needs targeted review | `tests/mcp-link-ops.test.ts`, `graph-file-times.json`, current receipt, `AGENTS.md`, `PLAN.md`, `PROJECT_STATUS.md` | Do not auto-resolve | One has a substantial deletion, one is stat-only, and the remainder are governance or evidence files requiring intentional authorship |

## Critical and realistic closeout decision

### Do next

1. Completed: added the narrow `/undefined/Local State` rule to `.gitignore`; the generated artifact remains local and recoverable.
2. Review the small set of post-receipt files as a research/documentation lane and decide whether each is current source of truth, evidence, or local scratch material.
3. Treat the pre-receipt intertwined product work as one exceptional **production-accepted integrated baseline**, unless a clean feature-contract split can be demonstrated without manufacturing history or breaking intermediate states.
4. Before any baseline commit, run the required full checks and refresh production acceptance if the exact source being committed differs from the installed receipt.

### Do not do

- Do not delete untracked source, tests, scripts, requirements, or reports merely because they are untracked.
- Do not create dozens of retrospective micro-commits based only on file type or directory; the changes are interdependent and that would invent a misleading history.
- Do not call every dirty file “unverified”; the receipt proves an integrated dirty snapshot was installed and verified.
- Do not claim the receipt proves current parity; the current fingerprint mismatches and the receipt lacks a file manifest.
- Do not stage, commit, push, or run `production:update` until the sensitive artifact and post-receipt boundary are decided.
- Do not start a new runtime, cache, daemon, Hook, or feature as part of repository cleanup.

## Proposed authorization gates

| Gate | Owner choice | Result if approved |
|---|---|---|
| P0 generated-state protection | Complete: ignore only `/undefined/Local State`; retain the local file | Prevents accidental inclusion of encrypted-key metadata without hiding sibling paths |
| P1 evidence boundary | Confirm post-receipt research/docs as keep, archive, or discard | Defines what belongs outside the accepted product baseline |
| P2 baseline closeout | Approve an integrated-baseline commit plan and verification | Converts the accepted but dirty product snapshot into durable Git history |

## Residual uncertainty

- There is no receipt-side file manifest, so exact accepted-versus-current file membership cannot be recovered with certainty.
- Modification time is only a triage signal.
- No test suite was rerun for this read-only inventory.
- No commit-worthiness decision has been made for the held files.

## Verification of this inventory

- Two independent read-only audits classified tracked and untracked changes.
- No existing repository file was intentionally changed by this inventory.
- No destructive or Git-history-changing action was taken.
- P0 follow-up: `git check-ignore` matched only `undefined/Local State`; `undefined/Other` and `other/Local State` remained unignored.
