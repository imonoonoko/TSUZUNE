# E: VERIFY-01 independent acceptance

## Verdict

- Technical gate: PASS.
- Overall artwork acceptance: PENDING.
- Blocking defects: none for the isolated technical proof.

VERIFY-01 was read-only and did not participate in production. It independently matched the current source to the frozen snapshot fingerprint `ed137cb77ccce737b432cd52838d596e7765a97fa074ecac66d2c4812319d8c5`, 599 contributors, and seed `1369952969`; confirmed source/protocol hashes remained stable around the run; reran all 21 tests and syntax checks; inspected the six 1280×720 captures; and verified the actual 90-second control changes only the target filament and authored downstream membrane/witness energy while preserving geometry, camera, cue timing, and world identity.

## Non-blocking findings

1. P2: `archiveTimeUtc` is not supported by the snapshot's `observedAt`. Treat it only as the frozen protocol's score-reference clock. The snapshot observation time is `2026-09-03T19:03:59.860Z`.
2. P2: the persisted technical report contains aggregates but not the 161,553 raw frame records. The harness failed closed over those records during execution, but a later reviewer cannot recompute p95 or the slow-frame fraction from the JSON alone.
3. P3: camera bound constants are duplicated in the model and protocol. They match in this round, but a future protocol could drift unless the model reads the protocol values.

The earlier stale A-result test count was corrected to the integrated 9 score/world tests. No frozen renderer or protocol code was changed after the formal run to address the remaining findings.

## Unproven boundary

Technical evidence cannot prove that the workshop owner can identify the local control before receipts, feels that their archive caused the work, wants to watch for 90 seconds, or wants to revisit on another day. Product integration and production delivery were not reviewed because they were outside the authorized scope.
