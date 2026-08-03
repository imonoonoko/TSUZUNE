# TSUZUNE Working Agreement

- TSUZUNE is explicitly personal, one-device, local Windows software.
- Prefer the simplest implementation that satisfies current, observed needs.
- Markdown files are the source of truth. Never require an app-owned database to read them.
- Keep v0.1 free of AI, MCP, cloud sync, accounts, plugins, collaboration, and speculative abstractions.
- MCP exposes the active Vault's Markdown notes, explicit note creation, revision-checked full-content updates, and history-preserving autonomous updates for ordinary knowledge or project notes. Raw sources and conversation logs remain immutable through the autonomous path.
- Do not expose delete, move, rename, directory creation, force overwrite, remote hosting, or OpenAI API calls unless the user explicitly asks.
- Preserve user data on failures. Never overwrite an existing note during rename, move, or trash collision handling.
- Run `npm run typecheck`, `npm test`, and `npm run check:mcp` before publishing MCP changes.

## Production TSUZUNE Dogfood

- Use the registered TSUZUNE MCP against the active production Vault at the start of project work: search for the project note, fetch it, and build only the relevant context before relying on chat recollection.
- At each verified milestone, write a concise source note and update the project note with the evidence path, current status, remaining boundary, and next step. Fetch first and use revision-checked updates.
- Keep the production Vault's `00_入口/TSUZUNE運用・開発資料`, `30_知識/TSUZUNE運用標準`, `30_知識/TSUZUNEシステム設計`, `30_知識/TSUZUNE開発ロードマップ`, `30_知識/TSUZUNE知識シナジー地図`, and dated development-material ledger synchronized whenever a milestone changes operations, architecture, evidence, priority, or a tested cross-domain insight. The repository remains implementation truth; these MOCs are dated navigation and operational synthesis. Update the affected atomic note first, then its MOC; do not expand a MOC into a duplicate specification or copy secrets into it.
- A verified milestone that changes shipped product code is not complete until `npm run production:update` installs and verifies that working tree on this PC. Research-only and documentation-only checkpoints do not require reinstalling an unchanged binary.
- The production update may promote a dirty working tree, but it must reject merge conflicts, whitespace errors, source changes during the gate, or a running production TSUZUNE. Never force-close the user's app.
- Production acceptance requires isolated packaged and installed smoke tests, exact built/installed executable and `app.asar` hashes, an unchanged `%APPDATA%\TSUZUNE` profile, and refreshed Codex MCP registration. The active Vault must not be opened by automated smoke tests.
- Treat fixture Vaults and isolated test profiles as test data, never as the production knowledge source. Installed-runtime acceptance must exercise the installed production TSUZUNE binary with isolated test data.
- Never write secrets, OAuth credentials, tokens, large raw artifacts, or unverified parity claims into the production Vault. Record `not compared` or `not matched` until the corresponding evidence exists.
