# TSUZUNE Working Agreement

- TSUZUNE is explicitly personal, one-device, local Windows software.
- Prefer the simplest implementation that satisfies current, observed needs.
- Markdown files are the source of truth. Never require an app-owned database to read them.
- Keep v0.1 free of AI, MCP, cloud sync, accounts, plugins, collaboration, and speculative abstractions.
- v0.2 MCP exposes the active Vault's Markdown notes and allows only explicit note creation and revision-checked full-content updates.
- Do not expose delete, move, rename, directory creation, force overwrite, remote hosting, or OpenAI API calls unless the user explicitly asks.
- Preserve user data on failures. Never overwrite an existing note during rename, move, or trash collision handling.
- Run `npm run typecheck`, `npm test`, and `npm run check:mcp` before publishing MCP changes.
