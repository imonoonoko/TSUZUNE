# Result 23 — Archive Weather motion parameters

status: proposal for the isolated WebGL2 motion prototype; not an implementation contract

## Boundary

This is a small, passive-viewing parameter envelope for the motion grammar in
`art-direction.md`: a persistent velocity field, tracers, short-lived trails,
weak history feedback, and reinjection. It neither measures note importance nor
maps a single Vault attribute to brightness, size, centre, or lifetime.

The numbers below are **our design choices**, not values prescribed by the
reference works. Their role is to make the proposed grammar testable before
adding controls, labels, or a more elaborate simulation.

## Source principles retained

| Principle | Source observation | Consequence here |
|---|---|---|
| A passing element can alter the field that later elements traverse. | Tendrils describes velocity traces left by particles as affecting later particle velocity. [source](https://epok.tech/work/tendrils/) | Feedback is non-zero but deliberately weak and decays. |
| Motion can remain continuous while the field changes gradually. | FLUX feeds time into 3D Perlin noise and describes smooth field evolution rather than a loop. [source](https://daeppen.dev/work/flux) | Use several slow, incommensurate temporal terms rather than scenes or a short repeating cycle. |
| The trace, rather than a particle icon, can reveal motion. | FLUX fades old line segments; Miri persists and decays an intensity surface for trails. [FLUX](https://daeppen.dev/work/flux) [Miri](https://miri-lang.org/gpu-demos/particles/) | Render density/trails; do not render legible node-points. |
| Renewal can coexist with continuity. | Miri ages and respawns particles that expire or leave the field. [source](https://miri-lang.org/gpu-demos/particles/) | Reinject a small distributed fraction continuously, not in visible bursts. |
| Autonomous time does not require user intervention. | Unsupervised is described as generative and non-interactive; FLUX also provides idle auto-pilot. [Unsupervised](https://refikanadol.com/works/unsupervised/) [FLUX](https://daeppen.dev/work/flux) | The default, and the acceptance target, is 12-minute no-input viewing. |

Holtset Flow is excluded from numeric derivation: the available first-party
material identifies it as a ThreeJS/WebGPU experiment but did not expose a
verifiable motion specification.

## Minimal numeric envelope

| Parameter | Proposed initial value and safe tuning range | Why this range is a design choice | Risk signal / correction |
|---|---|---|---|
| Field resolution | Start **256 × 144**; permit **192 × 108–384 × 216**. | Coarse enough to read as weather rather than detail texture, yet sufficient for broad local curvature on a 16:9 surface. | Below 192 × 108: blocky/grid-like flow. Above 384 × 216: fine turbulence begins to foreground simulation detail and adds fill cost. |
| Tracer pool | Start **16,384**; permit **8,192–32,768**. | Density should form mist, seams, and transient thickening without yielding countable particles. | Individual dots become the first reading: increase count or trail persistence. Surface becomes uniformly full: reduce count before changing palette. |
| Integration step | Fixed simulation step **1/60 s**, capped at **2 steps/render frame**; discard excess elapsed time rather than catch up visibly. | Stable enough for passive motion and avoids a long tab stall becoming an obvious burst. | Frame-rate-dependent direction/brightness, or visible fast-forward after tab return: verify the cap. |
| Velocity memory / damping | Retain **0.90–0.96 per 1/60-s step** (start **0.93**). | Gives turns inertia without making a permanent orbit. | <0.90 chatters like noise; >0.96 produces readable lanes or a dominant whirl. |
| Field feedback gain | Add tracer-derived perturbation at **0.003–0.010** of the base field magnitude (start **0.006**), clamped to **±8%** of base speed. | It makes passage consequential but prevents motion history from becoming the sole driver. | 0: no trace of history; >0.010 or clamp hits: runaway channels, fixed centres, or self-similar “fluid demo” behaviour. |
| Field-history decay | Exponential retain **0.985–0.995 per step** (start **0.991**; half-life roughly 1.3 s at 60 Hz). | A short memory lets later tracers feel an event without promoting a permanent topology. | <0.985: feedback is imperceptible; >0.995: ridges persist and violate erosion/dissolution. |
| Trail/density decay | Exponential retain **0.91–0.95 per rendered 60-Hz equivalent frame** (start **0.935**; visible half-life about 0.17 s). | Leaves a readable direction without filling the canvas. | <0.91 reads as points/flicker; >0.95 accumulates into a bright cloud or diagrammatic path. Apply dt-correct decay, not a frame-count-only alpha. |
| Tracer lifetime and reinjection | Lifetime sampled from **7–19 s**; reinject on expiry/out-of-bounds across source packets with a maximum **1/120** of the pool per simulation step (start: uniform lifetime distribution). | Distributed renewal avoids periodic population pulses while allowing the field to be continuously re-seeded by the archive aggregate. | Uniform simultaneous renewal makes a “scene reset”; reinjecting chiefly at one region creates a misleading centre/importance cue. |
| Temporal modulation | Combine **three** independently seeded terms with characteristic periods **73–109 s**, **137–191 s**, **223–337 s**; modulation amplitude **4–12%** of base field speed per term (start 7%, 6%, 4%). | The unequal periods are intentionally not a 12-minute composition or a scene sequence. | A recognisable repeated peak/phase inside 12 min: change the seed or periods, not merely the playback speed. Too much amplitude produces visible mode switching. |
| Palette | Start with a near-black neutral ground (**L 4–7%**); tracer luminance **18–72%**, capped at **82%**; use **two adjacent low-chroma hue families** with optional **≤10%** sparse third-family contribution. | Colour should distinguish local phase/field conditions, never note count, recency, quality, or semantic category. | Neon/additive bloom becomes the subject: reduce chroma/luminance before reducing motion. High luminance mapping to density can imply importance; keep intensity bounded and use a non-monotonic, seeded phase mapping. |
| Spatial bias | Base-field and reinjection contributions normalized per source packet; any local attraction/repulsion limited to **±12%** of base acceleration. | Prevents note count, text size, recency, or link volume from becoming a visual centre. | Stable centre, quadrant, or bright “important” basin in a control run: lower bias or randomize the spatial seed; do not compensate with labels. |

## Tuning order and explicit risks

1. First tune **trail decay and tracer pool** on synthetic control data until the
   first reading is weather/accumulation, not moving dots.
2. Then enable **base field plus temporal modulation** and run for 12 minutes.
   Reject any discernible loop, fixed scene boundary, permanent centre, or
   recurring peak.
3. Only then introduce **feedback**, beginning at 0.003. Increase once only if a
   blind observer cannot distinguish feedback-on from feedback-off over a short
   viewing; stop before a durable channel appears.
4. Finally evaluate source-packet reinjection against the input-removed control.
   A visible difference is necessary, but no individual input may become an
   icon, a stable centre, or a brightness ranking.

The highest-risk knobs are feedback gain, field-history decay, density/trail
decay, and spatial bias: together they can turn “archive weather” into either a
fixed graph-like diagram or a generic particle demo. Do not add mouse control,
presets, audio reaction, camera/mic input, labels, or a tuning HUD to compensate
for those failures; those are outside this prototype's acceptance boundary.

## Verification boundary

These ranges support only passive viewing. They need validation through the
existing 90-second contrast comparison, 12-minute no-input viewing, immediate
three questions, and next-day revisit. No numeric value is accepted as a claim
about existence-phase theory, Vault meaning, note quality, or note importance.
