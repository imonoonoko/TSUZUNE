# Repository-integration scout packet

- purpose: Trace the exact existing runtime path for creating an Inbox note and any local bridge that can be safely reused.
- ownership: Read-only inspection of `src`, `tests`, scripts, package metadata, and current docs; write only `results/repo-integration.md`.
- forbidden: Source edits, production Vault writes, `knowledge.md`, invented APIs.
- source of truth: Current dirty working tree.
- acceptance: Exact files/functions for app startup, active Vault identity, note creation, collision handling, preload/IPC, loopback/MCP authentication, and relevant tests.
- unseen boundary: Verify whether bridge calls can arrive from arbitrary local web origins and whether app-not-running behavior is defined.
- stop/escalation: Stop if the relevant implementation is generated or outside the repository.
