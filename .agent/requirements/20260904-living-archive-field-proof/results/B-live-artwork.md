# B: live artwork

## Result

Created an isolated WebGL2 artwork at `work/living-archive-field-prototype/`. The visible surface is only a full-screen canvas. Twelve source-backed regions share one persistent world and one view-projection: three multi-strand filaments carry directional warm passages, three translucent membranes reveal passage-through depth, and six witness clusters gather at endpoints. Climate, encounter, and micro-life use separate clocks; the camera follows a continuous world orbit and never changes target in response to a cue.

The renderer does not use screen-space trail history as world state. Candidate and one-phenomenon control share seed, camera, feature IDs, geometry, cue timing, and contributor ledger; the control removes only the selected recurrence energy and its declared downstream chain.

## Honest fallbacks

- Reduced motion renders a static Canvas2D composition.
- WebGL context loss renders a static Canvas2D fallback and records handled/unrecovered counts.
- Initial shader/program failure exposes a static failure surface and diagnostics instead of leaving an undefined runtime.

## Verification boundary

Source contracts and live WebGL2 boot pass. The result is an artwork candidate, not a claim about note value, true relationships, or existence-phase ontology. Aesthetic acceptance belongs to the workshop owner.
