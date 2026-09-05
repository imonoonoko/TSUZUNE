# P0-5 Checkbox Core Acceptance

- Role / model / reasoning: verification; gpt-5.6-luna / low. Good fit: exact public API fixtures. Escalate ambiguous YAML semantics or changes outside this contract. Freshness: current working files, record tested hash. Parent owns final verification and integration.
- Objective: Independently test checkbox lossless core operations through inspectFrontmatterProperty, setFrontmatterProperty and deleteFrontmatterProperty.
- Ownership: Create tests/frontmatter-checkbox.test.ts only. Read src/core/frontmatter.ts and existing property tests. Other agents are active; do not revert their edits.
- Accepted: top-level true/false, True/False/TRUE/FALSE; value is boolean; no-op retains bytes; mutation writes lowercase. Preserve comments/BOM/EOL/non-target source and deletion comments. Quoted values remain text.
- Forbidden: product-code changes, existing-test changes, Vault writes, Git, runtime launch, production promotion, global types, boolean list support or null/text conversion.
- Acceptance: npx vitest run tests/frontmatter-checkbox.test.ts --maxWorkers=1; report source hash, command result and any defects rather than changing implementation.
- Unseen boundary: choose an additional source-preservation boundary not named in parent UI tests and state it in the result.
- Stop: If a failure requires product changes, return exact fixture and expected/actual to parent. Parent decides and reruns after the fix.
