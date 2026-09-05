# F — visible-motion correction

## Owner evidence

The workshop owner reported that the live candidate was not moving at all. Direct inspection confirmed that the displayed clock advanced but successive live frames were effectively indistinguishable. This superseded the earlier telemetry-only acceptance.

## Root cause

The animation loop capped every visible frame's elapsed time at `0.1` seconds. When the Codex in-app browser delivered sparse frames, the renderer discarded most wall time and made the world progress roughly fifteen times too slowly. The camera and shader movement also remained below a useful perceptual threshold.

## Correction

- Preserve visible elapsed wall time; the existing visibility-change reset still prevents hidden-tab jumps.
- Increase continuous camera travel without cuts.
- Add travelling displacement and light heads to filaments.
- Make membrane passage and witness drift follow the same world clock.
- Add a three-second same-page screenshot comparison and require a mean pixel difference of at least `0.03`.
- Add regression coverage for sparse visible frames and three-second camera displacement.

## Evidence

- TDD red: missing live-motion contract, camera below the new displacement bound, and capped elapsed time each failed before their fixes.
- Green: 23/23 tests and five syntax checks pass.
- Codex in-app browser: 2.00 simulation seconds over 2.03 wall seconds; normal WebGL path, visible document, reduced motion false.
- Current eight-second Electron smoke: `boundaryPass=true`, `liveMotionPass=true`, mean pixel difference `0.045718`, p95 frame interval `3.7 ms`, zero intervals over `50 ms`, reduced-motion PASS, context-loss PASS, no console errors.
- Rejected revision mean pixel difference: `0.014463` over the same three-second gate.

## Independent checks and adoption

- Motion-path scout: adopted the finding that clock rates and mostly fixed geometry were visually sub-threshold.
- Acceptance-test scout: adopted the same-live-page temporal image-difference gate; static candidate/control screenshots remain a separate concern.
- Independent verifier: adopted its no-blocking-defect review of corrected frames and smoke output. Its reduced-motion uncertainty was rejected after direct live evidence showed `prefers-reduced-motion=false`.
- All delegated work was read-only; implementation, integration, unseen live-clock verification, and final state correction remained with CEO-01.

## Remaining boundary

The former twelve-minute run predates this correction and is not current-revision proof. A full rerun is intentionally deferred until the workshop owner judges that the corrected live direction is worth promoting. Product integration, dependencies, production update, and Git delivery remain outside authorization.
