# Packet 06 — Independent verification and production

## Objective

Adversarially verify the integrated shell/settings slice, then install and verify the working tree on this PC without touching the active production Vault during automated checks.

## Ownership

- Independent reviewer: read-only code, test, screenshot, and result inspection.
- Parent: fixes, repository gates, production update, delivery evidence, and final TSUZUNE writeback.

## Constraints

- Never force-close TSUZUNE.
- Use isolated Vault and userData for automated UI checks.
- Preserve the dirty worktree and production profile.
- No Git publication.

## Acceptance

- Full repository and UI gates pass.
- Independent review returns PASS or a bounded blocker is repaired and rechecked.
- `npm run production:update` passes its full gate, with exact built/installed hashes and unchanged production profile.
- Final canonical notes are fetched immediately before revision-checked writeback and read back afterward.

