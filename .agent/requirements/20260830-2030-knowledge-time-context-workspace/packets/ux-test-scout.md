# Packet: UX and test scout

- objective: Define public-behavior tests and a compact acceptance matrix for the approved workspace.
- ownership: renderer/main test suites and accessibility/UX evidence; read-only inspection only.
- forbidden: file edits, implementation, snapshot-only acceptance, internal-state-only tests.
- source of truth: `../plan.md` and existing test conventions.
- acceptance: name the best test files/helpers, give the first expected RED test, cover default/loading/empty/error/long/keyboard/responsive/source-open, and identify one no-write proof.
- unseen boundary check: look for stale async results, focus loss, duplicate labels, overlay trapping, and renderer trust of arbitrary paths.
- stop/escalation: return any security or data-loss risk immediately.

