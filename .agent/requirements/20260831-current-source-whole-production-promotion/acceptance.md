# Acceptance boundary

This file is intentionally outcome-independent and is finalized before the production source snapshot.

Completion must be read from, in order:

1. `docs/reports/production-update-latest.json` — `installed-and-verified`, all declared checks passed, source fingerprint, exact built/installed hashes, unchanged production profile.
2. Fresh `runtime_info` and `delivery_info` — installed MCP process is not stale and the repository matches the latest receipt.
3. The dated TSUZUNE execution record — human-readable decision, agent adoption/rejection, residual boundary, and evidence links.

Do not edit this packet merely to copy hashes or PASS counts after the gate. If a fingerprinted repository file must change, rerun `npm run production:update` and accept only the newer receipt.
