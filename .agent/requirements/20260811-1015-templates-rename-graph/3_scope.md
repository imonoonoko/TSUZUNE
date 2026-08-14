# Scope

## In scope

- `src/core/templates.ts` built-in template definitions and deterministic merge with Vault templates.
- `src/renderer/App.tsx` template selection and rename-dialog state/submit wiring.
- one small `RenameDialog` renderer component and existing modal styles only if required.
- `src/renderer/components/WikiGraphView.tsx` compact zoom-out, fit, and zoom-in controls using existing graph state.
- focused core, renderer, and app safety regressions.

## Out of scope

- automatic template files, template editing UI, AI classification, or a template database;
- changing rename/link/path-alias semantics, force-overwrite behavior, or backend IPC;
- full Obsidian graph parity, new layout algorithms, graph persistence schema, or OS automation;
- Context/MCP envelope changes or title filtering. Those remain a separate recall-safe optimization track.
