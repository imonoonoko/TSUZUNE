# D: live integration and technical acceptance

## Deterministic checks

- `node --test work/living-archive-field-prototype/*.test.mjs`: 21 PASS, 0 FAIL before the frozen run.
- `node --check work/living-archive-field-prototype/prototype.mjs`: PASS.
- In-app browser: WebGL2 mode `living-webgl2`, canvas 1280×720 at DPR 1, 12 features, zero WebGL errors, no console warning/error observed.

## Frozen actual-time run

Command: `npx electron work/living-archive-field-prototype/technical-run.mjs`

The no-retry run completed once with exit code 0. `technicalPass=true` and `boundaryPass=true`: 720.62 visible seconds, 161,553 recorded frames, p95 interval 3.7 ms, 0.009159 fraction above 50 ms, six distinct macro compositions, no blackout, no full saturation, no fixed central attractor, no short replay, no camera continuity violation, stable world identity, no WebGL error, and no unrecovered context loss.

The fixed 90-second candidate/control pair preserved world identity and produced mean RGB pixel difference 0.0104659. Reduced-motion and actual WebGL context-loss fallbacks passed. The report intentionally keeps top-level `pass=false` because blind-control and workshop-owner aesthetic gates are pending; telemetry is not allowed to approve art.

## Evidence

- `evidence/final/technical-report.json`
- `evidence/final/candidate-000s.png`
- `evidence/final/candidate-030s.png`
- `evidence/final/candidate-090s.png`
- `evidence/final/candidate-240s.png`
- `evidence/final/candidate-480s.png`
- `evidence/final/candidate-720s.png`
- `evidence/final/candidate-control-90s.png`
- `evidence/final/control-90s.png`

## Provenance clarification

The frozen protocol's `source.archiveTimeUtc` is a deterministic score-reference clock chosen when the protocol was frozen. It is not the snapshot observation timestamp. The imported snapshot reports `observedAt=2026-09-03T19:03:59.860Z`; a later protocol revision should rename the field to `scoreReferenceTimeUtc` or derive it explicitly. The frozen round is not rewritten after execution.
