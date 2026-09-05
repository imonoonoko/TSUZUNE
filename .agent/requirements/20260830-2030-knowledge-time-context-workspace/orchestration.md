# Orchestration

## Source of truth

- Contract and sequence: `plan.md`
- Machine-readable status: `state.json`
- Delegation contracts: `packets/`
- Returned evidence: `results/`
- Final integrated evidence: `final-report.md`

## Ownership

| Track | Owner | Scope | Write boundary |
|---|---|---|---|
| integration | root | contract, architecture choice, shared-file integration, unseen-boundary verification, production and TSUZUNE | repository + production + TSUZUNE final write |
| context path scout | delegated explorer | Context Compiler, Temporal Memory, IPC/preload/shared types, relevant tests | read-only |
| renderer scout | delegated explorer | Activity Rail, workspace modes, App layout, note-open path, responsive CSS | read-only |
| UX/test scout | delegated explorer | public test seams, accessibility, state matrix, risk review | read-only |

## Coordination rules

- Delegates are not alone in the worktree and must not revert or rewrite other changes.
- Scouts do not edit files or write production TSUZUNE.
- Root owns all edits to shared renderer/IPC/type files unless a later non-overlapping worker packet explicitly reassigns them.
- Findings are evidence, not completion. Root verifies integration and at least one unseen boundary.
- Any need for note mutation, new storage, new dependency, broad runtime, or contract expansion is returned to root without implementation.

