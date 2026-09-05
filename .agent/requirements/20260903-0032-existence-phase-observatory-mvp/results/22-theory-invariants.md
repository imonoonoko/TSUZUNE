# THEORY-INVARIANTS — Archive Weather prototype

## Scope and authority

This is a read-only theory-boundary review for Packet 22. It translates the already adopted product philosophy and Art Direction into prototype acceptance invariants; it does not add an ontological, scientific, or semantic claim.

- Product source: `30_知識/TSUZUNE-根幹思想-知識循環と構造探索.md` (active, user-adopted).
- Theory boundary: `30_知識/存在相理論-理論定義Research-v0.1-2026-09-01.md` (Research v0.1).
- Navigation/status: `30_知識/存在相理論-知識構造MOC-2026-09-01.md` (current-navigation).
- Design source: `art-direction.md` (designed-awaiting-owner-review).

`P₀ ≠ D_c(x) ≠ artwork` is the operational boundary. `P₀` is a world-side referent, `D_c(x)` is a finite local description, and this artwork is one finite observation/presentation derived from a Vault snapshot. None is evidence that the others have a particular physical, causal, or semantic form.

## Invariants and observable failure conditions

| ID | Executable invariant | Required observable check | Failure condition |
|---|---|---|---|
| I-INPUT-1 | The artwork accepts only a declared, aggregate snapshot: irreversible body-feature sketch, explicit-relation distribution, time distribution, and folder/path hash seed. These are separate inputs, not a combined `importance`, `rank`, `meaning`, or `similarity` score. | Emit a machine-readable input manifest for each run that lists each enabled channel and its source snapshot hash; inspect the render input/state for the absence of undeclared channels. | Any renderer input or intermediate field is a note-value/ranking/semantic score, or a raw title/body/path/relation label is supplied to the artwork. |
| I-INPUT-2 | No single note attribute, aggregate count, text length, recency, folder, or relation count may jointly determine brightness, size, centrality, and lifetime. Each visual parameter must identify its direct input channel(s) in the manifest. | For every visual parameter, list direct input channel(s); run a static/configuration inspection that finds no one scalar routed to more than one of brightness, size, centrality, lifetime. | One scalar controls two or more of those value-suggesting parameters, or an undocumented implicit default controls any of them. |
| I-ABLATE-1 | A control run is possible for every declared input channel: retain seed and all other channels, replace exactly one channel with its neutral/control form, then render the same duration. | Save paired run manifests and a fixed-window capture/metric for baseline plus one run per channel; record which predeclared morphology changed or did not change. | A channel cannot be independently disabled/replaced, a control changes more than its target channel, or no trace identifies the paired baseline. |
| I-ABLATE-2 | At least three declared channels must have distinct, predeclared visual roles; they may not all merely make the field brighter, denser, or more active. Example roles from the design are local curvature/hue phase, weak long-range synchronization, and injection/quiet interval. | Before owner review, name three channel-to-role mappings and inspect ablation captures: each target ablation removes or changes its own role while the other two remain available. | Fewer than three independent roles are declared; two or more ablations produce only the same global intensity change; or a claimed role survives removal of its sole declared channel. |
| I-PRIVACY-1 | The runtime snapshot, GPU/renderer state, image/video capture, canvas, and ordinary artwork UI contain no recoverable note title, body text, Wiki-link text, folder/path string, attachment name, or per-note identifier. | Search serialized snapshots, logs, telemetry/debug exports, DOM/canvas accessibility text, and captures for fixture sentinel strings placed in title/body/path/link fields. | Any sentinel appears outside the separately controlled production-information surface, or a per-note identifier can be used to retrieve/display a note from the artwork surface. |
| I-PRIVACY-2 | The body feature is irreversible for prototype purposes: no feature-to-text recovery path, retained raw-body cache, or reverse lookup is available to the renderer or artwork UI. | Review the snapshot schema and runtime storage/requests; prove that raw body/title/path fields and a feature-to-note lookup table are absent after aggregate extraction. | The renderer can access raw note content, a lookup maps a feature packet back to an individual note, or a debug endpoint/export restores note text. |
| I-PROV-1 | Every run has a separate, non-artwork provenance record: snapshot hash/date, declared channels, neutral/control substitutions, transform version/hash, deterministic seed/date salt, and omissions. It must say that the display is an observation/presentation, not a relation/value/identity map. | Open the production-information surface or saved run record for a baseline and an ablation run; verify every required field and the non-identity statement. | A run cannot be traced to its input/transform/control state, provenance is visible as a persistent label/HUD on the artwork, or the record claims truth/importance/meaning rather than transformation. |
| I-PROV-2 | Artwork labels and captions do not make semantic or scientific claims. Any accessible explanatory text uses bounded language: `観測表現`, `由来`, `変換`, `表していないこと`, and uncertainty/omission where applicable. | Review all visible copy, ARIA text, title/description, and production-information text against a claim checklist before owner review. | Copy states or implies that a particle/field/path/density/colour/cluster is `存在相`, a true relationship, importance, identity, emotional meaning, a physical force, or a scientific simulation. |
| I-NONIDENTITY-1 | No object type or visual quantity is named or implemented as `P₀`, `存在相`, `meaning`, `importance`, `identity`, `force`, or a universal flow. The allowed names are representational: tracer, field, transform, channel, snapshot, observation, and presentation. | Inspect public UI copy, run manifests, and prototype-facing identifiers/configuration labels. | A public-facing name or output equates a display element/metric with P₀ or assigns it a semantic, natural-scientific, or ontological status. |
| I-NONIDENTITY-2 | Blankness, distance, separation, missing links, low density, dimness, or short lifetime are never rendered or described as non-existence, disconnection, low value, weak identity, or absence of meaning. | Test sparse, singleton, unlinked, and empty aggregate fixtures; inspect explanatory copy and run records. | Any fixture produces a value/absence judgement, or copy converts an omitted/unlinked/displayed-as-empty condition into an ontological or social conclusion. |
| I-NONIDENTITY-3 | The motion grammar is local artistic translation only. `濃淡 → 流れ → 分化 → 統合 → 安定 → 地形 → 次の流れ` may guide a scene vocabulary, but not a mandatory time order, closed causal loop, physical law, or prediction. | Review motion specification and 12-minute capture for non-cyclic evolution; review explanatory copy for the bounded wording. | Fixed stages, a detectable closed loop, or documentation claims a universal sequence, causal mechanism, physical process, or predictive model. |

## Minimum acceptance evidence

Do not accept the isolated prototype until one compact evidence bundle contains:

1. Baseline input manifest and its non-artwork provenance record.
2. One paired ablation manifest/capture for each declared channel, including the three independent-role checks.
3. Privacy-sentinel search results for serialized inputs, runtime/debug output, UI/ARIA text, and captures.
4. The sparse, singleton, unlinked, and empty fixture review.
5. Copy/identifier review against I-PROV-2 and I-NONIDENTITY-1 through 3.

An aesthetic pass does not waive any of these checks; conversely, these checks do not establish beauty, user acceptance, theory support, scientific validity, or permission to integrate into TSUZUNE production.

## Escalation / stop condition

Stop and return to the owner if a requested invariant must infer note meaning, personal value, true relation, identity, emotion, ontology, causality, or natural science from the snapshot. The permitted response is to preserve the input as an explicitly limited aggregate transform, or to omit it; it is not to rename the inference as an artistic fact.
