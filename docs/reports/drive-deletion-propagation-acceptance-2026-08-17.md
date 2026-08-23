# Drive deletion propagation acceptance (2026-08-17)

## Result

PASS. The installed production build was exercised against disposable isolated
profiles and test Vault data. The production Vault was not modified.

## Acceptance matrix

| Scenario | Result | Evidence boundary |
|---|---:|---|
| Default deletion behavior preserves both sides | PASS | No local or remote deletion is propagated without an explicit opt-in. |
| Explicit local deletion propagates to Drive trash | PASS | The remote test object was trashed and verified after a full refresh. |
| Explicit remote deletion propagates to local `.trash` | PASS | The local note was moved to `.trash` and verified after a full refresh. |
| Pending deletion tombstone is cleared | PASS | The pending tombstone was absent after successful convergence. |
| Restart convergence | PASS | Both isolated clients converged to the same post-operation state after restart. |
| Production Vault untouched | PASS | The production Vault was outside the isolated test profile and remained unchanged. |
| Error count | PASS | 0 errors. |

The round-trip covered 10 files across 5 performance rounds. Test data and
temporary profiles were disposable and were cleaned up after the run.

## Performance

Measured on the isolated live round-trip (milliseconds):

| Operation | p50 | p95 |
|---|---:|---:|
| Preview | 3232.511 | 4034.714 |
| Apply | 7001.693 | 7419.072 |

These are acceptance measurements for this local environment, not a service
latency or multi-device concurrency guarantee.

## Safety boundary

The test exercised the explicit local/remote propagation flags, full-refresh
reconciliation, pending-deletion recovery handling, and restart behavior. No
credentials, access tokens, remote object identifiers, or other secret values
are recorded in this report.
