# Packet 02: isolated build and queries

- **Objective:** Build and query CRG 2.3.8 in a disposable tracked snapshot containing current source, including originally untracked files.
- **Ownership:** parent only; disposable temp snapshot, Python venv, graph data, and concise repository result artifacts.
- **Acceptance:** pinned version verified; no `install`; cold build exit/time; three exact baseline outputs; three CRG output groups; one incremental source edit with refresh time and observable graph change; snapshot and graph paths outside the repository; no source-checkout change outside this workflow artifact.
- **Unseen boundary:** verify CRG's tracked-file behavior, TS/TSX parse coverage, hidden absolute-path/code export, and stale result after edit/refresh.
- **Forbidden:** MCP registration, Codex config, Hooks, daemon, embeddings/cloud API, apply-refactor/wiki/memory features, production app interaction, or repository dependency changes.
- **Stop/escalate:** CRG requires a forbidden feature or source/config mutation to produce the evidence.

