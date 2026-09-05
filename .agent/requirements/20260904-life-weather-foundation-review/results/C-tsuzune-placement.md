# C — TSUZUNE placement audit (current checkout, 2026-09-04)

## Current truth

- LIFE Weather is presently a **pure renderer/core derivation**, not a product screen or an Electron feature. `createLifeWeatherObservations(notes, graph)` derives per-note time, content, link, structure, and phase inputs from the already-loaded `NoteDocument[]` and `WikiGraph` ([src/core/life-weather.ts:164-200](../../../../src/core/life-weather.ts#L164-L200)); `createLifeWeatherProfile` makes bounded candidate lists and returns explicit limitations, including that the result is a local observation rather than `存在相そのもの` ([src/core/life-weather.ts:360-388](../../../../src/core/life-weather.ts#L360-L388)). No `LifeWeatherProfile` crosses preload, IPC, or main-process boundaries.
- The closest shipped placement is the renderer-only `observatory` workspace tab. Its union type is `note | attachment | linked-view | global-graph | observatory` ([src/renderer/components/WorkspaceTabBar.tsx:7-25](../../../../src/renderer/components/WorkspaceTabBar.tsx#L7-L25)); the activity rail opens one reusable tab ([src/renderer/App.tsx:3418-3428](../../../../src/renderer/App.tsx#L3418-L3428)), and the command palette exposes the same route ([src/renderer/App.tsx:3108-3114](../../../../src/renderer/App.tsx#L3108-L3114)).
- `ObservatoryView` already consumes the appropriate in-memory boundary: filtered `visibleGraph` and `graphNotes`, then opens a chosen note through the existing `openNote` callback ([src/renderer/App.tsx:3725-3732](../../../../src/renderer/App.tsx#L3725-L3732)). It is intentionally a one-canvas, zero-edge particle observation, not a general LIFE Weather artwork ([src/renderer/components/ObservatoryView.tsx:523-624](../../../../src/renderer/components/ObservatoryView.tsx#L523-L624)).
- Electron currently creates one normal, sandboxed main window with the shared preload ([src/main/index.ts:92-106](../../../../src/main/index.ts#L92-L106)). The only child-window route is an attachment image preview: it reads a vault image into a `data:` page, has no preload, disables navigation/window opening, and is tracked separately ([src/main/index.ts:62-89](../../../../src/main/index.ts#L62-L89)). It is not a reusable immersive-window foundation.

## Observed call path and data boundary

```text
VaultService snapshot / watcher
  -> preload `window.tsuzune` typed IPC
  -> App snapshot state
  -> graphNotes + visibleGraph
  -> workspace tab dispatch
  -> ObservatoryView
  -> createLifeWeatherObservations(notes, graph)
  -> createObservatoryField(graph, { observations }) -> Canvas 2D
  -> selected particle -> existing openNote(path)
```

`TsuzuneApi` exposes vault snapshots and narrowly typed commands ([src/shared/types.ts:354-414](../../../../src/shared/types.ts#L354-L414)); its preload implementation only bridges those registered channels ([src/preload/index.ts:39-75](../../../../src/preload/index.ts#L39-L75)). Therefore a first LIFE Weather slice can remain renderer-local: it needs neither a new IPC channel nor a persistent database, and must not widen the Markdown/Vault write surface.

The workspace loader already flushes a pending note save before switching, clears note/attachment/linked-view state for `observatory`, and uses the vault graph ([src/renderer/App.tsx:2063-2081](../../../../src/renderer/App.tsx#L2063-L2081)). The analogous LIFE Weather route should preserve this safety behavior, rather than opening a second source of truth or a separate Vault scan.

## Placement matrix

| Placement | What it reuses | What it costs / fails to solve | Decision |
| --- | --- | --- | --- |
| Extend the existing **Observatory tab** | Existing activity-rail/command route, tab accessibility, renderer data, note return path, Canvas lifecycle | Keeps LIFE Weather visually and conceptually coupled to the current particle-only “observatory”; its ordinary workspace chrome and side panels can still make a work of contemplation feel like a tool view | Useful control and fallback, but not the primary artwork placement |
| New **LIFE Weather immersive workspace tab** in the same main window | Same snapshot/graph boundary, tab loader, save flush, preload/main security posture, existing note opening | Requires one new tab kind plus a renderer-owned presentation mode and exit/return behavior; no background work or persistence is justified in the first slice | **Recommend** |
| Dedicated frameless child `BrowserWindow` | Electron can create a second window; attachment-window security conventions are inspectable | Requires a new main/preload/IPC contract or safe boot payload, window ownership/close/reopen/focus rules, custom accessible close affordance, and a packaged/installed multi-window acceptance path. Existing attachment child is static data-URL HTML, not the React app | Hold until the same-window slice proves that OS-level separation is necessary |
| External or standalone LIFE Weather app | Maximum visual separation | Breaks the immediate return to a note, duplicates data transport/runtime/installation, and conflicts with the current one-device local product boundary without solving a demonstrated in-app limit | Reject for this work item |

## Recommendation

Adopt a **new `life-weather` workspace tab with an immersive renderer mode inside the existing main window**. It is not a graph tab with decoration: it owns the central panel while invoked from the existing activity rail/command palette, uses only a quiet, explicit return affordance, and returns to the prior workspace tab or an evidence note. The ordinary tab bar may remain as the reliable escape hatch in the first vertical slice; sidebars, headers, and tool controls should be visually absent or collapsed while the work is active, but not destroyed or globally reconfigured.

This is the smallest credible placement that gives the work a whole surface without prematurely adding a window lifecycle. It preserves the immediate “encounter -> open the underlying note -> return” loop already evidenced by the Observatory acceptance harness ([scripts/run-observatory-acceptance.mjs:154-200](../../../../scripts/run-observatory-acceptance.mjs#L154-L200)). It also keeps the initial claim modest: a renderer-local interpretation of the loaded Vault, not an authoritative new data model.

## Minimum integration seam (proposal, not implemented)

1. Add `life-weather` as a sibling workspace-tab kind and a single opener, patterned after `openObservatoryWorkspace` ([src/renderer/App.tsx:2137-2152](../../../../src/renderer/App.tsx#L2137-L2152)). Route it through the existing `loadWorkspaceTab` save-flush boundary.
2. Render a dedicated `LifeWeatherView` only when that tab is active. Pass `graph={visibleGraph}`, `notes={graphNotes}`, and `onOpen={openNote}` exactly as the Observatory boundary does; derive `LifeWeatherProfile` inside the renderer from that snapshot. Do not expose profile creation via preload, IPC, settings, watcher, or persistent storage in this slice.
3. Keep entrance and exit local and keyboard-accessible: an explicit “戻る” control plus `Escape` returns focus to the previous workspace tab; selecting an evidence note calls the existing `openNote`. If no prior tab exists, exit returns to the normal workspace without fabricating a tab.
4. Treat insufficient data, an exception while deriving/rendering, and an unavailable advanced renderer as honest states: show a static, readable explanation and the existing return control. Do not synthesize weather from absent notes, write diagnostic content to the Vault, or leave an animation loop running.

## Lifecycle, motion, and accessibility boundary

- The current Observatory already honors `prefers-reduced-motion`, document visibility, user pause, resize, and unmount cleanup: it suppresses animation when reduced/background/paused ([src/renderer/components/ObservatoryView.tsx:375-382](../../../../src/renderer/components/ObservatoryView.tsx#L375-L382)), attaches/removes the visibility listener ([src/renderer/components/ObservatoryView.tsx:434-438](../../../../src/renderer/components/ObservatoryView.tsx#L434-L438)), and cancels its single animation frame on cleanup ([src/renderer/components/ObservatoryView.tsx:444-482](../../../../src/renderer/components/ObservatoryView.tsx#L444-L482)). LIFE Weather must retain at least those conditions, with a static reduced-motion composition rather than merely slowing an effect.
- The present Canvas is keyboard reachable and supports pointer, arrows, Enter/Space, and Escape ([src/renderer/components/ObservatoryView.tsx:539-593](../../../../src/renderer/components/ObservatoryView.tsx#L539-L593)). The new view needs equivalent focus order, text alternatives/evidence labels, and a non-canvas failure/return path. A frameless window would add OS-close and focus-return accessibility obligations that this route avoids.
- Switching away from a conditional workspace view unmounts it; that is the appropriate first-slice pause/cleanup boundary. Do not add a hidden always-running scene or a background worker merely to preserve continuity.

## Acceptance and production boundary

- Existing source acceptance is meaningful but scoped: `tests/observatory-view.test.tsx` covers pause/resume/visibility/unmount ([tests/observatory-view.test.tsx:197-229](../../../../tests/observatory-view.test.tsx#L197-L229)) and reduced motion ([tests/observatory-view.test.tsx:305-319](../../../../tests/observatory-view.test.tsx#L305-L319)); the Electron harness exercises an isolated Vault and visible particle interaction. A LIFE Weather slice needs a parallel renderer test for entry/exit, reduced-motion/static fallback, empty/error behavior, and `onOpen`, plus an isolated packaged smoke that reaches the new tab. It must not use the production Vault as fixture data.
- Any product implementation changes fingerprinted source and therefore is not “本番反映済み” until `npm run production:update` completes. That gate typechecks, runs production tests and MCP checks, packages, executes packaged and installed smoke checks, verifies executable/`app.asar` hashes, preserves the production profile, and refreshes MCP registration ([scripts/update-production.mjs:25-49](../../../../scripts/update-production.mjs#L25-L49), [scripts/update-production.mjs:267-343](../../../../scripts/update-production.mjs#L267-L343)). This audit itself changed no product artifact and requires no production update.

## Unknowns / stop conditions

- The current source proves a Canvas 2D Observatory route, not the rendering API selected for LIFE Weather; rendering capability, frame budget, and the artwork’s exact temporal grammar remain for the rendering and artwork packets.
- Current tests show source/isolated Electron behavior; this audit did not run a packaged or installed runtime and makes no parity claim.
- It is unproven whether persistent “last immersive state,” cross-window display, or an OS-level frameless experience produces enough artistic gain to justify the added lifecycle/acceptance surface. Do not add them until the same-window vertical slice is viewed and fails its artistic success condition.
- Production TSUZUNE retrieval tools were not available in this task environment; no Vault note was read or written. All current-truth claims above are live-checkout observations, not historical documentation.
