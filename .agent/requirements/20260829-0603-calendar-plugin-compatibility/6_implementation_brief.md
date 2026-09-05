# Calendar Plugin Compatibility Implementation Brief

## Existing Patterns
- Manifest scanner: `src/main/obsidian-plugins.ts`
- Trusted IPC/preload: `src/main/ipc.ts`、`src/preload/index.ts`、`src/shared/types.ts`
- Native comparison UI: `src/renderer/components/DailyCalendar.tsx`
- Existing host flows: note open/create、workspace tabs、Settings、Command Palette in `src/renderer/App.tsx`
- Theme: `src/renderer/styles.css` and `DESIGN.md`

## Likely Touch Points
- Exact artifact verifier and bounded reader under `src/main/`。
- Shared compatibility types and narrow trusted IPC。
- Target-specific runtime/shim and Calendar host component under `src/renderer/`。
- Existing Settings and command registry integration。
- Fixture with official release artifact hash and conformance tests。

## Technical Assumptions
- Target is stable tag 1.5.10 commit `7d2aebda7f4a280bedc6da6d25f4da611d1625ef`。
- `require("obsidian")` is satisfied by a target-specific shim; no Node module loader is exposed to plugin code。
- TSUZUNE adapters own filesystem operations; plugin receives only bounded TFile-like objects and event APIs。
- Existing dependencies and browser DOM are sufficient unless RED evidence disproves it。

## Risks
- Executing third-party JS can reach renderer globals unless execution is tightly fixed and audited。
- Upstream Svelte DOM assumptions may differ from TSUZUNE React lifecycle。
- Daily/weekly note template semantics and Moment locale can drift。
- Current dirty worktree has overlapping App/CSS changes and must be preserved。

## Test Plan
- Parse compiled official artifact to inventory imports/global/API calls。
- Unit tests for artifact identity, fail-closed paths, lifecycle cleanup, event adapter, settings persistence。
- Conformance tests for every README feature and setting with fixed Vault fixture。
- UI tests for keyboard, focus, accessible names, 720/900/1440 widths and dark theme。
- Full `npm run typecheck`、`npm test`、`npm run check:mcp`、build、`git diff --check`。
- Isolated packaged/installed smoke and `npm run production:update` only after app is closed。

## Open Questions
- Whether official release `styles.css` differs from tag source。
- Whether a sandboxed iframe or audited renderer function host is the smaller safe runtime after compiled artifact inspection。

