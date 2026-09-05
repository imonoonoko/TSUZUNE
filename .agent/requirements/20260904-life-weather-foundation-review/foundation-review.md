# TSUZUNE LIFE Weather — Art-first foundation review

- Reviewed: 2026-09-04
- State: recommendation complete, owner decision pending
- Product code / dependency / production / Git change: none

## Conclusion

The foundation should change, but the first change is **not** a rewrite from TypeScript to Rust or from WebGL2 to WebGPU.

The current work still treats the archive as a collection of visible points. That contract makes the first reading a star field even when the internal model contains rich time, relationship, phase, and memory data. The new foundation should treat the archive as a set of **conserved contributors to one evolving material world**. A note keeps one logical identity and a complete provenance trail, but it no longer has to remain one dot on every frame.

The recommended product shape is:

> TypeScript compiles the current Vault snapshot into a deterministic Archive Score and provenance receipt. A dedicated full-window immersive surface renders one persistent world-coordinate representation—sparse 3D when warranted, otherwise bounded depth layers—with direct WebGL2/GLSL first. The ordinary TSUZUNE workspace disappears while viewing and returns intact on exit. WebGPU/WGSL becomes the next backend only after the same Living Archive Field score demonstrates a required visual or measured compute advantage.

## What the current system actually is

| Layer | Current truth | Artistic limitation |
| --- | --- | --- |
| Product placement | An ordinary `observatory` workspace tab inside the editor shell | The artwork is framed as another tool view; chrome, captions, hover, and note opening keep attention in analysis mode |
| Product renderer | React + TypeScript + Canvas 2D, capped to a small observational field | Safe and accessible, but not the isolated LIFE Weather artwork |
| Isolated artwork | Direct WebGL2/GLSL with 599 point lights and a 48 x 30 CPU memory field | The renderer is alive, but points dominate and the material field is visually subordinate |
| Representation | One logical note is continuously represented as one visible light | Preserves identity literally, but forces the whole archive back toward stars/nodes |
| Space | 2D positions plus scalar depth; screen-space feedback history | Parallax and size suggest depth, while the world and its history still live mainly in the image plane |
| Time | A fixed 90-second score with five global movements and two event lanes | Event replacement remains a hidden scene switch; smoothing the camera target cannot create a continuous world |
| Language | JavaScript/TypeScript host with GLSL shaders | No evidence that language limits beauty; it currently preserves the strongest data/provenance path |

Live evidence is recorded in [`results/D-current-path-and-gpu.md`](results/D-current-path-and-gpu.md). The current frame changed substantially over fifteen real seconds and reported no WebGL error, yet both sampled images still read first as white points on black. This separates liveness from artistic success.

## New representation contract

### 1. One note = one conserved contributor, not one permanent dot

Each logical note retains a stable ID, source observations, contribution channels, and receipt entries. Its visible contribution may temporarily appear as a witness light, a pressure change, a filament segment, a membrane boundary, a void, or a residual wake. Several notes may co-author one material form, and one note may influence several samples of that form, without multiplying the number of logical notes.

This revises the old reaction to decorative fragments. The failed 4,792-fragment version confused duplication with presence. The remedy is not to require 599 simultaneous dots; it is to make rendering samples subordinate to a single traceable contributor ledger.

The ledger is a causal invariant, not a retrospective label. Every visible macro transformation or material region must deterministically reproduce `{snapshotDigest, seed, archiveTime, regionOrCueId, channel, noteId, normalizedWeight, carrierTerm}`. Source-backed weights use a declared normalization rule; source-free noise, interpolation, and decay are recorded separately as carrier terms. Carrier terms may texture or transport a source-selected event, but may not select its cue, primary region, lifetime, or claimed relationship. No unrecorded semantic input may create a region and attach note IDs afterward.

### 2. Permit a carrier medium, forbid invented semantic claims

The renderer may generate voxels, particles, rays, noise samples, and interpolation as artistic material. These are the equivalent of pigment and canvas, not additional notes. A large, persistent structure must expose which observations and contributor weights produced it, but each photon does not need its own note ID.

The system must still never claim that brightness, center, size, cluster, path, field, or proximity is the true value, importance, relationship, or existence phase of a note.

### 3. The world persists; the camera observes it

Positions, velocity, density, and wakes belong to a common world coordinate system. The camera has its own continuous position, orientation, lens, and velocity state. An event changes forces inside the world; it does not replace the camera coordinate frame.

The first proof only needs a sparse 3D field or a bounded stack of depth layers, not a general game engine. Depth must be conveyed by at least parallax, occlusion, focus/extinction, and passage through material—not by point size alone.

Continuity is an invariant of state, not an easing effect. Cue boundaries may change only forces and temporal envelopes. They may not replace the world origin, seed, camera transform, or existing feature identities; they may not re-center or reinitialize the field. The proof records stable feature IDs and camera position/orientation/velocity before, during, and after each cue boundary. A coordinate or pose step outside the predeclared integrator bounds is a failure even when the pixels look smooth.

### 4. Replace global chapters with overlapping temporal voices

Use three asynchronous clocks:

- **archive climate**: minutes to tens of minutes; density regime, open space, field scale;
- **encounter envelopes**: roughly 45–180 seconds; source-backed emergence, convergence, rupture, recurrence;
- **micro-life**: seconds; flicker, curl, local exchange, dissipation.

No clock resets the others. Cues overlap with attack, sustain, release, and cooldown. The work opens at a deterministic point in an already-running archive time, so it does not begin from a blank screen or replay an overture on every visit.

### 5. Provenance is backstage, not a caption

