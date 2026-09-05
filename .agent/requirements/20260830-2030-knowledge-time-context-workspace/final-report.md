# Knowledge Time Context Workspace evidence packet

## Outcome

- Approved direction: B, dedicated central workspace.
- Source implementation: complete.
- Production installation: complete.
- Installed smoke acceptance: complete.
- Production TSUZUNE writeback: complete and read back.

## User-visible result

- Activity Rail clock and command palette open a read-only `知識の時間` workspace.
- Seed, purpose, as-of, temporal perspective, and history scope drive the existing Context Compiler / Temporal Memory path.
- Timeline, warnings, evidence, selection reasons, excerpts, modified time, omitted notes, and source-open are visible.
- The right context panel remains present. Escape and same-note source-open restore Activity Rail focus.

## Verification

- Focused context/IPC: 58 PASS.
- Full suite: 922 PASS / 1 SKIP; 96 files PASS / 1 SKIP.
- `npm run typecheck`, `npm run build`, `npm run check:mcp`: PASS.
- Code, security, and UX final reviews: no remaining P0-P2 findings.
- Isolated 1440 / 1024 / 720 visual acceptance: no horizontal overflow; right panel preserved; last evidence reachable at 720.
- `npm run production:update`: 10/10 PASS.
- Installer SHA-256: `e8f5178e175670d3ee0b0c1574af752054aec72a6dba5dc96cd841cd0078e833`.
- Built/installed executable SHA-256: `dcde25fafced680c26162260908d0f8f1b2119d34e46c864f8c0eaf781d3199b`.
- Built/installed app.asar SHA-256: `5e3c612d9cea4f3f00a0de90001a5176aed9aa8bc96293c01e525fa9b58c687e`.
- Production profile: 61 files and digest unchanged.
- Receipt: `docs/reports/production-update-latest.json`, verified at `2026-08-30T12:09:32.592Z`.

## Safety boundary

- Read-only scan uses `persistCreationTimes:false`.
- No note mutation, new database, vector database, background Hook, whole-Vault ingestion, embedded AI/chat, or generic plugin runtime.
- Relative Markdown path, dates, purpose length, and temporal perspective are validated at trusted IPC.
- Future/omitted bodies do not cross IPC; source-marker spoofing and ambiguity fail closed.

## Final persistence

- Fresh Codex MCP process started after the verified build and reports `stale_runtime:false`.
- Atomic evidence note: `30_知識/TSUZUNE-知識の時間Context Workspace実装・本番受入-2026-08-30.md`.
- Project Dashboard, roadmap, system-design MOC, and operation/development entry were each fetched immediately before one revision-guarded patch.
- Read-back found one atomic link in each of the four entry notes, with four non-history backlinks total.
- `delivery_info:mismatch` is caused by post-install workflow closeout documents. Shipped product code is unchanged, so another installation is not required.
- Direct use in the user's production Vault remains user-confirmation evidence, not an implementation or installed-acceptance blocker.
