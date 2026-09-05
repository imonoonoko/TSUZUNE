# D17 — Original philosophy guard

## Verdict

PASS after clarification.

The design preserves human-first capture, Markdown as source of truth, bounded structural exploration, and cautious writes. Automatic behavior is limited to a reversible one-note move with an unchanged filename and content; ambiguous meaning remains with the human.

## Clarifications applied

- A current-only lease is transient concurrency control, removed after release or stale recovery, and is not history.
- Slice A fixtures distinguish clear Raw with provenance from uncertain Raw with mixed claims or missing provenance.
- `organize_reason` uses a fixed v1 code set; transient system failures do not become semantic exception state.

## Rejected expansion

No Processed, Archive, History, run log, new database, all-Vault ingestion, semantic Lifecycle Hook, auto-merge, auto-delete, or graph/link-count objective.