The immersive image has no persistent caption, note-name hover, legend, score name, or visible controls. A deliberate source-lens action can pause or soften the work and open a separate receipt surface. Exit returns to the previous workspace. Reduced motion produces a composed still state with the same provenance, not a slowed animation.

## Foundation architecture

```text
Markdown Vault (source of truth)
        |
        v
Read-only observation in existing TypeScript core
        |
        v
Archive Score compiler (pure TypeScript)
  - snapshot digest + seed
  - overlapping temporal envelopes
  - contributor weights and limitations
  - provenance receipt
        |
        v
Persistent world-coordinate state
  - sparse xyz or bounded depth-layer coordinates
  - velocity / density / residual history
  - camera pose independent from cue replacement
        |
        v
Direct WebGL2 + small GLSL passes (first proof)
  - witness lights
  - field deposition and advection
  - filament / membrane / void material
  - depth, occlusion, extinction, restrained bloom
        |
        v
Full-window immersive React surface in the existing Electron window
  - shell visually absent
  - Escape / explicit return
  - separate source receipt
```

The first product seam can still be implemented internally as a `life-weather` workspace state so it reuses save-flush, current snapshot, focus return, and error handling. “Workspace state” is lifecycle only: while active, the activity rail, header, sidebars, and tab bar are hidden and the work covers the existing `BrowserWindow` client area. It is not OS fullscreen and not a second window. `Escape` and a focus-revealed return control restore the exact previous workspace tab and focus target. A second frameless `BrowserWindow`, background daemon, separate application, database, or new IPC surface is not justified yet.

## Language and rendering decision

| Candidate | What it would solve now | Cost / unresolved boundary | Result |
| --- | --- | --- | --- |
| TypeScript + Canvas 2D | Existing fallback, tests, reduced-motion still | Does not naturally support the desired field/material headroom | Keep as fallback/reference |
| **TypeScript + direct WebGL2/GLSL** | Reuses the working isolated renderer, custom passes, current Electron support, no dependency | Manual camera/pass discipline; performance still must be measured | **First proof** |
| TypeScript + raw WebGPU/WGSL | Compute and storage buffers can support denser or 3D fields | Actual art/frame advantage unmeasured; a second pipeline must be maintained | Measured next candidate |
| Three.js WebGPURenderer / TSL | Scene camera, materials, WebGPU-to-WebGL2 fallback | New dependency; renderer remains experimental; current raw shaders/postprocessing require migration | Do not add to first proof |
| Rust/WASM + wgpu | Useful only for a measured CPU bottleneck or a deliberate native runtime | Same browser GPU gates plus build/interop cost; no provenance or beauty advantage | Reject now |
| Native engine / sidecar | Maximum runtime independence | New process, IPC, window embedding, packaging, recovery, and two-app feel | Reject now |

The hidden Electron capability probe confirmed both WebGL2 and WebGPU, including adapter/device creation and a replacement device after intentional loss. That makes WebGPU a credible option, not a necessary one. Selection requires the same Living Archive Field snapshot, seed, archive time, score, canvas/DPR, and perceptual protocol on both paths; API novelty is not evidence.

Official platform evidence: [Electron 43.2.0 embeds Chromium 150](https://releases.electronjs.org/release/v43.2.0); [Chrome documents WebGPU graphics and compute support on supported Windows devices](https://developer.chrome.com/blog/webgpu-release); [the WebGPU specification defines separate compute and render pipelines](https://www.w3.org/TR/webgpu/); [Three.js documents both its fallback and its experimental/migration boundaries](https://threejs.org/manual/en/webgpurenderer).

## Keep, retire, and hold

### Keep

- Existing read-only note observations, multi-axis phase signatures, deterministic seed, source-backed phenomena, and provenance limitations.
- The privacy-safe snapshot route and Markdown source of truth.
- Pause, visibility, unmount, reduced-motion, empty-state, and failure cleanup contracts.
- Direct shader control and the in-app browser as the stable review surface.

### Retire from the artwork foundation

- `one logical note = one always-visible point`.
- Fixed 90-second global movement loop as the long-form clock.
- Event pair replacement as the camera target.
- Screen-space afterimage as the authoritative world history.
- Persistent caption, hover note labels, and visible control strip on the viewing surface.
- “cosmos” as permission to default to a star field.

### Hold until evidence exists

- WebGPU production backend, Three.js, Rust/WASM, native sidecar, separate window, audio, AI semantic interpretation, exported video, and background simulation.

## Strongest counterarguments

1. **The new contributor model may hide the personal archive more, not less.** If material forms become beautiful but interchangeable across matched Vaults, the change fails. The proof must compare source conditions and expose a receipt without putting explanation on the artwork.
2. **WebGL2 may encourage another patch on the old prototype.** The first proof must replace its world/time contracts, not merely add denser fog or bloom. Reusing an API does not mean preserving the current composition model.
3. **A full-window mode may be theatrical without being necessary.** It remains in the same BrowserWindow and has a simple escape path; a child window is held until owner observation proves that OS-level separation adds value.
4. **Twelve minutes can become slow rather than sustained.** The score must show local activity throughout and at least three macro-composition changes without a visible chapter cut.

## Recommendation boundary

Proceed only with the isolated art proof described in [`vertical-slice.md`](vertical-slice.md), and pre-register its provenance, continuity, blind-viewing, and frame-budget protocol before rendering. Do not yet wire product source, install a dependency, update production, or deliver Git. The product/runtime choice returns to the owner after the new representation has survived the visual, causal, continuity, and twelve-minute gates.
