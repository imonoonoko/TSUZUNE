# Packet 02 — minimal integration

- Objective: 既存query projection経路で4つのREDを解消する。
- Ownership: `src/core/context.ts`、`docs/mcp-integration.md`、`src/mcp/server.ts`。
- Forbidden: 新規dependency、DB、cache、daemon、Hook、別moduleへの責務移動、安全上限の緩和。
- Source of truth: repository codeとPacket 01のpublic tests。
- Acceptance: context suite 47/47、typecheck、公開説明と実装の一致。
- Unseen boundary: atomic one-term queryでrelated sourcesが予算から排除されないこと。
- Stop/escalation: queryless/temporal/MOC契約の変更が必要なら作業を止める。
