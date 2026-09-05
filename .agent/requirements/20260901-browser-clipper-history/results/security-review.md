# Browser clipper security review

## Verdict

GO for a bounded local MVP only if the capture endpoint is a separate, write-only capability. NO-GO for exposing the existing Drive Sync bridge or for allowing a browser request to select a path, overwrite, move, rename, delete, or invoke generic MCP writes.

## Current evidence

- `src/main/mcp-drive-sync-bridge.ts` binds to `127.0.0.1` on an ephemeral port and uses a 32-byte random bearer token.
- Its JSON reader rejects bodies over 20,000 characters, but the server has no `Origin`/`Sec-Fetch-Site` check and its token is not suitable for embedding in a browser extension.
- Existing entry-move and sync operations are materially broader than clipping and must not share the clipper route.
- The current MCP service has a 100,000-character note limit; the clipper should use a substantially smaller independent limit.

## Threats and minimum controls

| Threat | Required control |
|---|---|
| Malicious page title, selection, metadata, URL | Treat all fields as data. Validate URL with `new URL`; allow only `http:`/`https:`; normalize length; never interpret frontmatter or body as instructions. Escape YAML delimiters/newlines and fence Markdown body. |
| Prompt injection in page text/YouTube transcript | Store a clearly labelled untrusted source excerpt; no AI execution during capture; add provenance (`source_url`, `captured_at`, `source_type`) and a visible “外部ソース・未検証” marker. |
| HTML/script injection | Never write raw HTML as executable UI content. Convert to bounded plain text/Markdown and strip scripts/styles/events. Renderer must render note text as text, not HTML. |
| Path traversal / arbitrary filesystem write | API accepts no path or filename from extension. Server chooses `01_受信箱` and sanitizes a server-generated basename; reject separators, dot segments, control chars, and reserved Windows names. |
| Overwrite / destructive action | Capture is create-only. Use the existing collision-safe note creation primitive; if a collision occurs, add a server-generated suffix. Never update an existing note, including same URL. |
| Web origins / CSRF / DNS rebinding | Bind only to `127.0.0.1`; require POST, exact route, `Content-Type: application/json`, and a per-run capability. Check `Origin` against a configured extension ID and reject absent/unexpected browser origins; additionally reject non-extension `Sec-Fetch-Site` where present. Do not rely on Origin alone. |
| Extension ID instability | The unpacked extension must use a fixed manifest `key` (or an app pairing procedure that displays/records the generated ID). The app must allow exactly one configured extension ID, not `*`. A Web Store ID and dev ID are different and need explicit configuration. |
| Token theft / token storage | Do not hard-code a token. Generate a high-entropy per-run token, expose it only through an explicit local pairing flow, store it in OS-protected app state or memory, rotate on restart, and redact it from logs/errors. If pairing is not implemented, do not ship HTTP capture. |
| Local malware | A loopback token is not a protection against malware running as the user. Document this boundary; keep the API write-only, Inbox-only, small-body, rate-limited, and free of read/list/evaluate operations. |
| Oversized payload / resource exhaustion | Enforce byte limit before JSON accumulation, field-specific limits, total text limit, timeout, and a small concurrency/rate limit. Reject compressed/encoded expansion and malformed UTF-8. |
| Duplicate/replay | Include a client-generated request ID and server-side short-lived idempotency cache, or return the created path and make retries safe. Since captures are snapshots, identical later captures may create a new note only when explicitly retried after the idempotency window. |
| App shutdown / stale endpoint | Close the server before app exit; atomically remove capability state only if it still belongs to this run. Extension must show a deterministic “TSUZUNE is not running / retry” error and never fall back to direct filesystem access. |
| YouTube-specific data | Treat video title/channel/description/transcript as untrusted and optional. Capture URL/video ID/time and selected text; do not depend on private endpoints or silently claim a complete transcript. |

## Transport comparison

- Existing authenticated loopback HTTP bridge: good primitive (ephemeral loopback + random bearer), but unsafe as-is because it is broad and has no browser-origin policy. Reuse only its hardening pattern in an isolated `/clip` server or route with a separate capability and callback.
- Native Messaging: strongest browser origin binding through `allowed_origins`, but adds registry/host installation and lifecycle complexity. Prefer for distribution or if pairing cannot be made explicit.
- Custom protocol or direct Downloads: easy to trigger but payload limits, spoofing, and inability to bind to the active Vault make them unsuitable as the write boundary.

## Go/no-go boundary

GO: extension sends bounded title/url/selected text/optional YouTube timestamp to a dedicated local capability; the app creates exactly one fresh Markdown file under `01_受信箱`, preserving provenance and never modifying legacy `50_履歴`.

NO-GO: extension can supply a path, arbitrary Markdown filename, bearer token embedded in the package, arbitrary localhost endpoint, HTML that is later rendered unsafely, or any update/move/delete operation. Do not claim security against same-user malware.

## History implication

The captured Markdown itself is a source snapshot and provenance record. Keep it immutable-by-capture and collision-safe; this satisfies reproducibility without restoring mutation-by-mutation history or reactivating `50_履歴`.
