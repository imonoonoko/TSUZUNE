# Result 25 — parent verification

status: implementation verified; owner aesthetic acceptance pending

## Subject and baseline

- subject: isolated `work/archive-weather-prototype/` WebGL2 candidate
- snapshot: `sha256:49227204794a05b8e47eac637d9a39b66648e69f74263adffa36061f9e7a1155`
- verified: 2026-09-03, local Vite server at `127.0.0.1:4174`
- excluded: TSUZUNE product wiring, production install, Git delivery, raw note labels/content, individual paths, attachments, `50_履歴`

## Automated evidence

- `node --test work/archive-weather-prototype/model.test.mjs`: 5/5 passed.
- `node --check work/archive-weather-prototype/prototype.mjs`: passed.
- `git diff --check -- work/archive-weather-prototype .agent/requirements/20260903-0032-existence-phase-observatory-mvp`: passed.
- deterministic matched comparison retains the same particle seed and palette while changing only aggregate-derived spatial, temporal, and scale tracks.
- each of the three tracks can be ablated independently without changing the other two.
- CPU field analogue remained finite and bounded at 7-second samples through 720 simulated seconds.

## Browser evidence

- In-app hidden browser loaded the accessible shell, but deliberately hidden tabs suspended `requestAnimationFrame`; it was not used as motion evidence.
- Headless Microsoft Edge via Playwright ran the WebGL2 path without foregrounding the user interface.
- Initial browser pass exposed `GL_INVALID_OPERATION` from transform-feedback buffer aliasing. Buffer initialization and transform-feedback binding were separated; the defect was then absent.
- Frozen candidate reported `data-gl-error="0"`; browser console had 0 errors and 0 warnings after the favicon and GPU defects were fixed.
- Pause was stable: simulation time remained `40.45` across a further 3-second wait; resume restored progression.
- Vault aggregate and matched control both rendered and exposed the correct provenance mode. Their sheet curvature and gathering pattern were visibly different while the seed and palette remained matched.
- A 95-second wall-clock unattended headless run completed with no WebGL error or console warning. The headless browser advanced only 24.42 simulation seconds because detached rendering was throttled; this is not evidence for a full 90 simulation-second or 12-minute aesthetic observation.
- The independent art verifier flagged the startup status caption as a P1 artwork intrusion. The status remains in the accessible DOM but now has opacity 0 unless a WebGL2 error occurs; the final browser check reported opacity 0, `data-gl-error="0"`, and no console errors or warnings.

## Visual boundary

The candidate no longer presents node icons, explicit edges, labels, a fixed constellation, or the earlier vortex lattice. It renders dark, low-chroma, filament-like directional sheets with transient gathering and separation. This establishes a viewable candidate, not an artistic success claim. The owner still decides whether it is emotionally compelling, and a real visible 12-minute no-input viewing remains unverified.
