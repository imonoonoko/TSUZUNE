# Current source whole-tree production promotion — Task Contract

Date: 2026-08-31 JST

## Objective

Promote the complete current dirty TSUZUNE source tree, as explicitly approved by the user, through the official Windows production gate without reconstructing a smaller source base.

## Deliverables

- One stable tracked-and-untracked source snapshot accepted by `npm run production:update`.
- A fresh `docs/reports/production-update-latest.json` proving packaged and installed identity, production-profile invariance, and MCP registration.
- Installed evidence for the Inbox capture command and live MCP runtime/delivery evidence.
- One final TSUZUNE execution record linked from the TSUZUNE project note.
- One minimal workflow improvement: repository evidence is finalized before the gate so post-gate reporting does not invalidate its own source fingerprint.

## Constraints

- `knowledge.md` is Freebuff's `AGENTS.md` and must remain unchanged.
- Preserve every current tracked and untracked source file. Do not stash, reset, checkout, stage, commit, branch, worktree, push, or publish.
- Do not infer a smaller production base from task-owned hunks.
- Do not force-close TSUZUNE. Stop if the production GUI is running.
- Do not open the active production Vault in automated smoke tests.
- Keep legacy `50_履歴` protected and inert. Do not inspect, create, update, move, or reintroduce it.
- Do not add a new database, daemon, Hook, queue, dependency, or product abstraction.
- Repository files for this work item are finalized before the gate. Post-gate evidence belongs to the receipt, TSUZUNE record, and user report.

## Success

1. The official gate passes all declared checks on one unchanged source snapshot; built and installed executable/`app.asar` hashes match and the production profile is unchanged.
2. The installed package contains the Inbox capture implementation, and a fresh live MCP reports the expected version with `stale_runtime: false` and `delivery_info: match`.
3. The production receipt and one read-back TSUZUNE execution record provide enough evidence to resume or audit the work without changing the repository after the gate.

## Lane and evidence owners

- Lane: Orchestrated.
- Live task state owner: Codex task plan.
- Installed-source identity owner: `docs/reports/production-update-latest.json`.
- Durable operational evidence owner: final TSUZUNE execution record.
- Static orchestration packet: `orchestration.md`.

## Stop conditions

Stop without force or workaround if TSUZUNE is running, the source changes during the gate, Git has unmerged paths or whitespace errors, a required check fails, installed hashes differ, the production profile changes, or fresh runtime verification requires killing a user process.
