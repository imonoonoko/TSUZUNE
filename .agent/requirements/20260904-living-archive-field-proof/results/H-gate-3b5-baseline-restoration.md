# H: Gate 3B.5 baseline restoration

## Owner decision

The workshop owner clarified that the desired earlier artwork is exactly Gate 3B.5, not any revision of Living Archive Field. The Living Archive Field rereview is therefore rejected as the active visual baseline.

## Restoration

- Reused the intact Gate 3B.5 implementation at `work/archive-weather-prototype/` without copying or rewriting it.
- Changed the current in-app browser URL to `http://127.0.0.1:4175/work/archive-weather-prototype/` on the already-running repository-root Vite server.
- The live page identifies itself as `TSUZUNE LIFE Weather`, exposes 599 source-note lights, reports WebGL error `0`, and keeps the artwork status visually hidden.
- `work/living-archive-field-prototype/` remains isolated and unchanged by this restoration; it is no longer the active owner-review surface.

## Verification

- `node --test work/archive-weather-prototype/note-model.test.mjs work/archive-weather-prototype/display-composition.test.mjs work/archive-weather-prototype/renderer-contract.test.mjs`: 38 PASS, 0 FAIL.
- `node --check work/archive-weather-prototype/prototype.mjs`: PASS.
- Parent live inspection confirmed the exact Gate 3B.5 route, a changing white star field with foreground/background depth, and `data-gl-error="0"`.
- Existing source-backed evidence identifies Gate 3B.5 as `work/archive-weather-prototype/` and snapshot `sha256:49227204794a05b8e47eac637d9a39b66648e69f74263adffa36061f9e7a1155`.

## Boundary

This restores the owner-selected baseline for viewing. It does not claim renewed aesthetic acceptance, run a new twelve-minute gate, change product code, install production, add dependencies, or perform Git delivery.
