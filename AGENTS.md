# TSUZUNE Working Agreement

- TSUZUNE is explicitly personal, one-device, local Windows software.
- Prefer the simplest implementation that satisfies current, observed needs.
- Markdown files are the source of truth. Never require an app-owned database to read them.
- **Historical v0.1 baseline:** Excluded AI, MCP, cloud sync, accounts, plugins, collaboration, and speculative abstractions.
- **Current MCP contract:** Exposes the active Vault's Markdown notes, explicit note creation, and revision-checked, history-free updates for ordinary knowledge or project notes. Legacy `50_履歴` data remains protected and inert; raw sources and conversation logs remain immutable through the autonomous path.
- Do not expose delete, move, rename, directory creation, force overwrite, remote hosting, or OpenAI API calls unless the user explicitly asks.
- Preserve user data on failures. Never overwrite an existing note during rename, move, or trash collision handling.
- Run `npm run typecheck`, `npm test`, and `npm run check:mcp` before publishing MCP changes.

## Production TSUZUNE Dogfood

- Classify project work before using the production Vault: use **No-TSUZUNE** for self-contained lightweight work, **read-only** for non-trivial work that depends on prior decisions or constraints, and **read-write** only when canonical state, decisions, verification, or restart conditions change for later reuse. For read-only/read-write work, search narrowly, fetch only the relevant project context, and use `build_context` only when linked or temporal context is required.
- For one user-approved work item, accumulate intermediate results and write back only at its final verified boundary. Create at most one concise source note, then update each affected existing project note, MOC, or ledger at most once with the evidence path, current status, remaining boundary, and next step. Fetch immediately before the final revision-checked update; if the rendered content is identical, do not write. Do not patch hubs or MOCs after every sub-step.
- Keep the production Vault's `00_入口/TSUZUNE運用・開発資料`, `30_知識/TSUZUNE運用標準`, `30_知識/TSUZUNEシステム設計`, `30_知識/TSUZUNE開発ロードマップ`, `30_知識/TSUZUNE知識シナジー地図`, and dated development-material ledger synchronized only when the final verified boundary changes their operations, architecture, evidence, priority, or a tested cross-domain insight. The repository remains implementation truth; these MOCs are dated navigation and operational synthesis. Update the affected atomic note first, then each affected MOC once; do not expand a MOC into a duplicate specification or copy secrets into it.
- A verified milestone that changes shipped product code is not complete until `npm run production:update` installs and verifies that working tree on this PC. Research-only and documentation-only checkpoints do not require reinstalling an unchanged binary.
- The production update may promote a dirty working tree, but it must reject merge conflicts, whitespace errors, source changes during the gate, or a running production TSUZUNE. Never force-close the user's app.
- If delivery is mismatched and the latest installed receipt came from a dirty source without an exact source snapshot or path/hash manifest, treat task-owned hunk isolation as functional verification only, not as a production base. Before production update, require either explicit approval to promote the current source tree as a whole or a reconstruction audit that identifies a verified production-equivalent boundary.
- Finalize every repository-owned plan, status, and workflow artifact that belongs to a production promotion before `npm run production:update` takes its source snapshot. After a successful gate, keep result evidence in the excluded production receipt and the final TSUZUNE execution record; if any fingerprinted repository path must change, rerun the gate before claiming delivery match.
- Production acceptance requires isolated packaged and installed smoke tests, exact built/installed executable and `app.asar` hashes, an unchanged `%APPDATA%\TSUZUNE` profile, and refreshed Codex MCP registration. The active Vault must not be opened by automated smoke tests.
- Treat fixture Vaults and isolated test profiles as test data, never as the production knowledge source. Installed-runtime acceptance must exercise the installed production TSUZUNE binary with isolated test data.
- Never write secrets, OAuth credentials, tokens, large raw artifacts, or unverified parity claims into the production Vault. Record `not compared` or `not matched` until the corresponding evidence exists.

## User-Facing Result Reports

- Optimize for clarity and forward movement, not minimum length. Be concise without making the conversation abrupt, mechanical, or closed prematurely.
- Use a short completion report only when the requested work is genuinely complete, no user decision is pending, and there is no useful in-scope continuation. State what finished, what changed for the user, and whether they need to act; do not enforce an arbitrary sentence limit.
- Do not apply the completion-report shape to discussion, feedback, planning, review, diagnosis, status questions, clarification, brainstorming, or a request to continue. In those cases, answer directly, explain enough reasoning and tradeoffs to be useful, and advance the conversation with the most relevant next step.
- Match the user's tone and preserve a natural collaborative voice. Avoid canned closure phrases and do not replace a substantive answer with a terse status line.
- Say `あなたが追加で行うことはありません。` only at a true terminal boundary when the user has no action and no useful continuation remains. Never use it merely because one subtask finished.
- Keep technical evidence out of the opening. Add file counts, commit hashes, test counts, tool or Skill names, internal workflow, and implementation details only when the user asks, when failure or risk makes them relevant, or when they materially affect what the user can trust or do next.
- Mention remaining work only when it is inside the requested scope or requires the user's action. Do not present unrelated Held items, future candidates, or intentionally excluded work as unfinished work.
- Distinguish source implementation, installed production, live runtime verification, Git delivery, and user confirmation when the distinction changes the practical conclusion. When needed, use the precise terms `未着手`, `作業中`, `実装済み`, `本番反映済み`, `動作確認済み`, `利用者確認済み`.
- If behavior or appearance did not change, say so plainly and explain the practical reason in proportion to the task.

## GitHub Delivery

- When the user explicitly authorizes integration or publication and the required checks pass, Codex completes the routine PR flow through ready-for-review, merge, and default-branch verification. Do not hand a manual merge step back to the user.
- Stop before merge only when checks or review are unresolved, the merge would expand the authorized scope, or it would also publish a release, rewrite history, or perform another separately gated action.
