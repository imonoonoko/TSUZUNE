# Final source boundary — 2026-09-30

Status: source implemented and isolated verification passed; production held.

All three source success conditions in plan.md are met. The five ordered features are integrated; [report](../../../docs/reports/five-improvements-implementation-2026-09-30.md) describes behavior and limits.

| Check | Result and proof boundary |
|---|---|
| npm run build / typecheck | PASS; final renderer includes heading-focus and slug fixes |
| npm test | 1,319 PASS, 0 FAIL, 1 SKIP; 1,320 total. final-tests.json |
| npm run check:mcp | PASS; existing MCP contract regression, no permission expansion |
| current-decision / git diff --check | PASS |
| isolated source Electron | PASS: GFM, hover/focus component coverage plus real focus/Escape, Japanese-space fragment/H2 focus, main IPC conversion/rename, preservation, cell/filter, restart settings |
| preservation | 1,618 of 1,641 baseline files byte-identical; all 23 changed paths are task-owned, unexpected changes 0. Existing dirty changes retained |
| real OS Japanese IME | not_observable; synthetic composition/repeat guards verified, manual IME not performed |
| production reconstruction | archive matched; 10/12 changed-file candidates matched. Missing historical PLAN.md / PROJECT_STATUS.md, whole production fingerprint not reconstructed |
| production:update / packaged / installed | NOT RUN under user's hold rule; no production value conversion, publication or MCP re-registration |

Evidence: `work/five-improvements-20260930/{final-tests.json,production-base-audit.json,preservation.json,runtime/first.json,runtime/restart.json,runtime/cell.png}`. The runtime smoke uses an excluded fixture Vault and profile. Normal settings.json hash unchanged; whole normal profile comparison is not claimed.

Independent review fixed conversion changing the global declaration automatically. Value conversion now leaves declarations alone; key rename copies the registry entry while retaining old. Actual Electron exposed transient heading focus loss, fixed by focusing after final pending-state render; the new App regression passes. Markdown preview now retains leading prose and omits Setext underline; generated slugs avoid already used suffixes.

Initial full regression had 9 compatibility expectation failures; dynamic ARIA/default search shortcuts and caption/settings assertions were repaired. Subsequent full regression passed. Smoke harness failures included hidden-window focus and incorrect fixture selectors/profile format; these were corrected before successful source runtime checks. None of these are installed acceptance.

Work-item measurement closed once with outcome pass (source conditions). Ledger: `%LOCALAPPDATA%/codex-efficiency/measurements.jsonl`, measurement `7fa97d00f58fdf9125a0d061c7ecda062ae3f3d63594b1a07d408befc5eb2c3c`, window 12:20:26–15:20:31 UTC. Usage counters span root and three child sessions; they do not establish billing, saved time or model quality differences.

Next: recover and verify production-equivalent source, finalize fingerprinted docs, run production gate, then isolated packaged/installed smoke and exact hashes/profile/MCP checks. Preserve current tree and existing changes. Manual OS IME and user operation acceptance remain separate.

The final guard review also added same-note fragment save validation. Its regression proves failed saving prevents heading navigation and retains the draft. Final all-tests includes this case. Measurement ends at its explicit timestamp and excludes the subsequent final guard review/synchronization.
