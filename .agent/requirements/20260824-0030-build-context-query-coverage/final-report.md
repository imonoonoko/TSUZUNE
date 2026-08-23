# Final report

## Current boundary

Implementation, repository verification, production installation, post-restart live quality acceptance, and TSUZUNE persistence are complete. This artifact is frozen before the final production synchronization; its authoritative outcome is the excluded receipt file.

## Implemented outcome

- Projection is decided against the effective full candidate bundle budget.
- Every punctuation-delimited explicit intent can retain a distinct winning section.
- A matching bodyless parent includes its descendant branch without duplicating an already selected descendant.
- Atomic one-term queries no longer fill unrelated fallback sections and starve related protected sources.

## Evidence so far

- Four public RED/GREEN regression fixtures.
- Context suite 47/47 PASS.
- Typecheck PASS.
- Full tests 818 PASS, 1 SKIP.
- MCP gate PASS.
- Progressive-context fixture PASS after diagnosing and fixing the atomic fallback regression.

## Production receipt

- `installed-and-verified` at `2026-08-23T15:50:16.783Z`.
- Built and installed executable hashes match.
- Built and installed `app.asar` hashes match.
- The 58-file production profile digest is unchanged.
- All ten receipt checks passed, including packaged and installed smoke tests and MCP registration.

## Final persistence

- TSUZUNE record: `30_知識/TSUZUNE-build_context実効予算・親見出し・全意図保持改革-実施記録-2026-08-24.md`.
- Exact search returned one file, read-back passed, and the prior execution record provides one backlink.
- The final production synchronization is executed after this file is frozen. Its source fingerprint and installed hashes are recorded in `docs/reports/production-update-latest.json`, which is excluded from its own fingerprint.

## Live benchmark outcome

| Budget | Markers | Tasks | Seed truncated |
|---:|---:|---:|---:|
| 3000 | 16/16 | 5/5 | 0/5 |
| 5000 | 16/16 | 5/5 | 0/5 |
| 8000 | 16/16 | 5/5 | 0/5 |

All 15 case-budget combinations passed. The old 5000-character discontinuity is gone, four explicit intents survive, and bodyless parent headings retain their children.

At 3000 characters, sequential latency after one warmup was p50 482 ms and p95 593 ms over 15 samples. The previous baseline was p50 559 ms and p95 595 ms; this establishes no regression, not a causal performance claim.
