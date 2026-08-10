# Alternatives

## Templates

- Write starter Markdown files into every Vault: rejected because opening a Vault would mutate user data and add noisy context nodes.
- Keep the current empty dropdown: rejected because a clean Vault has no usable starting point.
- Add stable in-memory templates and let real Vault files override the same path: selected; it fixes the affordance without a startup write and preserves custom templates.

## Rename

- Keep `window.prompt`: rejected because the current Electron shell does not provide a reliable visible/accessible prompt path.
- Add a second rename backend: rejected; the existing validated `renameEntry` IPC is the correct data path.
- Use a small modal form around the existing operation and keep impact/collision checks: selected.

## Graph

- Rebuild the graph engine or clone all Obsidian controls: rejected as disproportionate.
- Add only visible zoom/fit controls that call the existing `changeZoom` and `fitGraph` functions: selected; it closes the most obvious discoverability gap while retaining current settings, filters, pan, and keyboard behavior.
