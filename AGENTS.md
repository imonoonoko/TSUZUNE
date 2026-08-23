# TSUZUNE Working Agreement

- TSUZUNE is explicitly personal, one-device, local Windows software.
- Prefer the simplest implementation that satisfies current, observed needs.
- Markdown files are the source of truth. Never require an app-owned database to read them.
- **Historical v0.1 baseline:** Excluded AI, MCP, cloud sync, accounts, plugins, collaboration, and speculative abstractions.
- **Current MCP contract:** Exposes the active Vault's Markdown notes, explicit note creation, revision-checked full-content updates, and history-preserving autonomous updates for ordinary knowledge or project notes. Raw sources and conversation logs remain immutable through the autonomous path.
- Do not expose delete, move, rename, directory creation, force overwrite, remote hosting, or OpenAI API calls unless the user explicitly asks.
- Preserve user data on failures. Never overwrite an existing note during rename, move, or trash collision handling.
- Run `npm run typecheck`, `npm test`, and `npm run check:mcp` before publishing MCP changes.

## Production TSUZUNE Dogfood

- Use the registered TSUZUNE MCP against the active production Vault at the start of project work: search for the project note, fetch it, and build only the relevant context before relying on chat recollection.
- For one user-approved work item, accumulate intermediate results and write back only at its final verified boundary. Create at most one concise source note, then update each affected existing project note, MOC, or ledger at most once with the evidence path, current status, remaining boundary, and next step. Fetch immediately before the final revision-checked update; if the rendered content is identical, do not write. Do not patch hubs or MOCs after every sub-step.
- Keep the production Vault's `00_入口/TSUZUNE運用・開発資料`, `30_知識/TSUZUNE運用標準`, `30_知識/TSUZUNEシステム設計`, `30_知識/TSUZUNE開発ロードマップ`, `30_知識/TSUZUNE知識シナジー地図`, and dated development-material ledger synchronized only when the final verified boundary changes their operations, architecture, evidence, priority, or a tested cross-domain insight. The repository remains implementation truth; these MOCs are dated navigation and operational synthesis. Update the affected atomic note first, then each affected MOC once; do not expand a MOC into a duplicate specification or copy secrets into it.
- A verified milestone that changes shipped product code is not complete until `npm run production:update` installs and verifies that working tree on this PC. Research-only and documentation-only checkpoints do not require reinstalling an unchanged binary.
- The production update may promote a dirty working tree, but it must reject merge conflicts, whitespace errors, source changes during the gate, or a running production TSUZUNE. Never force-close the user's app.
- Production acceptance requires isolated packaged and installed smoke tests, exact built/installed executable and `app.asar` hashes, an unchanged `%APPDATA%\TSUZUNE` profile, and refreshed Codex MCP registration. The active Vault must not be opened by automated smoke tests.
- Treat fixture Vaults and isolated test profiles as test data, never as the production knowledge source. Installed-runtime acceptance must exercise the installed production TSUZUNE binary with isolated test data.
- Never write secrets, OAuth credentials, tokens, large raw artifacts, or unverified parity claims into the production Vault. Record `not compared` or `not matched` until the corresponding evidence exists.

## User-Facing Result Reports

- Lead the final response with one plain-language paragraph that answers: what changed, what it means for the user, and how far it is actually complete. Do not lead with file names, test counts, hashes, tools, Skills, or implementation terminology.
- Report in this order: `結局どうなった` -> `変更前 -> 変更後` -> `利用者への効果` -> `現在地` -> `残っていること／停止線` -> `技術証拠`. Omit sections that add no useful information, but never omit the outcome or current state.
- If behavior or appearance did not change, say so explicitly. Explain the practical reason for an internal refactor, such as making later changes safer or limiting the area affected by failures.
- Use status terms precisely: `未着手`, `作業中`, `実装済み`, `本番反映済み`, `動作確認済み`, `利用者確認済み`. Tests or automated smoke checks may prove `動作確認済み`; only direct user confirmation may prove `利用者確認済み`.
- Distinguish source implementation, installed production, live runtime verification, and Git delivery. Never let `tests passed`, `production installed`, `committed`, `pushed`, or `merged` imply one another.
- Put detailed verification last and keep it compact. Translate unavoidable technical terms into their practical meaning instead of presenting raw evidence as the result.
- When reporting project status, separate current verified facts, historical evidence, items requiring recheck, and the reason the current state was adopted.

## GitHub Delivery

- When the user explicitly authorizes integration or publication and the required checks pass, Codex completes the routine PR flow through ready-for-review, merge, and default-branch verification. Do not hand a manual merge step back to the user.
- Stop before merge only when checks or review are unresolved, the merge would expand the authorized scope, or it would also publish a release, rewrite history, or perform another separately gated action.
