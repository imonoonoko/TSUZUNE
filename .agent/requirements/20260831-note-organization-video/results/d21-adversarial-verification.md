# D21 adversarial verification result

## Verdict

`PASS` for source completion and D22 promotion. The independent reviewer returned `REVISE` twice; every adopted finding was corrected and rechecked before the final verdict.

## Reviewer and ownership

- Reviewer: `/root/derived_organizer_adversarial_review`, independent Sol/high read-only adversarial role.
- Ownership: source/proposal immutability, bypass and race conditions, canonical-category ambiguity, search contract, result grouping, scope creep, and residual-boundary reporting.
- Forbidden: repository edits, production-Vault writes, source mutation, or implementation expansion.
- Parent decision: adopted all correctness findings. The sole earlier global-rank objection was rejected as a product-contract mismatch because fixed group order is intentional; the contract and test now guarantee group-local rank instead.

## Findings closed

1. Nested `knowledge.md`, oversized sources, unsafe Wiki-link paths, and out-of-scope source roots are rejected.
2. The live canonical category note is authoritative and fails closed on a missing/duplicate line, empty segments, unsupported values, and case-fold duplicates.
3. Proposal and approval both revalidate source revision and category; stale proposals are removed without a destination write.
4. Source path plus revision is atomically unique in the pending store, including concurrent proposals with different destination names.
5. Search requires every space-separated positive clause, preserves Japanese segment candidates inside a clause, and returns facet metadata even for filter-only queries.
6. Category/topic exact-search representation is bounded by rejecting double quotes in those labels.
7. Fixed groups are exclusive and complete: knowledge, source, Inbox, other. Existing operations remain available and rank is preserved inside each group.
8. No source update, move, delete, Hook, schedule, bulk classification, database, dependency, or embedded AI runtime was introduced.

## Verification

- Focused final: 107 tests PASS across MCP service, search, renderer query, and FileTree.
- Full final: 97 test files PASS, one file skipped; 927 tests PASS, one test skipped.
- Typecheck: PASS.
- MCP protocol check: PASS.
- Diff whitespace check: PASS; only existing line-ending conversion warnings were reported.

## Residual boundaries

- Installed/live runtime and production receipt are D22 evidence, not D21 evidence.
- Deterministic tests do not prove an extreme source-edit/approval TOCTOU stress schedule.
- The app cannot prove that an external AI will always recognize prompt injection, weak evidence, or a multi-responsibility source. The contract requires no tool call in those cases, and human approval remains mandatory.
