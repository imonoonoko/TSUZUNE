# O2-P3 Anonymous Apply/Rollback Prototype Scope

## MVP

- Operate only on a test-owned anonymous temporary Vault created during the same test run.
- Accept the existing schema-v1 classification plan only after the O2-P2 preview analysis passes.
- Capture complete preimages outside the fixture Vault before the first mutation.
- Rewrite resolved path-qualified Wiki links in active writable notes while preserving fragments and display aliases.
- Never rewrite `40_情報源` or `50_履歴` notes.
- Move the planned Markdown files without changing their bytes.
- Merge the planned old-path to new-path mappings into `.tsuzune/path-aliases.json` using the existing validation contract.
- Verify the applied Wiki, Graph, Context, MCP-ID projection, and immutable-note bytes.
- Roll back all changed files, paths, sidecar state, and newly created empty directories.
- Prove the same restoration after an injected failure at every mutation stage.

## Nice To Have

- A compact machine-readable test result that names the failpoint and before/after fingerprint.

## Future

- Decide whether Drive synchronizes the alias sidecar or replaces local aliases with remote rename semantics.
- Convert the proven prototype into a separately authorized production workflow.
- Add a human review UI only if real production apply is later authorized.

## Out Of Scope

- Production Vault or installed-app changes.
- Google Drive calls, remote rename, or sync-ledger changes.
- MCP write tools, delete/move/rename exposure, or new app UI.
- Rewriting source or history notes.
- General transaction framework, database, queue, plugin, background service, or new dependency.
- Claiming `applyAllowed=true` while `DRIVE_PATH_ALIAS_UNSUPPORTED` remains.

## Constraints

- Deadline: one bounded CP1 observation task.
- Team/resources: single local Codex task.
- Technology: existing Node filesystem APIs, Vitest, and TSUZUNE core modules.
- Budget/cost: no new dependency or persistent service.
- Compatibility/compliance: Windows path behavior, case-insensitive collision checks, symlink rejection, Markdown source-of-truth, immutable source/history boundaries.
