# Orchestration

`state.json` is the sole workflow-state owner. This document records ownership and dependency boundaries, not live progress.

| Track | Owner | Scope | Forbidden | Depends on | Result |
|---|---|---|---|---|---|
| History boundary | history-model reviewer | Decide provenance and snapshot retention versus generic mutation history | Production Vault writes; code edits | Canonical notes | `results/history-boundary.md` |
| Repository integration | integration scout | Trace current create-note, Vault identity, loopback/MCP bridge, tests | Code edits; `knowledge.md` | Current source | `results/repo-integration.md` |
| Extension architecture | architecture reviewer | Compare MV3 transport and capture APIs using official evidence | Code edits; external publication | Repo integration and Chrome docs | `results/extension-architecture.md` |
| Security | adversarial reviewer | Threat-model origins, authentication, untrusted content, path and size boundaries | Code edits; secrets | Proposed transport | `results/security-review.md` |
| Extension implementation | extension worker | MV3 files and self-check | App source; package; docs | Architecture and fixed endpoint contract | `results/implementation.md` |
| App integration | integration worker | Electron startup, encrypted token store, tray, packaging | Clip service; extension; unrelated source | Transport contract | `results/implementation.md` |
| Adversarial implementation review | adversarial reviewer | Concurrent idempotency, pairing, extraction and permission audit | Code edits | Implemented source | `results/adversarial-review.md` |
| Implementation and integration | root | TDD, source edits, unseen-boundary tests, docs, production gate | Unrelated cleanup; user-change rollback | All review packets | final evidence packet |

## Integration gates

1. Transport is not implemented until current bridge ownership and authentication are traced.
2. Public behavior tests fail before implementation.
3. A worker conclusion is advisory until root verifies it against unseen boundaries.
4. Production TSUZUNE is written once, only after the verified final boundary changes canonical decisions or evidence.
