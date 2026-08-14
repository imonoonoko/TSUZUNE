# CP1-B-01 reference completion: Excluded files

Date: 2026-08-12
Result: **blocked — no replacement for CP1-B-01's failed monitoring result.**

This was a correlated reference-completion attempt, not CP1-B sample 2/3. It retained CP1-B-01's partial fixed evidence and attempted only the missing add flow, populated row, remove flow, and persistence after a real process restart.

## Verification and boundary

- The local installer and `obsidian.asar` matched the fixed hashes recorded in the parent report. Extracting the archive's `package.json` reported `1.13.4`; the isolated window title reported `1.13.6`, so this discrepancy is retained rather than silently normalized.
- The anonymous source fixture was Git-clean before and after. Its current full-tree digest was `3AC87B1F134207B122E690A7E55D02B67935F23B726FF5F2CB70F12A1336D7D3`.
- Every launched Obsidian process used the fresh `%TEMP%` vault copy and fresh `%TEMP%` `--user-data-dir`; four isolated processes were observed at cleanup and all had exited after termination.
- No production TSUZUNE Vault, production Obsidian/TSUZUNE profile/window, installed TSUZUNE, product source, tests, package manifest, settings, Git refs, commits, remotes, releases, plans, indexes, baseline summary, or TSUZUNE note was changed.

## Outcome

The fixture opened successfully only after a fresh isolated `obsidian.json` was supplied. The fixed runtime's settings API and command probe did not surface the Files and links page. In a visible isolated window, Computer Use exposed the workspace accessibility tree but not a usable geometry for the Settings command. The add control was therefore not clicked by guessed coordinates.

Without a safely driven plus-triggered add flow, there was no populated row to inspect or remove. A restart after an unpopulated session would not be evidence of the required persisted value, so no persistence claim is made. The process exits recorded here are cleanup/exploratory exits, not the required real-restart proof.

## Honest retries

1. `--vault` launch showed the vault picker; no settings were changed.
2. Re-created isolated userData with an isolated `obsidian.json`, then opened the fixture.
3. Probed `app.setting` and the settings command; neither surfaced the settings UI.
4. Used the visible isolated window and accessibility path; stopped when only non-actionable Settings command metadata was available.

## Parent audit and usage

- The frozen card's `card_frozen_at` value is a date placeholder (`2026-08-12T00:00:00.000Z`), not a reliable execution timestamp. It is preserved rather than rewritten after execution and is not used for token-boundary claims.
- The separate task rollout contained 46 cumulative token events. Its final cumulative usage was input 3,674,978; cached input 3,472,896; output 16,415; reasoning 2,999. This correlated follow-up is excluded from the 3-sample natural-switch count.
- The four exploratory paths above are counted as retries. The high input and blocked outcome strengthen the warning against another immediate GUI-reference retry, but do not by themselves prove that a long-task boundary would have succeeded.

## Artifact

- `docs/reports/assets/cp1-b-01-obsidian-1.13.4/reference-completion/blocked-run.json`

The parent report and three CP1-B-01 assets remain unmodified, including its failed result.
