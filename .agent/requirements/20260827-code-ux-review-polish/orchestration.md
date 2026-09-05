# Orchestration

## Parallel review packets

- Packet 01 owns read-only correctness review of the current shell, Settings, primary navigation handlers, state transitions, and related tests.
- Packet 02 owns read-only interaction and visual UX audit of the current captures and implementation, including discoverability, hierarchy, feedback, and friction.
- Packet 03 owns read-only keyboard, focus, semantics, responsive, and regression-test-gap review.

Each packet must report exact evidence, P0–P3 priority, smallest credible fix, and a stop/escalation condition. Reviewers do not edit files, write production TSUZUNE, add dependencies, revert other work, or broaden scope into plugin/account/cloud parity.

## Integration policy

- The parent agent owns prioritization, all product-code edits, tests, unseen-boundary verification, production update, and production TSUZUNE writes.
- Existing handlers, components, native platform behavior, and current dependencies are reused before new implementation is considered.
- Verified correctness, accessibility, data preservation, and explicit user requirements are never simplified away.
- P3 decoration and speculative parity are reported but not automatically implemented.
- A finding that requires schema, IPC, authentication, or product-direction changes is Held for an explicit decision.

## Verification

The parent runs a red/green focused check for each accepted behavior, the repository gates, isolated Electron pointer/keyboard captures at 1440/900/720 CSS px with unchanged Markdown digest, an independent read-only verification packet, production update, installed smoke/hash/profile checks, post-restart MCP delivery checks, and one final-boundary TSUZUNE writeback.
