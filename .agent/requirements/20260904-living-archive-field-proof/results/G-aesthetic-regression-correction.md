# G — aesthetic regression correction

## Owner evidence

The workshop owner judged the amplified visible-motion revision substantially worse than the preceding artwork. Direct comparison confirmed that the correction had made filament geometry, membrane deformation, witness position, and camera travel compete for attention, replacing quiet negative space with broad moving light masses.

## Correction

- Keep the wall-time clock fix that prevents sparse visible frames from discarding elapsed time.
- Restore the preceding camera trajectory and all preceding filament, membrane, and witness shader values.
- Keep energy movement as travelling light on restrained, stable geometry.
- Replace the one-sided “more pixel change is better” gate with a bounded three-second contract: simulation time must remain within 80–120% of wall time and mean RGB difference within `0.008–0.035`.
- Add regression checks for the restrained camera displacement and light-led motion path.

## Evidence

- TDD red: the amplified revision failed the restrained clock/image contract, stable-geometry contract, and three-second camera bound.
- Green: 24/24 focused tests and five syntax checks pass.
- Current eight-second Electron smoke: `boundaryPass=true`, `liveMotionPass=true`, simulation delta `3.05s`, mean pixel difference `0.014463`, p95 frame interval `3.7ms`, zero intervals over `50ms`, reduced-motion PASS, context-loss PASS, and no console errors.
- Codex in-app browser: simulation advanced `2.00s` over `2.214s` wall time with reduced motion false; four-second before/after inspection showed travelling light without the prior geometry lurch.

## Delegated checks and adoption

- Motion-path audit recovered the exact preceding camera and shader values and correctly excluded the wall-time fix from rollback; adopted.
- Acceptance audit confirmed that the former `>= 0.03` gate had no artistic upper bound. Its recommendation to avoid an ungrounded upper bound was not adopted because the owner supplied direct rejection evidence for the measured `0.045718` revision; a deliberately broad `0.035` ceiling is used only as a regression tripwire, not an aesthetic score.
- Visual verification confirmed that no camera cut had been introduced. Its proposed reduced-motion concern was rejected after direct IAB evidence again showed `reduced=false`.
- All delegated work remained read-only. CEO-01 owned implementation, integration, live inspection, and the unseen bounded-motion verification.

## Remaining boundary

The restored candidate is ready for workshop-owner rereview, not aesthetically accepted. The old twelve-minute run remains historical, and a current-revision full run is deferred until the owner decides this direction is worth promoting. Product integration, dependencies, production update, and Git delivery remain outside authorization.
