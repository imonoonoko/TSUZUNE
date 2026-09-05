# Orchestration packet

## Shared source of truth

- Task Contract: `task-contract.md`
- Prior reconstruction audit: `../20260831-production-source-reconstruction-audit/final-report.md`
- Product constraints: repository `AGENTS.md`
- Acceptance implementation: `scripts/update-production.mjs`
- Machine receipt: `docs/reports/production-update-latest.json`

## Tracks

### D12 — production boundary and preflight

- Owner: Hypatia (`d8_delivery_boundary`)
- Purpose: independently verify that the official gate consumes the complete current source and that its stop conditions are satisfied.
- Ownership: read-only Git/process/gate-script evidence.
- Forbidden: edits, Git mutation, installation, process termination, Vault writes.
- Acceptance: report exact blockers or a bounded GO, including one unseen boundary check.

### D13 — original philosophy and data-safety guard

- Owner: Bernoulli (`d7_origin_guard`)
- Purpose: adversarially check the promotion against human-first capture, Markdown source-of-truth, history-free ordinary updates, and protected-data boundaries.
- Ownership: read-only contracts, relevant source/tests, and receipt/gate safety.
- Forbidden: edits, product expansion, Vault writes, inspecting legacy history contents.
- Acceptance: identify any release-blocking contradiction and distinguish it from held product ideas.

### D14 — self-update pressure test

- Owner: Curie (`d11_isolation`)
- Purpose: review whether the pre-gate-finalization rule is supported by observed friction and is the smallest durable workflow correction.
- Ownership: read-only workflow and fingerprint code.
- Forbidden: edits, new framework/runtime, product code, Vault writes.
- Acceptance: adopt/reject the rule with evidence and a simpler alternative if one exists.

### D15 — installed/live independent verification

- Owner: Pascal (`d9_capture_friction`)
- Purpose: define and, after the gate, independently execute bounded installed/live probes for Inbox capture and MCP delivery.
- Ownership: read-only installed bundle/runtime/receipt evidence after parent authorization.
- Forbidden: active production Vault automation, process termination, product/Vault/Git writes.
- Acceptance: installed marker, receipt consistency, and fresh runtime/delivery result; state what is not proven.

## Integration rule

The parent owns all repository edits, official gate execution, final unseen-boundary verification, TSUZUNE writes, and user reporting. Agent conclusions are evidence, never completion by themselves.
