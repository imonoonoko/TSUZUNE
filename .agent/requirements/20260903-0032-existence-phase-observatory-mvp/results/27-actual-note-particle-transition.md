# Result 27 — actual-note particle transition

status: isolated R3 mechanically verified; owner aesthetic acceptance pending

## Subject and observation boundary

- subject: isolated `work/archive-weather-prototype/` WebGL2 candidate
- production Vault observation fingerprint: `sha256:a93639dc4fe9640f57007af2bcbe83020635f0c715746729cc56ce7c1185aedf`
- included current Markdown notes: 577
- excluded protected `50_履歴` notes: 1,411
- all 577 included notes were fetched read-only; no product or Vault source note was changed during extraction
- raw titles, body, and paths were discarded before the generated snapshot was written

## Implemented design

- One observed note is one particle: 577 notes, 577 opaque IDs, 577 rendered particles.
- Each note carries four independent observational tracks:
  - content: normalized character-trigram sketch, not raw text or a semantic label;
  - time: relative modification position and cyclic components, not an importance score;
  - links: resolved explicit Wiki-link indices, with missing links retained as an observation limit;
  - structure: normalized headings, lists, fences, paragraphs, links, and length.
- The snapshot contains 4,095 resolved explicit-link observations and 200 unresolved or ambiguous observations. Unresolved is not interpreted as absence.
- Pair relations pass through attraction, release, and repulsion. A 43-second epoch introduces changing unfamiliar candidates outside the fixed link/content pool, preventing the candidate set itself from becoming the visible ontology.
- CPU fixed-step dynamics feed WebGL2 rendering. The artwork contains no fake dust population, explicit edge lines, permanent clusters, semantic labels, or value/importance score.
- Light, halo, trail, and rare warm shifts express current motion phase and energy only.

## Changed artifacts

- `work/archive-weather-prototype/note-snapshot.mjs`
- `work/archive-weather-prototype/note-model.mjs`
- `work/archive-weather-prototype/note-model.test.mjs`
- `work/archive-weather-prototype/prototype.mjs`
- `work/archive-weather-prototype/index.html`
- `work/archive-weather-prototype/style.css`
- `work/archive-weather-prototype/README.md`
- removed obsolete aggregate-only `model.mjs`, `model.test.mjs`, and `vault-snapshot.mjs`

## Verification

- Red: the new public-behavior test initially failed because `note-model.mjs` did not exist.
- Green: `node --test work/archive-weather-prototype/note-model.test.mjs` passed 6/6.
- `node --check work/archive-weather-prototype/prototype.mjs` passed.
- Independent privacy scan: 577 entries, 577 unique IDs, no raw-key fields (`title`, `body`, `path`, `importance`, `value`, `rank`) and no `.md` path fragments.
- Obsolete-contract scan found no `8192`, `8_192`, `vaultSnapshot`, `Vault aggregate`, or `Matched control` reference in the prototype.
- Per-track ablation changes motion independently for content, time, links, and structure.
- With the external field disabled, note interactions still change neighbourhoods rather than exposing a fixed graph.
- Simulated 120/360/720/1800-second states remain finite, moving, and spatially distributed.
- Headless Microsoft Edge WebGL2 reported 577 particles, 577 notes, `glError=0`, and zero console errors/warnings.
- Around 637 simulated seconds: mean speed 0.00706, 42 occupied coarse cells, largest-cell share 0.0832, and neighbour retention 0.0104 versus the earlier sample.
- The first browser rendering was rejected by the parent as overexposed white spaghetti. Trail gating, decay, light balance, and direct live-particle rendering were iterated before retaining the current candidate.
- Final visual evidence: `output/playwright/archive-weather-note-particles-183s-final.png` and `output/playwright/archive-weather-note-particles-615s-final.png`.

These checks prove count, privacy shape, independent influence, relationship change, numerical stability, and browser execution. They do not prove that the work is beautiful, emotionally affecting, or suitable for the TSUZUNE product.

## Delegation integration and operational judgment

- Four independent agents were used because feature privacy, nonlinear dynamics, art direction, and adversarial acceptance had separate evidence boundaries and could run concurrently.
- The parent adopted the shared core: actual notes as particles, privacy-preserving tracks, no fake dust/edges/score, reversible temporary relations, and long-time counterexamples.
- No subagent edited production TSUZUNE or product code. Parent integration avoided merge handoff and rework conflicts.
- Routing decision: maintain this four-way split only for similarly high-ambiguity generative-art milestones; do not make it a standing organization or use it for routine changes.
- Next guard: any future attribute or visual channel must pass privacy, independent ablation, and non-value-score review before product consideration.

## Current state and stop boundary

The actual-note system is implemented and mechanically verified only in the isolated prototype. Product integration, production update, Git delivery, visible unattended 12-minute owner viewing, and owner aesthetic acceptance are not performed. The next step is the user's direct viewing of this candidate; a separate explicit decision is required before any product work.
