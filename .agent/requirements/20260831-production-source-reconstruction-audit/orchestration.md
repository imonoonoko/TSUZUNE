# Orchestration

## Shared boundary

All packets are read-only. Agents are not alone in the repository and must not revert, edit, stage, commit, install, stop processes, mutate the production Vault, or inspect `50_履歴`. `knowledge.md` is protected. Report evidence with exact paths/commands and distinguish fact, inference, and unknown.

## Packet A — source provenance and receipt boundary

- Objective: classify the current dirty source into coherent work-item groups and determine what can and cannot be inferred about receipt-time installed source.
- Sources: Git HEAD/status/diff, workflow/result artifacts, receipt, production scripts, dist metadata if useful.
- Do: produce group inventory, receipt-inclusion confidence, verification evidence, risk, and a safe promotion prerequisite.
- Do not: reconstruct by modifying files or treat compiled output as exact source.
- Expected output: bounded provenance matrix and strongest falsifier.
- Verification: counts reconcile with current Git inventory; at least one aggregate-fingerprint limitation is demonstrated from code or receipt.

## Packet B — test suite delta

- Objective: explain 94 files / 912 tests versus 91 files / 868 tests and determine whether the current suite lost coverage beyond intentional history removal.
- Sources: test Git status/diff, current Vitest discovery/output, receipt-time execution record, package/config.
- Do: identify deleted/added/renamed test files, collect their historical test counts where possible, and reconcile the 44-test / 3-file delta.
- Do not: edit tests or source; do not rerun broad commands repeatedly.
- Expected output: exact or bounded reconciliation, coverage risk, and next check.
- Verification: current `npm test` is run once by either packet owner or parent; avoid duplicate full-suite runs.

## Packet C — original-philosophy guard

- Objective: challenge whether promoting the current source or adding workflow hardening preserves human-first knowledge circulation and cautious writes.
- Sources: canonical root-philosophy note, current audit plan, current source group findings when available.
- Do: define accept/reject criteria and stop conditions for the final decision.
- Do not: propose new product features, automation, or Vault changes.
- Expected output: concise adversarial review with an explicit no-op option.
- Verification: every rejection maps to an adopted principle or current evidence.

## Packet D — workflow retrospective

- Objective: audit this task's subagent packets, handoffs, corrections, and state artifacts for demonstrated process failures; propose the smallest durable self-update.
- Sources: both 20260831 workflow directories, packet results, AGENTS.md, relevant scripts/checks.
- Do: identify repeated ambiguity, duplicate work, evidence loss, or unsafe escalation; propose exact file/line-level edits and verification.
- Do not: write files, invent a management system, or encode one-off trivia as global policy.
- Expected output: P0–P2 findings and at most three concrete changes, with one recommended minimum.
- Verification: recommended rule must have prevented or shortened a real event in this task.

## Integration packet

Parent records Accepted / Rejected / Conflicts / Decisions / Final changes / Remaining risks in `final-report.md`, then updates `state.json`. Subagent messages are summarized into `results/` before closeout.

