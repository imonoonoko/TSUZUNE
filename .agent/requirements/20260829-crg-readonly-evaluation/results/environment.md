# Environment and isolation evidence

- evaluation date: 2026-08-29 JST
- source checkout: current dirty TSUZUNE working tree; no branch, dependency, product, MCP, Codex-setting, Hook, daemon, embedding, production-app, or remote mutation
- disposable root: `%LOCALAPPDATA%\\Temp\\tsuzune-crg-eval-<random>` (outside the repository; exact random path intentionally omitted from durable evidence)
- snapshot scope: current `src/**`, `tests/**`, `scripts/**`, `package*.json`, `tsconfig*.json`, and matching build/test configuration files
- snapshot: 303 tracked files, 3,796,261 bytes, isolated commit `a96e18a873f4cef09bffbcf53952fee89b7d9950`
- parser input: CRG accepted 283 supported files; the remainder were unsupported/non-source files in the bounded snapshot
- Python: temporary `uv` environment using CPython 3.12.9
- package: `code-review-graph==2.3.8`, version verified through Python package metadata
- temporary install: 76 packages, 5,612 ms; no project package files changed
- graph storage: external temp `graph-data`; no embeddings or network provider configured
- executable used: temporary `code-review-graph.exe`; `crg-daemon.exe` was installed as a transitive entrypoint but never started

## Cold build

Command shape:

```text
code-review-graph build --repo <snapshot> --data-dir <temp-graph-data> --skip-flows
```

- exit: 0
- elapsed: 12,466 ms
- result: 283 files parsed
- post-build status: 3,697 nodes, 51,848 edges; languages `javascript`, `powershell`, `tsx`, `typescript`
- graph commit/HEAD: both `a96e18a873f4cef09bffbcf53952fee89b7d9950`
- flow/community detection was intentionally excluded; raw caller/test edges, signatures, and FTS remained available

## Integrity boundary

- disposable snapshot manifest after the trial: 303/303 hashes matched; snapshot Git status was clean
- source checkout compared with the frozen manifest after the trial: 301/303 hashes still matched
- the two source-side mismatches were `src/renderer/App.tsx` and `scripts/check-calendar-plugin-electron.mjs`, changed by concurrent work after snapshot creation; the three evaluated exact-symbol reference sets were rechecked and remained unchanged
- workflow documents under `.agent/requirements/20260829-crg-readonly-evaluation/` are the only repository writes owned by this evaluation

