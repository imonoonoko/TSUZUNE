# Result 21 — Runtime placement

## Conclusion

Place the MVP in a new isolated browser prototype directory under `work/` (for example `work/archive-weather-prototype/`), with a self-contained `index.html`, `prototype.js`, and optional `README.md`. Do not import or wire `src/renderer/components/ObservatoryView.tsx`; the art direction explicitly freezes production integration until user acceptance.

## Evidence

- Existing production surface is `src/renderer/components/ObservatoryView.tsx:170-317`, a Canvas2D renderer, and `App.tsx:3725-3729` mounts it. Reusing it would violate the isolation boundary and retain note-opening/labels that art direction excludes.
- Existing `package.json` has Vite scripts but no standalone prototype script and no WebGL/WebGPU library. Raw WebGL2 in a static page is therefore the smallest dependency-free implementation.
- Existing browser smoke convention is Electron acceptance: `scripts/run-observatory-acceptance.mjs` launches a fixture app and inspects DOM/canvas. That script is production-specific and should not be repurposed for the isolated prototype.
- Existing tests use Vitest + jsdom (`tests/observatory-view.test.tsx`), but jsdom cannot validate actual WebGL2 rendering. A browser smoke must use the Codex in-app browser or a real Chromium/Playwright path only when explicitly permitted by the parent workflow.

## Run and test convention

From repository root, serve only the prototype directory with an existing local static server, e.g. `npx vite --host 127.0.0.1 --root work/archive-weather-prototype` (after files exist). Open the resulting URL in the Codex in-app browser. Smoke checks: WebGL2 context is non-null, Escape/pause work, `prefers-reduced-motion` freezes simulation, synthetic and aggregate modes switch, no title/node/edge/HUD text appears, and 90-second idle motion remains alive. Do not use `npm run build` or production acceptance as a prototype substitute.

## Smallest isolated placement

`work/archive-weather-prototype/index.html` owns the canvas and minimal controls; `prototype.js` owns raw WebGL2 shaders, velocity field, tracer advection, trail decay, feedback, lifetime/reinjection, synthetic/aggregate fixture switch, and reduced-motion handling. Keep source data synthetic or a manually prepared aggregate snapshot; never load raw note text/title.

## Unseen boundary

Actual WebGL2 availability, shader correctness, visual distinction between synthetic and aggregate inputs, 90-second non-looping behavior, and 12-minute stability are unverified until a real browser smoke is run. Do not infer FPS or GPU compatibility from repository inspection.
