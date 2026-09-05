# Packet: Context path scout

- objective: Identify the exact existing Context Compiler / Temporal Memory entrypoints and the smallest trusted read-only renderer exposure.
- ownership: `src/core/context.ts`, `src/core/temporal.ts`, related main/preload/shared declarations and tests; read-only inspection only.
- forbidden: file edits, production TSUZUNE writes, new APIs or redesign proposals outside the accepted workspace.
- source of truth: `../plan.md` and current repository implementation.
- acceptance: report exact symbols/files/call flow, current input/output shapes, existing limits/warnings/omissions, reusable tests, and the smallest safe IPC seam.
- unseen boundary check: identify any field that appears in core output but is lost before renderer, and any future-leakage or path-safety risk.
- stop/escalation: stop if required behavior would mutate notes, bypass context limits, or require a new dependency/runtime.

