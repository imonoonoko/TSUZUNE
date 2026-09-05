# D — Current path and Electron GPU evidence

## Current display path

Current product source follows this route:

```text
Markdown Vault
  -> main-process Vault snapshot and watcher
  -> sandboxed preload API
  -> React App snapshot / visible graph
  -> ordinary observatory workspace tab
  -> ObservatoryView
  -> CPU simulation + Canvas 2D
```

The separate artwork at `work/archive-weather-prototype/` does not cross that product seam. It uses a privacy-safe snapshot, a JavaScript note system, a 90-second repeating score, a 48 x 30 CPU memory field, and direct WebGL2/GLSL rendering.

## Live artwork observation

Observed through the already-open Codex in-app browser at `http://127.0.0.1:4174/` on 2026-09-04:

- Canvas: 795 x 698 CSS/device pixels at the observed browser scale.
- Live state: 599 particles, 48 x 30 flow texture, WebGL error `0`.
- First sampled state: simulation time 3426.33, movement `ignition`, event stages `capture,rupture`, memory activity 0.748696.
- Fifteen seconds later: simulation time 3530.72, movement `rupture`, event stages `rupture,capture`, memory activity 0.737865.
- The composition center moved from `0.7952,0.6163` to `0.9372,0.6866`; the program was alive and changing.
- In both views, the dominant first reading remained sparse white points on black. The flow, field history, material transformation, and Vault-specific cause were too faint to carry the image without explanation.

The renderer therefore passes a liveness check while failing to demonstrate that the renderer API or simulation speed is the primary artistic bottleneck.

## Verified spatial limitation

The current isolated vertex shader receives `vec2 aPosition` plus one scalar `depth`. Perspective, point size, light level, and parallax are derived from that scalar before the result is written directly to clip space (`work/archive-weather-prototype/prototype.mjs:52-99`). Its history buffer is a screen-sized 2D texture reprojected between changing composition frames (`prototype.mjs:192-236`, `561-637`). This is a coherent 2.5D effect, but it is not a persistent three-dimensional world through which one camera travels.

The score also has a fixed `ART_DURATION = 90`, five global movements, and two event lanes (`work/archive-weather-prototype/note-model.mjs:182-218`, `463-553`). The active events determine the display composition target (`prototype.mjs:447-458`). Smoothing the target removes a positional snap, but the camera grammar still follows event replacement rather than observing one persistent world.

## Electron 43 capability receipt

Command:

```powershell
node_modules/.bin/electron.cmd .agent/requirements/20260904-life-weather-foundation-review/experiments/electron-gpu-capability.mjs
```

Observed in a hidden, sandboxed Electron renderer loaded from the local prototype URL:

- Electron 43.2.0 / Chromium 150.0.7871.129.
- Secure context: true.
- WebGL2 context: available.
- Required current-prototype float support: `EXT_color_buffer_float` and `OES_texture_float_linear` available.
- WebGPU: available; adapter and device creation succeeded.
- Selected limits: 2 GiB maximum buffer, 1024 compute invocations per workgroup, 16384 maximum 2D texture dimension, 2048 maximum 3D texture dimension.
- Intentional device destruction produced the expected `destroyed` loss result; requesting a fresh adapter and replacement device succeeded.

This proves only that WebGPU can be explored on this PC in the current Electron runtime. It does not prove frame-time superiority, visual superiority, production recovery, or packaged-runtime parity.

## Parent conclusion

The current bottleneck order is:

1. representation contract;
2. temporal and camera grammar;
3. presentation surface;
4. material renderer structure;
5. only then rendering API and implementation language.

Changing language before the first four would preserve the same artwork at a higher engineering cost.

