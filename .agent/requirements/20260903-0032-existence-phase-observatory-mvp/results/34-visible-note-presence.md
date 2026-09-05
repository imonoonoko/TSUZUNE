# Life Weather Gate 2.2 — visible note presence

## Trigger

The owner rejected Gate 2.1 after direct viewing. The numeric existence-phase responses were not perceptually legible, a velocity-aligned streak still extended from each point, outlined particle contours looked cheap, and high-frequency white haze read as a mosaic rather than smoke.

## Implemented boundary

- Deleted the complete velocity-streak shader, buffer, VAO, upload, and draw path. The renderer has no line primitive or instanced velocity quad.
- Added an eight-channel visual signature without a combined score: edge softness, core density, halo spread, haze persistence, pulse rate, pulse depth, chromatic bias, and surface turbulence.
- Replaced outlined contours and residue rings with continuous core-to-halo emission. Phase differences alter falloff, density, scale, pulse, and low-amplitude organic deformation rather than drawing symbols around a point.
- Mapped each note to a stable continuous jade, ice-blue, violet, and restrained amber spectrum using the privacy-safe observed traits plus its opaque identity phase. Color is one channel, not the only channel and not a value rank.
- Limited visible history deposition to notes affected by an observed Life Weather event. Removed velocity advection and high-frequency grain from the display path; the remaining colored history diffuses locally with low-frequency variation and finite decay.

## Verification

- `node --test work/archive-weather-prototype/note-model.test.mjs work/archive-weather-prototype/renderer-contract.test.mjs`: 19 tests PASS.
- `npx vitest run tests/life-weather.test.ts tests/observatory.test.ts --maxWorkers=1`: 2 files / 14 tests PASS.
- `npm run typecheck`: PASS.
- Target-file `git diff --check`: PASS.
- Codex in-app browser, isolated `http://127.0.0.1:4174/`: WebGL2 rendering loaded successfully. Direct visual comparison at initial and later time found no point-attached straight streak, no outlined/ring particle vocabulary, no white high-frequency mosaic, and a visible distribution of note-specific colors. Controls remained visually recessive.

## Remaining boundary

This is source implementation and local isolated-browser verification only. It is not integrated into the TSUZUNE product, not production-installed, and not Git-delivered. Artistic acceptance still belongs to the owner after direct viewing. The visual signature is a local artwork mapping, not existence-phase itself, a scientific model, a personality classification, or a note-value score.
