# Security review packet

- purpose: Adversarially review the proposed browser-to-TSUZUNE capture boundary.
- ownership: Read-only threat modeling; write only `results/security-review.md`.
- forbidden: Code edits, secrets, production Vault writes, broad system scanning.
- source of truth: Proposed API, current bridge code, extension permissions.
- acceptance: Threats and required mitigations for origin confusion, CSRF, local malware limits, token storage, path traversal, overwrite, Markdown/HTML injection, prompt injection, oversized payloads, duplicate requests, and application shutdown.
- unseen boundary: A malicious webpage intentionally crafts title, selection, metadata, and URL.
- stop/escalation: Escalate any design that cannot confine writes to a fresh Inbox Markdown note.
