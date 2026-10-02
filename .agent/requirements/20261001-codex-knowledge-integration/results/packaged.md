# Packaged / installed knowledge smoke integration

Owned change: `scripts/check-packaged-startup.mjs` only. Existing GUI executable launch, isolated user/session profile readiness checks, process-closure requirement and cleanup remain in place. No other agent's changes reverted.

After GUI readiness, the script now reads the selected executable's adjacent `resources/app.asar`, extracts exactly `out/mcp/server.js` and `out/mcp/base-worker.js` into its existing temporary smoke directory, and creates a local `{"type":"module"}` package marker so both extracted `.js` files retain their ESM identity. It records each extracted entry's SHA-256.

It invokes the parent's `scripts/check-mcp-knowledge-flow.mjs` under ordinary Node with `TSUZUNE_MCP_SERVER_PATH` pointing at the extracted server; the sibling Worker resolves from that same extraction. The shared flow owns fixture Vault/settings creation, four new tool-registration assertions and real `query_base` Worker execution. No rebuild or registered bundle replacement occurs. Execution is bounded to 60 seconds; on Windows timeout, only the owned helper process tree is terminated. Output distinguishes `guiExecutable.rendererReady` from `embeddedMcp.status`, archive path, extracted hashes and the fact that embedded artifacts ran under Node with isolated fixtures.

The existing production-update path calls this smoke once for packaged output and once for the installed executable, so both calls automatically gain this check.

Verified without launching either executable:

- `node --check scripts/check-packaged-startup.mjs`: PASS.
- `git diff --check -- scripts/check-packaged-startup.mjs`: PASS.
- Existing installed `@electron/asar` named `extractFile` import resolves as a function; no dependency added.
- Callers in `scripts/update-production.mjs:279,288` use the same script for packaged and installed acceptance.

Pending integration dependency: the parent-owned `check-mcp-knowledge-flow.mjs` did not yet exist when this packet was checked. The script intentionally fails if the shared flow is missing or unsuccessful. Actual extraction/query/GUI smoke is held until the parent runs the approved production promotion; this source-only packet is not packaged, installed or live-runtime evidence.

Requested model/reasoning: sol/medium per dispatch. Actual execution model/reasoning is not observable through this agent's tools.
