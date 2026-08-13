# X1-T1 Structured-only Transport — local verification 2026-08-12

## Scope

`build_context`だけをlegacy text blockと`structuredContent`の二重搬送から、`content: []`と既存`structuredContent`だけの形状へ変更した。search、fetch、get_backlinks、create_note、update_note、autonomous_update_noteはlegacy形状のままである。

## Protocol adjustment

Context Markdownの`Generated:`は生成時刻であり、同じ意味内容でも各呼出しで変わる。X1-T1 protocolはこの一行だけを`Generated: <volatile>`へ正規化したcanonical metricsを比較し、正規化前Markdownの文字数・byte数は別にrecordするよう改訂した。他の本文、候補、warning、temporal値は正規化していない。

## Local stdio evidence

Same fixture source digest: `237d6ec0d5b4340c37b62e3cd86b821fb79db0c1d00b1003c5e4f578893a57b3`
Canonical Context Markdown SHA-256: `87b8d063eaadb2382fcfc3233cbdeb56f88d3a4307142b6424ba50ac30db2736`

| Metric | Legacy | Candidate | Gate |
|---|---:|---:|---|
| Context Markdown characters | 593 | 593 | unchanged |
| Context Markdown UTF-8 bytes | 687 | 687 | recorded only |
| `JSON.stringify(S)` UTF-8 bytes | 1,177 | 1,177 | unchanged |
| JSON-RPC wire UTF-8 bytes | 2,761 | 1,252 | 54.7% smaller; PASS |
| `client.callTool` p95 after 10 warmup + 30 calls | 5.282ms | 3.471ms | no >10% regression; PASS |

Both runs used the same fixture, `as_of: 2026-08-11`, query, budget, and schema. Each run verified canonical `S` on all 30 calls and verified that its fixture and operational sidecar digest did not change during measurement. Production project-note revision was `sha256:f1c9c7fc5090538df6a7c2db8adb3329f4db129d8cac70f1464dbfa80d85d04a` before and after local measurement.

## Verification

- `npm run typecheck` — PASS
- `npx vitest run tests/mcp-service.test.ts` — 18 PASS
- `NODE_OPTIONS=--max-old-space-size=6144 npm test` — 57 files / 513 PASS
- `npm run build:mcp && node scripts/check-mcp.mjs` — PASS
- `git diff --check` — PASS

## Codex Desktop fresh-task fixture check

The original 247-file Vault snapshot was unavailable. A 25-note read-only fixture was reconstructed from the saved 2026-08-09 Context capture plus the resolved TSUZUNE Git-checkpoint source. Its stable digest after initial sidecar creation was `8ca7b80b8569b2c002edce1ccd25452c56b6744d99d9fdb217fc6ff034156a6e`.

A fresh Codex Desktop task used only the fixture MCP read tools. The fixed four questions across the three seed paths returned candidate `content: []` in 12/12 checked bundles; answer quality was 4/4, source trace 3/3, future-state leakage 0, and fixture writes 0. A second fresh task (`019ff182-1473-7141-a747-895378941587`) reproduced the four-answer and source-trace result with the fixture server only. Host model identity and per-call token usage were not exposed by the task API.

## Acceptance scope

The acceptance host is Codex Desktop, which exposes the local stdio MCP registered in `~/.codex/config.toml`. The fixture is reconstructed rather than the original 247-file snapshot, so this is a bounded fixture result, not a replay of that original snapshot.

ChatGPT does not connect directly to local MCP servers; its remote-MCP route requires a separate Secure MCP Tunnel integration. It is outside this local transport scope, not a failed quality gate. Host model-visible input tokens remain not observable and are not inferred from wire bytes. The X1-T1 transport gates in the revised protocol are satisfied; production update still requires the normal repository gates.
