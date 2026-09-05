# Packet 01: header action trace

- Objective: Map every current header item to its handler, state, dialog, shortcut, test, and user-visible failure state.
- Ownership: Read-only `src/renderer/App.tsx`, related components/styles, renderer tests.
- Do: Identify the smallest reuse path for relocating each entry point.
- Do not: Edit files, propose new backend behavior, change TSUZUNE or Git state.
- Expected output: Evidence table, coupling risks, unseen boundary checks.
